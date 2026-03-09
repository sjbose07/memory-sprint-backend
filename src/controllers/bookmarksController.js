const pool = require('../config/db');

// GET /bookmarks
const listBookmarks = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT q.*, c.name AS chapter_name, s.name AS subject_name, b.created_at AS bookmarked_at
             FROM bookmarks b
             JOIN questions q ON q.id = b.question_id
             JOIN chapters c ON c.id = q.chapter_id
             JOIN subjects s ON s.id = c.subject_id
             WHERE b.user_id = $1
             ORDER BY b.created_at DESC`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /bookmarks/:questionId
const addBookmark = async (req, res) => {
    const { questionId } = req.params;
    try {
        await pool.query(
            'INSERT INTO bookmarks (user_id, question_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [req.user.id, questionId]
        );
        res.status(201).json({ message: 'Bookmarked' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// DELETE /bookmarks/:questionId
const removeBookmark = async (req, res) => {
    const { questionId } = req.params;
    try {
        await pool.query(
            'DELETE FROM bookmarks WHERE user_id = $1 AND question_id = $2',
            [req.user.id, questionId]
        );
        res.json({ message: 'Bookmark removed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { listBookmarks, addBookmark, removeBookmark };
