// Telegram Orqa Fon Tozalash Boti
// Foydalanuvchi yuborgan rasmlarni qabul qilib, orqa fonini olib tashlaydi

const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");
const sharp = require("sharp");
const dotenv = require("dotenv");
const { v4: uuidv4 } = require("uuid");
const mongoose = require("mongoose");

// .env faylidan konfiguratsiya ma'lumotlarini o'qiymiz
dotenv.config();

// Bot tokeni va RemoveBG API kaliti
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const REMOVEBG_API_KEY = process.env.REMOVEBG_API_KEY;

// MongoDB ulanish URL
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/bg-remover-bot";

// Xatolik bo'lsa dasturni to'xtatish
if (!TELEGRAM_BOT_TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN aniqlanmadi. .env faylini tekshiring!");
  process.exit(1);
}

if (!REMOVEBG_API_KEY) {
  console.error("REMOVEBG_API_KEY aniqlanmadi. .env faylini tekshiring!");
  console.warn("Bot cheklangan rejimda ishlaydi!");
}

// Bot yaratamiz
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// Kataloglarni sozlaymiz
const DOWNLOADS_DIR = path.join(__dirname, "downloads");
const OUTPUTS_DIR = path.join(__dirname, "outputs");

// Kataloglarni tekshirib, yo'q bo'lsa yaratamiz
[DOWNLOADS_DIR, OUTPUTS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Statistika uchun MongoDB sxemasi
const statsSchema = new mongoose.Schema({
  userId: { type: Number, required: true },
  username: String,
  processedImages: { type: Number, default: 0 },
  lastActive: { type: Date, default: Date.now },
});

const userSchema = new mongoose.Schema({
  userId: { type: Number, required: true, unique: true },
  username: String,
  firstName: String,
  lastName: String,
  registeredAt: { type: Date, default: Date.now },
  totalProcessed: { type: Number, default: 0 },
  lastActive: { type: Date, default: Date.now },
  selectedBackground: { type: String, default: "transparent" },
});

const imageLogSchema = new mongoose.Schema({
  userId: { type: Number, required: true },
  originalFileId: String,
  processedFileId: String,
  processedAt: { type: Date, default: Date.now },
  processingTime: Number, // millisekundlarda
  success: Boolean,
  errorMessage: String,
});

// Modellar
const Stats = mongoose.model("Stats", statsSchema);
const User = mongoose.model("User", userSchema);
const ImageLog = mongoose.model("ImageLog", imageLogSchema);

// MongoDB ga ulanamiz
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("MongoDB ga muvaffaqiyatli ulandi!"))
  .catch((err) => {
    console.error("MongoDB ga ulanishda xatolik:", err);
    console.warn("Bot statistikasiz rejimda ishlaydi!");
  });

// Bot ma'lumotlarini o'rnatamiz
bot.setMyCommands([
  { command: "/start", description: "Botni ishga tushirish" },
  { command: "/help", description: "Yordam olish" },
  { command: "/stats", description: "Statistikani ko'rish" },
  { command: "/background", description: "Orqa fon turini tanlash" },
]);

// /start komandasi bilan botni ishga tushirish
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username || "";
  const firstName = msg.from.first_name || "";
  const lastName = msg.from.last_name || "";

  // Foydalanuvchini bazaga saqlash
  try {
    await User.findOneAndUpdate(
      { userId: msg.from.id },
      {
        userId: msg.from.id,
        username,
        firstName,
        lastName,
        lastActive: new Date(),
      },
      { upsert: true }
    );
  } catch (error) {
    console.error("Foydalanuvchini saqlashda xatolik:", error);
  }

  const message = `👋 Assalomu alaykum, ${firstName}!

🎯 Men rasmlarning orqa fonini tozalab beruvchi botman.

📤 Menga istalgan rasm yuboring, men uni orqa fonidan tozalab, shaffof (.png) formatda qaytaraman.

✅ Qo'llab-quvvatlanadigan formatlar: JPG, PNG, WEBP

⚙️ Qo'shimcha imkoniyatlar:
- /background - orqa fon turini tanlash
- /stats - statistikani ko'rish
- /help - yordam olish

📷 Hoziroq rasm yuborishni boshlang!`;

  await bot.sendMessage(chatId, message);
});

