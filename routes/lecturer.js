const express = require('express');
const router = express.Router();
const lecturerController = require('../controllers/lecturerController');

router.get('/students/:lecturerId', lecturerController.getMyStudents);
router.get('/schedules/:lecturerId', lecturerController.getSchedules);
router.get('/requests/:lecturerId', lecturerController.getPendingRequests);
router.post('/requests/:id/respond', lecturerController.respondToRequest);
router.get('/students-list/:lecturerId', lecturerController.getStudentList);
router.get('/student-supervisors/:studentId', lecturerController.getStudentSupervisors);

module.exports = router;