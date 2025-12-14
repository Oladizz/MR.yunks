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
            first_name: user.first_name,
        };
        if (user.username) {
            dataToSet.username = user.username;
        }
        if (user.last_name) {
            dataToSet.last_name = user.last_name;
        }

        const userDoc = await userRef.get(); // Fetch the document first

        if (!userDoc.exists) {
            // Document doesn't exist, create it with initial XP
            await userRef.set({ xp: 0, ...dataToSet });
        } else {
            // Document exists, update other fields but only set xp if it's missing
            const updateFields = { ...dataToSet };
            if (userDoc.data().xp === undefined) {
                updateFields.xp = 0;
            }
            if (Object.keys(updateFields).length > 0) { // Only update if there are fields to update
                await userRef.update(updateFields);
            }
        }

    } catch (error) {
        console.error(`Error updating global user ${user.id} in DB:`, error);
    }

    if (chatId) {
        const chatMemberRef = db.collection('chat_members').doc(chatId.toString()).collection('members').doc(user.id.toString());
        try {
            const memberData = {
                first_name: user.first_name,
            };
            if (user.username) {
                memberData.username = user.username;
            }
            if (user.last_name) {
                memberData.last_name = user.last_name;
            }
            await chatMemberRef.set(memberData, { merge: true });
        } catch (error) {
            console.error(`Error updating chat member ${user.id} for chat ${chatId}:`, error);
        }
    }
}

async function awardXp(userId, amount) {
    const userRef = db.collection('users').doc(userId.toString());
    try {
        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) {
                // Should not happen if updateUserInDb is called reliably, but good to handle
                console.warn(`Attempted to award XP to non-existent user: ${userId}`);
                transaction.set(userRef, { xp: amount }, { merge: true }); // Create with XP
            } else {
                const currentXp = userDoc.data().xp || 0;
                const newXp = currentXp + amount;
                transaction.update(userRef, { xp: newXp });
                console.log(`User ${userId} now has ${newXp} XP.`);
                // TODO: Add leveling logic here or call a separate leveling function
            }
        });
    } catch (error) {
        console.error(`Error awarding XP to user ${userId}:`, error);
    }
}

module.exports = { getUserByUsername, updateUserInDb, awardXp };
