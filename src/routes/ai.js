const express = require('express');
const router = express.Router();
const { generateQuestions } = require('../controllers/aiController');
const authMiddleware = require('../middleware/auth');
const requireRole = require('../middleware/roles');

router.post('/generate', authMiddleware, requireRole('admin', 'moderator'), generateQuestions);

module.exports = router;
