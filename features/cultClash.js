const { addPoints } = require('../core/points');
const cultClashGames = {};

function startElimination(chatId, bot) {
    const game = cultClashGames[chatId];
    if (!game) return;
    let players = Object.keys(game.players);
    const eliminationInterval = setInterval(() => {
        if (players.length <= 3) {
            clearInterval(eliminationInterval);
            const winnerIds = players;
            const winners = winnerIds.map(id => `@${game.players[id]}`).join(', ');
            
            winnerIds.forEach(id => addPoints(id, 100));

            bot.sendMessage(chatId, `🏆 The Cult Clash is over! The winners are: ${winners}. Each has been awarded 100 Yunk points!`);
            delete cultClashGames[chatId];
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
        bot.sendMessage(chatId, randomMessage);
        players.splice(eliminatedIndex, 1);
    }, 5000);
}

function registerCultClashHandlers(bot) {
    /**
     * The Cult Clash Game - Starting.
     */
    bot.onText(/\/start_cult_clash|\/cultclash/, (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const adminId = process.env.ADMIN_TELEGRAM_ID;

        if (userId.toString() !== adminId) {
            bot.sendMessage(chatId, "Only an admin can start the Cult Clash.");
            return;
        }
        if (cultClashGames[chatId] && cultClashGames[chatId].isGameRunning) {
            bot.sendMessage(chatId, "A Cult Clash game is already in progress.");
            return;
        }

        cultClashGames[chatId] = {
            players: {},
            isGameRunning: true,
            isJoiningPhase: true,
        };

        bot.sendMessage(chatId, "🔥 A Cult Clash is about to begin! 🔥\nYou have 30 seconds to join the fight. Type /join_clash to enter!");

        setTimeout(() => {
            if (cultClashGames[chatId]) {
                cultClashGames[chatId].isJoiningPhase = false;
                bot.sendMessage(chatId, "The joining phase is over! The clash begins now...");
                const playersCount = Object.keys(cultClashGames[chatId].players).length;
                if (playersCount < 2) {
                    bot.sendMessage(chatId, "Not enough players for a clash. Game over.");
                    delete cultClashGames[chatId];
                } else {
                    startElimination(chatId, bot);
                }
            }
        }, 30000);
    });

    /**
     * The Cult Clash Game - Joining.
     */
    bot.onText(/\/join_clash|\/join/, (msg) => {
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
        bot.sendMessage(chatId, `@${username} has joined the Cult Clash!`);
    });
}

module.exports = registerCultClashHandlers;
