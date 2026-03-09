const pool = require('../config/db');

// POST /attempts/:id/submit — submit answers and calculate score
const submitAttempt = async (req, res) => {
    const { id } = req.params;
    const { answers } = req.body; // [{ question_id, selected_option }]

    if (!Array.isArray(answers) || !answers.length) {
        return res.status(400).json({ error: 'answers array is required' });
    }

    const client = await pool.connect();
    try {
        // Verify attempt belongs to user
        const attemptResult = await client.query(
            'SELECT * FROM test_attempts WHERE id = $1 AND user_id = $2',
            [id, req.user.id]
        );

        if (!attemptResult.rows.length) {
            client.release();
            return res.status(404).json({ error: 'Attempt not found' });
        }

        if (attemptResult.rows[0].completed_at) {
            client.release();
            return res.status(400).json({ error: 'Attempt already completed' });
        }

        // Get correct answers and test config
        const attempt = attemptResult.rows[0];
        const testResult = await client.query('SELECT negative_marking FROM tests WHERE id = $1', [attempt.test_id]);
        const negMarking = testResult.rows[0].negative_marking;

        const questionIds = answers.map(a => a.question_id);
        const qResult = await client.query(
            `SELECT id, correct_option FROM questions WHERE id = ANY($1::uuid[])`,
            [questionIds]
        );
        const correctMap = {};
        qResult.rows.forEach(q => { correctMap[q.id] = q.correct_option; });

        await client.query('BEGIN');

        let score = 0;
        for (const answer of answers) {
            const isCorrect = correctMap[answer.question_id] === answer.selected_option?.toUpperCase();
            if (isCorrect) {
                score++;
            } else if (negMarking && answer.selected_option) {
                score -= 0.25;
            }
            await client.query(
                `INSERT INTO attempt_answers (attempt_id, question_id, selected_option, is_correct)
                 VALUES ($1, $2, $3, $4)`,
                [id, answer.question_id, answer.selected_option?.toUpperCase() || null, isCorrect]
            );
        }

        // Complete the attempt
        const updatedAttempt = await client.query(
            `UPDATE test_attempts SET score = $1, completed_at = NOW()
             WHERE id = $2 RETURNING *`,
            [score, id]
        );

        await client.query('COMMIT');

        // Return results with correct answers
        const detailResult = await client.query(
            `SELECT aa.question_id, aa.selected_option, aa.is_correct,
              q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
              q.correct_option, q.explanation
       FROM attempt_answers aa
       JOIN questions q ON q.id = aa.question_id
       WHERE aa.attempt_id = $1`,
            [id]
        );

        res.json({
            attempt_id: id,
            score,
            total: updatedAttempt.rows[0].total,
            percentage: Math.max(0, Math.round((score / updatedAttempt.rows[0].total) * 100)),
            details: detailResult.rows,
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Submit Attempt Error:', err);
        res.status(500).json({ error: 'Internal server error during submission' });
    } finally {
        client.release();
    }
};

// GET /attempts/:id — get attempt result
const getAttemptResult = async (req, res) => {
    const { id } = req.params;
    try {
        const attemptResult = await pool.query(
            `SELECT ta.*, t.title, t.timer_minutes FROM test_attempts ta
       JOIN tests t ON t.id = ta.test_id
       WHERE ta.id = $1 AND ta.user_id = $2`,
            [id, req.user.id]
        );
        if (!attemptResult.rows.length) return res.status(404).json({ error: 'Attempt not found' });

        const detailResult = await pool.query(
            `SELECT aa.question_id, aa.selected_option, aa.is_correct,
              q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
              q.correct_option, q.explanation
       FROM attempt_answers aa
       JOIN questions q ON q.id = aa.question_id
       WHERE aa.attempt_id = $1`,
            [id]
        );

        const attempt = attemptResult.rows[0];
        const rawScore = parseFloat(attempt.score);
        res.json({
            ...attempt,
            score: rawScore,
            percentage: Math.max(0, Math.round((rawScore / attempt.total) * 100)),
            details: detailResult.rows,
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { submitAttempt, getAttemptResult };