// /help komandasi
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;

  const message = `🆘 <b>Botdan foydalanish yo'riqnomasi</b>

1️⃣ <b>Rasmni yuborish:</b>
   - Oddiy rasm yuboring
   - Siqilgan (compressed) rasm yuboring
   - Fayl sifatida yuboring

2️⃣ <b>Orqa fon tozalash:</b>
   - Bot avtomatik ravishda orqa fonni aniqlaydi va olib tashlaydi
   - Natija .png formatida qaytariladi (shaffof)

3️⃣ <b>Orqa fon turlari:</b>
   - /background - orqa fon turini tanlash:
     • Shaffof (standart)
     • Oq
     • Tabiiy
     • Ofis

🔍 <b>Qo'shimcha:</b>
   - /stats - foydalanish statistikasi
   - /help - ushbu yordam xabari

⚠️ <b>Muammolar bo'lsa:</b>
   - Rasmni boshqa formatda yuboring
   - Rasmning aniqligi pastroq bo'lsa, sinab ko'ring

💡 <b>Maslahat:</b> Eng yaxshi natija uchun obyekt va fon o'rtasidagi kontrast yuqori bo'lgan rasmlardan foydalaning.`;

  await bot.sendMessage(chatId, message, { parse_mode: "HTML" });
});

// /stats komandasi
bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    // Foydalanuvchi statistikasi
    const user = await User.findOne({ userId: msg.from.id });

    // Umumiy statistika
    const totalUsers = await User.countDocuments();
    const totalImages = await ImageLog.countDocuments({ success: true });
    const todayImages = await ImageLog.countDocuments({
      processedAt: { $gte: new Date().setHours(0, 0, 0, 0) },
      success: true,
    });

    let message = `📊 <b>Statistika</b>\n\n`;

    if (user) {
      message += `👤 <b>Sizning statistikangiz:</b>\n`;
      message += `• Qayta ishlangan rasmlar: ${user.totalProcessed} ta\n`;
      message += `• Ro'yxatdan o'tgan sana: ${user.registeredAt.toLocaleDateString()}\n\n`;
    }

    message += `🌐 <b>Umumiy statistika:</b>\n`;
    message += `• Jami foydalanuvchilar: ${totalUsers} ta\n`;
    message += `• Qayta ishlangan rasmlar: ${totalImages} ta\n`;
    message += `• Bugungi qayta ishlashlar: ${todayImages} ta`;

    await bot.sendMessage(chatId, message, { parse_mode: "HTML" });
  } catch (error) {
    console.error("Statistikani olishda xatolik:", error);
    await bot.sendMessage(
      chatId,
      "⚠️ Statistikani olishda xatolik yuz berdi. Iltimos, keyinroq qayta urinib ko'ring."
    );
  }
});

// /background komandasi - orqa fon turini tanlash
bot.onText(/\/background/, async (msg) => {
  const chatId = msg.chat.id;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "🔍 Shaffof", callback_data: "bg_transparent" },
        { text: "⬜ Oq", callback_data: "bg_white" },
      ],
      [
        { text: "🌄 Tabiiy", callback_data: "bg_nature" },
        { text: "🏢 Ofis", callback_data: "bg_office" },
      ],
    ],
  };

  await bot.sendMessage(chatId, "🎨 Iltimos, orqa fon turini tanlang:", {
    reply_markup: keyboard,
  });
});

// Orqa fon tanlash uchun callback
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data.startsWith("bg_")) {
    const background = data.replace("bg_", "");

    try {
      await User.findOneAndUpdate(
        { userId: query.from.id },
        { selectedBackground: background }
      );

      let messageText = "✅ ";

      switch (background) {
        case "transparent":
          messageText += "Shaffof orqa fon tanlandi.";
          break;
        case "white":
          messageText += "Oq orqa fon tanlandi.";
          break;
        case "nature":
          messageText += "Tabiiy orqa fon tanlandi.";
          break;
        case "office":
          messageText += "Ofis orqa foni tanlandi.";
          break;
        default:
          messageText += "Shaffof orqa fon tanlandi.";
      }

      await bot.answerCallbackQuery(query.id, { text: "Tanlandi!" });
      await bot.editMessageText(messageText, {
        chat_id: chatId,
        message_id: query.message.message_id,
      });
    } catch (error) {
      console.error("Orqa fon turini o'zgartirishda xatolik:", error);
      await bot.answerCallbackQuery(query.id, { text: "Xatolik yuz berdi!" });
    }
  }
});

// Rasmlarni qayta ishlash
bot.on("photo", async (msg) => {
  await processImage(msg);
});

// Fayl sifatida yuborilgan rasmlarni ham qabul qilish
bot.on("document", async (msg) => {
  const mimeType = msg.document.mime_type || "";
  const supportedFormats = ["image/jpeg", "image/png", "image/webp"];

  if (supportedFormats.includes(mimeType)) {
    await processImage(msg, true);
  } else {
    await bot.sendMessage(
      msg.chat.id,
      "⚠️ Qo'llab-quvvatlanmaydigan fayl formati. Iltimos, JPG, PNG yoki WEBP formatidagi rasm yuboring."
    );
  }
});

