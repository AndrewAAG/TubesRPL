const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/scheduleController');

router.get('/student/:studentId', scheduleController.getStudentSchedules);

// Bisa dipake student maupun lecturer
router.put('/:id/reschedule', scheduleController.rescheduleAppointment);
module.exports = router;