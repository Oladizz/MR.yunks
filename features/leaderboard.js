const { db } = require('../core/firebase');
const { sendRateLimitedMessage } = require('../core/telegramUtils');

function registerLeaderboardHandlers(bot) {
    bot.onText(/\/leaderboard(?:\s+(\d+))?/, async (msg, match) => {
        const chatId = msg.chat.id;
        const requestedLimit = match[1] ? parseInt(match[1], 10) : 10;
        const limit = Math.min(Math.max(1, requestedLimit), 20); // Limit to between 1 and 20

        bot.sendChatAction(chatId, 'typing'); // Visual feedback

        try {
            const usersRef = db.collection('users');
            const snapshot = await usersRef.orderBy('xp', 'desc').limit(limit).get();

            if (snapshot.empty) {
                sendRateLimitedMessage(bot, chatId, "ℹ️ No users found with XP yet.");
                return;
            }

            let leaderboardMessage = "🏆 *XP Leaderboard* 🏆\n\n";
            const medals = ['🥇', '🥈', '🥉'];
            let rank = 1;
            snapshot.forEach(doc => {
                const userData = doc.data();
                const username = userData.username || `${userData.first_name || ''} ${userData.last_name || ''}`.trim();
                const rankPrefix = (rank <= medals.length) ? medals[rank - 1] : `${rank}.`;
                leaderboardMessage += `${rankPrefix} ${username} - ${userData.xp || 0} XP\n`;
                rank++;
            });

            // Fetch and display user's own rank
            const userId = msg.from.id;
            const userRef = db.collection('users').doc(userId.toString());
            const userDoc = await userRef.get();

            if (userDoc.exists) {
                const userXp = userDoc.data().xp || 0;
                // To find the user's actual rank, we need to query all users with more XP
                const higherRankedUsersSnapshot = await usersRef.where('xp', '>', userXp).count().get();
                const userRank = higherRankedUsersSnapshot.data().count + 1;
                const username = msg.from.username || `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim();
                
                leaderboardMessage += `\n\n_Your Rank: ${userRank}. ${username} - ${userXp} XP_`;
            } else {
                leaderboardMessage += `\n\n_Your Rank: Not yet ranked. Send messages to earn XP!_`;
            }
            
            sendRateLimitedMessage(bot, chatId, leaderboardMessage, { parse_mode: 'Markdown' });

        } catch (error) {
            console.error("Error fetching XP leaderboard:", error);
            let errorMessage = `❌ An error occurred while fetching the XP leaderboard: ${error.message}.`;
            if (error.code === 'failed-precondition' && error.message.includes('Firestore indexes')) {
                errorMessage += " This might be due to a missing Firestore index for 'users' collection on the 'xp' field.";
            }
            sendRateLimitedMessage(bot, chatId, errorMessage);
        }
    });
}

module.exports = registerLeaderboardHandlers;
