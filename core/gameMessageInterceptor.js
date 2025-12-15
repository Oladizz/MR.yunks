const { updateLastBotMessage } = require('./gameMessageUtils');
const { shadowGames, renderShadowGameStatus } = require('../features/shadowGame');
const { cultClashGames, renderCultClashStatus } = require('../features/cultClash');

function registerGameMessageInterceptor(bot) {
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        // Ignore messages from bots or commands
        if (msg.from.is_bot || (msg.text && msg.text.startsWith('/'))) {
            return;
        }

        let game;
        let renderStatusFunction;

        // Check for active Shadow Game
        if (shadowGames[chatId] && shadowGames[chatId].isGameRunning) {
            game = shadowGames[chatId];
            renderStatusFunction = renderShadowGameStatus;
        }
        // Check for active Cult Clash Game
        else if (cultClashGames[chatId] && cultClashGames[chatId].isGameRunning) {
            game = cultClashGames[chatId];
            renderStatusFunction = renderCultClashStatus;
        }

        if (game && renderStatusFunction) {
            const { text, options } = renderStatusFunction(chatId);
            if (text) {
                // Delete the user's message (as per requirement "bot message should be the last")
                try {
                    await bot.deleteMessage(chatId, msg.message_id);
                } catch (error) {
                    console.warn(`Could not delete user message ${msg.message_id} during game:`, error.message);
                }
                await updateLastBotMessage(bot, chatId, game, text, options);
            }
        }
    });
}

module.exports = { registerGameMessageInterceptor };
