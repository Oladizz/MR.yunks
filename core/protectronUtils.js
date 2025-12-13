const { db } = require('./firebase');
const { isUserAdmin } = require('../features/moderation'); // Keep this if used by other protectronUtils functions
const { sendRateLimitedMessage } = require('./telegramUtils');
const admin = require('firebase-admin'); // Import firebase-admin for FieldValue if needed by the moved functions

async function setProtectronSetting(chatId, setting, value) {
    const configRef = db.collection('protectron_configs').doc(chatId.toString());
    await configRef.set({ [setting]: value }, { merge: true });
}

async function getProtectronSetting(chatId, setting) {
    const configRef = db.collection('protectron_configs').doc(chatId.toString());
    const doc = await configRef.get();
    return doc.exists ? doc.data()[setting] : undefined;
}

async function getBlacklistedWords(chatId) {
    try {
        const configRef = db.collection('protectron_configs').doc(chatId.toString());
        const doc = await configRef.get();
        return doc.exists && doc.data().blacklistedWords ? doc.data().blacklistedWords : [];
    } catch (error) {
        console.error("Error getting blacklisted words:", error);
        return [];
    }
}

async function getWhitelistedDomains(chatId) {
    try {
        const configRef = db.collection('protectron_configs').doc(chatId.toString());
        const doc = await configRef.get();
        return doc.exists && doc.data().whitelistedDomains ? doc.data().whitelistedDomains : [];
    } catch (error) {
        console.error("Error getting whitelisted domains:", error);
        return [];
    }
}

const toggleSetting = async (bot, msg, settingName, display_name) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!await isUserAdmin(bot, chatId, userId)) {
        sendRateLimitedMessage(bot, chatId, `You are not authorized to toggle ${display_name}.`);
        return;
    }

    try {
        const currentValue = await getProtectronSetting(chatId, settingName);
        const newValue = !currentValue;
        await setProtectronSetting(chatId, settingName, newValue);
        const status = newValue ? 'enabled' : 'disabled';
        sendRateLimitedMessage(bot, chatId, `Protectron: ${display_name} has been ${status}.`);
    } catch (error) {
        console.error(`Error toggling ${settingName}:`, error);
        sendRateLimitedMessage(bot, chatId, `An error occurred while toggling ${display_name}.`);
    }
};

module.exports = {
    setProtectronSetting,
    getProtectronSetting,
    getBlacklistedWords,
    getWhitelistedDomains,
    toggleSetting,
};