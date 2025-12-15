require('dotenv').config();

const bot = require('./core/bot');
const setupServer = require('./core/server');
const registerAdminHandlers = require('./features/admin');
const { registerCultClashHandlers } = require('./features/cultClash');
const registerMiscHandlers = require('./features/misc');
const registerProphecyHandlers = require('./features/prophecy');
const { registerShadowGameHandlers } = require('./features/shadowGame');
const { registerModerationHandlers } = require('./features/moderation');
const { registerConfigHandlers, saveWebAppConfig } = require('./features/config');
const { setupProtectronHandlers } = require('./features/protectron');
const { registerTagAllHandlers } = require('./features/tagall');
const registerLeaderboardHandlers = require('./features/leaderboard');
const { registerTypoHandler } = require('./features/typoHandler');
const { registerGameMessageInterceptor } = require('./core/gameMessageInterceptor'); // New import
const { startCountdownCheck } = require('./core/countdownManager');

const { setBotCommands } = require('./core/commands');

const adminIdsString = process.env.ADMIN_TELEGRAM_ID;
let globalAdminIds = [];

if (adminIdsString) {
    globalAdminIds = adminIdsString.split(',').map(id => id.trim());
}

if (globalAdminIds.length === 0) {
    console.error("ADMIN_TELEGRAM_ID not found or empty. Please add it (comma-separated for multiple) to your .env file.");
    process.exit(1);
}

// Setup express server for webhooks (in production)
setupServer();

// Register all handlers
registerGameMessageInterceptor(bot); // Register game message interceptor first
registerAdminHandlers(bot, globalAdminIds); // Pass globalAdminIds here
registerCultClashHandlers(bot);
registerMiscHandlers(bot);
registerProphecyHandlers(bot);
registerShadowGameHandlers(bot);
registerModerationHandlers(bot);
registerConfigHandlers(bot);
setupProtectronHandlers(bot, globalAdminIds);
registerTagAllHandlers(bot);
registerLeaderboardHandlers(bot);
registerTypoHandler(bot); // Register typo handler last

startCountdownCheck(bot);
setBotCommands(bot); // Call setBotCommands after all handlers are registered

console.log('Mr. Yunks bot has started...');