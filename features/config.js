const { db } = require('../core/firebase');
const { isUserAdmin } = require('./moderation'); // Re-using the admin check

function registerConfigHandlers(bot) {
    bot.onText(/\/settings/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        if (!await isUserAdmin(bot, chatId, userId)) {
            bot.sendMessage(chatId, "You are not authorized to open bot settings.");
            return;
        }
        
        const webAppUrl = process.env.RENDER_URL;
        if (!webAppUrl) {
            bot.sendMessage(chatId, "Web app URL is not configured. Cannot open settings.");
            return;
        }

        try {
            const configRef = db.collection('chat_configs').doc(chatId.toString());
            const doc = await configRef.get();
            let configQuery = "";

            if (doc.exists) {
                const config = doc.data();
                const configString = JSON.stringify(config);
                const encodedConfig = Buffer.from(configString).toString('base64');
                configQuery = `?config=${encodedConfig}`;
            }

            const url = `${webAppUrl}/index.html${configQuery}`;

            const opts = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Open Settings Panel', web_app: { url: url } }]
                    ]
                }
            };
            bot.sendMessage(chatId, 'Click the button below to open the settings panel for this chat.', opts);

        } catch (error) {
            console.error("Error preparing settings web app:", error);
            bot.sendMessage(chatId, `Failed to open settings. Please try again. Error: ${error.message}`);
        }
    });

    bot.onText(/\/config set welcome_message (.+)|\/setwelcome (.+)/s, async (msg, match) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const welcomeMessage = match[1];

        if (!await isUserAdmin(bot, chatId, userId)) {
            bot.sendMessage(chatId, "You are not authorized to configure this bot.");
            return;
        }

        if (!welcomeMessage) {
            bot.sendMessage(chatId, "Please provide a welcome message. Usage: /config set welcome_message <your message>");
            return;
        }

        try {
            const configRef = db.collection('chat_configs').doc(chatId.toString());
            await configRef.set({ welcomeMessage }, { merge: true });
            bot.sendMessage(chatId, "✅ Welcome message updated successfully.");
            bot.sendMessage(chatId, `ℹ️ *Available Placeholders for Welcome Message:*\n- \`{username}\`: The new member's Telegram username (if available).\n- \`{initiate_name}\`: A randomly assigned initiate name from the bot's data.`, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error("Error updating welcome message:", error);
            bot.sendMessage(chatId, `❌ Failed to update the welcome message. Please try again. Error: ${error.message}`);
        }
    });

    bot.onText(/\/config show|\/showconfig/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const chatType = msg.chat.type;

        if (!await isUserAdmin(bot, chatId, userId)) {
            bot.sendMessage(chatId, "❌ You are not authorized to view the bot's configuration.");
            return;
        }

        try {
            const configRef = db.collection('chat_configs').doc(chatId.toString());
            const doc = await configRef.get();

            let response = "⚙️ *Current Bot Configuration:*\n";
            if (!doc.exists) {
                response += "\nℹ️ No custom configuration found for this chat.";
            } else {
                const config = doc.data();
                for (const [key, value] of Object.entries(config)) {
                    response += `\n- *${key}*: \`${JSON.stringify(value)}\``;
                }
            }

            sendRateLimitedMessage(bot, userId, response, { parse_mode: 'Markdown' });

            if (chatType !== 'private') {
                sendRateLimitedMessage(bot, chatId, "✅ Bot configuration sent to your private chat with me.");
            }

        } catch (error) {
            console.error("Error fetching configuration:", error);
            sendRateLimitedMessage(bot, userId, `❌ Failed to fetch configuration. Please try again. Error: ${error.message}`);
            if (chatType !== 'private') {
                sendRateLimitedMessage(bot, chatId, `❌ An error occurred while fetching configuration. Check your private chat with me for details.`);
            }
        }
    });

    bot.onText(/\/add_banned_word (.+)|\/banword (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const word = match[1].toLowerCase().trim();

        if (!await isUserAdmin(bot, chatId, userId)) {
            bot.sendMessage(chatId, "You are not authorized to modify the banned words list.");
            return;
        }

        if (!word) {
            bot.sendMessage(chatId, "Usage: /add_banned_word <word>");
            return;
        }

        try {
            const configRef = db.collection('chat_configs').doc(chatId.toString());
            const admin = require('firebase-admin');

            await configRef.update({
                bannedWords: admin.firestore.FieldValue.arrayUnion(word)
            });

            bot.sendMessage(chatId, `"${word}" has been added to the banned words list.`);
        } catch (error) {
            // If the document or field doesn't exist, update will fail. Use set with merge.
            if (error.code === 5) { // 'NOT_FOUND' error code for Firestore
                const configRef = db.collection('chat_configs').doc(chatId.toString());
                await configRef.set({ bannedWords: [word] }, { merge: true });
                bot.sendMessage(chatId, `"${word}" has been added to the banned words list.`);
            } else {
                console.error("Error adding banned word:", error);
                bot.sendMessage(chatId, `Failed to add banned word. Please try again. Error: ${error.message}`);
            }
        }
    });

    bot.onText(/\/remove_banned_word (.+)|\/unbanword (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const word = match[1].toLowerCase().trim();

        if (!await isUserAdmin(bot, chatId, userId)) {
            bot.sendMessage(chatId, "You are not authorized to modify the banned words list.");
            return;
        }

        if (!word) {
            bot.sendMessage(chatId, "Usage: /remove_banned_word <word>");
            return;
        }

        try {
            const configRef = db.collection('chat_configs').doc(chatId.toString());
            const admin = require('firebase-admin');

            await configRef.update({
                bannedWords: admin.firestore.FieldValue.arrayRemove(word)
            });

            bot.sendMessage(chatId, `"${word}" has been removed from the banned words list.`);
        } catch (error) {
            console.error("Error removing banned word:", error);
            bot.sendMessage(chatId, `Failed to remove banned word. Please try again. Error: ${error.message}`);
        }
    });

    bot.onText(/\/list_banned_words|\/bannedwords/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        if (!await isUserAdmin(bot, chatId, userId)) {
            bot.sendMessage(chatId, "You are not authorized to view the banned words list.");
            return;
        }

        try {
            const configRef = db.collection('chat_configs').doc(chatId.toString());
            const doc = await configRef.get();

            if (doc.exists && doc.data().bannedWords && doc.data().bannedWords.length > 0) {
                const bannedWords = doc.data().bannedWords;
                bot.sendMessage(chatId, `Banned words: \n- ${bannedWords.join('\n- ')}`);
            } else {
                bot.sendMessage(chatId, "There are no banned words in this chat.");
            }
        } catch (error) {
            console.error("Error listing banned words:", error);
            bot.sendMessage(chatId, `Failed to list banned words. Please try again. Error: ${error.message}`);
        }
    });
}


async function saveWebAppConfig(chatId, data) {
    const configRef = db.collection('chat_configs').doc(chatId.toString());
    await configRef.set(data, { merge: true });
}

module.exports = {
    registerConfigHandlers,
    saveWebAppConfig
};
