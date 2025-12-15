const sharp = require('sharp');
const { db } = require('../core/firebase');
const { initiatedNames } = require('../data');
const { updateUserInDb, awardXp, calculateLevel, calculateXpForNextLevel } = require('../core/users');
const { isUserAdmin } = require('./moderation');
const { sendRateLimitedMessage } = require('../core/telegramUtils');
const { parseDuration } = require('./moderation');

function registerMiscHandlers(bot) {
    /**
     * Handles the /start command.
     */
    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, "Welcome to Mr. Yunks bot!");
    });

    /**
     * Handles the /help command.
     */
    bot.onText(/\/help/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const chatType = msg.chat.type;
        const isAdmin = await isUserAdmin(bot, chatId, userId);

        let helpMessage = `
<b>Mr. Yunks Bot Features</b>

<b>General Commands:</b>
- <code>/start</code>: Start interacting with the bot.
- <code>/help</code>: Shows this help message.
- <code>/prophecy &lt;question&gt;</code>: Get a prophecy.
- <code>/leaderboard [number]</code>: Display the top XP earners (e.g., /leaderboard 5 to show top 5).
- Send a photo to convert it to a sticker.

<b>⚙️ Admin Commands</b>: Manage your chat with moderation tools, settings, and game controls.
<b>🛡️ Protectron Commands</b>: Advanced spam and content filtering for a clean chat environment.
<b>🎮 Game Commands</b>: Engage with fun and interactive mini-games like Cult Clash and Shadow Game.
`;
        
        const inlineKeyboard = [];
        if (isAdmin || chatType === 'private') { // Only show admin/protectron buttons to admins or in private chat
            inlineKeyboard.push([{ text: 'Admin Commands', callback_data: 'help_admin' }]);
            inlineKeyboard.push([{ text: 'Protectron Commands', callback_data: 'help_protectron' }]);
        }
        inlineKeyboard.push([{ text: 'Game Commands', callback_data: 'help_games' }]);


        const opts = {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: inlineKeyboard
            }
        };

        bot.sendMessage(chatId, helpMessage, opts);
    });

    bot.on('callback_query', async (callbackQuery) => {
        const msg = callbackQuery.message;
        const chatId = msg.chat.id;
        const userId = callbackQuery.from.id;
        const data = callbackQuery.data;
        const isAdmin = await isUserAdmin(bot, chatId, userId);

        let responseText = "";

        if (data === 'help_admin') {
            if (!isAdmin && msg.chat.type !== 'private') {
                bot.answerCallbackQuery(callbackQuery.id, { text: "You are not authorized to view admin commands." });
                return;
            }
            responseText = `
<b>⚙️ Admin Commands - Your Toolkit for Chat Management ⚙️</b>

These powerful commands allow administrators to maintain order, manage members, and configure the bot's behavior within the chat.

- <code>/tagall [message]</code>: Silently tags all known members in the chat.
  <i>Example: <code>/tagall Important announcement, check pinned message!</code></i>
- <code>/announce <message></code>: Post an announcement visible to all chat members.
  <i>Example: <code>/announce New rules effective today! Read them now.</code></i>
- <code>/announcetop</code> or <code>/top [number]</code>: Announce top active members (e.g., /top 5 to show top 5).
- <code>/settings</code>: Open bot settings (via web app).
- <code>/setwelcome <message></code>: Set a custom welcome message for new members.
  <i>Example: <code>/setwelcome Welcome, {username}! Your journey begins...</code></i>
- <code>/showconfig</code>: Show the current bot configuration.
- <code>/banword <word></code>: Add a word to the banned words list.
  <i>Example: <code>/banword spam</code></i>
- <code>/unbanword <word></code>: Remove a word from the banned words list.
- <code>/bannedwords</code>: List all banned words.
- <code>/cultclash</code>: Start a Cult Clash game.
- <code>/kick @username</code>: Kick a user from the group.
  <i>Example: <code>/kick @baduser</code></i>
- <code>/ban @username</code>: Ban a user from the group permanently.
- <code>/unban &lt;user_id&gt;</code>: Unban a user by their ID.
- <code>/mute @username [duration]</code>: Mute a user for a specified duration (e.g., 30m, 2h, 1d).
  <i>Example: <code>/mute @noisyuser 1h</code></i>
- <code>/unmute @username</code>: Unmute a user.
- <code>/warn @username</code>: Warn a user.
- <code>/warnings @username</code>: Check a user's warnings.
- <code>/add_user_to_db &lt;user_id&gt;</code>: Manually add a user to the database for tagging purposes.
- <code>/countdown &lt;duration&gt; [message]</code>: Start a countdown (e.g., 5m, 1h, 2d).
  <i>Example: <code>/countdown 1d Event starts tomorrow!</code></i>
- <code>/awardxp @username &lt;amount&gt;</code>: Award XP to a user.
  <i>Example: <code>/awardxp @winner 100</code></i>
`;
        } else if (data === 'help_protectron') {
            if (!isAdmin && msg.chat.type !== 'private') {
                bot.answerCallbackQuery(callbackQuery.id, { text: "You are not authorized to view Protectron commands." });
                return;
            }
            responseText = `
<b>🛡️ Protectron Commands - Advanced Chat Security 🛡️</b>

Protectron offers a suite of powerful moderation tools to keep your chat clean and safe. These commands are for administrators only.

- <code>/status</code>: Display current Protectron settings for this chat.
- <code>/antispam</code>: Toggle the general anti-spam filter (on/off).
- <code>/antispam_mode &lt;mode&gt;</code>: Set anti-spam mode (<i>Simple</i> or <i>Advanced</i>).
  <i>Example: <code>/antispam_mode Advanced</code></i>
- <code>/noevents</code>: Toggle filtering of join/leave messages.
- <code>/nobots</code>: Toggle protection against spam bots.
- <code>/nolinks</code>: Toggle filtering messages with links, mentions, forwards, reply markup.
- <code>/noforwards</code>: Toggle filtering forwarded messages.
- <code>/nocontacts</code>: Toggle filtering messages with contact numbers.
- <code>/nolocations</code>: Toggle filtering messages with locations.
- <code>/nocommands</code>: Toggle filtering commands from group members.
- <code>/nohashtags</code>: Toggle filtering messages with hashtags.
- <code>/antiflood</code>: Toggle anti-flood protection.
- <code>/imagefilter</code>: Toggle pornographic image filter.
- <code>/profanity</code>: Toggle offensive language filter.
- <code>/blacklist</code>: View blacklisted words.
- <code>/blacklist_add &lt;word&gt;</code>: Add a word to the blacklist. Messages containing this word will be deleted.
  <i>Example: <code>/blacklist_add badword</code></i>
- <code>/blacklist_remove &lt;word&gt;</code>: Remove a word from the blacklist.
- <code>/blacklist_clear</code>: Clear all blacklisted words.
- <code>/whitelist</code>: View whitelisted domains.
- <code>/whitelist_add &lt;domain&gt;</code>: Add a domain to the whitelist. Links from this domain will be allowed.
  <i>Example: <code>/whitelist_add example.com</code></i>
- <code>/whitelist_remove &lt;domain&gt;</code>: Remove a domain from the whitelist.
- <code>/whitelist_clear</code>: Clear all whitelisted domains.
`;
        } else if (data === 'help_games') {
            responseText = `
<b>🎮 Game Commands - Engage and Play! 🎮</b>

Dive into our interactive games! Anyone can initiate these games to have fun with other chat members.

- <code>/js</code>: Start or join the setup for a Shadow Game.
  Example: <code>/js</code>
- <code>/s @username</code>: In a Shadow Game, tag another player if you are "IT".
  Example: <code>/s @targetuser</code>
- <code>/cultclash</code>: Start a Cult Clash game.
  Example: <code>/cultclash</code>
- <code>/join_clash</code> or <code>/join</code>: Join an active Cult Clash game during its joining phase.
  Example: <code>/join_clash</code>
`;
        }

        if (responseText) {
            try { // Added try-catch block here
                await bot.editMessageText(responseText, {
                    chat_id: chatId,
                    message_id: msg.message_id,
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Back to Help Categories', callback_data: 'help_main' }]
                        ]
                    }
                });
            } catch (error) {
                console.error(`Error editing message for help_games callback in chat ${chatId}:`, error);
                // Optionally, send a new message as a fallback if editing fails
                // bot.sendMessage(chatId, "Failed to update help message. Here are the game commands:\n" + responseText, { parse_mode: 'Markdown' });
            }
        } else if (data === 'help_main') {
            // Re-send the main help message with buttons
            const reHelpMessage = `
<b>Mr. Yunks Bot Features</b>

<b>General Commands:</b>
- <code>/start</code>: Start interacting with the bot.
- <code>/help</code>: Shows this help message.
- <code>/prophecy &lt;question&gt;</code>: Get a prophecy.
- <code>/leaderboard [number]</code>: Display the top XP earners (e.g., /leaderboard 5 to show top 5).
- Send a photo to convert it to a sticker.
`;
            const reInlineKeyboard = [];
            if (isAdmin || msg.chat.type === 'private') {
                reInlineKeyboard.push([{ text: 'Admin Commands', callback_data: 'help_admin' }]);
                reInlineKeyboard.push([{ text: 'Protectron Commands', callback_data: 'help_protectron' }]);
            }
            reInlineKeyboard.push([{ text: 'Game Commands', callback_data: 'help_games' }]);
            
            bot.editMessageText(reHelpMessage, {
                chat_id: chatId,
                message_id: msg.message_id,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: reInlineKeyboard
                }
            });
        }

        bot.answerCallbackQuery(callbackQuery.id);
    });

    bot.onText(/\/profile/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const username = msg.from.username || `${msg.from.first_name} ${msg.from.last_name || ''}`.trim();

        bot.sendChatAction(chatId, 'typing'); // Visual feedback

        try {
            const userRef = db.collection('users').doc(userId.toString());
            const userDoc = await userRef.get();

            let currentXp = 0;
            let currentLevel = 0;

            if (userDoc.exists) {
                currentXp = userDoc.data().xp || 0;
                currentLevel = userDoc.data().level || 0;
            } else {
                sendRateLimitedMessage(bot, chatId, `ℹ️ @${username}, your profile is not yet initialized. Send a few messages to earn XP!`);
                return;
            }

            const xpForCurrentLevelStart = xpToReachLevel(currentLevel);
            const xpForNextLevel = xpToReachLevel(currentLevel + 1);
            const xpIntoCurrentLevel = currentXp - xpForCurrentLevelStart;
            const xpNeededForNextLevel = xpForNextLevel - xpForCurrentLevelStart;

            // Simple progress bar
            const barLength = 10;
            const progress = xpNeededForNextLevel > 0 ? (xpIntoCurrentLevel / xpNeededForNextLevel) : 1;
            const filledBlocks = Math.round(progress * barLength);

            const progressBar = '█'.repeat(filledBlocks) + '░'.repeat(barLength - filledBlocks);

            let profileMessage = `<b>🌟 ${username}'s Profile 🌟</b>
            
<b>Level:</b> ${currentLevel}
<b>XP:</b> ${currentXp}
<b>XP for next level (${currentLevel + 1}):</b> ${xpForNextLevel}

<code>[${progressBar}]</code> ${xpIntoCurrentLevel}/${xpNeededForNextLevel} XP to Level ${currentLevel + 1}
`;
            sendRateLimitedMessage(bot, chatId, profileMessage, { parse_mode: 'HTML' });

        } catch (error) {
            console.error("Error fetching user profile:", error);
            sendRateLimitedMessage(bot, chatId, `❌ An error occurred while fetching your profile: ${error.message}`);
        }
    });

    /**
     * Handles the /add_user_to_db <user_id> command.
     * Allows an admin to manually add a user to the database.
     */
    bot.onText(/\/add_user_to_db (\d+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const callerId = msg.from.id;
        const userIdToAdd = parseInt(match[1], 10);

        bot.sendChatAction(chatId, 'typing'); // Visual feedback

        if (!await isUserAdmin(bot, chatId, callerId)) {
            sendRateLimitedMessage(bot, chatId, "❌ You are not authorized to use this command.");
            return;
        }

        if (isNaN(userIdToAdd)) {
            sendRateLimitedMessage(bot, chatId, "⚠️ Please provide a valid user ID (e.g., /add_user_to_db 123456789).");
            return;
        }

        try {
            // Telegram Bot API does not provide a direct way to get user info by ID without them being in the chat
            // or having interacted with the bot. getChatMember is the closest, but requires the user to be in the chat.
            // This command assumes the user with userIdToAdd is *already* a member of the chat.
            const chatMember = await bot.getChatMember(chatId, userIdToAdd);

            if (chatMember && chatMember.user) {
                await updateUserInDb(chatMember.user, chatId);
                sendRateLimitedMessage(bot, chatId, `✅ User ${chatMember.user.first_name} (ID: ${userIdToAdd}) has been added/updated in the database.`);
            } else {
                sendRateLimitedMessage(bot, chatId, `⚠️ Could not find user with ID ${userIdToAdd} in this chat. They must be a member of this chat.`);
            }
        } catch (error) {
            console.error("Error in /add_user_to_db command:", error);
            sendRateLimitedMessage(bot, chatId, `❌ An error occurred while trying to add the user: ${error.message}`);
        }
    });

    /**
     * Handles the /countdown <duration> [message] command.
     * Starts a countdown in the chat.
     */
    bot.onText(/\/countdown\s+(\d+[mhd])(?:\s+(.*))?/, async (msg, match) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const durationStr = match[1];
        const countdownMessage = match[2] || "Countdown finished!";

        bot.sendChatAction(chatId, 'typing'); // Visual feedback

        if (!await isUserAdmin(bot, chatId, userId)) {
            sendRateLimitedMessage(bot, chatId, "❌ You are not authorized to use this command.");
            return;
        }

        const endTimeSeconds = parseDuration(durationStr);

        if (!endTimeSeconds) {
            sendRateLimitedMessage(bot, chatId, "⚠️ Invalid duration format. Use (e.g., 5m, 1h, 2d).");
            return;
        }

        const nowSeconds = Math.floor(Date.now() / 1000);
        const durationInSeconds = endTimeSeconds - nowSeconds;

        const MIN_DURATION_SECONDS = 5 * 60; // 5 minutes
        const MAX_DURATION_SECONDS = 3 * 24 * 60 * 60; // 3 days

        if (durationInSeconds < MIN_DURATION_SECONDS || durationInSeconds > MAX_DURATION_SECONDS) {
            sendRateLimitedMessage(bot, chatId, `⚠️ Countdown duration must be between ${MIN_DURATION_SECONDS / 60} minutes and ${MAX_DURATION_SECONDS / (24 * 60 * 60)} days.`);
            return;
        }

        try {
            const countdownRef = db.collection('chat_countdowns').doc(); // Auto-generate ID
            await countdownRef.set({
                chatId: chatId,
                endTime: endTimeSeconds * 1000, // Convert to milliseconds for Date objects
                message: countdownMessage,
                adminId: userId,
                createdAt: new Date(),
            });

            const endDate = new Date(endTimeSeconds * 1000);
            sendRateLimitedMessage(bot, chatId, `✅ Countdown for "${countdownMessage}" started! It will finish on ${endDate.toLocaleString()}.`);

        } catch (error) {
            console.error("Error in /countdown command:", error);
            sendRateLimitedMessage(bot, chatId, `❌ An error occurred while trying to start the countdown: ${error.message}`);
        }
    });

    /**
     * Welcomes new members to the group.
     */
    bot.on('new_chat_members', async (msg) => {
        const chatId = msg.chat.id;

        const configRef = db.collection('chat_configs').doc(chatId.toString());
        const configDoc = await configRef.get();
        const config = configDoc.exists ? configDoc.data() : {};

        msg.new_chat_members.forEach((member) => {
            updateUserInDb(member, chatId);
            if (!member.is_bot) {
                const username = member.username || `${member.first_name} ${member.last_name || ''}`.trim();
                const randomName = initiatedNames[Math.floor(Math.random() * initiatedNames.length)] || 'the Chosen One';

                const defaultWelcomeMessage = "Yoh-koh-so, @{username}! ☠️\n\nCult’s runes have spoken, the spirits nods rituals initiated\n\nYour initiate name is: {initiate_name} 🔮\n\nProve your devotion… the Cult watches. 👁️";
                
                let welcomeMessage = config.welcomeMessage || defaultWelcomeMessage;

                welcomeMessage = welcomeMessage
                    .replace(/{username}/g, username)
                    .replace(/{initiate_name}/g, randomName);

                bot.sendMessage(chatId, welcomeMessage);
            }
        });
    });

    /**
     * Converts a received photo into a sticker.
     */
    bot.on('photo', async (msg) => {
        updateUserInDb(msg.from, msg.chat.id);
        const chatId = msg.chat.id;
        bot.sendChatAction(chatId, 'upload_photo'); // Visual feedback
        bot.sendMessage(chatId, "Processing your image into a sticker...");
        try {
            const photo = msg.photo[msg.photo.length - 1];
            const fileId = photo.file_id;
            const fileStream = bot.getFileStream(fileId);
            const chunks = [];
            for await (const chunk of fileStream) {
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);
            const stickerBuffer = await sharp(buffer)
                .resize(512, 512, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .webp()
                .toBuffer();
            await bot.sendSticker(chatId, stickerBuffer);
            bot.sendMessage(chatId, "✅ Here's your sticker!");
        } catch (error) {
            console.error("Error converting image to sticker:", error);
            bot.sendMessage(chatId, `❌ Sorry, I couldn't convert that image to a sticker. Please try another one. Error: ${error.message}`);
        }
    });

    /**
     * Tracks user activity by message count.
     */
    bot.on('message', async (msg) => {
        updateUserInDb(msg.from, msg.chat.id);
        if ((msg.text && msg.text.startsWith('/')) || msg.photo || msg.from.is_bot) {
            return;
        }
      
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const xpAwardResult = await awardXp(userId, 1); // Award 1 XP for each message
        const username = msg.from.username || `${msg.from.first_name} ${msg.from.last_name || ''}`.trim();

        // Check for level up
        if (xpAwardResult && xpAwardResult.levelChanged) {
            sendRateLimitedMessage(bot, chatId, `🎉 Congratulations @${username}! You've reached Level ${xpAwardResult.newLevel}!`);
        }
      
        const today = new Date().toISOString().slice(0, 10);

        try {
            const activityRef = db.collection('userActivity').doc(chatId.toString()).collection(today).doc(userId.toString());
            await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(activityRef);
                if (!doc.exists) {
                    transaction.set(activityRef, { username, messageCount: 1 });
                } else {
                    const newCount = doc.data().messageCount + 1;
                    transaction.update(activityRef, { messageCount: newCount, username });
                }
            });
        } catch (error) {
            console.error("Error updating user activity:", error);
        }
    });
}

module.exports = registerMiscHandlers;
