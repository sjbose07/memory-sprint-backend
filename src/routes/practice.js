const express = require('express');
const router = express.Router();
const { getPracticeQuestions, savePracticeScore } = require('../controllers/practiceController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/:chapterId/questions', getPracticeQuestions);
router.post('/:chapterId/save-score', savePracticeScore);

module.exports = router;
