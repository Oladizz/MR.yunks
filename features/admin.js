const { db } = require('../core/firebase');
const { getUserByUsername, awardXp } = require('../core/users');

function registerAdminHandlers(bot, globalAdminIds) { // Accept globalAdminIds as a parameter
    /**
     * Admin command to post an announcement.
     */
    bot.onText(/\/announce (.+)/s, (msg, match) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const announcementText = match[1];

        if (!globalAdminIds.includes(userId.toString())) { // Check against the array
            bot.sendMessage(chatId, "You are not authorized to make announcements.");
            return;
        }

        if (!announcementText) {
            bot.sendMessage(chatId, "Please provide a message for the announcement. Usage: /announce <your message>");
            return;
        }

        const announcement = `🎉 *Yunks Announcement* 🎉\n\n${announcementText}`;
        bot.sendMessage(chatId, announcement, { parse_mode: 'Markdown' });
    });

    /**
     * Admin command to announce top active members.
     */
    bot.onText(/\/announcetop|\/top(?:\s+(\d+))?/, async (msg, match) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const requestedLimit = match[1] ? parseInt(match[1], 10) : 3;
        const limit = Math.min(Math.max(1, requestedLimit), 10); // Limit to between 1 and 10 for reasonable display

        if (!globalAdminIds.includes(userId.toString())) { // Check against the array
            bot.sendMessage(chatId, "You are not authorized to use this command.");
            return;
        }

        const today = new Date().toISOString().slice(0, 10);
        const activityRef = db.collection('userActivity').doc(chatId.toString()).collection(today);

        try {
            const snapshot = await activityRef.orderBy('messageCount', 'desc').limit(limit).get();
            if (snapshot.empty) {
                bot.sendMessage(chatId, "No activity recorded today.");
                return;
            }

            let announcement = "🔥 Top Active Yunkers of the Day:\n";
            let rank = 1;
            const medals = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']; // Up to 10 medals
            snapshot.forEach(doc => {
                const userData = doc.data();
                if (rank <= medals.length) { // Only add medal if available
                    announcement += `${medals[rank - 1]} @${userData.username} (${userData.messageCount} messages)\n`;
                } else {
                    announcement += `${rank}. @${userData.username} (${userData.messageCount} messages)\n`;
                }
                rank++;
            });
            announcement += "\nKeep chatting, building, and earning your Yunk points!";
            bot.sendMessage(chatId, announcement);
        } catch (error) {
            console.error("Error announcing top active members:", error);
            bot.sendMessage(chatId, "An error occurred while fetching the leaderboard.");
        }
    });

    /**
     * Admin command to award XP to a user.
     */
    bot.onText(/\/awardxp @(\S+) (\d+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const callerId = msg.from.id;
        const targetUsername = match[1];
        const xpAmount = parseInt(match[2], 10);

        if (!globalAdminIds.includes(callerId.toString())) { // Check against the array
            bot.sendMessage(chatId, "You are not authorized to use this command.");
            return;
        }

        if (isNaN(xpAmount) || xpAmount <= 0) {
            bot.sendMessage(chatId, "Please provide a valid positive number for XP amount.");
            return;
        }

        try {
            const targetUser = await getUserByUsername(targetUsername);

            if (!targetUser) {
                bot.sendMessage(chatId, `User @${targetUsername} not found.`);
                return;
            }

            await awardXp(targetUser.id, xpAmount);
            bot.sendMessage(chatId, `Awarded ${xpAmount} XP to @${targetUsername}.`);
        } catch (error) {
            console.error("Error awarding XP:", error);
            bot.sendMessage(chatId, "An error occurred while trying to award XP.");
        }
    });
}

module.exports = registerAdminHandlers;
