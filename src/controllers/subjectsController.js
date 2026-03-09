const pool = require('../config/db');

// GET /subjects
const listSubjects = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT s.id, s.name, s.description, s.created_at,
              COUNT(c.id)::int AS chapter_count
       FROM subjects s
       LEFT JOIN chapters c ON c.subject_id = s.id
       GROUP BY s.id ORDER BY s.name`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /subjects/:id
const getSubjectById = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            `SELECT s.id, s.name, s.description, s.created_at,
              COUNT(c.id)::int AS chapter_count
       FROM subjects s
       LEFT JOIN chapters c ON c.subject_id = s.id
       WHERE s.id = $1
       GROUP BY s.id`,
            [id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ error: 'Subject not found' });
        }

        // Fetch chapters for this subject to include in the response if needed
        const chaptersRes = await pool.query(
            'SELECT * FROM chapters WHERE subject_id = $1 ORDER BY order_num, name',
            [id]
        );

        const subject = result.rows[0];
        subject.chapters = chaptersRes.rows;

        res.json(subject);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /subjects
const createSubject = async (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Subject name is required' });
    try {
        const result = await pool.query(
            'INSERT INTO subjects (name, description, created_by) VALUES ($1, $2, $3) RETURNING *',
            [name, description || null, req.user.id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// DELETE /subjects/:id
const deleteSubject = async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM subjects WHERE id = $1 RETURNING id', [req.params.id]);
        if (!result.rows.length) return res.status(404).json({ error: 'Subject not found' });
        res.json({ message: 'Subject deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// PATCH /subjects/:id
const editSubject = async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Subject name is required' });
    try {
        const result = await pool.query(
            'UPDATE subjects SET name = $1, description = $2 WHERE id = $3 RETURNING *',
            [name, description || null, id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Subject not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /subjects/:id/chapters
const listChapters = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null;
        const result = await pool.query(
            `SELECT c.id, c.name, c.description, c.order_num, c.tags, c.created_at,
              COUNT(q.id)::int AS question_count,
              ps.score AS last_practice_score,
              ps.total AS last_practice_total,
              ps.last_practiced_at
       FROM chapters c
       LEFT JOIN questions q ON q.chapter_id = c.id
       LEFT JOIN practice_scores ps ON ps.chapter_id = c.id AND ps.user_id = $2
       WHERE c.subject_id = $1
       GROUP BY c.id, ps.score, ps.total, ps.last_practiced_at 
       ORDER BY c.order_num, c.name`,
            [req.params.id, userId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /subjects/:id/chapters
const createChapter = async (req, res) => {
    const { name, order_num, tags, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Chapter name is required' });
    try {
        const result = await pool.query(
            'INSERT INTO chapters (subject_id, name, order_num, tags, description) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [req.params.id, name, order_num || 0, tags || [], description || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// PATCH /subjects/:subjectId/chapters/:chapterId
const editChapter = async (req, res) => {
    const { id: subjectId, chapterId } = req.params;
    const { name, order_num, tags, description } = req.body;

    if (!name) return res.status(400).json({ error: 'Chapter name is required' });

    try {
        const result = await pool.query(
            'UPDATE chapters SET name = $1, order_num = COALESCE($2, order_num), tags = $3, description = $4 WHERE id = $5 AND subject_id = $6 RETURNING *',
            [name, order_num || null, tags || [], description || null, chapterId, subjectId]
        );

        if (!result.rows.length) {
            return res.status(404).json({ error: 'Chapter not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// DELETE /subjects/:id/chapters/:chapterId
const deleteChapter = async (req, res) => {
    const { id: subjectId, chapterId } = req.params;
    try {
        const result = await pool.query(
            'DELETE FROM chapters WHERE id = $1 AND subject_id = $2 RETURNING id',
            [chapterId, subjectId]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Chapter not found' });
        res.json({ message: 'Chapter deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { listSubjects, createSubject, deleteSubject, editSubject, getSubjectById, listChapters, createChapter, editChapter, deleteChapter };
