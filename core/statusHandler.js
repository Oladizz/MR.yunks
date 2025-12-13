const { db } = require('./firebase');
const { isUserAdmin } = require('../features/moderation');
const { sendRateLimitedMessage } = require('./telegramUtils');
const { getBlacklistedWords, getWhitelistedDomains } = require('./protectronUtils');

function registerStatusHandler(bot) {
    bot.onText(/\/status/, async (msg) => {
        var chatId = msg.chat.id;
        var userId = msg.from.id;

        if (!await isUserAdmin(bot, chatId, userId)) {
            sendRateLimitedMessage(bot, chatId, "You are not authorized to view Protectron settings.");
            return;
        }

        try {
            const configRef = db.collection('protectron_configs').doc(chatId.toString());
            const doc = await configRef.get();
            const settings = doc.exists ? doc.data() : {};

            let statusMessage = "🛡️ *Protectron Status* 🛡️\n\n";

            statusMessage += `*Anti-spam:* ${settings.antispam ? '✅ Enabled' : '❌ Disabled'}\n`;
            statusMessage += `*Anti-spam Mode:* ${settings.antispam_mode || 'Simple'}\n`;
            statusMessage += `*Filter Join/Leave Messages:* ${settings.noevents ? '✅ Enabled' : '❌ Disabled'}\n`;
            statusMessage += `*Protect Against Spam Bots:* ${settings.nobots ? '✅ Enabled' : '❌ Disabled'}\n`;
            statusMessage += `*Filter Links/Mentions/Forwards/Reply Markup:* ${settings.nolinks ? '✅ Enabled' : '❌ Disabled'}\n`;
            statusMessage += `*Filter Forwarded Messages:* ${settings.noforwards ? '✅ Enabled' : '❌ Disabled'}\n`;
            statusMessage += `*Filter Contact Numbers:* ${settings.nocontacts ? '✅ Enabled' : '❌ Disabled'}\n`;
            statusMessage += `*Filter Locations:* ${settings.nolocations ? '✅ Enabled' : '❌ Disabled'}\n`;
            statusMessage += `*Filter Commands from Group Members:* ${settings.nocommands ? '✅ Enabled' : '❌ Disabled'}\n`;
            statusMessage += `*Filter Hashtags:* ${settings.nohashtags ? '✅ Enabled' : '❌ Disabled'}\n`;
            statusMessage += `*Anti-flood Protection:* ${settings.antiflood ? '✅ Enabled' : '❌ Disabled'}\n`;
            statusMessage += `*Image Filter (Pornographic):* ${settings.imagefilter ? '✅ Enabled' : '❌ Disabled'}\n`;
            statusMessage += `*Profanity Filter:* ${settings.profanity ? '✅ Enabled' : '❌ Disabled'}\n`;

            const blacklistedWords = await getBlacklistedWords(chatId);
            statusMessage += `\n*Blacklisted Words:* ${blacklistedWords.length > 0 ? blacklistedWords.join(', ') : 'None'}\n`;

            const whitelistedDomains = await getWhitelistedDomains(chatId);
            statusMessage += `*Whitelisted Domains:* ${whitelistedDomains.length > 0 ? whitelistedDomains.join(', ') : 'None'}`;

            sendRateLimitedMessage(bot, chatId, statusMessage, { parse_mode: 'Markdown' });

        } catch (error) {
            console.error("Error fetching Protectron status:", error);
            sendRateLimitedMessage(bot, chatId, "An error occurred while fetching Protectron status. Please try again.");
        }
    });
}

module.exports = { registerStatusHandler };