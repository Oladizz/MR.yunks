const { db } = require('../core/firebase');
const { prophecies } = require('../data');

function registerProphecyHandlers(bot) {
    /**
     * The Prophecy Game.
     */
    bot.onText(/\/prophecy(?: (.+))?/, async (msg, match) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const username = msg.from.username || `${msg.from.first_name} ${msg.from.last_name || ''}`.trim();
        const question = match[1];

        if (!question) {
            bot.sendMessage(chatId, "You must ask a question to the spirits. Usage: /prophecy <your question>");
            return;
        }

        const today = new Date().toISOString().slice(0, 10);
        const limitRef = db.collection('prophecyLimits').doc(userId.toString()).collection('dates').doc(today);

        try {
            const limitDoc = await limitRef.get();
            const currentCount = limitDoc.exists ? limitDoc.data().count : 0;
            if (currentCount >= 3) {
                bot.sendMessage(chatId, `@${username}, you have already received 3 prophecies today. The spirits must rest.`);
                return;
            }

            const rand = Math.random();
            let prophecy;
            if (rand < 0.4) {
                prophecy = prophecies.neutral[Math.floor(Math.random() * prophecies.neutral.length)];
            } else if (rand < 0.7) {
                prophecy = prophecies.positive[Math.floor(Math.random() * prophecies.positive.length)];
            } else if (rand < 0.95) {
                prophecy = prophecies.negative[Math.floor(Math.random() * prophecies.negative.length)];
            } else {
                prophecy = prophecies.meme[Math.floor(Math.random() * prophecies.meme.length)];
            }

            const response = `🔮 The Cult Speaks 🔮\n@${username}, your query: "${question}"\n\n✨ Prophecy: "${prophecy}" ✨\n\nYour fate is woven into the shadows… 🔥`;
            bot.sendMessage(chatId, response);
            await limitRef.set({ count: currentCount + 1 }, { merge: true });
        } catch (error) {
            console.error("Error in prophecy game:", error);
            bot.sendMessage(chatId, "The spirits are disturbed. An error occurred.");
        }
    });
}

module.exports = registerProphecyHandlers;
