const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

const messageIds = {}; 
bot.onText(/\/chatid/, (msg) => {
  const chatId = msg.chat.id;
  bot
    .sendMessage(
      chatId,
      `
Chat Information:
ID: ${chatId}
Type: ${msg.chat.type}
Title: ${msg.chat.title || "N/A"}
`
    )
    .then((sentMessage) => {
            if (!messageIds[chatId]) {
        messageIds[chatId] = [];
      }
      messageIds[chatId].push(sentMessage.message_id);
    });
});

bot.onText(/\/test/, async (msg) => {
  const chatId = msg.chat.id;
  if (messageIds[chatId]) {
    for (const messageId of messageIds[chatId]) {
      try {
        await bot.deleteMessage(chatId, messageId);
      } catch (error) {
        console.error(`Не удалось удалить сообщение с ID ${messageId}:`, error);
      }
    }
        delete messageIds[chatId];
  } else {
    bot.sendMessage(chatId, "Нет сообщений для удаления.");
  }
});

module.exports = bot;
