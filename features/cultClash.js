const { addPoints } = require('../core/points');
const { updateLastBotMessage } = require('../core/gameMessageUtils'); // New import
const cultClashGames = {};

// Function to generate the Cult Clash status message and keyboard, without sending
function renderCultClashStatus(chatId) {
    const game = cultClashGames[chatId];
    if (!game) return { text: null, options: null };

    let statusMessage = `🔥 *Cult Clash is in progress!* 🔥\n`;

    if (game.isJoiningPhase) {
        statusMessage += `\n*Joining Phase:* Active (Ends in approx. ${Math.ceil(game.joinTimeLeft / 1000)}s)\n`;
        statusMessage += `*Players Joined:* ${Object.keys(game.players).length > 0 ? Object.values(game.players).map(p => `@${p}`).join(', ') : 'None yet.'}`;
        
        return {
            text: statusMessage,
            options: {
                reply_markup: {
                    inline_keyboard: [[{ text: '⚔️ Join the Clash', callback_data: 'cc_join' }]]
                },
                parse_mode: 'Markdown'
            }
        };
    } else {
        statusMessage += `\n*Round:* ${game.round || 1}\n`;
        statusMessage += `*Players Remaining:* ${Object.keys(game.players).length > 0 ? Object.values(game.players).map(p => `@${p}`).join(', ') : 'None'}\n`;
        if (game.eliminated.length > 0) {
            statusMessage += `*Eliminated:* ${game.eliminated.map(u => `@${u}`).join(', ')}\n`;
        }
    }

    return { text: statusMessage, options: { parse_mode: 'Markdown' } };
}


async function startElimination(chatId, bot) {
    const game = cultClashGames[chatId];
    if (!game) return;
    let players = Object.keys(game.players);
    const eliminationInterval = setInterval(async () => {
        if (players.length <= 3) {
            clearInterval(eliminationInterval);
            const winnerIds = players;
            const winners = winnerIds.map(id => `@${game.players[id]}`).join(', ');
            
            winnerIds.forEach(id => addPoints(id, 20));

            const winnerMessage = `🏆 The Cult Clash is over! The winners are: ${winners}. Each has been awarded 20 Yunk points!`;
            
            if (game.gameMessageId) {
                try {
                    await bot.editMessageText(winnerMessage, {
                        chat_id: chatId,
                        message_id: game.gameMessageId,
                        parse_mode: 'Markdown'
                    });
                    game.lastBotMessageId = game.gameMessageId; // Update lastBotMessageId
                } catch (error) {
                    console.error("Error editing winner message in Cult Clash:", error);
                    const sentMsg = await bot.sendMessage(chatId, winnerMessage, { parse_mode: 'Markdown' });
                    game.gameMessageId = sentMsg.message_id; // Update gameMessageId on fallback
                    game.lastBotMessageId = sentMsg.message_id; // Update lastBotMessageId
                }
            } else {
                const sentMsg = await bot.sendMessage(chatId, winnerMessage, { parse_mode: 'Markdown' });
                game.gameMessageId = sentMsg.message_id; // Update gameMessageId on fallback
                game.lastBotMessageId = sentMsg.message_id; // Update lastBotMessageId
            }

            delete cultClashGames[chatId];
            game.gameMessageId = null;
            game.currentMessageText = null;
            game.lastBotMessageId = null; // Clear when game ends
            return;
        }
        const eliminatedIndex = Math.floor(Math.random() * players.length);
        const eliminatedId = players[eliminatedIndex];
        const eliminatedUsername = game.players[eliminatedId];
        const eliminationMessages = [
            `@${eliminatedUsername} slipped off! ❌`,
            `@${eliminatedUsername} just got vaporized! 💨`,
            `The spirits have claimed @${eliminatedUsername}! 💀`,
        ];
        const randomMessage = eliminationMessages[Math.floor(Math.random() * eliminationMessages.length)];
        
        // Update the current message text and then edit the main game message
        game.currentMessageText = `${game.currentMessageText}\n${randomMessage}`;
        if (game.gameMessageId) {
            try {
                await bot.editMessageText(game.currentMessageText, {
                    chat_id: chatId,
                    message_id: game.gameMessageId,
                    parse_mode: 'Markdown'
                });
                game.lastBotMessageId = game.gameMessageId; // Update lastBotMessageId
            } catch (error) {
                console.error("Error editing elimination message in Cult Clash:", error);
                const sentMsg = await bot.sendMessage(chatId, game.currentMessageText, { parse_mode: 'Markdown' });
                game.gameMessageId = sentMsg.message_id; // Update gameMessageId on fallback
                game.lastBotMessageId = sentMsg.message_id; // Update lastBotMessageId
            }
        } else {
            const sentMsg = await bot.sendMessage(chatId, game.currentMessageText, { parse_mode: 'Markdown' });
            game.gameMessageId = sentMsg.message_id; // Update gameMessageId on fallback
            game.lastBotMessageId = sentMsg.message_id; // Update lastBotMessageId
        }

        players.splice(eliminatedIndex, 1);
    }, 5000);
}

