const express = require('express');
const router = express.Router();
const {
    listCurrentAffairs,
    getCurrentAffairsById,
    createCurrentAffairs,
    editCurrentAffairs,
    deleteCurrentAffairs
} = require('../controllers/currentAffairsController');
const authMiddleware = require('../middleware/auth');
const requireRole = require('../middleware/roles');

// Public GET
router.get('/', listCurrentAffairs);
router.get('/:id', getCurrentAffairsById);

// Protected routes below
router.use(authMiddleware);

router.post('/', requireRole('admin', 'moderator'), createCurrentAffairs);
router.patch('/:id', requireRole('admin', 'moderator'), editCurrentAffairs);
router.delete('/:id', requireRole('admin'), deleteCurrentAffairs);

module.exports = router;
