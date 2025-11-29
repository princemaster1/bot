# 📦 WhatsApp Bot (Baileys + Gemini AI)

A simple, modular WhatsApp bot built with Node.js and Baileys. 
Designed for **Termux** session generation and **Koyeb** deployment.

## ✨ Features
- **Auto Status Viewer**: Automatically marks statuses as read.
- **Gemini AI Chat**: Tag the bot or use `,ai` to chat.
- **Always Online**: Keeps presence available.
- **Session Login**: Supports QR Code & Pairing Code.
- **Dockerized**: Ready for Koyeb.

---

## 📱 Step 1: Generate Session (Termux)

You need to generate a unique **SESSION_ID** to login.

1. Install Termux from Play Store or F-Droid.
2. Open Termux and type:

```bash
pkg update && pkg upgrade -y
pkg install git nodejs -y
git clone https://github.com/username/my-whatsapp-bot
cd my-whatsapp-bot
npm install
node server.js
```

3. **Scan the QR Code** displayed in the terminal.
4. Wait for the bot to send a message to your **Saved Messages**.
5. Copy the long text string (that is your `SESSION_ID`).

---

## 🚀 Step 2: Deploy to Koyeb

1. **Fork** this repository.
2. Create a new App on [Koyeb](https://koyeb.com).
3. Select **GitHub** as the source and choose your forked repo.
4. Go to **Settings** -> **Environment Variables** and add:

| Key | Value |
|-----|-------|
| `SESSION_ID` | (Paste the code you copied from Termux) |
| `GEMINI_API_KEY` | (Your API Key from Google AI Studio) |
| `DATABASE_URL` | (Optional: MongoDB Connection URL) |

5. Click **Deploy**.
6. Wait 2 minutes. The bot will message you: *"Successfully deployed!"*

---

## 🛠️ Commands

- `,menu` : Show command list
- `,ai <text>` : Chat with Gemini
- `,ping` : Check bot speed