// Noto'g'ri turdagi kontentga javob
bot.on(
  ["audio", "voice", "video", "video_note", "contact", "location", "sticker"],
  async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(
      chatId,
      "⚠️ Bu turdagi kontent qo'llab-quvvatlanmaydi. Iltimos, JPG, PNG yoki WEBP formatidagi rasm yuboring."
    );
  }
);

/**
 * Rasmni qayta ishlash
 * @param {Object} msg - Telegram xabar obyekti
 * @param {Boolean} isDocument - Rasm fayl sifatida yuborilganmi
 */
async function processImage(msg, isDocument = false) {
  const chatId = msg.chat.id;
  const startTime = Date.now();
  let originalFileId = "";
  let downloadPath = "";
  let outputPath = "";
  let processingMsg = null;

  try {
    // Jarayon boshlanganligi haqida xabar
    processingMsg = await bot.sendMessage(
      chatId,
      "🔄 Rasmni qayta ishlash boshlandi..."
    );

    // Foydalanuvchi ma'lumotlarini yangilash
    try {
      await User.findOneAndUpdate(
        { userId: msg.from.id },
        { lastActive: new Date() }
      );
    } catch (err) {
      console.warn("Foydalanuvchi ma'lumotlarini yangilashda xatolik:", err);
    }

    // Fayl ID va uni yuklab olish
    if (isDocument) {
      originalFileId = msg.document.file_id;
      const fileInfo = await bot.getFile(originalFileId);
      const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileInfo.file_path}`;

      const fileExt = path.extname(fileInfo.file_path) || ".jpg";
      downloadPath = path.join(DOWNLOADS_DIR, `${uuidv4()}${fileExt}`);
      outputPath = path.join(OUTPUTS_DIR, `${uuidv4()}.png`);

      // Rasmni yuklab olish
      await downloadFile(fileUrl, downloadPath);
    } else {
      // Eng katta o'lchamdagi rasmni olish
      const photoArray = msg.photo;
      const photo = photoArray[photoArray.length - 1];
      originalFileId = photo.file_id;

      const fileInfo = await bot.getFile(originalFileId);
      const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileInfo.file_path}`;

      downloadPath = path.join(DOWNLOADS_DIR, `${uuidv4()}.jpg`);
      outputPath = path.join(OUTPUTS_DIR, `${uuidv4()}.png`);

      // Rasmni yuklab olish
      await downloadFile(fileUrl, downloadPath);
    }

    // Foydalanuvchi fon turini olish
    let background = "transparent";
    try {
      const user = await User.findOne({ userId: msg.from.id });
      if (user && user.selectedBackground) {
        background = user.selectedBackground;
      }
    } catch (err) {
      console.warn("Foydalanuvchi fon turini olishda xatolik:", err);
    }

    // Orqa fonni olib tashlash va qayta ishlash
    await bot.editMessageText("🔄 Orqa fonni tozalash jarayoni...", {
      chat_id: chatId,
      message_id: processingMsg.message_id,
    });

    // RemoveBG API yordamida orqa fonni tozalash
    await removeBackground(downloadPath, outputPath, background);

    // Natija rasmni yuborish
    await bot.editMessageText("✅ Rasm tayyorlandi! Yuborilmoqda...", {
      chat_id: chatId,
      message_id: processingMsg.message_id,
    });

    const processedFileId = await sendProcessedImage(chatId, outputPath);

    // Statistikani yangilash
    const processingTime = Date.now() - startTime;

    try {
      // Foydalanuvchi statistikasini yangilash
      await User.findOneAndUpdate(
        { userId: msg.from.id },
        { $inc: { totalProcessed: 1 } }
      );

      // Rasm qayta ishlash logini saqlash
      await new ImageLog({
        userId: msg.from.id,
        originalFileId,
        processedFileId,
        processingTime,
        success: true,
      }).save();
    } catch (err) {
      console.warn("Statistikani yangilashda xatolik:", err);
    }

    // Jarayon yakunlanganligi haqida xabar
    await bot.editMessageText("✅ Orqa fon muvaffaqiyatli tozalandi!", {
      chat_id: chatId,
      message_id: processingMsg.message_id,
    });

    // Fayllarni tozalash
    cleanupFiles(downloadPath, outputPath);
  } catch (error) {
    console.error("Rasmni qayta ishlashda xatolik:", error);

    if (processingMsg) {
      await bot.editMessageText(
        "❌ Xatolik yuz berdi. Iltimos, boshqa rasm bilan qayta urinib ko'ring.",
        {
          chat_id: chatId,
          message_id: processingMsg.message_id,
        }
      );
    } else {
      await bot.sendMessage(
        chatId,
        "❌ Xatolik yuz berdi. Iltimos, boshqa rasm bilan qayta urinib ko'ring."
      );
    }

    // Xato logini saqlash
    try {
      await new ImageLog({
        userId: msg.from.id,
        originalFileId,
        processingTime: Date.now() - startTime,
        success: false,
        errorMessage: error.message,
      }).save();
    } catch (err) {
      console.warn("Xato logini saqlashda xatolik:", err);
    }

    // Fayllarni tozalash
    cleanupFiles(downloadPath, outputPath);
  }
}

