const express = require('express');
const router = express.Router();
const { listUsers, updateUserRole, approveUser, deleteUser, getMyHistory, getMySuggestions, adminCreateUser, updateProfile } = require('../controllers/usersController');
const authMiddleware = require('../middleware/auth');
const requireRole = require('../middleware/roles');

// All routes require login
router.use(authMiddleware);

router.get('/me/history', getMyHistory);
router.get('/me/suggestions', getMySuggestions);
router.patch('/me', updateProfile);

// Admin only
router.get('/', requireRole('admin'), listUsers);
router.post('/', requireRole('admin'), adminCreateUser);
router.patch('/:id/role', requireRole('admin'), updateUserRole);
router.patch('/:id/approve', requireRole('admin'), approveUser);
router.delete('/:id', requireRole('admin'), deleteUser);

module.exports = router;
