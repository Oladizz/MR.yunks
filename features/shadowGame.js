const { getUserByUsername, awardXp } = require('../core/users');
const shadowGames = {};

// Function to generate the status message and keyboard, without sending
function renderShadowGameStatus(chatId) {
    const game = shadowGames[chatId];
    if (!game) return { text: null, options: null };

    const itPlayer = Object.values(game.players).find(p => p.isIt);
    const statusText = `
🌑 SHADOW STATUS
• It: ${itPlayer ? `<code>@${itPlayer.username}</code>` : 'None'}
• Time left: ${game.joinTimeLeft !== null ? `${Math.floor(game.joinTimeLeft / 60)}:${(game.joinTimeLeft % 60).toString().padStart(2, '0')}` : 'N/A'}
• Players remaining: ${Object.keys(game.players).length}
• Eliminated: ${game.eliminated.length}
• Join time: ${game.joinDuration / 60} min
• Round: ${game.round}
    `;

    // Only include join button if in joining phase
    let reply_markup = {};
    if (game.isJoiningPhase) {
        reply_markup = {
            inline_keyboard: [[{ text: '🕶️ Enter the Shadows', callback_data: 'sg_join' }]]
        };
    }

    return { text: statusText, options: { reply_markup: reply_markup, parse_mode: 'HTML' } };
}

// Function to update and manage the status panel
async function updateStatusPanel(bot, chatId) { // Changed order of args to match standard `bot` first
    const game = shadowGames[chatId];
    if (!game) return;

    const { text, options } = renderShadowGameStatus(chatId);
    if (!text) return;

    if (game.statusMessageId) {
        try {
            await bot.editMessageText(text, {
                chat_id: chatId,
                message_id: game.statusMessageId,
                ...options
            });
        } catch (error) {
            console.error("Error editing Shadow Game status message:", error.message);
            // If message not found (e.g., deleted by user), post a new one
            const newStatusMsg = await bot.sendMessage(chatId, text, options);
            game.statusMessageId = newStatusMsg.message_id;
        }
    } else {
        const newStatusMsg = await bot.sendMessage(chatId, text, options);
        game.statusMessageId = newStatusMsg.message_id;
    }
}

function startJoinTimer(chatId, bot) {
    const game = shadowGames[chatId];
    if (!game || game.joinTimer) return;

    game.joinTimer = setInterval(async () => {
        game.joinTimeLeft--;
        if (game.joinTimeLeft % 10 === 0) { // Update every 10 seconds
            updateStatusPanel(bot, chatId);
        }
        if (game.joinTimeLeft <= 0) {
            clearInterval(game.joinTimer);
            game.isJoiningPhase = false;
            
            // Edit the join message to indicate phase closed
            if (game.joinMessageId) {
                try {
                    await bot.editMessageText('JOINING PHASE CLOSED', {
                        chat_id: chatId,
                        message_id: game.joinMessageId
                    });
                } catch (error) {
                    console.error("Error editing join message to close phase:", error);
                    // Fallback: send new message and update lastBotMessageId
                    const sentMsg = await bot.sendMessage(chatId, 'JOINING PHASE CLOSED');
                    game.lastBotMessageId = sentMsg.message_id;
                }
            } else {
                // Fallback: send new message and update lastBotMessageId
                const sentMsg = await bot.sendMessage(chatId, 'JOINING PHASE CLOSED');
                game.lastBotMessageId = sentMsg.message_id;
            }

            if (Object.keys(game.players).length < 2) {
                const noPlayersMessage = "Not enough players joined. The Shadow Game is canceled.";
                if (game.gameMessageId) {
                    try {
                        await bot.editMessageText(noPlayersMessage, {
                            chat_id: chatId,
                            message_id: game.gameMessageId,
                        });
                        game.lastBotMessageId = game.gameMessageId;
                    } catch (error) {
                        console.error("Error editing game message for insufficient players:", error);
                        const sentMsg = await bot.sendMessage(chatId, noPlayersMessage);
                        game.lastBotMessageId = sentMsg.message_id;
                    }
                } else {
                    const sentMsg = await bot.sendMessage(chatId, noPlayersMessage);
                    game.lastBotMessageId = sentMsg.message_id;
                }
                delete shadowGames[chatId];
                game.gameMessageId = null;
                game.statusMessageId = null;
                game.lastBotMessageId = null;
                return;
            }

            const playerIds = Object.keys(game.players);
            const firstItId = playerIds[Math.floor(Math.random() * playerIds.length)];
            game.players[firstItId].isIt = true;
            game.round = 1;
            
            const huntMessageText = `👁️ THE HUNT BEGINS
<code>@${game.players[firstItId].username}</code> is IT

Use /s @username to TAG
⏳ Tag timer: 25 seconds`;
            if (game.gameMessageId) {
                try {
                    await bot.editMessageText(huntMessageText, {
                        chat_id: chatId,
                        message_id: game.gameMessageId,
                        parse_mode: 'HTML'
                    });
                    game.lastBotMessageId = game.gameMessageId;
                } catch (error) {
                    console.error("Error editing hunt message:", error);
                    const sentMsg = await bot.sendMessage(chatId, huntMessageText, { parse_mode: 'HTML' });
                    game.gameMessageId = sentMsg.message_id;
                    game.lastBotMessageId = sentMsg.message_id;
                }
            } else {
                const sentMsg = await bot.sendMessage(chatId, huntMessageText, { parse_mode: 'HTML' });
                game.gameMessageId = sentMsg.message_id;
                game.lastBotMessageId = sentMsg.message_id;
            }
            updateStatusPanel(bot, chatId);
            startTagTimer(chatId, firstItId, bot);
        }
    }, 1000);
}

