// routes/coordinator.js
const express = require('express');
const router = express.Router();
const coordinatorController = require('../controllers/coordinatorController');

// SEMESTER MANAGEMENT
router.get('/semesters', coordinatorController.getSemesters);
router.post('/semesters', coordinatorController.saveSemester); // Create/Update handled in one
router.delete('/semesters/:id', coordinatorController.deleteSemester);
router.post('/semesters/set-active', coordinatorController.setActiveSemester);
router.get('/assignments', coordinatorController.getAssignments);
router.post('/assignments', coordinatorController.saveAssignment);

module.exports = router;