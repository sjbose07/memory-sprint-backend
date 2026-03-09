const express = require('express');
const router = express.Router();
const { getPerformance, getDatabaseStats, getGlobalStats } = require('../controllers/analyticsController');
const authMiddleware = require('../middleware/auth');
const requireRole = require('../middleware/roles');

router.get('/performance', authMiddleware, getPerformance);
router.get('/database-stats', authMiddleware, requireRole('admin'), getDatabaseStats);
router.get('/global-stats', authMiddleware, requireRole('admin'), getGlobalStats);

module.exports = router;
