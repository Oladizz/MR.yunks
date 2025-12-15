async function updateLastBotMessage(bot, chatId, game, newMessageText, options = {}) {
    if (game.lastBotMessageId) {
        try {
            await bot.deleteMessage(chatId, game.lastBotMessageId);
        } catch (error) {
            console.warn(`Could not delete old game message ${game.lastBotMessageId}:`, error.message);
            // Ignore error, message might already be deleted or not found
        }
    }
    try {
        const sentMessage = await bot.sendMessage(chatId, newMessageText, options);
        game.lastBotMessageId = sentMessage.message_id;
    } catch (error) {
        console.error("Error sending new game message:", error);
    }
}

module.exports = { updateLastBotMessage };
