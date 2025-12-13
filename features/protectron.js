const { db } = require('../core/firebase');
const { isUserAdmin } = require('../features/moderation');
const admin = require('firebase-admin'); // Import firebase-admin for FieldValue
const { sendRateLimitedMessage } = require('../core/telegramUtils');
const { setProtectronSetting, getProtectronSetting, toggleSetting, getBlacklistedWords, getWhitelistedDomains } = require('../core/protectronUtils');
const { registerStatusHandler } = require('../core/statusHandler');

function setupProtectronHandlers(bot, adminId) {
    console.log('Protectron handlers set up.');

    registerStatusHandler(bot);



    // Toggle Commands
    bot.onText(/\/antispam/, (msg) => toggleSetting(bot, msg, 'antispam', 'Anti-spam filter'));
    bot.onText(/\/noevents/, (msg) => toggleSetting(bot, msg, 'noevents', 'Filtering join/leave messages'));
        bot.onText(/\/nobots/, (msg) => toggleSetting(bot, msg, 'nobots', 'Protection against spam bots'));
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
            sendRateLimitedMessage(bot, chatId, "An error occurred while setting the anti-spam mode.");
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
                sendRateLimitedMessage(bot, chatId, "Failed to add blacklisted word. Please try again.");
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
            sendRateLimitedMessage(bot, chatId, "Failed to remove blacklisted word. Please try again.");
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
            sendRateLimitedMessage(bot, chatId, "Failed to clear blacklisted words. Please try again.");
        }
    });

    bot.onText(/\/blacklist/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        if (!await isUserAdmin(bot, chatId, userId)) {
            sendRateLimitedMessage(bot, chatId, "You are not authorized to view the blacklisted words list.");
            return;
        }

        try {
            const blacklistedWords = await getBlacklistedWords(chatId);
            if (blacklistedWords.length > 0) {
                sendRateLimitedMessage(bot, chatId, `Blacklisted words: \n- ${blacklistedWords.join('\n- ')}`);
            } else {
                sendRateLimitedMessage(bot, chatId, "There are no blacklisted words in this chat.");
            }
        } catch (error) {
            console.error("Error listing blacklisted words:", error);
            sendRateLimitedMessage(bot, chatId, "Failed to list blacklisted words. Please try again.");
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
                sendRateLimitedMessage(bot, chatId, "Failed to add whitelisted domain. Please try again.");
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
            sendRateLimitedMessage(bot, chatId, "Failed to remove whitelisted domain. Please try again.");
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
            sendRateLimitedMessage(bot, chatId, "Failed to clear whitelisted domains. Please try again.");
        }
    });

    bot.onText(/\/whitelist/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        if (!await isUserAdmin(bot, chatId, userId)) {
            sendRateLimitedMessage(bot, chatId, "You are not authorized to view the whitelisted domains list.");
            return;
        }

        try {
            const whitelistedDomains = await getWhitelistedDomains(chatId);
            if (whitelistedDomains.length > 0) {
                sendRateLimitedMessage(bot, chatId, `Whitelisted domains: \n- ${whitelistedDomains.join('\n- ')}`);
            } else {
                sendRateLimitedMessage(bot, chatId, "There are no whitelisted domains in this chat.");
            }
        } catch (error) {
            console.error("Error listing whitelisted domains:", error);
            sendRateLimitedMessage(bot, chatId, "Failed to list whitelisted domains. Please try again.");
        }
    });
}
module.exports = { setupProtectronHandlers };