function startTagTimer(chatId, itId, bot) {
    const game = shadowGames[chatId];
    if (!game) return;

    if (game.tagTimer) clearTimeout(game.tagTimer);

    game.tagTimer = setTimeout(async () => { // Made async to await bot.editMessageText
        if (game.players[itId] && game.players[itId].isIt) {
            const itUsername = game.players[itId].username;
            let messageToEditContent = `☠️ <code>@${itUsername}</code> was swallowed by the darkness for failing to tag in time.`;

            game.eliminated.push(itUsername);
            delete game.players[itId];

            const playerIds = Object.keys(game.players);
            if (playerIds.length > 1) {
                const newItId = playerIds[Math.floor(Math.random() * playerIds.length)];
                game.players[newItId].isIt = true;
                game.round++;
                messageToEditContent += `\n<code>@${game.players[newItId].username}</code> is now IT.
⏳ Tag timer: 25 seconds`;

                if (game.gameMessageId) {
                    try {
                        await bot.editMessageText(messageToEditContent, {
                            chat_id: chatId,
                            message_id: game.gameMessageId,
                            parse_mode: 'HTML'
                        });
                        game.lastBotMessageId = game.gameMessageId;
                    } catch (error) {
                        console.error("Error editing game message after elimination:", error);
                        const sentMsg = await bot.sendMessage(chatId, messageToEditContent, { parse_mode: 'HTML' });
                        game.gameMessageId = sentMsg.message_id;
                        game.lastBotMessageId = sentMsg.message_id;
                    }
                } else {
                    const sentMsg = await bot.sendMessage(chatId, messageToEditContent, { parse_mode: 'HTML' });
                    game.gameMessageId = sentMsg.message_id;
                    game.lastBotMessageId = sentMsg.message_id;
                }
                updateStatusPanel(bot, chatId);
                startTagTimer(chatId, newItId, bot);
            } else if (playerIds.length === 1) {
                const winnerUsername = game.players[playerIds[0]].username;
                const winnerMessage = `👑 WINNER OF THE SHADOWS
<code>@${winnerUsername}</code> stands alone
🌑 The darkness bows.`;
                if (game.gameMessageId) {
                    try {
                        await bot.editMessageText(winnerMessage, {
                            chat_id: chatId,
                            message_id: game.gameMessageId,
                            parse_mode: 'HTML'
                        });
                        game.lastBotMessageId = game.gameMessageId;
                    } catch (error) {
                        console.error("Error editing game message for winner:", error);
                        const sentMsg = await bot.sendMessage(chatId, winnerMessage, { parse_mode: 'HTML' });
                        game.gameMessageId = sentMsg.message_id;
                        game.lastBotMessageId = sentMsg.message_id;
                    }
                } else {
                    const sentMsg = await bot.sendMessage(chatId, winnerMessage, { parse_mode: 'HTML' });
                    game.gameMessageId = sentMsg.message_id;
                    game.lastBotMessageId = sentMsg.message_id;
                }
                delete shadowGames[chatId];
                game.gameMessageId = null;
                game.statusMessageId = null;
                game.lastBotMessageId = null; // Clear when game ends
            } else {
                const gameOverMessage = "Everyone has been consumed by the shadows. The game is over.";
                if (game.gameMessageId) {
                    try {
                        await bot.editMessageText(gameOverMessage, {
                            chat_id: chatId,
                            message_id: game.gameMessageId,
                            parse_mode: 'HTML'
                        });
                        game.lastBotMessageId = game.gameMessageId;
                    } catch (error) {
                        console.error("Error editing game message for game over:", error);
                        const sentMsg = await bot.sendMessage(chatId, gameOverMessage, { parse_mode: 'HTML' });
                        game.gameMessageId = sentMsg.message_id;
                        game.lastBotMessageId = sentMsg.message_id;
                    }
                } else {
                    const sentMsg = await bot.sendMessage(chatId, gameOverMessage, { parse_mode: 'HTML' });
                    game.gameMessageId = sentMsg.message_id;
                    game.lastBotMessageId = sentMsg.message_id;
                }
                delete shadowGames[chatId];
                game.gameMessageId = null;
                game.statusMessageId = null;
                game.lastBotMessageId = null; // Clear when game ends
            }
        }
    }, 25000); // 25-second tag timer
}

