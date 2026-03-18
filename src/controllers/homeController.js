const pool = require('../config/db');

// GET /home/summary
const getHomeSummary = async (req, res) => {
    try {
        // Run queries in parallel for maximum speed
        const [testsRes, caRes, subjectsRes] = await Promise.all([
            // 1. Recent Tests
            pool.query(`
                SELECT t.id, t.title, t.timer_minutes, t.question_count, t.created_at, t.share_code, t.negative_marking, t.is_strict,
                       c.name AS chapter_name, s.name AS subject_name
                FROM tests t
                JOIN chapters c ON c.id = t.chapter_id
                JOIN subjects s ON s.id = c.subject_id
                ORDER BY t.created_at DESC
                LIMIT 5
            `),

            // 2. Recent Current Affairs
            pool.query(`
                SELECT ca.id, ca.title, ca.topic, ca.content, ca.type, ca.created_at, COUNT(q.id) as question_count 
                FROM current_affairs ca 
                LEFT JOIN questions q ON ca.id = q.current_affair_id 
                GROUP BY ca.id 
                ORDER BY ca.created_at DESC
                LIMIT 5
            `),

            // 3. Subjects with chapter counts
            pool.query(`
                SELECT s.*, (SELECT COUNT(*)::int FROM chapters c WHERE c.subject_id = s.id) as chapter_count
                FROM subjects s
                ORDER BY s.name ASC
            `)
        ]);

        const subjects = subjectsRes.rows;
        let featuredChapters = [];
        let lastPracticed = null;

        // If there are subjects, fetch first subject's chapters for "Resume Learning"
        if (subjects.length > 0) {
            const chaptersRes = await pool.query(`
                SELECT c.*, 
                       (SELECT score FROM test_attempts ta 
                        JOIN tests t ON ta.test_id = t.id 
                        WHERE t.chapter_id = c.id AND ta.user_id = $1 
                        ORDER BY ta.completed_at DESC LIMIT 1) as last_score,
                       (SELECT total FROM test_attempts ta 
                        JOIN tests t ON ta.test_id = t.id 
                        WHERE t.chapter_id = c.id AND ta.user_id = $1 
                        ORDER BY ta.completed_at DESC LIMIT 1) as last_total
                FROM chapters c 
                WHERE c.subject_id = $2 
                ORDER BY c.chapter_order ASC 
                LIMIT 5
            `, [req.user.id, subjects[0].id]);
            
            featuredChapters = chaptersRes.rows;
            lastPracticed = featuredChapters.find(ch => ch.last_score !== null) || featuredChapters[0];
        }

        res.json({
            recentTests: testsRes.rows,
            recentCA: caRes.rows,
            subjects: subjects,
            recentChapters: featuredChapters,
            lastPracticed: lastPracticed
        });
    } catch (err) {
        console.error('Home Summary Error:', err);
        res.status(500).json({ error: err.message });
    }
};

module.exports = { getHomeSummary };
