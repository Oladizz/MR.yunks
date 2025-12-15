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

            const allMentions = [];
            membersSnapshot.forEach(doc => {
                const user = doc.data();
                if (user.username) {
                    allMentions.push(`@${user.username}`);
                } else {
                    const sanitizedFirstName = (user.first_name || 'user').replace(/\[/g, '(').replace(/\]/g, ')');
                    allMentions.push(`[${sanitizedFirstName}](tg://user?id=${doc.id})`);
                }
            });

            const maxMessageLength = 4000; // Reduced for safety
            const baseText = match[1] ? `${match[1]}\n\n` : 'Tagging all known members:\n\n';
            let currentMessage = baseText;

            for (const mention of allMentions) {
                if (currentMessage.length + mention.length + 1 > maxMessageLength) {
                    await sendRateLimitedMessage(bot, chatId, currentMessage, { parse_mode: 'Markdown', disable_notification: true });
                    currentMessage = baseText;
                }
                currentMessage += `${mention} `;
            }

            // Send any remaining mentions
            if (currentMessage.trim() !== baseText.trim()) {
                await sendRateLimitedMessage(bot, chatId, currentMessage.trim(), { parse_mode: 'Markdown', disable_notification: true });
            }

        } catch (error) {
            console.error("Error in /tagall command:", error);
            sendRateLimitedMessage(bot, chatId, `An error occurred while trying to tag everyone. Error: ${error.message}`);
        }
    });
}

module.exports = { registerTagAllHandlers };
