const express = require('express');
const router = express.Router();
const evaluationController = require('../controllers/evaluationController');

router.get('/student/:studentId', evaluationController.getEvaluations);
router.get('/detail/:appId', evaluationController.getEvaluationDetail); 
router.put('/task/:taskId', evaluationController.updateTaskStatus);    

router.get('/lecturer/:lecturerId', evaluationController.getLecturerHistory);
router.post('/note', evaluationController.saveNote);
router.post('/task', evaluationController.addTask);

module.exports = router;