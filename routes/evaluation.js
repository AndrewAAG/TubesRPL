const express = require('express');
const router = express.Router();
const evaluationController = require('../controllers/evaluationController');

router.get('/student/:studentId', evaluationController.getEvaluations);
router.get('/detail/:appId', evaluationController.getEvaluationDetail); 
router.put('/task/:taskId', evaluationController.updateTaskStatus);    

module.exports = router;