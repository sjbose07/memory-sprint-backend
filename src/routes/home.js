const express = require('express');
const router = express.Router();
const { getHomeSummary } = require('../controllers/homeController');
const authMiddleware = require('../middleware/auth');

// Protected Home route
router.get('/summary', authMiddleware, getHomeSummary);

module.exports = router;
