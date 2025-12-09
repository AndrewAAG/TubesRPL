const NotificationModel = require('../models/notificationModel');

// 1. Get List Notifikasi
exports.getUserNotifications = async (req, res) => {
    try {
        const userId = req.query.user_id;
        if (!userId) return res.status(400).json({ error: 'User ID required' });

        const data = await NotificationModel.getByUser(userId);
        res.json({ success: true, data: data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 2. Get Unread Count (Untuk Badge Merah)
exports.getUnreadCount = async (req, res) => {
    try {
        const userId = req.query.user_id;
        const count = await NotificationModel.getUnreadCount(userId);
        res.json({ success: true, count: count });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 3. Mark All as Read
exports.markAsRead = async (req, res) => {
    try {
        const { user_id } = req.body;
        await NotificationModel.markAllAsRead(user_id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.sendBroadcast = async (req, res) => {
    try {
        const { senderId, targetType, title, message } = req.body;

        if (!targetType || !title || !message) {
            return res.status(400).json({ success: false, message: 'Data tidak lengkap' });
        }

        // 1. Dapatkan List ID Penerima
        const recipientIds = await NotificationModel.getTargetUserIds(targetType, senderId);

        if (recipientIds.length === 0) {
            return res.json({ success: false, message: 'Tidak ada user yang sesuai kriteria target.' });
        }

        // 2. Lakukan Bulk Insert
        await NotificationModel.createBulk(recipientIds, title, message);

        res.json({ success: true, message: `Berhasil mengirim ke ${recipientIds.length} pengguna.` });

    } catch (error) {
        console.error("Broadcast Error:", error);
        res.status(500).json({ success: false, message: 'Gagal mengirim broadcast.' });
    }
};