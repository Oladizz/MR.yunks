const { db } = require('./firebase');

// --- Leveling System Helpers ---
function xpToReachLevel(level) {
    if (level <= 1) return 0;
    return 5 * level * (level - 1); // e.g., Level 2 = 10 XP, Level 3 = 30 XP, Level 4 = 60 XP
}

function calculateLevel(xp) {
    if (xp < 0) return 1; // Level 1 is base
    let level = 1;
    while (xp >= xpToReachLevel(level + 1)) {
        level++;
    }
    return level;
}

function calculateXpForNextLevel(currentLevel) {
    return xpToReachLevel(currentLevel + 1);
}
// -----------------------------

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
        let result = {};
        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            let currentXp = 0;
            let currentLevel = 0;

            if (userDoc.exists) {
                currentXp = userDoc.data().xp || 0;
                currentLevel = userDoc.data().level || 0;
            } else {
                // Should not happen if updateUserInDb is called reliably, but good to handle
                console.warn(`Attempted to award XP to non-existent user: ${userId}. Initializing with 0 XP.`);
                transaction.set(userRef, { xp: 0, level: 0 }, { merge: true });
            }

            const newXp = currentXp + amount;
            const newLevel = calculateLevel(newXp);

            transaction.update(userRef, { xp: newXp, level: newLevel });
            console.log(`User ${userId} now has ${newXp} XP (Level ${newLevel}).`);

            result = { newXp, newLevel, levelChanged: newLevel > currentLevel };
        });
        return result;
    } catch (error) {
        console.error(`Error awarding XP to user ${userId}:`, error);
        return { newXp: 0, newLevel: 0, levelChanged: false };
    }
}

module.exports = { getUserByUsername, updateUserInDb, awardXp, calculateLevel, calculateXpForNextLevel };
