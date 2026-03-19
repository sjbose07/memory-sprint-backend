const express = require('express');
const router = express.Router();
const adminNoticeController = require('../controllers/adminNoticeController');
const authenticateToken = require('../middleware/auth');
const requireRole = require('../middleware/roles');

// All routes are protected and require admin role
router.use(authenticateToken);
router.use(requireRole('admin'));

router.get('/', adminNoticeController.listNotices);
router.patch('/:id/read', adminNoticeController.markAsRead);
router.delete('/:id', adminNoticeController.deleteNotice);

module.exports = router;
