const { db } = require('../core/firebase');
const { getUserByUsername } = require('../core/users');

/**
 * Checks if a user is an admin or creator in a specific chat.
 * @param {TelegramBot} bot The bot instance.
 * @param {number|string} chatId The ID of the chat.
 * @param {number} userId The ID of the user.
 * @returns {Promise<boolean>} True if the user is an admin, false otherwise.
 */
async function isUserAdmin(bot, chatId, userId) {
    try {
        const member = await bot.getChatMember(chatId, userId);
        return ['creator', 'administrator'].includes(member.status);
    } catch (error) {
        console.error(`Error checking admin status for user ${userId} in chat ${chatId}:`, error);
        return false;
    }
}


/**
 * Parses a duration string (e.g., 30m, 2h, 1d) and returns the 'until' timestamp.
 * @param {string} durationStr The duration string.
 * @returns {number|null} The UNIX timestamp for when the restriction lifts, or null if permanent.
 */
function parseDuration(durationStr) {
    if (!durationStr) {
        return null; // Permanent
    }
    const match = durationStr.match(/^(\d+)([mhd])$/);
    if (!match) {
        return null;
    }
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const now = Math.floor(Date.now() / 1000);
    let seconds;
    switch (unit) {
        case 'm':
            seconds = value * 60;
            break;
        case 'h':
            seconds = value * 60 * 60;
            break;
        case 'd':
            seconds = value * 60 * 60 * 24;
            break;
        default:
            return null;
    }
    return now + seconds;
}

