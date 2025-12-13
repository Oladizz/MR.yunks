
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error("TELEGRAM_BOT_TOKEN not found. Please add it to your .env file.");
  process.exit(1);
}

const isProduction = process.env.NODE_ENV === 'production';
const renderUrl = process.env.RENDER_URL;

let bot;

if (isProduction && renderUrl) {
  bot = new TelegramBot(token);
  const webhookUrl = `${renderUrl}/webhook/${token}`;
  bot.setWebHook(webhookUrl);
  console.log(`Webhook set to ${webhookUrl}`);
} else {
  console.log("Not in production or RENDER_URL not set, using polling for local development.");
  bot = new TelegramBot(token, { polling: true });
}

module.exports = bot;
