// routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth');

// Hubungkan URL /login ke fungsi login di controller
router.post('/login', authController.login);

module.exports = router;