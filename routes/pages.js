const express = require('express');
const router = express.Router();
const path = require('path');

// Helper function agar tidak perlu ketik path.join berulang kali
// Ini mengarah ke folder 'public' di root project
const publicPath = (fileName) => path.join(__dirname, '../public', fileName);

// --- PUBLIC ROUTES ---
router.get('/', (req, res) => res.redirect('/login'));
router.get('/login', (req, res) => res.sendFile(publicPath('login.html')));

// --- MAHASISWA ---
router.get('/student/schedule', (req, res) => res.sendFile(publicPath('/student/student_schedule.html')));
router.get('/student/progress', (req, res) => res.sendFile(publicPath('/student/student_progress.html')));
router.get('/student/evaluation', (req, res) => res.sendFile(publicPath('/student/student_evaluation.html')));
router.get('/student/evaluation/detail', (req, res) => res.sendFile(publicPath('/student/student_evaluation_detail.html')));

// --- DOSEN ---

// --- ADMIN ---


// Fallback 404
// router.get('*', (req, res) => res.status(404).send('Halaman tidak ditemukan'));

module.exports = router;