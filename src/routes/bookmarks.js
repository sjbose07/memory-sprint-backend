const express = require('express');
const router = express.Router();
const { listBookmarks, addBookmark, removeBookmark } = require('../controllers/bookmarksController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', listBookmarks);
router.post('/:questionId', addBookmark);
router.delete('/:questionId', removeBookmark);

module.exports = router;
