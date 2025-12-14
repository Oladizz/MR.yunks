const { db } = require('./firebase');
const { sendRateLimitedMessage } = require('./telegramUtils'); // Assuming this utility can be used

let countdownInterval;

async function checkAndExecuteCountdowns(bot) {
    try {
        const now = Date.now();
        const countdownsRef = db.collection('chat_countdowns');
        const snapshot = await countdownsRef.where('endTime', '<=', now).get();

        if (snapshot.empty) {
            return;
        }

        const batch = db.batch();
        snapshot.forEach(doc => {
            const countdown = doc.data();
            console.log(`Executing countdown for chat ${countdown.chatId}: ${countdown.message}`);
            // Use sendRateLimitedMessage if available, otherwise bot.sendMessage
            if (sendRateLimitedMessage) {
                sendRateLimitedMessage(bot, countdown.chatId, `🎉 ${countdown.message}`);
            } else {
                bot.sendMessage(countdown.chatId, `🎉 ${countdown.message}`);
            }
            batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`Executed ${snapshot.size} countdowns.`);
    } catch (error) {
        console.error("Error checking and executing countdowns:", error);
    }
}

function startCountdownCheck(bot) {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    // Check every minute
    countdownInterval = setInterval(() => checkAndExecuteCountdowns(bot), 60 * 1000);
    console.log("Countdown check interval started.");
}

function stopCountdownCheck() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        console.log("Countdown check interval stopped.");
    }
}

module.exports = { startCountdownCheck, stopCountdownCheck };
