# 🤖 BoluDevs Bot

A WhatsApp bot built with the Baileys library for group management — tag all members, mute/unmute, moderate links and bad words, download media, generate stickers and more. It's designed to help admins efficiently manage WhatsApp groups.

<div align="center">
  <a href="https://git.io/typing-svg">
    <img src="https://readme-typing-svg.demolab.com?font=Ribeye&size=50&pause=1000&color=33ff00&center=true&width=910&height=100&lines=BoluDevs+Bot;Multi+Device+Whatsapp+Bot;Coded+By+BoluDevs" alt="Typing SVG" />
  </a>
</div>

<div align="center">
  <img src="assets/bot_image.jpg" alt="BoluDevs Bot" height="300">
</div>

---

## 👤 Owner

**BoluDevs**

- WhatsApp: `+2349033372448`
- WhatsApp: `+2349041490874`

Set these in `settings.js` under `ownerNumber` / `ownerNumbers` before running the bot.

---

## ⚙️ Features

- **Tag all group members** with the `.tagall` command
- **Admin restricted usage** (only group admins can use certain commands)
- **Games** like Tic-Tac-Toe, Hangman and Trivia for interactive group engagement
- **Text-to-Speech** with `.tts`
- **Sticker creation** with `.sticker`
- **Anti-link / anti-badword / anti-tag detection** for group safety
- **Antidelete & view-once recovery**
- **Warn and manage group members** with admin control
- **Downloaders** for YouTube, Spotify, TikTok, Instagram and Facebook
- **AI commands** — GPT, Gemini, image and video generation

Type `.menu` in chat for the full command list.

---

## 📖 About

BoluDevs Bot assists group admins by providing tools to efficiently manage large WhatsApp groups. It uses the Baileys library to interact with the WhatsApp Web API and supports multi-device features.

It is lightweight and easy to customize with more commands. The bot runs in a Node.js environment and supports both QR code and pairing-code authentication to link your WhatsApp account.

---

## 🛠️ Setup & Installation

### Prerequisites

- Node.js 18 or newer
- Git (for cloning the repository)
- `ffmpeg` installed and on your `PATH` (used for stickers and media conversion)

### Step-by-Step Setup

1. **Clone the repository:**

    ```bash
    git clone <your-repo-url>.git
    cd Knightbot-MD
    ```

2. **Install the dependencies:**

    ```bash
    npm install
    ```

3. **Configure the owner numbers:**

    Open `settings.js` and set:

    ```js
    ownerNumber: '2349033372448',
    ownerNumbers: ['2349033372448', '2349041490874'],
    ```

4. **Run the bot:**

    ```bash
    node index.js
    ```

5. **Link your account:**

    A pairing code is printed in the terminal (or scan the QR code if you disable pairing). Enter the code under **WhatsApp → Settings → Linked Devices → Link a Device**.

    Your session is stored in the `session/` folder — keep it private.

### Useful scripts

```bash
npm start              # start the bot
npm run start:optimized # start with a smaller memory footprint (good for small VPS/panels)
npm run start:fresh    # clear the session and start over
```

---

## 🤝 Contributing

Contributions, issues and feature requests are welcome — feel free to open an issue or pull request.

---

## ⚠️ Important Warning

**Note:** This bot is created for educational purposes only. This is NOT an official WhatsApp bot. Using this bot may lead to your WhatsApp account being banned. Use it at your own risk. The developers will not be responsible for any consequences or account bans that may occur while using this bot.

## 📝 Legal

- This project is not affiliated with, authorized, maintained, sponsored or endorsed by WhatsApp or any of its affiliates or subsidiaries.
- This is independent and unofficial software. Use it at your own risk.
- Do not spam people with this bot.
- Do not use this bot to send bulk messages or for illegal purposes.
- The developers assume no liability and are not responsible for any misuse or damage caused by this program.

### License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT). You must:

- Use this software in compliance with all applicable laws and regulations
- Include original license and copyright notices
- Credit original authors
- Not use it for spam or malicious purposes

## 📜 Copyright Notice

Copyright (c) 2024 BoluDevs. All rights reserved.

This project contains code from various open source projects:

- Baileys (MIT License)
- Other libraries as listed in `package.json`

## 🙏 Credits

- **BoluDevs** — owner / maintainer
- [Baileys](https://github.com/adiwajshing/Baileys) — the WhatsApp Web API library this bot is built on
- [TechGod143](https://github.com/TechGod143) — pair code implementation
- [Dgxeon](https://github.com/Dgxeon) — pair code implementation
