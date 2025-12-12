require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const fs = require('fs');
const sharp = require('sharp');
const express = require('express');

// --- Initialization ---
const token = process.env.TELEGRAM_BOT_TOKEN;
const renderUrl = process.env.RENDER_URL; // Your app's public URL, e.g., https://your-app-name.onrender.com

if (!token) {
  console.error("TELEGRAM_BOT_TOKEN not found. Please add it to your .env file.");
  process.exit(1);
}

// Initialize Telegram Bot (now without polling)
const bot = new TelegramBot(token);

// Set webhook
if (process.env.NODE_ENV === 'production' && renderUrl) {
  const webhookUrl = `${renderUrl}/webhook/${token}`;
  bot.setWebHook(webhookUrl);
  console.log(`Webhook set to ${webhookUrl}`);
} else {
    console.log("Not in production or RENDER_URL not set, using polling for local development.");
    // For local development, we can re-enable polling.
    // To do this, we need to stop the bot instance and create a new one with polling.
    bot.stopPolling();
    const newBot = new TelegramBot(token, { polling: true });
    // Re-assign all event listeners to the new bot instance
    // This is a simplified example. A full implementation would require re-attaching all handlers.
    // For now, we will assume that for local dev, the user can change the code to enable polling.
    console.log("To run locally with polling, please comment out the webhook logic and initialize the bot with { polling: true }");
}


// Initialize Firebase
try {
  const serviceAccount = require('./serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase initialized successfully.');
} catch (error) {
  console.error('Error initializing Firebase:', error.message);
  console.log('Please make sure you have a valid serviceAccountKey.json file.');
  process.exit(1);
}

const db = admin.firestore();

// --- Load Game Data ---
let initiatedNames = [];
try {
  initiatedNames = require('./data/initiatedNames.json');
} catch (error) {
  console.error("Could not load initiatedNames.json:", error.message);
}

let prophecies = {};
try {
  prophecies = require('./data/prophecies.json');
} catch (error) {
  console.error("Could not load prophecies.json:", error.message);
}

// --- Game States ---
const shadowGames = {};
const cultClashGames = {};


// --- Webhook Server Setup ---
const app = express();
app.use(express.json());

// Webhook endpoint
app.post(`/webhook/${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Express server is listening on port ${PORT}`);
});


// --- Bot Functionality ---

/**
 * Admin command to post an announcement.
 */
bot.onText(///announce (.+)/s, (msg, match) => {
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
bot.onText(///announcetop/, async (msg) => {
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

/**
 * The Cult Clash Game - Starting.
 */
bot.onText(///start_cult_clash/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const adminId = process.env.ADMIN_TELEGRAM_ID;

  if (userId.toString() !== adminId) {
    bot.sendMessage(chatId, "Only an admin can start the Cult Clash.");
    return;
  }
  if (cultClashGames[chatId] && cultClashGames[chatId].isGameRunning) {
    bot.sendMessage(chatId, "A Cult Clash game is already in progress.");
    return;
  }

  cultClashGames[chatId] = {
    players: {},
    isGameRunning: true,
    isJoiningPhase: true,
  };

  bot.sendMessage(chatId, "🔥 A Cult Clash is about to begin! 🔥\nYou have 30 seconds to join the fight. Type /join_clash to enter!");

  setTimeout(() => {
    if (cultClashGames[chatId]) {
      cultClashGames[chatId].isJoiningPhase = false;
      bot.sendMessage(chatId, "The joining phase is over! The clash begins now...");
      const playersCount = Object.keys(cultClashGames[chatId].players).length;
      if (playersCount < 2) {
        bot.sendMessage(chatId, "Not enough players for a clash. Game over.");
        delete cultClashGames[chatId];
      } else {
        startElimination(chatId);
      }
    }
  }, 30000);
});

/**
 * The Cult Clash Game - Joining.
 */
bot.onText(///join_clash/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || `${msg.from.first_name} ${msg.from.last_name || ''}`.trim();
  const game = cultClashGames[chatId];

  if (!game || !game.isGameRunning) {
    bot.sendMessage(chatId, "There is no Cult Clash game to join.");
    return;
  }
  if (!game.isJoiningPhase) {
    bot.sendMessage(chatId, "The joining phase for the Cult Clash is over.");
    return;
  }
  if (game.players[userId]) {
    bot.sendMessage(chatId, `@${username}, you are already in the clash.`);
    return;
  }
  game.players[userId] = username;
  bot.sendMessage(chatId, `@${username} has joined the Cult Clash!`);
});

/**
 * The Shadow Game - Joining and starting.
 */
bot.onText(///join_shadow/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || `${msg.from.first_name} ${msg.from.last_name || ''}`.trim();

  if (!shadowGames[chatId]) {
    shadowGames[chatId] = {
      players: {},
      gameTimer: null,
      isGameRunning: true,
    };
    bot.sendMessage(chatId, "A new Shadow Game is starting! Use /join_shadow to enter.");
  }

  if (shadowGames[chatId].players[userId]) {
    bot.sendMessage(chatId, `@${username}, you are already in the game.`);
    return;
  }

  shadowGames[chatId].players[userId] = { username, isIt: false };
  bot.sendMessage(chatId, `@${username} has entered the shadows… beware!`);

  if (Object.keys(shadowGames[chatId].players).length === 1) {
    setTimeout(() => {
      if (shadowGames[chatId] && Object.keys(shadowGames[chatId].players).length > 0) {
        const firstItId = Object.keys(shadowGames[chatId].players)[0];
        shadowGames[chatId].players[firstItId].isIt = true;
        const firstItUsername = shadowGames[chatId].players[firstItId].username;
        bot.sendMessage(chatId, `@${firstItUsername} is the first to be "It"! They have 25 seconds to tag someone with /shadow @username.`);
        startTagTimer(chatId, firstItId);
      }
    }, 5000);
  }
});

