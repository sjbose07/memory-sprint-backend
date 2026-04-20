const express = require('express');
const router = express.Router();
const {
    listSubjects, createSubject, deleteSubject, editSubject, getSubjectById,
    listChapters, createChapter, editChapter, deleteChapter, reorderChapters,
    listChapterGroups, createChapterGroup, editChapterGroup, deleteChapterGroup, bulkMoveChapters
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
router.patch('/:id/chapters/reorder', requireRole('admin', 'moderator'), reorderChapters);
router.patch('/:id/chapters/bulk-move', requireRole('admin', 'moderator'), bulkMoveChapters);
router.patch('/:id/chapters/:chapterId', requireRole('admin', 'moderator'), editChapter);
router.delete('/:id/chapters/:chapterId', requireRole('admin'), deleteChapter);

// Chapter Groups (Protected routes)
router.get('/:id/groups', listChapterGroups);
router.post('/:id/groups', requireRole('admin', 'moderator'), createChapterGroup);
router.patch('/:id/groups/:groupId', requireRole('admin', 'moderator'), editChapterGroup);
router.delete('/:id/groups/:groupId', requireRole('admin'), deleteChapterGroup);

module.exports = router;
