const notificationModel = require('../models/notificationModel');

exports.getUserNotifications = (req, res) => {
    const userId = req.query.user_id;

    if (!userId) {
        return res.status(400).json({ error: 'User ID diperlukan!' });
    }

    notificationModel.getNotificationsByUser(userId, (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Gagal mengambil data' });
        }
        res.json(data);
    });
};