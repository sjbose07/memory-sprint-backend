const pool = require('../config/db');

// Simple in-memory cache — keyed by userId, TTL 30 seconds
const cache = new Map();
const CACHE_TTL_MS = 30_000;

function getCached(userId) {
    const entry = cache.get(userId);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL_MS) {
        cache.delete(userId);
        return null;
    }
    return entry.data;
}

function setCached(userId, data) {
    cache.set(userId, { ts: Date.now(), data });
}

// GET /home/summary
const getHomeSummary = async (req, res) => {
    try {
        const userId = req.user.id;
        // const cached = getCached(userId); // Disabled for troubleshooting

        let testsRows, caRows, subjects;

        if (false) { // if (cached) {
            // Serve shared data from cache (instant)
            ({ testsRows, caRows, subjects } = cached);
        } else {
            // Fetch shared data in parallel
            const [testsRes, caRes, subjectsRes] = await Promise.all([
                pool.query(`
                    SELECT t.id, t.title, t.timer_minutes, t.question_count, t.created_at,
                           t.negative_marking AS is_negative, t.is_strict,
                           c.name AS chapter_name, s.name AS subject_name
                    FROM tests t
                    LEFT JOIN chapters c ON c.id = t.chapter_id
                    LEFT JOIN subjects s ON s.id = c.subject_id
                    ORDER BY t.created_at DESC
                    LIMIT 5
                `).catch(e => { console.error('Tests Query Error:', e.message); return { rows: [] }; }),

                pool.query(`
                    SELECT ca.id, ca.title, ca.topic, ca.content, ca.type, ca.created_at, COUNT(q.id) as question_count 
                    FROM current_affairs ca 
                    LEFT JOIN questions q ON ca.id = q.current_affair_id 
                    GROUP BY ca.id 
                    ORDER BY ca.created_at DESC
                    LIMIT 5
                `).catch(e => { console.error('CA Query Error:', e.message); return { rows: [] }; }),

                pool.query(`
                    SELECT s.*, (SELECT COUNT(*)::int FROM chapters c WHERE c.subject_id = s.id) as chapter_count
                    FROM subjects s
                    ORDER BY s.name ASC
                `).catch(e => { console.error('Subjects Query Error:', e.message); return { rows: [] }; })
            ]);

            testsRows  = testsRes.rows;
            caRows     = caRes.rows;
            subjects   = subjectsRes.rows;

            setCached(userId, { testsRows, caRows, subjects });
        }

        // Always fetch user-specific last practiced (cheap single query)
        let featuredChapters = [];
        let lastPracticed = null;

        if (subjects.length > 0) {
            try {
                const chaptersRes = await pool.query(`
                    SELECT c.*, s.name as subject_name,
                           (SELECT COUNT(*) FROM questions q WHERE q.chapter_id = c.id) as question_count,
                           (SELECT score FROM test_attempts ta 
                            JOIN tests t ON ta.test_id = t.id 
                            WHERE t.chapter_id = c.id AND ta.user_id = $1 
                            ORDER BY ta.completed_at DESC LIMIT 1) as last_score,
                           (SELECT total FROM test_attempts ta 
                            JOIN tests t ON ta.test_id = t.id 
                            WHERE t.chapter_id = c.id AND ta.user_id = $1 
                            ORDER BY ta.completed_at DESC LIMIT 1) as last_total
                    FROM chapters c 
                    JOIN subjects s ON s.id = c.subject_id
                    ORDER BY c.created_at DESC 
                    LIMIT 10
                `, [userId]);

                featuredChapters = chaptersRes.rows;
                lastPracticed = featuredChapters.find(ch => ch.last_score !== null) || featuredChapters[0];
            } catch (e) {
                console.error('Featured Chapters Query Error:', e);
            }
        }

        res.json({
            recentTests:    testsRows,
            recentCA:       caRows,
            subjects:       subjects,
            recentChapters: featuredChapters,
            lastPracticed:  lastPracticed
        });
    } catch (err) {
        console.error('Home Summary Global Error:', err);
        res.status(500).json({ error: err.message });
    }
};

module.exports = { getHomeSummary };