function registerCultClashHandlers(bot) {
    /**
     * The Cult Clash Game - Starting.
     */
    bot.onText(/\/start_cult_clash|\/cultclash/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        if (cultClashGames[chatId] && cultClashGames[chatId].isGameRunning) {
            bot.sendMessage(chatId, "A Cult Clash game is already in progress.");
            return;
        }

        cultClashGames[chatId] = {
            players: {},
            isGameRunning: true,
            isJoiningPhase: true,
            gameMessageId: null,
            currentMessageText: "",
            lastBotMessageId: null, // New property to track the latest bot message for "push to bottom"
        };

        const initialMessageText = `🔥 A Cult Clash is about to begin! 🔥

*How to Play:*
1. All participants have 30 seconds to join the game using the /join_clash command.
2. Once the joining phase ends, players will be randomly eliminated one by one.
3. The last 3 players remaining will be declared the winners!
4. Winners will receive 20 Yunk points each.

You have 30 seconds to join the fight. Type /join_clash to enter!`;

        const sentMessage = await bot.sendMessage(chatId, initialMessageText, { parse_mode: 'Markdown' });
        cultClashGames[chatId].gameMessageId = sentMessage.message_id;
        cultClashGames[chatId].currentMessageText = initialMessageText; // Initialize current message text
        cultClashGames[chatId].lastBotMessageId = sentMessage.message_id; // Set lastBotMessageId initially

        setTimeout(async () => { // Made async
            if (cultClashGames[chatId]) {
                cultClashGames[chatId].isJoiningPhase = false;
                let messageToEndJoining = "The joining phase is over! The clash begins now...";
                const playersCount = Object.keys(cultClashGames[chatId].players).length;

                if (playersCount < 2) {
                    messageToEndJoining = "Not enough players for a clash. Game over.";
                    delete cultClashGames[chatId];
                } else {
                    startElimination(chatId, bot);
                }

                cultClashGames[chatId].currentMessageText = `${cultClashGames[chatId].currentMessageText}\n\n${messageToEndJoining}`;

                if (cultClashGames[chatId] && cultClashGames[chatId].gameMessageId) { // Check if game still exists
                    try {
                        await bot.editMessageText(cultClashGames[chatId].currentMessageText, {
                            chat_id: chatId,
                            message_id: cultClashGames[chatId].gameMessageId,
                            parse_mode: 'Markdown'
                        });
                        cultClashGames[chatId].lastBotMessageId = cultClashGames[chatId].gameMessageId; // Update lastBotMessageId
                    } catch (error) {
                        console.error("Error editing message to end joining phase in Cult Clash:", error);
                        const sentMsg = await bot.sendMessage(chatId, cultClashGames[chatId].currentMessageText, { parse_mode: 'Markdown' });
                        cultClashGames[chatId].gameMessageId = sentMsg.message_id; // Update gameMessageId on fallback
                        cultClashGames[chatId].lastBotMessageId = sentMsg.message_id; // Update lastBotMessageId
                    }
                } else {
                    const sentMsg = await bot.sendMessage(chatId, cultClashGames[chatId].currentMessageText, { parse_mode: 'Markdown' });
                    cultClashGames[chatId].gameMessageId = sentMsg.message_id; // Update gameMessageId on fallback
                    cultClashGames[chatId].lastBotMessageId = sentMsg.message_id; // Update lastBotMessageId
                }
            }
        }, 30000);
    });

    /**
     * The Cult Clash Game - Joining.
     */
    bot.onText(/\/join_clash|\/join/, async (msg) => { // Made async
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const username = msg.from.username || `${msg.from.first_name} ${msg.from.last_name || ''}`.trim();
        const game = cultClashGames[chatId];

        if (!game || !game.isGameRunning) {
            bot.sendMessage(chatId, "There is no Cult Clash game to join.");
            return;
        }
        if (!game.isJoiningPhase) {
            bot.sendMessage(chatId, "The joining phase for the Cult Clash is over.");
            return;
        }
        if (game.players[userId]) {
            bot.sendMessage(chatId, `@${username}, you are already in the clash.`);
            return;
        }
        game.players[userId] = username;
        
        // Edit the main game message to append the join message
        game.currentMessageText = `${game.currentMessageText}\n👤 @${username} has joined the Cult Clash!`;
        if (game.gameMessageId) {
            try {
                await bot.editMessageText(game.currentMessageText, {
                    chat_id: chatId,
                    message_id: game.gameMessageId,
                    parse_mode: 'Markdown'
                });
                game.lastBotMessageId = game.gameMessageId; // Update lastBotMessageId
            } catch (error) {
                console.error("Error editing join message in Cult Clash:", error);
                const sentMsg = await bot.sendMessage(chatId, game.currentMessageText, { parse_mode: 'Markdown' }); // Fallback
                game.gameMessageId = sentMsg.message_id; // Update gameMessageId on fallback
                game.lastBotMessageId = sentMsg.message_id; // Update lastBotMessageId
            }
        } else {
            const sentMsg = await bot.sendMessage(chatId, game.currentMessageText, { parse_mode: 'Markdown' }); // Fallback
            game.gameMessageId = sentMsg.message_id; // Update gameMessageId on fallback
            game.lastBotMessageId = sentMsg.message_id; // Update lastBotMessageId
        }
    });
}

module.exports = { registerCultClashHandlers, cultClashGames, renderCultClashStatus };
