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
router.get('/student/import', (req, res) => res.sendFile(publicPath('/student/student_import.html')));
router.get('/student/evaluation/detail', (req, res) => res.sendFile(publicPath('/student/student_evaluation_detail.html')));

// --- DOSEN ---
router.get('/lecturer/schedule', (req, res) => res.sendFile(publicPath('/lecturer/lecturer_schedule.html')));
router.get('/lecturer/requests', (req, res) => res.sendFile(publicPath('/lecturer/lecturer_requests.html')));
router.get('/lecturer/evaluation', (req, res) => res.sendFile(publicPath('/lecturer/lecturer_evaluation.html')));
router.get('/lecturer/evaluation/detail', (req, res) => res.sendFile(publicPath('/lecturer/lecturer_evaluation_detail.html')));
router.get('/lecturer/students', (req, res) => res.sendFile(publicPath('/lecturer/lecturer_students.html')));
router.get('/lecturer/student-progress', (req, res) => res.sendFile(publicPath('/lecturer/lecturer_student_progress.html')));

// --- KOORDINATOR ---
router.get('/coordinator/schedule', (req, res) => res.sendFile(publicPath('/coordinator/coordinator_schedules.html')));
router.get('/coordinator/assignments', (req, res) => res.sendFile(publicPath('/coordinator/coordinator_assignments.html')));
router.get('/coordinator/users', (req, res) => res.sendFile(publicPath('/coordinator/coordinator_users.html')));
router.get('/coordinator/import', (req, res) => res.sendFile(publicPath('/coordinator/coordinator_import.html')));

// Fallback 404
// router.get('*', (req, res) => res.status(404).send('Halaman tidak ditemukan'));

module.exports = router;