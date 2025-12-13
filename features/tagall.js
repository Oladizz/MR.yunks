const { db } = require('../core/firebase');
const { isUserAdmin } = require('./moderation');
const { sendRateLimitedMessage } = require('../core/telegramUtils');

function registerTagAllHandlers(bot) {
    bot.onText(/\/tagall(?: (.+))?/, async (msg, match) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        if (!await isUserAdmin(bot, chatId, userId)) {
            sendRateLimitedMessage(bot, chatId, "You are not authorized to use this command.");
            return;
        }

        try {
            const membersSnapshot = await db.collection('chat_members').doc(chatId.toString()).collection('members').get();
            if (membersSnapshot.empty) {
                sendRateLimitedMessage(bot, chatId, "I haven't seen any active users in this chat yet. Give me some time to learn who is here.");
                return;
            }

            let text = match[1] ? `${match[1]}\n\n` : 'Tagging all known members:\n\n';
            let mentions = [];
            membersSnapshot.forEach(doc => {
                const user = doc.data();
                if (user.username) {
                    mentions.push(`@${user.username}`);
                } else {
                    mentions.push(`[${user.first_name || 'user'}](tg://user?id=${doc.id})`);
                }
            });

            const message = text + mentions.join(' ');

            sendRateLimitedMessage(bot, chatId, message, { parse_mode: 'Markdown', disable_notification: true });

        } catch (error) {
            console.error("Error in /tagall command:", error);
            sendRateLimitedMessage(bot, chatId, "An error occurred while trying to tag everyone.");
        }
    });
}

module.exports = { registerTagAllHandlers };
