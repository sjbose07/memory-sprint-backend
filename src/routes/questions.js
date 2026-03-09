const express = require('express');
const multer = require('multer');
const router = express.Router();
const {
    listQuestions, createQuestion, bulkUploadQuestions,
    deleteQuestion, previewQuestions, bulkExportQuestions, bulkSyncQuestions
} = require('../controllers/questionsController');
const authMiddleware = require('../middleware/auth');
const requireRole = require('../middleware/roles');

// multer: store in memory (buffer) for PDF/text parsing
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (req, file, cb) => {
        const allowed = ['application/pdf', 'text/plain', 'text/csv'];
        if (allowed.includes(file.mimetype) || file.originalname.endsWith('.txt')) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF and text files are allowed'));
        }
    }
});

router.use(authMiddleware);

router.get('/', listQuestions);
router.post('/', requireRole('admin', 'moderator'), createQuestion);
router.post('/bulk', requireRole('admin', 'moderator'), upload.single('file'), bulkUploadQuestions);
router.post('/preview', requireRole('admin', 'moderator'), upload.single('file'), previewQuestions);
router.get('/bulk-export/:chapterId', requireRole('admin', 'moderator'), bulkExportQuestions);
router.put('/bulk-sync/:chapterId', requireRole('admin', 'moderator'), bulkSyncQuestions);
router.delete('/:id', requireRole('admin', 'moderator'), deleteQuestion);

module.exports = router;