/**
 * Faylni yuklab olish
 * @param {string} url - Fayl URL manzili
 * @param {string} destinationPath - Saqlash uchun yo'l
 */
async function downloadFile(url, destinationPath) {
  const response = await axios({
    method: "GET",
    url: url,
    responseType: "stream",
  });

  const writer = fs.createWriteStream(destinationPath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

/**
 * Orqa fonni olib tashlash
 * @param {string} inputPath - Kirish rasm yo'li
 * @param {string} outputPath - Chiqish rasm yo'li
 * @param {string} background - Orqa fon turi
 */
async function removeBackground(
  inputPath,
  outputPath,
  background = "transparent"
) {
  // RemoveBG API mavjud bo'lsa, API orqali fonni olib tashlaymiz
  if (REMOVEBG_API_KEY) {
    try {
      const formData = new FormData();
      formData.append("image_file", fs.createReadStream(inputPath));
      formData.append("size", "auto");

      // Orqa fon turi bo'yicha
      switch (background) {
        case "white":
          formData.append("bg_color", "white");
          break;
        case "nature":
          formData.append(
            "bg_image_url",
            "https://images.unsplash.com/photo-1501854140801-50d01698950b"
          );
          break;
        case "office":
          formData.append(
            "bg_image_url",
            "https://images.unsplash.com/photo-1497366811353-6870744d04b2"
          );
          break;
        default:
          formData.append("format", "png"); // Shaffof uchun
      }

      const response = await axios({
        method: "post",
        url: "https://api.remove.bg/v1.0/removebg",
        data: formData,
        responseType: "arraybuffer",
        headers: {
          ...formData.getHeaders(),
          "X-Api-Key": REMOVEBG_API_KEY,
        },
      });

      fs.writeFileSync(outputPath, response.data);
      return;
    } catch (error) {
      console.error("RemoveBG API xatoligi:", error);
      // API xato bersa, mahalliy usulga o'tamiz
    }
  }

  // RemoveBG API mavjud bo'lmasa yoki xato bersa,
  // mahalliy usul: Sharp bilan oddiy segmentatsiya
  // Bu oddiy usul bo'lib, professional natija bermasligi mumkin
  try {
    await sharp(inputPath)
      .ensureAlpha() // Alpha kanalni qo'shish
      .threshold(240) // Oq rangga yaqin piksellarni shaffof qilish
      .toFormat("png")
      .toFile(outputPath);
  } catch (error) {
    console.error("Sharp xatoligi:", error);
    throw new Error("Rasmni qayta ishlashda xatolik yuz berdi.");
  }
}

/**
 * Qayta ishlangan rasmni yuborish
 * @param {number} chatId - Chat ID
 * @param {string} filePath - Fayl yo'li
 * @returns {Promise<string>} - Yuborilgan fayl ID si
 */
async function sendProcessedImage(chatId, filePath) {
  const result = await bot.sendDocument(chatId, filePath, {
    caption: "✅ Orqa foni tozalangan rasm",
  });

  return result.document ? result.document.file_id : "";
}

/**
 * Fayllarni tozalash
 * @param {string} downloadPath - Yuklab olingan fayl yo'li
 * @param {string} outputPath - Chiqish fayl yo'li
 */
function cleanupFiles(downloadPath, outputPath) {
  try {
    if (fs.existsSync(downloadPath)) {
      fs.unlinkSync(downloadPath);
    }

    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
  } catch (error) {
    console.error("Fayllarni tozalashda xatolik:", error);
  }
}

// Xatoliklarni qayd etish
bot.on("polling_error", (error) => {
  console.error("Bot polling xatosi:", error);
});

console.log("Bot ishga tushdi...");
