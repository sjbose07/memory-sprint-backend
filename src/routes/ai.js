const express = require('express');
const router = express.Router();
const multer = require('multer');
const { generateQuestions, enhanceText, processDocument, listAvailableModels } = require('../controllers/aiController');
const authMiddleware = require('../middleware/auth');
const requireRole = require('../middleware/roles');

const upload = multer({ 
   storage: multer.memoryStorage(),
   limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

router.post('/generate', authMiddleware, requireRole('admin', 'moderator'), generateQuestions);
router.post('/enhance', authMiddleware, requireRole('admin', 'moderator'), enhanceText);
router.post('/process', authMiddleware, requireRole('admin', 'moderator'), upload.single('document'), processDocument);
router.get('/models', authMiddleware, requireRole('admin', 'moderator'), listAvailableModels);

module.exports = router;
