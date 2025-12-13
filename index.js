require('dotenv').config();

const bot = require('./core/bot');
const setupServer = require('./core/server');
const registerAdminHandlers = require('./features/admin');
const registerCultClashHandlers = require('./features/cultClash');
const registerMiscHandlers = require('./features/misc');
const registerProphecyHandlers = require('./features/prophecy');
const registerShadowGameHandlers = require('./features/shadowGame');
const { registerModerationHandlers } = require('./features/moderation');
const { registerConfigHandlers, saveWebAppConfig } = require('./features/config');
const { setupProtectronHandlers } = require('./features/protectron');
const { registerTagAllHandlers } = require('./features/tagall');

const adminId = process.env.ADMIN_TELEGRAM_ID;

if (!adminId) {
    console.error("ADMIN_TELEGRAM_ID not found. Please add it to your .env file.");
    process.exit(1);
}

// Setup express server for webhooks (in production)
setupServer();

// Register all handlers
registerAdminHandlers(bot);
registerCultClashHandlers(bot);
registerMiscHandlers(bot);
registerProphecyHandlers(bot);
registerShadowGameHandlers(bot);
registerModerationHandlers(bot);
registerConfigHandlers(bot);
setupProtectronHandlers(bot, adminId);
registerTagAllHandlers(bot);

bot.on('web_app_data', async (webAppData) => {
    const chatId = webAppData.message.chat.id;
    try {
        const data = JSON.parse(webAppData.data);
        await saveWebAppConfig(chatId, data);
        bot.sendMessage(chatId, "Settings have been updated successfully via the web panel!");
    } catch (error) {
        console.error("Error processing web app data:", error);
        bot.sendMessage(chatId, "There was an error saving your settings.");
    }
});

console.log('Mr. Yunks bot has started...');