function registerModerationHandlers(bot) {
    // Handler to check for banned words
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        // Ignore messages from bots and admins
        if (msg.from.is_bot || await isUserAdmin(bot, chatId, msg.from.id)) {
            return;
        }

        if (msg.text) {
            const configRef = db.collection('chat_configs').doc(chatId.toString());
            const doc = await configRef.get();

            if (doc.exists && doc.data().bannedWords) {
                const bannedWords = doc.data().bannedWords;
                const messageText = msg.text.toLowerCase();

                for (const word of bannedWords) {
                    if (messageText.includes(word)) {
                        try {
                            await bot.deleteMessage(chatId, msg.message_id);
                            // Optionally, send a warning message to the user or a log to the admins
                            bot.sendMessage(chatId, `@${msg.from.username}, your message was deleted for containing a banned word.`).then(sentMsg => {
                                setTimeout(() => bot.deleteMessage(chatId, sentMsg.message_id), 5000);
                            });
                        } catch (error) {
                            console.error(`Failed to delete message with banned word:`, error);
                        }
                        return; // Stop after finding one banned word
                    }
                }
            }
        }
    });

    bot.onText(/\/kick(?: @([a-zA-Z0-9_]+))?/, async (msg, match) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const taggedUsername = match[1];

        // Check if the user is an admin
        if (!await isUserAdmin(bot, chatId, userId)) {
            bot.sendMessage(chatId, "You are not authorized to use this command.");
            return;
        }

        let userToKickId;
        let userToKickUsername;

        if (msg.reply_to_message) {
            userToKickId = msg.reply_to_message.from.id;
            userToKickUsername = msg.reply_to_message.from.username || `${msg.reply_to_message.from.first_name} ${msg.reply_to_message.from.last_name || ''}`.trim();
        } else if (taggedUsername) {
            const user = await getUserByUsername(taggedUsername);
            if (user) {
                userToKickId = user.id;
                userToKickUsername = user.username;
            } else {
                bot.sendMessage(chatId, `User @${taggedUsername} not found.`);
                return;
            }
        } else {
            bot.sendMessage(chatId, "Usage: /kick @username or reply to a message with /kick.");
            return;
        }

        try {
            await bot.kickChatMember(chatId, userToKickId);
            bot.sendMessage(chatId, `@${userToKickUsername} has been kicked from the group.`);
        } catch (error) {
            console.error(`Error kicking user ${userToKickId}:`, error);
            bot.sendMessage(chatId, `Failed to kick @${userToKickUsername}. Make sure I have the right permissions. Error: ${error.message}`);
        }
    });

    bot.onText(/\/ban(?: @([a-zA-Z0-9_]+))?/, async (msg, match) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const taggedUsername = match[1];

        if (!await isUserAdmin(bot, chatId, userId)) {
            bot.sendMessage(chatId, "You are not authorized to use this command.");
            return;
        }

        let userToBanId;
        let userToBanUsername;

        if (msg.reply_to_message) {
            userToBanId = msg.reply_to_message.from.id;
            userToBanUsername = msg.reply_to_message.from.username || `${msg.reply_to_message.from.first_name} ${msg.reply_to_message.from.last_name || ''}`.trim();
        } else if (taggedUsername) {
            const user = await getUserByUsername(taggedUsername);
            if (user) {
                userToBanId = user.id;
                userToBanUsername = user.username;
            } else {
                bot.sendMessage(chatId, `User @${taggedUsername} not found.`);
                return;
            }
        } else {
            bot.sendMessage(chatId, "Usage: /ban @username or reply to a message with /ban.");
            return;
        }

        try {
            await bot.banChatMember(chatId, userToBanId);
            bot.sendMessage(chatId, `@${userToBanUsername} has been banned from the group.`);
        } catch (error) {
            console.error(`Error banning user ${userToBanId}:`, error);
            bot.sendMessage(chatId, `Failed to ban @${userToBanUsername}. Make sure I have the right permissions. Error: ${error.message}`);
        }
    });

    bot.onText(/\/unban (\d+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const userToUnbanId = match[1];

        if (!await isUserAdmin(bot, chatId, userId)) {
            bot.sendMessage(chatId, "You are not authorized to use this command.");
            return;
        }

        if (!userToUnbanId) {
            bot.sendMessage(chatId, "Usage: /unban <user_id>");
            return;
        }

        try {
            await bot.unbanChatMember(chatId, userToUnbanId);
            bot.sendMessage(chatId, `User with ID ${userToUnbanId} has been unbanned.`);
        } catch (error) {
            console.error(`Error unbanning user ${userToUnbanId}:`, error);
            bot.sendMessage(chatId, `Failed to unban user with ID ${userToUnbanId}. Make sure the ID is correct and I have the right permissions. Error: ${error.message}`);
        }
    });

    bot.onText(/\/mute(?: @([a-zA-Z0-9_]+))?(?: (\d+[mhd]))?/, async (msg, match) => {
        const chatId = msg.chat.id;
        const adminId = msg.from.id;
        const taggedUsername = match[1];
        const durationStr = match[2];

        if (!await isUserAdmin(bot, chatId, adminId)) {
            bot.sendMessage(chatId, "You are not authorized to use this command.");
            return;
        }

        let userToMuteId;
        let userToMuteUsername;

        if (msg.reply_to_message) {
            userToMuteId = msg.reply_to_message.from.id;
            userToMuteUsername = msg.reply_to_message.from.username || `${msg.reply_to_message.from.first_name} ${msg.reply_to_message.from.last_name || ''}`.trim();
        } else if (taggedUsername) {
            const user = await getUserByUsername(taggedUsername);
            if (user) {
                userToMuteId = user.id;
                userToMuteUsername = user.username;
            } else {
                bot.sendMessage(chatId, `User @${taggedUsername} not found.`);
                return;
            }
        } else {
            bot.sendMessage(chatId, "Usage: /mute @username [duration] or reply with /mute [duration] (e.g., 30m, 2h, 1d).");
            return;
        }

        const untilDate = parseDuration(durationStr);
        const muteOptions = {
            can_send_messages: false,
            can_send_media_messages: false,
            can_send_polls: false,
            can_send_other_messages: false,
            can_add_web_page_previews: false,
            can_change_info: false,
            can_invite_users: false,
            can_pin_messages: false,
        };

        try {
            await bot.restrictChatMember(chatId, userToMuteId, { ...muteOptions, until_date: untilDate });
            let response = `@${userToMuteUsername} has been muted.`;
            if (durationStr) {
                response += ` for ${durationStr}.`;
            } else {
                response += ` permanently.`
            }
            bot.sendMessage(chatId, response);
        } catch (error) {
            console.error(`Error muting user ${userToMuteId}:`, error);
            bot.sendMessage(chatId, `Failed to mute @${userToMuteUsername}. Make sure I have the right permissions. Error: ${error.message}`);
        }
    });

    bot.onText(/\/unmute(?: @([a-zA-Z0-9_]+))?/, async (msg, match) => {
        const chatId = msg.chat.id;
        const adminId = msg.from.id;
        const taggedUsername = match[1];

        if (!await isUserAdmin(bot, chatId, adminId)) {
            bot.sendMessage(chatId, "You are not authorized to use this command.");
            return;
        }

        let userToUnmuteId;
        let userToUnmuteUsername;

        if (msg.reply_to_message) {
            userToUnmuteId = msg.reply_to_message.from.id;
            userToUnmuteUsername = msg.reply_to_message.from.username || `${msg.reply_to_message.from.first_name} ${msg.reply_to_message.from.last_name || ''}`.trim();
        } else if (taggedUsername) {
            const user = await getUserByUsername(taggedUsername);
            if (user) {
                userToUnmuteId = user.id;
                userToUnmuteUsername = user.username;
            } else {
                bot.sendMessage(chatId, `User @${taggedUsername} not found.`);
                return;
            }
        } else {
            bot.sendMessage(chatId, "Usage: /unmute @username or reply with /unmute.");
            return;
        }

        const unmuteOptions = {
            can_send_messages: true,
            can_send_media_messages: true,
            can_send_polls: true,
            can_send_other_messages: true,
            can_add_web_page_previews: true,
            can_change_info: true,
            can_invite_users: true,
            can_pin_messages: true,
        };

        try {
            await bot.restrictChatMember(chatId, userToUnmuteId, unmuteOptions);
            bot.sendMessage(chatId, `@${userToUnmuteUsername} has been unmuted.`);
        } catch (error) {
            console.error(`Error unmuting user ${userToUnmuteId}:`, error);
            bot.sendMessage(chatId, `Failed to unmute @${userToUnmuteUsername}. Make sure I have the right permissions. Error: ${error.message}`);
        }
    });

    bot.onText(/\/warn(?: @([a-zA-Z0-9_]+))?/, async (msg, match) => {
        const chatId = msg.chat.id;
        const adminId = msg.from.id;
        const taggedUsername = match[1];

        if (!await isUserAdmin(bot, chatId, adminId)) {
            bot.sendMessage(chatId, "You are not authorized to issue warnings.");
            return;
        }

        let userToWarnId;
        let userToWarnUsername;

        if (msg.reply_to_message) {
            userToWarnId = msg.reply_to_message.from.id;
            userToWarnUsername = msg.reply_to_message.from.username || `${msg.reply_to_message.from.first_name} ${msg.reply_to_message.from.last_name || ''}`.trim();
        } else if (taggedUsername) {
            const user = await getUserByUsername(taggedUsername);
            if (user) {
                userToWarnId = user.id;
                userToWarnUsername = user.username;
            } else {
                bot.sendMessage(chatId, `User @${taggedUsername} not found.`);
                return;
            }
        } else {
            bot.sendMessage(chatId, "Usage: /warn @username or reply to a message with /warn.");
            return;
        }

        try {
            const warningsRef = db.collection('user_warnings').doc(chatId.toString()).collection('users').doc(userToWarnId.toString());
            const warningDoc = await warningsRef.get();
            
            const newWarningCount = (warningDoc.exists ? warningDoc.data().count : 0) + 1;
            
            await warningsRef.set({
                count: newWarningCount,
                username: userToWarnUsername,
                last_warned_by: msg.from.username,
            }, { merge: true });

            bot.sendMessage(chatId, `@${userToWarnUsername} has been warned. They now have ${newWarningCount} warning(s).`);
        } catch (error) {
            console.error(`Error issuing warning to user ${userToWarnId}:`, error);
            bot.sendMessage(chatId, `Failed to issue warning. Please try again. Error: ${error.message}`);
        }
    });

    bot.onText(/\/warnings(?: @([a-zA-Z0-9_]+))?/, async (msg, match) => {
        const chatId = msg.chat.id;
        const taggedUsername = match[1];
        
        let targetUserId;
        let targetUsername;

        if (msg.reply_to_message) {
            targetUserId = msg.reply_to_message.from.id;
            targetUsername = msg.reply_to_message.from.username || `${msg.reply_to_message.from.first_name} ${msg.reply_to_message.from.last_name || ''}`.trim();
        } else if (taggedUsername) {
            const user = await getUserByUsername(taggedUsername);
            if (user) {
                targetUserId = user.id;
                targetUsername = user.username;
            } else {
                bot.sendMessage(chatId, `User @${taggedUsername} not found.`);
                return;
            }
        } else {
            bot.sendMessage(chatId, "Usage: /warnings @username or reply to a user with /warnings to check their warning count.");
            return;
        }

        try {
            const warningsRef = db.collection('user_warnings').doc(chatId.toString()).collection('users').doc(targetUserId.toString());
            const warningDoc = await warningsRef.get();

            if (warningDoc.exists) {
                const warningCount = warningDoc.data().count;
                bot.sendMessage(chatId, `@${targetUsername} has ${warningCount} warning(s).`);
            } else {
                bot.sendMessage(chatId, `@${targetUsername} has no warnings.`);
            }
        } catch (error) {
            console.error(`Error fetching warnings for user ${targetUserId}:`, error);
            bot.sendMessage(chatId, `Failed to fetch warnings. Please try again. Error: ${error.message}`);
        }
    });
}


module.exports = {
    registerModerationHandlers,
    isUserAdmin,
    parseDuration
};
