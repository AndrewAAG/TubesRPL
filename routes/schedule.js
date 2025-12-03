// routes/schedule.js

const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/scheduleController');

// ===== EXISTING ROUTES (TETAP ADA) =====

// Route untuk mendapatkan jadwal bimbingan mahasiswa
router.get('/student/:studentId', scheduleController.getStudentSchedules);

// Route untuk reschedule appointment
router.put('/reschedule/:id', scheduleController.rescheduleAppointment);

// ===== NEW ROUTES FOR CALENDAR =====

// Route untuk mengambil jadwal kalender
// GET /api/schedules/calendar/:user_id?start_date=2025-10-01&end_date=2025-10-31
router.get('/calendar/:user_id', scheduleController.getCalendarSchedules);

// Route untuk booking slot jadwal
// POST /api/schedules/book
router.post('/book', scheduleController.bookScheduleSlot);

// Route untuk cancel booking
// POST /api/schedules/cancel
router.post('/cancel', scheduleController.cancelBooking);

module.exports = router;