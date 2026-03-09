const pool = require('../config/db');

// GET /tests?chapter_id=...
const listTests = async (req, res) => {
    const { chapter_id } = req.query;
    try {
        let query = `SELECT t.id, t.title, t.timer_minutes, t.question_count, t.created_at, t.share_code, t.negative_marking, t.is_strict,
                        c.name AS chapter_name, s.name AS subject_name
                 FROM tests t
                 JOIN chapters c ON c.id = t.chapter_id
                 JOIN subjects s ON s.id = c.subject_id`;
        const params = [];
        if (chapter_id) {
            query += ' WHERE t.chapter_id = $1';
            params.push(chapter_id);
        }
        query += ' ORDER BY t.created_at DESC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Helper to generate unique share code
const generateShareCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// POST /tests
const createTest = async (req, res) => {
    const { title, chapter_id, timer_minutes, question_count, negative_marking, is_negative, is_strict } = req.body;
    if (!title || !chapter_id) return res.status(400).json({ error: 'title and chapter_id are required' });

    // Handle incoming field name mismatch (is_negative vs negative_marking)
    const negMarking = (negative_marking === true || is_negative === true);

    // Check enough questions exist
    const countResult = await pool.query(
        'SELECT COUNT(*)::int AS cnt FROM questions WHERE chapter_id = $1',
        [chapter_id]
    );
    const available = countResult.rows[0].cnt;
    const requested = parseInt(question_count) || 10;
    if (available < requested) {
        return res.status(400).json({
            error: `Not enough questions. Chapter has ${available} questions, requested ${requested}`
        });
    }

    try {
        const shareCode = generateShareCode();
        const result = await pool.query(
            `INSERT INTO tests (title, chapter_id, timer_minutes, question_count, negative_marking, is_strict, share_code, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [
                title,
                chapter_id,
                parseInt(timer_minutes) || 30,
                requested,
                negMarking,
                is_strict === true,
                shareCode,
                req.user.id
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /tests/code/:code
const getTestByCode = async (req, res) => {
    const { code } = req.params;
    try {
        const result = await pool.query(
            `SELECT t.*, c.name AS chapter_name, s.name AS subject_name
             FROM tests t
             JOIN chapters c ON c.id = t.chapter_id
             JOIN subjects s ON s.id = c.subject_id
             WHERE t.share_code = $1`,
            [code.toUpperCase()]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Test code not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


// DELETE /tests/:id
const deleteTest = async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM tests WHERE id = $1 RETURNING id', [req.params.id]);
        if (!result.rows.length) return res.status(404).json({ error: 'Test not found' });
        res.json({ message: 'Test deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /tests/:id/start — creates an attempt and returns random questions
const startTest = async (req, res) => {
    const { id } = req.params;
    try {
        const testResult = await pool.query('SELECT * FROM tests WHERE id = $1', [id]);
        if (!testResult.rows.length) return res.status(404).json({ error: 'Test not found' });
        const test = testResult.rows[0];

        // Pick random questions
        const qResult = await pool.query(
            `SELECT id, question_text, option_a, option_b, option_c, option_d
       FROM questions WHERE chapter_id = $1
       ORDER BY RANDOM() LIMIT $2`,
            [test.chapter_id, test.question_count]
        );

        // Create attempt
        const attemptResult = await pool.query(
            `INSERT INTO test_attempts (test_id, user_id, total)
       VALUES ($1, $2, $3) RETURNING id`,
            [id, req.user.id, qResult.rows.length]
        );

        res.status(201).json({
            attempt_id: attemptResult.rows[0].id,
            test: {
                id: test.id,
                title: test.title,
                timer_minutes: test.timer_minutes,
                negative_marking: test.negative_marking,
                is_strict: test.is_strict
            },

            questions: qResult.rows,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { listTests, createTest, deleteTest, startTest, getTestByCode };

