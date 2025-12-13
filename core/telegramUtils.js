let messageQueue = [];
let isProcessingQueue = false;
let currentRetryAfter = 0; // seconds

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function processQueue(bot) {
    if (isProcessingQueue) return;
    isProcessingQueue = true;

    while (messageQueue.length > 0) {
        if (currentRetryAfter > 0) {
            console.log(`Rate limit hit. Retrying after ${currentRetryAfter} seconds.`);
            await sleep(currentRetryAfter * 1000);
            currentRetryAfter = 0; // Reset after waiting
        }

        const { chatId, text, options, resolve, reject } = messageQueue.shift();

        try {
            const result = await bot.sendMessage(chatId, text, options);
            resolve(result);
        } catch (error) {
            if (error.response && error.response.error_code === 429) {
                currentRetryAfter = error.response.parameters.retry_after || 30; // Default to 30 seconds if not specified
                console.warn(`Telegram API rate limit exceeded. Retrying after ${currentRetryAfter} seconds.`);
                messageQueue.unshift({ chatId, text, options, resolve, reject }); // Add back to front of queue
            } else {
                console.error("Error sending message:", error);
                reject(error);
            }
        }
    }
    isProcessingQueue = false;
}

function sendRateLimitedMessage(bot, chatId, text, options = {}) {
    return new Promise((resolve, reject) => {
        messageQueue.push({ chatId, text, options, resolve, reject });
        if (!isProcessingQueue) {
            processQueue(bot);
        }
    });
}

module.exports = { sendRateLimitedMessage };