const express = require('express');
const router = express.Router();
const { generateQuestions, enhanceText } = require('../controllers/aiController');
const authMiddleware = require('../middleware/auth');
const requireRole = require('../middleware/roles');

router.post('/generate', authMiddleware, requireRole('admin', 'moderator'), generateQuestions);
router.post('/enhance', authMiddleware, requireRole('admin', 'moderator'), enhanceText);

module.exports = router;
