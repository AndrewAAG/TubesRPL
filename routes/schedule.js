const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/scheduleController');

router.get('/student/:studentId', scheduleController.getStudentSchedules);

module.exports = router;