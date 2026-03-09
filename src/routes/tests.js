const express = require('express');
const router = express.Router();
const { listTests, createTest, deleteTest, startTest, getTestByCode } = require('../controllers/testsController');
const authMiddleware = require('../middleware/auth');
const requireRole = require('../middleware/roles');

// Public GET
router.get('/', listTests);
router.get('/code/:code', getTestByCode);

// Protected routes below
router.use(authMiddleware);

router.post('/', requireRole('admin', 'moderator'), createTest);
router.delete('/:id', requireRole('admin', 'moderator'), deleteTest);
router.post('/:id/start', startTest);

module.exports = router;
