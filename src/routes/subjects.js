const express = require('express');
const router = express.Router();
const {
    listSubjects, createSubject, deleteSubject, editSubject, getSubjectById,
    listChapters, createChapter, editChapter, deleteChapter
} = require('../controllers/subjectsController');
const authMiddleware = require('../middleware/auth');
const requireRole = require('../middleware/roles');

// Subjects (Public GET)
router.get('/', listSubjects);
router.get('/:id', getSubjectById);

// Chapters (Public GET - nested under subject)
router.get('/:id/chapters', listChapters);

// Protected routes below
router.use(authMiddleware);

router.post('/', requireRole('admin', 'moderator'), createSubject);
router.patch('/:id', requireRole('admin', 'moderator'), editSubject);
router.delete('/:id', requireRole('admin'), deleteSubject);

// Chapters (Protected routes)
router.post('/:id/chapters', requireRole('admin', 'moderator'), createChapter);
router.patch('/:id/chapters/:chapterId', requireRole('admin', 'moderator'), editChapter);
router.delete('/:id/chapters/:chapterId', requireRole('admin'), deleteChapter);

module.exports = router;
