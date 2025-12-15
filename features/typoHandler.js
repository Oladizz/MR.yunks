const levenshtein = require('js-levenshtein'); // A common library for Levenshtein distance
const { sendRateLimitedMessage } = require('../core/telegramUtils');
const { defaultCommands, adminCommands } = require('../core/commands'); // Import command lists

function registerTypoHandler(bot) {
    // Collect all command names
    const allCommands = [
        ...defaultCommands.map(cmd => cmd.command),
        ...adminCommands.map(cmd => cmd.command)
    ].filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates

    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const messageText = msg.text;

        // Only process messages that start with / and are not handled by other commands
        if (messageText && messageText.startsWith('/')) {
            const command = messageText.split(' ')[0].substring(1).toLowerCase(); // Extract command name without '/'

            // Check if it's an exact match for any registered command (handled elsewhere)
            // Or if it's already an existing handler. This 'on' message is meant as a fallback.
            // No direct way to check if other handlers 'caught' it, so we rely on this being registered last.

            let bestMatch = null;
            let minDistance = 3; // Threshold for "did you mean" suggestions. Adjust as needed.

            for (const cmd of allCommands) {
                const distance = levenshtein(command, cmd.toLowerCase());
                if (distance < minDistance) {
                    minDistance = distance;
                    bestMatch = cmd;
                }
            }

            if (bestMatch) {
                sendRateLimitedMessage(bot, chatId, `🤔 Did you mean: /${bestMatch}?`);
            }
        }
    });
}

module.exports = { registerTypoHandler };