function registerShadowGameHandlers(bot) {
    bot.onText(/\/js/, async (msg) => {
        const chatId = msg.chat.id;
        if (shadowGames[chatId]) {
            bot.sendMessage(chatId, "A Shadow Game is already being set up or is in progress.");
            return;
        }

        shadowGames[chatId] = {
            starterId: msg.from.id,
            players: {},
            isJoiningPhase: true,
            joinDuration: 0,
            joinTimeLeft: null,
            joinTimer: null,
            tagTimer: null,
            round: 0,
            eliminated: [],
            statusMessageId: null, // This is for the status panel, not the main game message
            joinMessageId: null, // This is for the join message, if distinct from gameMessageId
            gameMessageId: null, // This will be the main persistent game message ID
            lastBotMessageId: null, // This will track the message to be pushed to bottom
        };
        const game = shadowGames[chatId]; // Declare game variable here and assign the initialized object

        const howToPlayMessage = `<b>🌑 SHADOW GAME - HOW TO PLAY 🌑</b>

<b>Objective:</b> Survive the hunt!
<b>Starting the Game:</b> Use /js to initiate a new game.
<b>Joining:</b> During the joining phase, tap the 'Enter the Shadows' button to join.
<b>The Hunt:</b> One player is randomly chosen as 'IT'. Their goal is to 'tag' another player using the /s @username command within 25 seconds.
<b>Elimination:</b> If 'IT' fails to tag someone in time, they are eliminated.
<b>New 'IT':</b> If 'IT' successfully tags someone, the tagged player becomes the new 'IT', and the timer resets.
<b>Winning:</b> The last player remaining wins!

Good luck, and may the shadows be ever in your favor!`;
        const sentHowToPlayMessage = await bot.sendMessage(chatId, howToPlayMessage, { parse_mode: 'HTML' });

        const opts = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '1 min', callback_data: 'sg_time_60' }, { text: '2 min', callback_data: 'sg_time_120' }, { text: '3 min', callback_data: 'sg_time_180' }],
                    [{ text: '4 min', callback_data: 'sg_time_240' }, { text: '5 min', callback_data: 'sg_time_300' }]
                ]
            }
        };
        const sentSetupMessage = await bot.sendMessage(chatId, `🌑 SHADOW GAME SETUP
@${msg.from.username}, choose how long players can join:`, opts);

        game.gameMessageId = sentSetupMessage.message_id; // Main game message is the setup message with buttons
        game.lastBotMessageId = sentSetupMessage.message_id; // Initially, this is the message to track
        game.statusMessageId = sentHowToPlayMessage.message_id; // Use this for the "how to play" to avoid editing the main one

    });
    
    bot.onText(/\/s @(.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const itId = msg.from.id;
        const taggedUsername = match[1];
        const game = shadowGames[chatId];

        if (!game || !game.isGameRunning || !game.players[itId] || !game.players[itId].isIt) {
            bot.sendMessage(chatId, "You are not It or there is no game running.");
            return;
        }

        const taggedPlayer = await getUserByUsername(taggedUsername);
        if (!taggedPlayer || !game.players[taggedPlayer.id]) {
            // Player tagged a non-existent user or a user not in the game
            const eliminationMessage = `Could not find a player named <code>@${taggedUsername}</code> in this game. ☠️ <code>@${game.players[itId].username}</code> has been removed for tagging an invalid target.`;
            if (game.gameMessageId) {
                try {
                    await bot.editMessageText(eliminationMessage, {
                        chat_id: chatId,
                        message_id: game.gameMessageId,
                        parse_mode: 'HTML'
                    });
                    game.lastBotMessageId = game.gameMessageId;
                } catch (error) {
                    console.error("Error editing game message for invalid tag:", error);
                    const sentMsg = await bot.sendMessage(chatId, eliminationMessage, { parse_mode: 'HTML' });
                    game.gameMessageId = sentMsg.message_id;
                    game.lastBotMessageId = sentMsg.message_id;
                }
            } else {
                const sentMsg = await bot.sendMessage(chatId, eliminationMessage, { parse_mode: 'HTML' });
                game.gameMessageId = sentMsg.message_id;
                game.lastBotMessageId = sentMsg.message_id;
            }

            game.eliminated.push(game.players[itId].username);
            delete game.players[itId];
            
            const playerIds = Object.keys(game.players);
            if (playerIds.length > 1) {
                const newItId = playerIds[Math.floor(Math.random() * playerIds.length)];
                game.players[newItId].isIt = true;
                game.round++;
                const newItMessageText = `\n<code>@${game.players[newItId].username}</code> is now IT.`;
                if (game.gameMessageId) {
                     try {
                        await bot.editMessageText(eliminationMessage + newItMessageText + `\n⏳ Tag timer: 25 seconds`, {
                            chat_id: chatId,
                            message_id: game.gameMessageId,
                            parse_mode: 'HTML'
                        });
                        game.lastBotMessageId = game.gameMessageId;
                    } catch (error) {
                        console.error("Error editing game message for new IT after invalid tag:", error);
                        const sentMsg = await bot.sendMessage(chatId, newItMessageText, { parse_mode: 'HTML' });
                        game.gameMessageId = sentMsg.message_id;
                        game.lastBotMessageId = sentMsg.message_id;
                    }
                } else {
                    const sentMsg = await bot.sendMessage(chatId, newItMessageText, { parse_mode: 'HTML' });
                    game.gameMessageId = sentMsg.message_id;
                    game.lastBotMessageId = sentMsg.message_id;
                }
                updateStatusPanel(bot, chatId);
                startTagTimer(chatId, newItId, bot);
            } else if (playerIds.length === 1) {
                const winnerUsername = game.players[playerIds[0]].username;
                const winnerMessage = `👑 WINNER OF THE SHADOWS
<code>@${winnerUsername}</code> stands alone
🌑 The darkness bows.`;
                if (game.gameMessageId) {
                    try {
                        await bot.editMessageText(winnerMessage, {
                            chat_id: chatId,
                            message_id: game.gameMessageId,
                            parse_mode: 'HTML'
                        });
                        game.lastBotMessageId = game.gameMessageId;
                    } catch (error) {
                        console.error("Error editing game message for winner after invalid tag:", error);
                        const sentMsg = await bot.sendMessage(chatId, winnerMessage, { parse_mode: 'HTML' });
                        game.gameMessageId = sentMsg.message_id;
                        game.lastBotMessageId = sentMsg.message_id;
                    }
                } else {
                    const sentMsg = await bot.sendMessage(chatId, winnerMessage, { parse_mode: 'HTML' });
                    game.gameMessageId = sentMsg.message_id;
                    game.lastBotMessageId = sentMsg.message_id;
                }
                delete shadowGames[chatId];
                game.gameMessageId = null;
                game.statusMessageId = null;
                game.lastBotMessageId = null; // Clear when game ends
            } else {
                const gameOverMessage = "Everyone has been consumed by the shadows. The game is over.";
                if (game.gameMessageId) {
                    try {
                        await bot.editMessageText(gameOverMessage, {
                            chat_id: chatId,
                            message_id: game.gameMessageId,
                            parse_mode: 'HTML'
                        });
                        game.lastBotMessageId = game.gameMessageId;
                    } catch (error) {
                        console.error("Error editing game message for game over after invalid tag:", error);
                        const sentMsg = await bot.sendMessage(chatId, gameOverMessage, { parse_mode: 'HTML' });
                        game.gameMessageId = sentMsg.message_id;
                        game.lastBotMessageId = sentMsg.message_id;
                    }
                } else {
                    const sentMsg = await bot.sendMessage(chatId, gameOverMessage, { parse_mode: 'HTML' });
                    game.gameMessageId = sentMsg.message_id;
                    game.lastBotMessageId = sentMsg.message_id;
                }
                delete shadowGames[chatId];
                game.gameMessageId = null;
                game.statusMessageId = null;
                game.lastBotMessageId = null; // Clear when game ends
            }
            return;
        }
        
        if (taggedPlayer.id === itId.toString()) {
            bot.sendMessage(chatId, "You cannot tag yourself!");
            return;
        }

        game.players[itId].isIt = false;
        game.players[taggedPlayer.id].isIt = true;
        game.round++;

        const tagMessage = `🕶️ SHADOWED
<code>@${game.players[itId].username}</code> tagged <code>@${taggedUsername}</code>
<code>@${taggedUsername}</code> is IT
⏳ Timer reset to 25 seconds`;

        if (game.gameMessageId) {
            try {
                await bot.editMessageText(tagMessage, {
                    chat_id: chatId,
                    message_id: game.gameMessageId,
                    parse_mode: 'HTML'
                });
                game.lastBotMessageId = game.gameMessageId;
            } catch (error) {
                console.error("Error editing game message after tag:", error);
                const sentMsg = await bot.sendMessage(chatId, tagMessage, { parse_mode: 'HTML' });
                game.gameMessageId = sentMsg.message_id;
                game.lastBotMessageId = sentMsg.message_id;
            }
        } else {
            const sentMsg = await bot.sendMessage(chatId, tagMessage, { parse_mode: 'HTML' });
            game.gameMessageId = sentMsg.message_id;
            game.lastBotMessageId = sentMsg.message_id;
        }
        updateStatusPanel(bot, chatId);
        startTagTimer(chatId, taggedPlayer.id, bot);
    });

    bot.on('callback_query', async (callbackQuery) => {
        const msg = callbackQuery.message;
        const chatId = msg.chat.id;
        const game = shadowGames[chatId];
        const data = callbackQuery.data;

        if (!game) return;

        if (data.startsWith('sg_time_')) {
            if (callbackQuery.from.id !== game.starterId) {
                bot.answerCallbackQuery(callbackQuery.id, { text: "Only the person who started the game can select the time." });
                return;
            }
            
            const timeInSeconds = parseInt(data.split('_')[2], 10);
            game.joinDuration = timeInSeconds;
            game.joinTimeLeft = timeInSeconds;

            bot.deleteMessage(chatId, msg.message_id);

            const joinMessage = await bot.sendMessage(chatId, `🌒 JOIN THE SHADOWS
Tap to enter…
⏳ Time left: ${Math.floor(timeInSeconds / 60)}:00 minutes`, {
                reply_markup: {
                    inline_keyboard: [[{ text: '🕶️ Enter the Shadows', callback_data: 'sg_join' }]]
                }
            });
            game.joinMessageId = joinMessage.message_id;
            
            startJoinTimer(chatId, bot);
            bot.answerCallbackQuery(callbackQuery.id);
        } else if (data === 'sg_join') {
            const userId = callbackQuery.from.id;
            const username = callbackQuery.from.username;

            if (game.players[userId]) {
                bot.answerCallbackQuery(callbackQuery.id, { text: "You are already in the game." });
                return;
            }

            if (!game.isJoiningPhase) {
                bot.answerCallbackQuery(callbackQuery.id, { text: "The joining phase is over." });
                return;
            }
            
            game.players[userId] = { username, isIt: false };
            await awardXp(userId, 5); // Award XP for joining
            
            if (game.joinMessageId) {
                try {
                    const currentJoinMessage = (await bot.editMessageText(`🌒 JOIN THE SHADOWS
Tap to enter…
⏳ Time left: ${Math.floor(game.joinTimeLeft / 60)}:${(game.joinTimeLeft % 60).toString().padStart(2, '0')} minutes

<i>Joined Players: ${Object.values(game.players).map(p => `<code>@${p.username}</code>`).join(', ')}</i>`, {
                        chat_id: chatId,
                        message_id: game.joinMessageId,
                        reply_markup: {
                            inline_keyboard: [[{ text: '🕶️ Enter the Shadows', callback_data: 'sg_join' }]]
                        },
                        parse_mode: 'HTML'
                    })).text;
                    game.lastBotMessageId = game.joinMessageId;
                } catch (error) {
                    console.error("Error editing join message:", error);
                    const sentMsg = await bot.sendMessage(chatId, `👤 @${username} entered the shadows…`); // Fallback
                    game.lastBotMessageId = sentMsg.message_id;
                }
            } else {
                const sentMsg = await bot.sendMessage(chatId, `👤 @${username} entered the shadows…`); // Fallback if joinMessageId is somehow missing
                game.lastBotMessageId = sentMsg.message_id;
            }
            updateStatusPanel(bot, chatId);
            bot.answerCallbackQuery(callbackQuery.id);
        }
    });
}

module.exports = { registerShadowGameHandlers, shadowGames, renderShadowGameStatus };
