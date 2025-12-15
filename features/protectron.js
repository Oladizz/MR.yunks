const { db } = require('../core/firebase');
const { isUserAdmin } = require('../features/moderation');
const admin = require('firebase-admin'); // Import firebase-admin for FieldValue
const { sendRateLimitedMessage } = require('../core/telegramUtils');
const { setProtectronSetting, getProtectronSetting, toggleSetting, getBlacklistedWords, getWhitelistedDomains } = require('../core/protectronUtils');
const { registerStatusHandler } = require('../core/statusHandler');

function setupProtectronHandlers(bot, adminId) {
    console.log('Protectron handlers set up.');

    registerStatusHandler(bot);

    bot.on('callback_query', async (callbackQuery) => {
        const msg = callbackQuery.message;
        const chatId = msg.chat.id;
        const userId = callbackQuery.from.id;
        const data = callbackQuery.data;

        if (data.startsWith('protectron_toggle_')) {
            await bot.answerCallbackQuery(callbackQuery.id); // Acknowledge the callback immediately

            if (!await isUserAdmin(bot, chatId, userId)) {
                sendRateLimitedMessage(bot, chatId, "You are not authorized to change Protectron settings.");
                return;
            }

            const settingName = data.replace('protectron_toggle_', '');
            try {
                const currentValue = await getProtectronSetting(chatId, settingName);
                const newValue = !currentValue;
                await setProtectronSetting(chatId, settingName, newValue);
                
                // Re-render the status message to reflect the change
                const configRef = db.collection('protectron_configs').doc(chatId.toString());
                const doc = await configRef.get();
                const settings = doc.exists ? doc.data() : {};

                let statusMessage = "🛡️ *Protectron Status* 🛡️\n\n";
                const inlineKeyboard = [];

                const addToggleRow = (setting, displayName, currentValue) => {
                    const statusEmoji = currentValue ? '✅' : '❌';
                    const buttonText = `${statusEmoji} ${displayName}`;
                    inlineKeyboard.push([{ text: buttonText, callback_data: `protectron_toggle_${setting}` }]);
                    statusMessage += `*${displayName}:* ${currentValue ? '✅ Enabled' : '❌ Disabled'}\n`;
                };

                addToggleRow('antispam', 'Anti-spam', settings.antispam);
                statusMessage += `*Anti-spam Mode:* ${settings.antispam_mode || 'Simple'}\n`;
                addToggleRow('noevents', 'Filter Join/Leave Messages', settings.noevents);
                addToggleRow('nobots', 'Protect Against Spam Bots', settings.nobots);
                addToggleRow('nolinks', 'Filter Links/Mentions/Forwards/Reply Markup', settings.nolinks);
                addToggleRow('noforwards', 'Filter Forwarded Messages', settings.noforwards);
                addToggleRow('nocontacts', 'Filter Contact Numbers', settings.nocontacts);
                addToggleRow('nolocations', 'Filter Locations', settings.nolocations);
                addToggleRow('nocommands', 'Filter Commands from Group Members', settings.nocommands);
                addToggleRow('nohashtags', 'Filter Hashtags', settings.nohashtags);
                addToggleRow('antiflood', 'Anti-flood Protection', settings.antiflood);
                addToggleRow('imagefilter', 'Image Filter (Pornographic)', settings.imagefilter);
                addToggleRow('profanity', 'Profanity Filter', settings.profanity);

                const blacklistedWords = await getBlacklistedWords(chatId);
                statusMessage += `\n*Blacklisted Words:* ${blacklistedWords.length > 0 ? blacklistedWords.join(', ') : 'None'}\n`;

                const whitelistedDomains = await getWhitelistedDomains(chatId);
                statusMessage += `*Whitelisted Domains:* ${whitelistedDomains.length > 0 ? whitelistedDomains.join(', ') : 'None'}`;
                
                inlineKeyboard.push([{ text: '🔄 Refresh Status', callback_data: 'status_refresh' }]);
                inlineKeyboard.push([{ text: '🔙 Back to Main Protectron Menu', callback_data: 'protectron_main_menu' }]);

                // Edit the original message
                await bot.editMessageText(statusMessage, {
                    chat_id: chatId,
                    message_id: msg.message_id,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: inlineKeyboard
                    }
                });
                sendRateLimitedMessage(bot, chatId, `Protectron: ${settingName} has been ${newValue ? 'enabled' : 'disabled'}.`);

            } catch (error) {
                console.error(`Error toggling Protectron setting ${settingName}:`, error);
                sendRateLimitedMessage(bot, chatId, `An error occurred while toggling ${settingName}. Error: ${error.message}`);
            }
        } // Closing brace for if (data.startsWith('protectron_toggle_'))
        else if (data === 'status_refresh' || data === 'protectron_main_menu') {
            await bot.answerCallbackQuery(callbackQuery.id); // Acknowledge the callback immediately

            // Re-render the status message
            const configRef = db.collection('protectron_configs').doc(chatId.toString());
            const doc = await configRef.get();
            const settings = doc.exists ? doc.data() : {};

            let statusMessage = "🛡️ *Protectron Status* 🛡️\n\n";
            const inlineKeyboard = [];

            const addToggleRow = (setting, displayName, currentValue) => {
                const statusEmoji = currentValue ? '✅' : '❌';
                const buttonText = `${statusEmoji} ${displayName}`;
                inlineKeyboard.push([{ text: buttonText, callback_data: `protectron_toggle_${setting}` }]);
                statusMessage += `*${displayName}:* ${currentValue ? '✅ Enabled' : '❌ Disabled'}\n`;
            };

            addToggleRow('antispam', 'Anti-spam', settings.antispam);
            statusMessage += `*Anti-spam Mode:* ${settings.antispam_mode || 'Simple'}\n`;
            addToggleRow('noevents', 'Filter Join/Leave Messages', settings.noevents);
            addToggleRow('nobots', 'Protect Against Spam Bots', settings.nobots);
            addToggleRow('nolinks', 'Filter Links/Mentions/Forwards/Reply Markup', settings.nolinks);
            addToggleRow('noforwards', 'Filter Forwarded Messages', settings.noforwards);
            addToggleRow('nocontacts', 'Filter Contact Numbers', settings.nocontacts);
            addToggleRow('nolocations', 'Filter Locations', settings.nolocations);
            addToggleRow('nocommands', 'Filter Commands from Group Members', settings.nocommands);
            addToggleRow('nohashtags', 'Filter Hashtags', settings.nohashtags);
            addToggleRow('antiflood', 'Anti-flood Protection', settings.antiflood);
            addToggleRow('imagefilter', 'Image Filter (Pornographic)', settings.imagefilter);
            addToggleRow('profanity', 'Profanity Filter', settings.profanity);

            const blacklistedWords = await getBlacklistedWords(chatId);
            statusMessage += `\n*Blacklisted Words:* ${blacklistedWords.length > 0 ? blacklistedWords.join(', ') : 'None'}\n`;

            const whitelistedDomains = await getWhitelistedDomains(chatId);
            statusMessage += `*Whitelisted Domains:* ${whitelistedDomains.length > 0 ? whitelistedDomains.join(', ') : 'None'}`;
            
            inlineKeyboard.push([{ text: '🔄 Refresh Status', callback_data: 'status_refresh' }]);
            inlineKeyboard.push([{ text: '🔙 Back to Main Protectron Menu', callback_data: 'protectron_main_menu' }]);
            
            await bot.editMessageText(statusMessage, {
                chat_id: chatId,
                message_id: msg.message_id,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: inlineKeyboard
                }
            });
        }
    });
    bot.onText(/\/nolinks/, (msg) => toggleSetting(bot, msg, 'nolinks', 'Filtering links, mentions, forwards, reply markup'));
    bot.onText(/\/noforwards/, (msg) => toggleSetting(bot, msg, 'noforwards', 'Filtering forwarded messages'));
    bot.onText(/\/nocontacts/, (msg) => toggleSetting(bot, msg, 'nocontacts', 'Filtering contact numbers'));
    bot.onText(/\/nolocations/, (msg) => toggleSetting(bot, msg, 'nolocations', 'Filtering locations'));
    bot.onText(/\/nocommands/, (msg) => toggleSetting(bot, msg, 'nocommands', 'Filtering commands from group members'));
    bot.onText(/\/nohashtags/, (msg) => toggleSetting(bot, msg, 'nohashtags', 'Filtering messages with hashtags'));
    bot.onText(/\/antiflood/, (msg) => toggleSetting(bot, msg, 'antiflood', 'Anti-flood protection'));
    bot.onText(/\/imagefilter/, (msg) => toggleSetting(bot, msg, 'imagefilter', 'Pornographic image filter'));
    bot.onText(/\/profanity/, (msg) => toggleSetting(bot, msg, 'profanity', 'Profanity filter'));

    bot.onText(/\/antispam_mode (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const mode = match[1].trim();

        if (!await isUserAdmin(bot, chatId, userId)) {
            sendRateLimitedMessage(bot, chatId, "You are not authorized to change the anti-spam mode.");
            return;
        }

        const validModes = ['Simple', 'Advanced'];
        if (!validModes.includes(mode)) {
            sendRateLimitedMessage(bot, chatId, "Invalid anti-spam mode. Please use 'Simple' or 'Advanced'.");
            return;
        }

        try {
            await setProtectronSetting(chatId, 'antispam_mode', mode);
            sendRateLimitedMessage(bot, chatId, `Protectron: Anti-spam mode set to *${mode}*.`, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error("Error setting anti-spam mode:", error);
            sendRateLimitedMessage(bot, chatId, `An error occurred while setting the anti-spam mode: ${error.message}`);
        }
    });

    // Blacklist Commands
    bot.onText(/\/blacklist_add (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const word = match[1].toLowerCase().trim();

        if (!await isUserAdmin(bot, chatId, userId)) {
            sendRateLimitedMessage(bot, chatId, "You are not authorized to modify the blacklisted words list.");
            return;
        }

        if (!word) {
            sendRateLimitedMessage(bot, chatId, "Usage: /blacklist_add <word>");
            return;
        }

        try {
            const configRef = db.collection('protectron_configs').doc(chatId.toString());
            await configRef.update({
                blacklistedWords: admin.firestore.FieldValue.arrayUnion(word)
            });
            sendRateLimitedMessage(bot, chatId, `"${word}" has been added to the blacklisted words list.`);
        } catch (error) {
            if (error.code === 5) { // NOT_FOUND for document
                await configRef.set({ blacklistedWords: [word] }, { merge: true });
                sendRateLimitedMessage(bot, chatId, `"${word}" has been added to the blacklisted words list.`);
            } else {
                console.error("Error adding blacklisted word:", error);
                sendRateLimitedMessage(bot, chatId, `Failed to add blacklisted word. Please try again. Error: ${error.message}`);
            }
        }
    });

    bot.onText(/\/blacklist_remove (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const word = match[1].toLowerCase().trim();

        if (!await isUserAdmin(bot, chatId, userId)) {
            sendRateLimitedMessage(bot, chatId, "You are not authorized to modify the blacklisted words list.");
            return;
        }

        if (!word) {
            sendRateLimitedMessage(bot, chatId, "Usage: /blacklist_remove <word>");
            return;
        }

        try {
            const configRef = db.collection('protectron_configs').doc(chatId.toString());
            await configRef.update({
                blacklistedWords: admin.firestore.FieldValue.arrayRemove(word)
            });
            sendRateLimitedMessage(bot, chatId, `"${word}" has been removed from the blacklisted words list.`);
        } catch (error) {
            console.error("Error removing blacklisted word:", error);
            sendRateLimitedMessage(bot, chatId, `Failed to remove blacklisted word. Please try again. Error: ${error.message}`);
        }
    });

    bot.onText(/\/blacklist_clear/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        if (!await isUserAdmin(bot, chatId, userId)) {
            sendRateLimitedMessage(bot, chatId, "You are not authorized to clear the blacklisted words list.");
            return;
        }

        try {
            const configRef = db.collection('protectron_configs').doc(chatId.toString());
            await configRef.set({ blacklistedWords: [] }, { merge: true });
            sendRateLimitedMessage(bot, chatId, "The blacklisted words list has been cleared.");
        } catch (error) {
            console.error("Error clearing blacklisted words:", error);
            sendRateLimitedMessage(bot, chatId, `Failed to clear blacklisted words. Please try again. Error: ${error.message}`);
        }
    });

    bot.onText(/\/blacklist/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const chatType = msg.chat.type;

        if (!await isUserAdmin(bot, chatId, userId)) {
            sendRateLimitedMessage(bot, chatId, "❌ You are not authorized to view the blacklisted words list.");
            return;
        }

        try {
            const blacklistedWords = await getBlacklistedWords(chatId);
            let responseMessage;
            if (blacklistedWords.length > 0) {
                responseMessage = `📜 *Blacklisted words for this chat:*\n- ${blacklistedWords.join('\n- ')}`;
            } else {
                responseMessage = "ℹ️ There are no blacklisted words in this chat.";
            }
            
            sendRateLimitedMessage(bot, userId, responseMessage, { parse_mode: 'Markdown' });

            if (chatType !== 'private') {
                sendRateLimitedMessage(bot, chatId, "✅ Blacklisted words list sent to your private chat with me.");
            }
        } catch (error) {
            console.error("Error listing blacklisted words:", error);
            sendRateLimitedMessage(bot, userId, `❌ Failed to list blacklisted words. Please try again. Error: ${error.message}`);
            if (chatType !== 'private') {
                sendRateLimitedMessage(bot, chatId, `❌ An error occurred while listing blacklisted words. Check your private chat with me for details.`);
            }
        }
    });
    // Whitelist Commands
    bot.onText(/\/whitelist_add (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const domain = match[1].toLowerCase().trim();

        if (!await isUserAdmin(bot, chatId, userId)) {
            sendRateLimitedMessage(bot, chatId, "You are not authorized to modify the whitelisted domains list.");
            return;
        }

        if (!domain) {
            sendRateLimitedMessage(bot, chatId, "Usage: /whitelist_add <domain>");
            return;
        }

        try {
            const configRef = db.collection('protectron_configs').doc(chatId.toString());
            await configRef.update({
                whitelistedDomains: admin.firestore.FieldValue.arrayUnion(domain)
            });
            sendRateLimitedMessage(bot, chatId, `"${domain}" has been added to the whitelisted domains list.`);
        } catch (error) {
            if (error.code === 5) { // NOT_FOUND for document
                await configRef.set({ whitelistedDomains: [domain] }, { merge: true });
                sendRateLimitedMessage(bot, chatId, `"${domain}" has been added to the whitelisted domains list.`);
            } else {
                console.error("Error adding whitelisted domain:", error);
                sendRateLimitedMessage(bot, chatId, `Failed to add whitelisted domain. Please try again. Error: ${error.message}`);
            }
        }
    });

    bot.onText(/\/whitelist_remove (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const domain = match[1].toLowerCase().trim();

        if (!await isUserAdmin(bot, chatId, userId)) {
            sendRateLimitedMessage(bot, chatId, "You are not authorized to modify the whitelisted domains list.");
            return;
        }

        if (!domain) {
            sendRateLimitedMessage(bot, chatId, "Usage: /whitelist_remove <domain>");
            return;
        }

        try {
            const configRef = db.collection('protectron_configs').doc(chatId.toString());
            await configRef.update({
                whitelistedDomains: admin.firestore.FieldValue.arrayRemove(domain)
            });
            sendRateLimitedMessage(bot, chatId, `"${domain}" has been removed from the whitelisted domains list.`);
        } catch (error) {
            console.error("Error removing whitelisted domain:", error);
            sendRateLimitedMessage(bot, chatId, `Failed to remove whitelisted domain. Please try again. Error: ${error.message}`);
        }
    });

    bot.onText(/\/whitelist_clear/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        if (!await isUserAdmin(bot, chatId, userId)) {
            sendRateLimitedMessage(bot, chatId, "You are not authorized to clear the whitelisted domains list.");
            return;
        }

        try {
            const configRef = db.collection('protectron_configs').doc(chatId.toString());
            await configRef.set({ whitelistedDomains: [] }, { merge: true });
            sendRateLimitedMessage(bot, chatId, "The whitelisted domains list has been cleared.");
        } catch (error) {
            console.error("Error clearing whitelisted domains:", error);
            sendRateLimitedMessage(bot, chatId, `Failed to clear whitelisted domains. Please try again. Error: ${error.message}`);
        }
    });

    bot.onText(/\/whitelist/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const chatType = msg.chat.type;

        if (!await isUserAdmin(bot, chatId, userId)) {
            sendRateLimitedMessage(bot, chatId, "❌ You are not authorized to view the whitelisted domains list.");
            return;
        }

        try {
            const whitelistedDomains = await getWhitelistedDomains(chatId);
            let responseMessage;
            if (whitelistedDomains.length > 0) {
                responseMessage = `📜 *Whitelisted domains for this chat:*\n- ${whitelistedDomains.join('\n- ')}`;
            } else {
                responseMessage = "ℹ️ There are no whitelisted domains in this chat.";
            }

            sendRateLimitedMessage(bot, userId, responseMessage, { parse_mode: 'Markdown' });

            if (chatType !== 'private') {
                sendRateLimitedMessage(bot, chatId, "✅ Whitelisted domains list sent to your private chat with me.");
            }
        } catch (error) {
            console.error("Error listing whitelisted domains:", error);
            sendRateLimitedMessage(bot, userId, `❌ Failed to list whitelisted domains. Please try again. Error: ${error.message}`);
            if (chatType !== 'private') {
                sendRateLimitedMessage(bot, chatId, `❌ An error occurred while listing whitelisted domains. Check your private chat with me for details.`);
            }
        }
    });
}
module.exports = { setupProtectronHandlers };
