const pool = require('../config/db');

// GET /analytics/performance
const getPerformance = async (req, res) => {
    const userId = req.user.id;

    try {
        // 1. Subject-wise accuracy
        const subjectAccuracy = await pool.query(`
            SELECT 
                s.name as subject_name,
                COUNT(aa.id) FILTER (WHERE aa.is_correct = TRUE) as correct_count,
                COUNT(aa.id) as total_count,
                ROUND(COUNT(aa.id) FILTER (WHERE aa.is_correct = TRUE)::numeric / NULLIF(COUNT(aa.id), 0) * 100, 1) as accuracy
            FROM subjects s
            JOIN chapters c ON c.subject_id = s.id
            JOIN questions q ON q.chapter_id = c.id
            JOIN attempt_answers aa ON aa.question_id = q.id
            JOIN test_attempts ta ON ta.id = aa.attempt_id
            WHERE ta.user_id = $1
            GROUP BY s.name
            ORDER BY accuracy DESC
        `, [userId]);

        // 2. Recent activity (last 7 days of attempts)
        const recentActivity = await pool.query(`
            SELECT 
                DATE(ta.completed_at) as date,
                COUNT(ta.id) as attempt_count,
                AVG(ta.score::numeric / NULLIF(ta.total, 0) * 100) as avg_score
            FROM test_attempts ta
            WHERE ta.user_id = $1 
              AND ta.completed_at >= NOW() - INTERVAL '7 days'
              AND ta.completed_at IS NOT NULL
            GROUP BY DATE(ta.completed_at)
            ORDER BY DATE(ta.completed_at) ASC
        `, [userId]);

        // 3. Overall stats
        const overallStats = await pool.query(`
            SELECT 
                COUNT(ta.id) as total_attempts,
                SUM(ta.score) as total_correct,
                SUM(ta.total) as total_questions,
                ROUND(SUM(ta.score)::numeric / NULLIF(SUM(ta.total), 0) * 100, 1) as overall_accuracy
            FROM test_attempts ta
            WHERE ta.user_id = $1 AND ta.completed_at IS NOT NULL
        `, [userId]);

        res.json({
            subjectAccuracy: subjectAccuracy.rows,
            recentActivity: recentActivity.rows,
            overall: overallStats.rows[0] || { total_attempts: 0, total_correct: 0, total_questions: 0, overall_accuracy: 0 }
        });

    } catch (err) {
        console.error('Analytics Error:', err);
        res.status(500).json({ error: err.message });
    }
};

// GET /analytics/database-stats (Admin Only)
const getDatabaseStats = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT pg_database_size(current_database()) as size_bytes
        `);

        let bytes = result.rows[0].size_bytes;
        // Basic formatting
        const megaBytes = (bytes / (1024 * 1024)).toFixed(2);

        res.json({
            size_bytes: bytes,
            formatted_size: `${megaBytes} MB`
        });
    } catch (err) {
        console.error('Database Stats Error:', err);
        res.status(500).json({ error: err.message });
    }
};

// GET /analytics/global-stats (Admin Only)
const getGlobalStats = async (req, res) => {
    try {
        const stats = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM subjects) as total_subjects,
                (SELECT COUNT(*) FROM questions) as total_questions,
                (SELECT COUNT(*) FROM tests) as total_tests,
                (SELECT COUNT(*) FROM test_attempts) as total_attempts
        `);

        res.json(stats.rows[0]);
    } catch (err) {
        console.error('Global Stats Error:', err);
        res.status(500).json({ error: err.message });
    }
};

module.exports = { getPerformance, getDatabaseStats, getGlobalStats };
