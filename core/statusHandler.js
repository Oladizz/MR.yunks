const { db } = require('./firebase');
const { isUserAdmin } = require('../features/moderation');
const { sendRateLimitedMessage } = require('./telegramUtils');
const { getBlacklistedWords, getWhitelistedDomains } = require('./protectronUtils');

function registerStatusHandler(bot) {
    bot.onText(/\/status/, async (msg) => {
        var chatId = msg.chat.id;
        var userId = msg.from.id;
        var chatType = msg.chat.type;

        if (!await isUserAdmin(bot, chatId, userId)) {
            sendRateLimitedMessage(bot, chatId, "❌ You are not authorized to view Protectron settings.");
            return;
        }

        try {
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

            // Send full status to the user who invoked the command
            inlineKeyboard.push([{ text: '🔄 Refresh Status', callback_data: 'status_refresh' }]); // Add refresh button
            inlineKeyboard.push([{ text: '🔙 Back to Main Protectron Menu', callback_data: 'protectron_main_menu' }]); // New back button

            sendRateLimitedMessage(bot, userId, statusMessage, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: inlineKeyboard
                }
            });

            // If it was a group chat, send a concise message to the group
            if (chatType !== 'private') {
                sendRateLimitedMessage(bot, chatId, "✅ Protectron status sent to your private chat with me.");
            }

        } catch (error) {
            console.error("Error fetching Protectron status:", error);
            sendRateLimitedMessage(bot, userId, `❌ An error occurred while fetching Protectron status: ${error.message}`);
            if (chatType !== 'private') {
                sendRateLimitedMessage(bot, chatId, `❌ An error occurred while fetching Protectron status. Please check your private chat with me for details.`);
            }
        }
    });
}

module.exports = { registerStatusHandler };