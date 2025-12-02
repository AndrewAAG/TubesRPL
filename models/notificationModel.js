const db = require('../config/db');

const getNotificationsByUser = (userId, callback) => {
    // Sesuaikan nama kolom dengan database kamu:
    // time_notified -> kita urutkan berdasarkan ini
    const query = `SELECT * FROM notifications WHERE user_id = ? ORDER BY time_notified DESC`;
    
    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error("Database Query Error:", err);
            return callback(err, null);
        }
        callback(null, results);
    });
};

module.exports = { getNotificationsByUser };