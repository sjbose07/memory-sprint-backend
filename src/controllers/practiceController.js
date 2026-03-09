const pool = require('../config/db');

// GET /practice/:chapterId/questions
const getPracticeQuestions = async (req, res) => {
    const { chapterId } = req.params;
    try {
        const result = await pool.query(
            `SELECT id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation
             FROM questions WHERE chapter_id = $1 ORDER BY RANDOM()`,
            [chapterId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /practice/:chapterId/save-score
const savePracticeScore = async (req, res) => {
    const { chapterId } = req.params;
    const { score, total } = req.body;

    if (score === undefined || total === undefined) {
        return res.status(400).json({ error: 'score and total are required' });
    }

    try {
        await pool.query(
            `INSERT INTO practice_scores (user_id, chapter_id, score, total, last_practiced_at)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (user_id, chapter_id)
             DO UPDATE SET score = EXCLUDED.score, total = EXCLUDED.total, last_practiced_at = NOW()`,
            [req.user.id, chapterId, score, total]
        );
        res.json({ message: 'Score saved successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { getPracticeQuestions, savePracticeScore };
