const { db } = require('./firebase');

async function addPoints(userId, points) {
    if (!userId || !points) return;
    const pointsRef = db.collection('yunk_points').doc(userId.toString());
    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(pointsRef);
            if (!doc.exists) {
                transaction.set(pointsRef, { points: points });
            } else {
                const newPoints = doc.data().points + points;
                transaction.update(pointsRef, { points: newPoints });
            }
        });
    } catch (error) {
        console.error(`Error adding points to user ${userId}:`, error);
    }
}

module.exports = { addPoints };
