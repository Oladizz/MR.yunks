const { db } = require('../core/firebase');

function registerAdminHandlers(bot) {
    /**
     * Admin command to post an announcement.
     */
    bot.onText(/\/announce (.+)/s, (msg, match) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const adminId = process.env.ADMIN_TELEGRAM_ID;
        const announcementText = match[1];

        if (userId.toString() !== adminId) {
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
    bot.onText(/\/announcetop|\/top/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const adminId = process.env.ADMIN_TELEGRAM_ID;

        if (userId.toString() !== adminId) {
            bot.sendMessage(chatId, "You are not authorized to use this command.");
            return;
        }

        const today = new Date().toISOString().slice(0, 10);
        const activityRef = db.collection('userActivity').doc(chatId.toString()).collection(today);

        try {
            const snapshot = await activityRef.orderBy('messageCount', 'desc').limit(3).get();
            if (snapshot.empty) {
                bot.sendMessage(chatId, "No activity recorded today.");
                return;
            }

            let announcement = "🔥 Top Active Yunkers of the Day:\n";
            let rank = 1;
            const medals = ['1️⃣', '2️⃣', '3️⃣'];
            snapshot.forEach(doc => {
                const userData = doc.data();
                announcement += `${medals[rank - 1]} @${userData.username} (${userData.messageCount} messages)\n`;
                rank++;
            });
            announcement += "\nKeep chatting, building, and earning your Yunk points!";
            bot.sendMessage(chatId, announcement);
        } catch (error) {
            console.error("Error announcing top active members:", error);
            bot.sendMessage(chatId, "An error occurred while fetching the leaderboard.");
        }
    });
}

module.exports = registerAdminHandlers;
