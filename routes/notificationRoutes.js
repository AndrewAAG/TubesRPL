const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

// Route untuk mengambil notifikasi berdasarkan user_id
// URL Akhir: /api/notifications?user_id=...
router.get('/', notificationController.getUserNotifications);

module.exports = router;