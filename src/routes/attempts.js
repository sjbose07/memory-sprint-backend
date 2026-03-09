const express = require('express');
const router = express.Router();
const { submitAttempt, getAttemptResult } = require('../controllers/attemptsController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.post('/:id/submit', submitAttempt);
router.get('/:id', getAttemptResult);

module.exports = router;
