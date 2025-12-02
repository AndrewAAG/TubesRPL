const express = require('express');
const router = express.Router();
const path = require('path');

// Helper function untuk ambil file dari folder public
const publicPath = (fileName) => path.join(__dirname, '../public', fileName);

// --- PUBLIC ROUTES ---
router.get('/', (req, res) => res.redirect('/login'));
router.get('/login', (req, res) => 
    res.sendFile(publicPath('login.html'))
);

// --- MAHASISWA ---
router.get('/student/schedule', (req, res) =>
    res.sendFile(publicPath('student/student_schedule.html'))
);

router.get('/student/calendar', (req, res) =>
    res.sendFile(publicPath('student/calendar.html'))
);

// --- DOSEN ---

// --- ADMIN ---

module.exports = router;
