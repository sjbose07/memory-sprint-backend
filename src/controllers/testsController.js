const pool = require('../config/db');

// GET /tests?chapter_id=...&current_affair_id=...
const listTests = async (req, res) => {
    const { chapter_id, current_affair_id } = req.query;
    try {
        let query = `SELECT t.id, t.title, t.timer_minutes, t.question_count, t.created_at, t.share_code, t.negative_marking, t.negative_marking AS is_negative, t.is_strict, t.chapter_id, t.current_affair_id,
                        c.name AS chapter_name, ca.title AS ca_title
                 FROM tests t
                 LEFT JOIN chapters c ON c.id = t.chapter_id
                 LEFT JOIN current_affairs ca ON ca.id = t.current_affair_id`;
        
        const params = [];
        const conditions = [];

        if (chapter_id) {
            params.push(chapter_id);
            conditions.push(`t.chapter_id = $${params.length}`);
        }
        if (current_affair_id) {
            params.push(current_affair_id);
            conditions.push(`t.current_affair_id = $${params.length}`);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY t.created_at DESC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ... generateShareCode ...

// POST /tests
const createTest = async (req, res) => {
    const { title, chapter_id, current_affair_id, timer_minutes, question_count, negative_marking, is_negative, is_strict } = req.body;
    if (!title || (!chapter_id && !current_affair_id)) {
        return res.status(400).json({ error: 'title and (chapter_id or current_affair_id) are required' });
    }
    const negMarking = (negative_marking === true || is_negative === true);
    const strictMode = (is_strict === true);
    const requested = parseInt(question_count) || 10;

    try {
        // Check enough questions exist
        let countQuery = 'SELECT COUNT(*)::int AS cnt FROM questions WHERE ';
        let countParams = [];
        if (chapter_id) {
            countQuery += 'chapter_id = $1';
            countParams.push(chapter_id);
        } else {
            countQuery += 'current_affair_id = $1';
            countParams.push(current_affair_id);
        }

        const countResult = await pool.query(countQuery, countParams);
        const available = countResult.rows[0].cnt;
        
        if (available < requested) {
            return res.status(400).json({
                error: `Not enough questions. Found ${available}, requested ${requested}`
            });
        }

        const shareCode = generateShareCode();
        const result = await pool.query(
            `INSERT INTO tests (title, chapter_id, current_affair_id, timer_minutes, question_count, negative_marking, is_strict, share_code, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [
                title,
                chapter_id || null,
                current_affair_id || null,
                parseFloat(timer_minutes) || 30,
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
            `SELECT t.*, t.negative_marking AS is_negative, c.name AS chapter_name, ca.title AS ca_title
             FROM tests t
             LEFT JOIN chapters c ON c.id = t.chapter_id
             LEFT JOIN current_affairs ca ON ca.id = t.current_affair_id
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
        let qQuery = `SELECT id, question_text, option_a, option_b, option_c, option_d
                      FROM questions WHERE `;
        let qParams = [];
        if (test.chapter_id) {
            qQuery += 'chapter_id = $1';
            qParams.push(test.chapter_id);
        } else {
            qQuery += 'current_affair_id = $1';
            qParams.push(test.current_affair_id);
        }
        qQuery += ' ORDER BY RANDOM() LIMIT $2';
        qParams.push(test.question_count);

        const qResult = await pool.query(qQuery, qParams);

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

