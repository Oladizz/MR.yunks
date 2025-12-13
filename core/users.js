const { db } = require('./firebase');

async function getUserByUsername(username) {
    if (!username) return null;
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('username', '==', username).limit(1).get();
    if (snapshot.empty) {
        return null;
    }
    const userDoc = snapshot.docs[0];
    return { id: userDoc.id, ...userDoc.data() };
}

async function updateUserInDb(user, chatId) {
    if (!user || user.is_bot) return;

    const userRef = db.collection('users').doc(user.id.toString());
    try {
        const dataToSet = {
            username: user.username,
            first_name: user.first_name,
        };
        if (user.last_name) {
            dataToSet.last_name = user.last_name;
        }
        await userRef.set(dataToSet, { merge: true });
    } catch (error) {
        console.error(`Error updating global user ${user.id} in DB:`, error);
    }

    if (chatId) {
        const chatMemberRef = db.collection('chat_members').doc(chatId.toString()).collection('members').doc(user.id.toString());
        try {
            const memberData = {
                username: user.username,
                first_name: user.first_name,
            };
            if (user.last_name) {
                memberData.last_name = user.last_name;
            }
            await chatMemberRef.set(memberData, { merge: true });
        } catch (error) {
            console.error(`Error updating chat member ${user.id} for chat ${chatId}:`, error);
        }
    }
}

module.exports = { getUserByUsername, updateUserInDb };
