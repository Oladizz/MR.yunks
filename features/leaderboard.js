const { db } = require('../core/firebase');
const { sendRateLimitedMessage } = require('../core/telegramUtils');

function registerLeaderboardHandlers(bot) {
    bot.onText(/\/leaderboard(?:\s+(\d+))?/, async (msg, match) => {
        const chatId = msg.chat.id;
        const requestedLimit = match[1] ? parseInt(match[1], 10) : 10;
        const limit = Math.min(Math.max(1, requestedLimit), 20); // Limit to between 1 and 20

        try {
            const usersRef = db.collection('users');
            const snapshot = await usersRef.orderBy('xp', 'desc').limit(limit).get();

            if (snapshot.empty) {
                sendRateLimitedMessage(bot, chatId, "No users found with XP yet.");
                return;
            }

            let leaderboardMessage = "🏆 *XP Leaderboard* 🏆\n\n";
            let rank = 1;
            snapshot.forEach(doc => {
                const userData = doc.data();
                console.log(`Leaderboard: User ID: ${doc.id}, Data:`, userData); // Debug log
                const username = userData.username || `${userData.first_name} ${userData.last_name || ''}`.trim();
                leaderboardMessage += `${rank}. ${username} - ${userData.xp || 0} XP\n`;
                rank++;
            });
            sendRateLimitedMessage(bot, chatId, leaderboardMessage, { parse_mode: 'Markdown' });

        } catch (error) {
            console.error("Error fetching XP leaderboard:", error);
            sendRateLimitedMessage(bot, chatId, "An error occurred while fetching the XP leaderboard.");
        }
    });
}

module.exports = registerLeaderboardHandlers;
