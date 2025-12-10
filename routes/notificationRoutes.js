const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

// Route untuk mengambil notifikasi berdasarkan user_id
// URL Akhir: /api/notifications?user_id=...
router.get('/', notificationController.getUserNotifications);
router.get('/count', notificationController.getUnreadCount);
router.post('/mark-read', notificationController.markAsRead);
router.post('/broadcast', notificationController.sendBroadcast);

module.exports = router;