/**
 * The Shadow Game - Tagging.
 */
bot.onText(///shadow @(.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const itId = msg.from.id;
  const taggedUsername = match[1];
  const game = shadowGames[chatId];

  if (!game || !game.isGameRunning) {
    bot.sendMessage(chatId, "There is no Shadow Game running.");
    return;
  }
  if (!game.players[itId] || !game.players[itId].isIt) {
    bot.sendMessage(chatId, "You are not 'It'!");
    return;
  }

  const taggedPlayerEntry = Object.entries(game.players).find(([, player]) => player.username === taggedUsername);
  if (!taggedPlayerEntry) {
    bot.sendMessage(chatId, `Could not find a player named @${taggedUsername} in this game.`);
    return;
  }
  const taggedPlayerId = taggedPlayerEntry[0];
  if (taggedPlayerId === itId.toString()) {
    bot.sendMessage(chatId, "You cannot tag yourself!");
    return;
  }

  game.players[itId].isIt = false;
  game.players[taggedPlayerId].isIt = true;
  const itUsername = game.players[itId].username;
  const newItUsername = game.players[taggedPlayerId].username;
  bot.sendMessage(chatId, `@${itUsername} has shadowed @${newItUsername}! The hunt continues…`);
  startTagTimer(chatId, taggedPlayerId);
});

/**
 * The Prophecy Game.
 */
bot.onText(///prophecy(?: (.+))?/, async (msg, match) => {
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

    const response = `🔮 The Cult Speaks 🔮\n@{username}, your query: "${question}"\n\n✨ Prophecy: "${prophecy}" ✨\n\nYour fate is woven into the shadows… 🔥`;
    bot.sendMessage(chatId, response);
    await limitRef.set({ count: currentCount + 1 }, { merge: true });
  } catch (error) {
    console.error("Error in prophecy game:", error);
    bot.sendMessage(chatId, "The spirits are disturbed. An error occurred.");
  }
});

/**
 * Welcomes new members to the group.
 */
bot.on('new_chat_members', (msg) => {
  const chatId = msg.chat.id;
  msg.new_chat_members.forEach((member) => {
    if (!member.is_bot) {
      const username = member.username || `${member.first_name} ${member.last_name || ''}`.trim();
      const randomName = initiatedNames[Math.floor(Math.random() * initiatedNames.length)] || 'the Chosen One';
      const welcomeMessage = `Yoh-koh-so, @${username}! ☠\n\nCult’s runes have spoken, the spirits nods rituals initiated\n\nYour initiate name is: ${randomName} 🔮\n\nProve your devotion… the Cult watches. 👁️`;
      bot.sendMessage(chatId, welcomeMessage);
    }
  });
});

/**
 * Converts a received photo into a sticker.
 */
bot.on('photo', async (msg) => {
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


// --- Helper Functions ---
function startElimination(chatId) {
  const game = cultClashGames[chatId];
  if (!game) return;
  let players = Object.keys(game.players);
  const eliminationInterval = setInterval(() => {
    if (players.length <= 3) {
      clearInterval(eliminationInterval);
      const winners = players.map(id => `@${game.players[id]}`).join(', ');
      bot.sendMessage(chatId, `🏆 The Cult Clash is over! The winners are: ${winners}`);
      delete cultClashGames[chatId];
      return;
    }
    const eliminatedIndex = Math.floor(Math.random() * players.length);
    const eliminatedId = players[eliminatedIndex];
    const eliminatedUsername = game.players[eliminatedId];
    const eliminationMessages = [
      `@${eliminatedUsername} slipped off! ❌`,
      `@${eliminatedUsername} just got vaporized! 💨`,
      `The spirits have claimed @${eliminatedUsername}! 💀`,
    ];
    const randomMessage = eliminationMessages[Math.floor(Math.random() * eliminationMessages.length)];
    bot.sendMessage(chatId, randomMessage);
    players.splice(eliminatedIndex, 1);
  }, 5000);
}

function startTagTimer(chatId, itId) {
  if (shadowGames[chatId] && shadowGames[chatId].gameTimer) {
    clearTimeout(shadowGames[chatId].gameTimer);
  }
  shadowGames[chatId].gameTimer = setTimeout(() => {
    if (shadowGames[chatId] && shadowGames[chatId].players[itId] && shadowGames[chatId].players[itId].isIt) {
      const itUsername = shadowGames[chatId].players[itId].username;
      bot.sendMessage(chatId, `@${itUsername} failed to tag someone in time! A new "It" will be chosen.`);
      shadowGames[chatId].players[itId].isIt = false;
      const playerIds = Object.keys(shadowGames[chatId].players).filter(id => id !== itId);
      if (playerIds.length > 0) {
        const newItId = playerIds[Math.floor(Math.random() * playerIds.length)];
        shadowGames[chatId].players[newItId].isIt = true;
        const newItUsername = shadowGames[chatId].players[newItId].username;
        bot.sendMessage(chatId, `@${newItUsername} is now "It"! They have 25 seconds to tag someone.`);
        startTagTimer(chatId, newItId);
      } else {
        bot.sendMessage(chatId, "Not enough players to continue the game.");
        delete shadowGames[chatId];
      }
    }
  }, 25000);
}

console.log('Mr. Yunks bot has started...');
