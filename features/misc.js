const sharp = require('sharp');
const { db } = require('../core/firebase');
const { initiatedNames } = require('../data');
const { updateUserInDb } = require('../core/users');
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
        const chatType = msg.chat.type;

        const generalCommandsHelp = `
*Mr. Yunks Bot Features*

*General Commands:*
- \`/start\`: Start interacting with the bot.
- \`/help\`: Shows this help message.
- \`/prophecy <question>\`: Get a prophecy.
- \`/js\`: Join a Shadow Game.
- \`/s @username\`: Tag a user in a Shadow Game.
- \`/join_clash\` or \`/join\`: Join a Cult Clash game.
- Send a photo to convert it to a sticker.
`;

        const adminCommandsHelp = `
*Admin Commands:*
- \`/tagall [message]\`: Silently tags all known members in the chat.
- \`/announce <message>\`: Post an announcement.
- \`/announcetop\` or \`/top [number]\`: Announce top active members (e.g., /top 5 to show top 5).
- \`/settings\`: Open bot settings.
- \`/setwelcome <message>\`: Set a custom welcome message.
- \`/showconfig\`: Show the current bot configuration.
- \`/banword <word>\`: Add a word to the banned words list.
- \`/unbanword <word>\`: Remove a word from the banned words list.
- \`/bannedwords\`: List all banned words.
- \`/cultclash\`: Start a Cult Clash game.
- \`/kick @username\`: Kick a user.
- \`/ban @username\`: Ban a user.
- \`/unban <user_id>\`: Unban a user by their ID.
- \`/mute @username [duration]\`: Mute a user.
- \`/unmute @username\`: Unmute a user.
- \`/warn @username\`: Warn a user.
- \`/warnings @username\`: Check a user's warnings.
- \`/add_user_to_db <user_id>\`: Manually add a user to the database for tagging purposes.
- \`/countdown <duration> [message]\`: Start a countdown (e.g., 5m, 1h, 2d).
`;

        const protectronCommandsHelp = `
*Protectron Commands (Admin Only):*
- \`/status\`: Display current Protectron settings.
- \`/antispam\`: Toggle anti-spam filter.
- \`/antispam_mode\`: Set anti-spam mode (Simple/Advanced).
- \`/noevents\`: Toggle filtering of join/left messages.
- \`/nobots\`: Toggle protection against spam bots.
- \`/nolinks\`: Toggle filtering messages with links, mentions, forwards, reply markup.
- \`/noforwards\`: Toggle filtering forwarded messages.
- \`/nocontacts\`: Toggle filtering messages with contact numbers.
- \`/nolocations\`: Toggle filtering messages with locations.
- \`/nocommands\`: Toggle filtering commands from group members.
- \`/nohashtags\`: Toggle filtering messages with hashtags.
- \`/antiflood\`: Toggle anti-flood protection.
- \`/imagefilter\`: Toggle pornographic image filter.
- \`/profanity\`: Toggle offensive language filter.
- \`/blacklist\`: Manage blacklisted words.
- \`/blacklist_add <word>\`: Add a word to blacklist.
- \`/blacklist_remove <word>\`: Remove a word from blacklist.
- \`/blacklist_clear\`: Clear the blacklist.
- \`/whitelist\`: Manage whitelisted domains.
- \`/whitelist_add <domain>\`: Add a domain to whitelist.
- \`/whitelist_remove <domain>\`: Remove a domain from whitelist.
- \`/whitelist_clear\`: Clear the whitelist.
`;

        let finalHelpMessage = "";

        if (chatType === 'private') {
            finalHelpMessage = generalCommandsHelp + adminCommandsHelp + protectronCommandsHelp;
        } else {
            finalHelpMessage = generalCommandsHelp + "\n*For more options, including Admin and Protectron commands, please send /help in a private chat with me.*";
        }
        
        bot.sendMessage(chatId, finalHelpMessage, { parse_mode: 'Markdown' });
    });

    /**
     * Handles the /add_user_to_db <user_id> command.
     * Allows an admin to manually add a user to the database.
     */
    bot.onText(/\/add_user_to_db (\d+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const callerId = msg.from.id;
        const userIdToAdd = parseInt(match[1], 10);

        if (!await isUserAdmin(bot, chatId, callerId)) {
            sendRateLimitedMessage(bot, chatId, "You are not authorized to use this command.");
            return;
        }

        if (isNaN(userIdToAdd)) {
            sendRateLimitedMessage(bot, chatId, "Please provide a valid user ID (e.g., /add_user_to_db 123456789).");
            return;
        }

        try {
            // Telegram Bot API does not provide a direct way to get user info by ID without them being in the chat
            // or having interacted with the bot. getChatMember is the closest, but requires the user to be in the chat.
            // This command assumes the user with userIdToAdd is *already* a member of the chat.
            const chatMember = await bot.getChatMember(chatId, userIdToAdd);

            if (chatMember && chatMember.user) {
                await updateUserInDb(chatMember.user, chatId);
                sendRateLimitedMessage(bot, chatId, `User ${chatMember.user.first_name} (ID: ${userIdToAdd}) has been added/updated in the database.`);
            } else {
                sendRateLimitedMessage(bot, chatId, `Could not find user with ID ${userIdToAdd} in this chat. They must be a member of this chat.`);
            }
        } catch (error) {
            console.error("Error in /add_user_to_db command:", error);
            sendRateLimitedMessage(bot, chatId, "An error occurred while trying to add the user.");
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

        if (!await isUserAdmin(bot, chatId, userId)) {
            sendRateLimitedMessage(bot, chatId, "You are not authorized to use this command.");
            return;
        }

        const endTimeSeconds = parseDuration(durationStr);

        if (!endTimeSeconds) {
            sendRateLimitedMessage(bot, chatId, "Invalid duration format. Use (e.g., 5m, 1h, 2d).");
            return;
        }

        const nowSeconds = Math.floor(Date.now() / 1000);
        const durationInSeconds = endTimeSeconds - nowSeconds;

        const MIN_DURATION_SECONDS = 5 * 60; // 5 minutes
        const MAX_DURATION_SECONDS = 3 * 24 * 60 * 60; // 3 days

        if (durationInSeconds < MIN_DURATION_SECONDS || durationInSeconds > MAX_DURATION_SECONDS) {
            sendRateLimitedMessage(bot, chatId, `Countdown duration must be between ${MIN_DURATION_SECONDS / 60} minutes and ${MAX_DURATION_SECONDS / (24 * 60 * 60)} days.`);
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
            sendRateLimitedMessage(bot, chatId, `Countdown for "${countdownMessage}" started! It will finish on ${endDate.toLocaleString()}.`);

        } catch (error) {
            console.error("Error in /countdown command:", error);
            sendRateLimitedMessage(bot, chatId, "An error occurred while trying to start the countdown.");
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
        } catch (error) {
            console.error("Error converting image to sticker:", error);
            bot.sendMessage(chatId, "Sorry, I couldn't convert that image to a sticker. Please try another one.");
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
        const username = msg.from.username || `${msg.from.first_name} ${msg.from.last_name || ''}`.trim();
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
