const express = require('express');
const router = express.Router();
const lecturerController = require('../controllers/lecturerController');

router.get('/students/:lecturerId', lecturerController.getMyStudents);
router.get('/schedules/:lecturerId', lecturerController.getSchedules);

module.exports = router;