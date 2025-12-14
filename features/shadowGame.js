const { getUserByUsername, awardXp } = require('../core/users');
const shadowGames = {};

// Function to update and manage the status panel
async function updateStatusPanel(chatId, bot) {
    const game = shadowGames[chatId];
    if (!game) return;

    const itPlayer = Object.values(game.players).find(p => p.isIt);
    const statusText = `
🌑 SHADOW STATUS
• It: ${itPlayer ? `@${itPlayer.username}` : 'None'}
• Time left: ${game.joinTimeLeft !== null ? `${Math.floor(game.joinTimeLeft / 60)}:${(game.joinTimeLeft % 60).toString().padStart(2, '0')}` : 'N/A'}
• Players remaining: ${Object.keys(game.players).length}
• Eliminated: ${game.eliminated.length}
• Join time: ${game.joinDuration / 60} min
• Round: ${game.round}
    `;

    if (game.statusMessageId) {
        try {
            await bot.editMessageText(statusText, {
                chat_id: chatId,
                message_id: game.statusMessageId,
            });
        } catch (error) {
            // If message not found, post a new one
            const newStatusMsg = await bot.sendMessage(chatId, statusText);
            game.statusMessageId = newStatusMsg.message_id;
        }
    } else {
        const newStatusMsg = await bot.sendMessage(chatId, statusText);
        game.statusMessageId = newStatusMsg.message_id;
    }
}

function startJoinTimer(chatId, bot) {
    const game = shadowGames[chatId];
    if (!game || game.joinTimer) return;

    game.joinTimer = setInterval(async () => {
        game.joinTimeLeft--;
        if (game.joinTimeLeft % 10 === 0) { // Update every 10 seconds
            updateStatusPanel(chatId, bot);
        }
        if (game.joinTimeLeft <= 0) {
            clearInterval(game.joinTimer);
            game.isJoiningPhase = false;
            bot.editMessageText('JOINING PHASE CLOSED', {
                chat_id: chatId,
                message_id: game.joinMessageId
            });

            if (Object.keys(game.players).length < 2) {
                bot.sendMessage(chatId, "Not enough players joined. The Shadow Game is canceled.");
                delete shadowGames[chatId];
                return;
            }

            const playerIds = Object.keys(game.players);
            const firstItId = playerIds[Math.floor(Math.random() * playerIds.length)];
            game.players[firstItId].isIt = true;
            game.round = 1;
            
            bot.sendMessage(chatId, `👁️ THE HUNT BEGINS
@${game.players[firstItId].username} is IT

Use /s @username to TAG
⏳ Tag timer: 25 seconds`);
            updateStatusPanel(chatId, bot);
            startTagTimer(chatId, firstItId, bot);
        }
    }, 1000);
}

function startTagTimer(chatId, itId, bot) {
    const game = shadowGames[chatId];
    if (!game) return;

    if (game.tagTimer) clearTimeout(game.tagTimer);

    game.tagTimer = setTimeout(() => {
        if (game.players[itId] && game.players[itId].isIt) {
            const itUsername = game.players[itId].username;
            bot.sendMessage(chatId, `☠️ @${itUsername} was swallowed by the darkness for failing to tag in time.`);
            game.eliminated.push(itUsername);
            delete game.players[itId];

            const playerIds = Object.keys(game.players);
            if (playerIds.length > 1) {
                const newItId = playerIds[Math.floor(Math.random() * playerIds.length)];
                game.players[newItId].isIt = true;
                game.round++;
                bot.sendMessage(chatId, `@${game.players[newItId].username} is now IT.`);
                updateStatusPanel(chatId, bot);
                startTagTimer(chatId, newItId, bot);
            } else if (playerIds.length === 1) {
                const winnerUsername = game.players[playerIds[0]].username;
                bot.sendMessage(chatId, `👑 WINNER OF THE SHADOWS
@${winnerUsername} stands alone
🌑 The darkness bows.`);
                delete shadowGames[chatId];
            } else {
                bot.sendMessage(chatId, "Everyone has been consumed by the shadows. The game is over.");
                delete shadowGames[chatId];
            }
        }
    }, 25000); // 25-second tag timer
}

function registerShadowGameHandlers(bot) {
    bot.onText(/\/js/, (msg) => {
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
            statusMessageId: null,
            joinMessageId: null,
        };

        const opts = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '1 min', callback_data: 'sg_time_60' }, { text: '2 min', callback_data: 'sg_time_120' }, { text: '3 min', callback_data: 'sg_time_180' }],
                    [{ text: '4 min', callback_data: 'sg_time_240' }, { text: '5 min', callback_data: 'sg_time_300' }]
                ]
            }
        };
        bot.sendMessage(chatId, `🌑 SHADOW GAME SETUP
@${msg.from.username}, choose how long players can join:`, opts);
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
            bot.sendMessage(chatId, `Could not find a player named @${taggedUsername} in this game. You have been removed.`);
            game.eliminated.push(game.players[itId].username);
            delete game.players[itId];
            
            const playerIds = Object.keys(game.players);
            if (playerIds.length > 1) {
                const newItId = playerIds[Math.floor(Math.random() * playerIds.length)];
                game.players[newItId].isIt = true;
                game.round++;
                bot.sendMessage(chatId, `@${game.players[newItId].username} is now IT.`);
                updateStatusPanel(chatId, bot);
                startTagTimer(chatId, newItId, bot);
            } else if (playerIds.length === 1) {
                const winnerUsername = game.players[playerIds[0]].username;
                bot.sendMessage(chatId, `👑 WINNER OF THE SHADOWS
@${winnerUsername} stands alone
🌑 The darkness bows.`);
                delete shadowGames[chatId];
            } else {
                bot.sendMessage(chatId, "Everyone has been consumed by the shadows. The game is over.");
                delete shadowGames[chatId];
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

        bot.sendMessage(chatId, `🕶️ SHADOWED
@${game.players[itId].username} tagged @${taggedUsername}
@${taggedUsername} is IT
⏳ Timer reset to 25 seconds`);
        updateStatusPanel(chatId, bot);
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
            bot.sendMessage(chatId, `👤 @${username} entered the shadows…`);
            updateStatusPanel(chatId, bot);
            bot.answerCallbackQuery(callbackQuery.id);
        }
    });
}

module.exports = registerShadowGameHandlers;
