# 🤖 Telegram Orqa Fon Tozalovchi Bot

Bu Telegram bot foydalanuvchilarning yuborgan rasmlaridan orqa fonni olib tashlaydi va ularni shaffof PNG formatida qaytaradi. Bot `Remove.bg` API yordamida ishlaydi hamda MongoDB orqali foydalanuvchi ma'lumotlari va statistikani saqlaydi.

---

## 📌 Xususiyatlar

- 📤 Rasm yuboring – bot orqa fonni olib tashlaydi.
- 🔄 Fon turini tanlash:
  - `Transparent` (sukut bo'yicha)
  - `White`
  - `Natural`
  - `Office`
- 📊 Statistika va loglar.
- 🧠 MongoDB bilan foydalanuvchini eslab qoladi.

---

## 🧰 Texnologiyalar

- **Node.js** – JavaScript runtime
- **Telegraf** yoki **node-telegram-bot-api** – Telegram bilan ishlash
- **MongoDB + Mongoose** – Ma'lumotlar bazasi
- **remove.bg API** – Orqa fonni olib tashlash
- **Sharp** – Rasmni qayta ishlash
- **Axios** – HTTP so'rovlar
- **FormData** – Fayl uzatish uchun
- **dotenv** – Muhit o'zgaruvchilari

---

## 📦 O'rnatish

```bash
git clone https://github.com/your-username/bg-remover-bot.git
cd bg-remover-bot
npm install
```

`.env` faylini yarating va quyidagilarni kiriting:

```env
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
REMOVEBG_API_KEY=your-removebg-api-key
MONGODB_URI=mongodb://localhost:27017/bg-remover-bot
```

---

## 🚀 Ishga tushirish

```bash
node index.js
```

---

## 📂 Katalog tuzilmasi

```
bg-remover-bot/
├── downloads/       # Yuklab olingan rasm fayllari (tmp)
├── outputs/         # Qayta ishlangan natija fayllari
├── models/          # Mongoose modellari (User.js, ImageLog.js)
├── services/        # Remove.bg, MongoDB, va boshqa servislar
├── .env             # Muhit o'zgaruvchilari
├── index.js         # Botning asosiy kodi
└── README.md        # Hujjat (shu fayl)
```

---

## 🔘 Telegram komandalar

| Buyruq        | Tavsif                                    |
| ------------- | ----------------------------------------- |
| `/start`      | Botni ishga tushirish                     |
| `/help`       | Foydalanish bo'yicha yordam               |
| `/background` | Orqa fon turini tanlash                   |
| `/stats`      | Statistika ko'rish (faqat adminlar uchun) |

---

## 🧠 Ma'lumotlar bazasi modellari

### `User` (foydalanuvchi modeli)

```js
{
  telegramId: String,
  username: String,
  firstName: String,
  backgroundType: String, // default: "transparent"
  createdAt: Date
}
```

### `ImageLog` (har bir yuborilgan rasm logi)

```js
{
  userId: ObjectId, // Bog'langan foydalanuvchi
  originalFilePath: String,
  outputFilePath: String,
  backgroundType: String,
  createdAt: Date
}
```

---

## 🧪 Test qilish

1. Telegram'da `/start` buyrug'ini yuboring.
2. Rasm yuboring – bot fonni olib tashlaydi va natijani yuboradi.
3. `/background` buyrug'i orqali fon turini o'zgartiring.
4. Turli rasm formatlarini (JPG, PNG, WEBP) sinab ko'ring.

---

## ⚠️ Eslatma

- `remove.bg` API bepul rejada kuniga 1 ta bepul so'rov beradi.
- API kredit tugaganida foydalanuvchi ogohlantiriladi.
- MongoDB server ishlayotganiga ishonch hosil qiling.

---
