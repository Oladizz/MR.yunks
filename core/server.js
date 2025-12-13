const express = require('express');
const bot = require('./bot');

function setupServer() {
    if (process.env.NODE_ENV !== 'production' || !process.env.RENDER_URL) {
        console.log("Not in production, skipping Express server setup.");
        return;
    }
    
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const app = express();
    app.use(express.json());
    app.use(express.static('webapp'));

    app.get('/', (req, res) => {
        res.send('Mr. Yunks bot is running!');
    });

    // Webhook endpoint
    app.post(`/webhook/${token}`, (req, res) => {
        bot.processUpdate(req.body);
        res.sendStatus(200);
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Express server is listening on port ${PORT}`);
    });
}

module.exports = setupServer;
