const pool = require('../config/db');
const { deleteAssetsFromText } = require('../utils/cloudinaryHelper');

// GET /subjects
const listSubjects = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT s.id, s.name, s.description, s.created_at,
              COUNT(DISTINCT c.id)::int AS chapter_count,
              (SELECT COUNT(sm.id)::int FROM study_materials sm 
               JOIN chapters ch ON ch.id = sm.chapter_id 
               WHERE ch.subject_id = s.id) AS material_count
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
              COUNT(DISTINCT c.id)::int AS chapter_count,
              (SELECT COUNT(sm.id)::int FROM study_materials sm 
               JOIN chapters ch ON ch.id = sm.chapter_id 
               WHERE ch.subject_id = s.id) AS material_count
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
    const { id } = req.params;
    try {
        // 1. Fetch all materials in all chapters of this subject for cleanup
        const materialsRes = await pool.query(
            `SELECT sm.content 
             FROM study_materials sm
             JOIN chapters c ON c.id = sm.chapter_id
             WHERE c.subject_id = $1`,
            [id]
        );

        // 2. Delete from database (Chapters/Materials should cascade-delete in DB)
        const result = await pool.query('DELETE FROM subjects WHERE id = $1 RETURNING id', [id]);
        if (!result.rows.length) return res.status(404).json({ error: 'Subject not found' });

        // 3. Trigger Cloudinary cleanup
        materialsRes.rows.forEach(material => {
            deleteAssetsFromText(material.content).catch(err => console.error('Cloudinary cleanup error (Subject Material):', err));
        });

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
            `SELECT c.id, c.subject_id, c.group_id, c.name, c.description, c.order_num, c.tags, c.type, c.created_at,
              (SELECT COUNT(q.id)::int FROM questions q WHERE q.chapter_id = c.id AND q.type = 'mcq') AS mcq_count,
              (SELECT COUNT(sm.id)::int FROM study_materials sm WHERE sm.chapter_id = c.id) AS material_count,
              ps.score AS last_practice_score,
              ps.total AS last_practice_total,
              ps.last_practiced_at
       FROM chapters c
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
    const { name, order_num, tags, description, type } = req.body;
    if (!name) return res.status(400).json({ error: 'Chapter name is required' });
    try {
        const result = await pool.query(
            'INSERT INTO chapters (subject_id, name, order_num, tags, description, type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [req.params.id, name, order_num || 0, tags || [], description || null, type || 'mcq']
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// PATCH /subjects/:subjectId/chapters/:chapterId
const editChapter = async (req, res) => {
    const { id: subjectId, chapterId } = req.params;
    const { name, order_num, tags, description, type } = req.body;
    if (!name) return res.status(400).json({ error: 'Chapter name is required' });

    try {
        const result = await pool.query(
            'UPDATE chapters SET name = $1, order_num = COALESCE($2, order_num), tags = $3, description = $4, type = COALESCE($5, type) WHERE id = $6 AND subject_id = $7 RETURNING *',
            [name, order_num || null, tags || [], description || null, type || null, chapterId, subjectId]
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
        // 1. Fetch all materials in this chapter for cleanup
        const materialsRes = await pool.query('SELECT content FROM study_materials WHERE chapter_id = $1', [chapterId]);
        
        // 2. Delete from database
        const result = await pool.query(
            'DELETE FROM chapters WHERE id = $1 AND subject_id = $2 RETURNING id',
            [chapterId, subjectId]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Chapter not found' });

        // 3. Trigger Cloudinary cleanup for each material
        materialsRes.rows.forEach(material => {
            deleteAssetsFromText(material.content).catch(err => console.error('Cloudinary cleanup error (Chapter Material):', err));
        });

        res.json({ message: 'Chapter deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// PATCH /subjects/:id/chapters/reorder
const reorderChapters = async (req, res) => {
    const { id: subjectId } = req.params;
    const { chapterIds } = req.body; // Array of UUIDs in new order

    if (!Array.isArray(chapterIds)) return res.status(400).json({ error: 'chapterIds array required' });

    try {
        await pool.query('BEGIN');
        for (let i = 0; i < chapterIds.length; i++) {
            await pool.query(
                'UPDATE chapters SET order_num = $1 WHERE id = $2 AND subject_id = $3',
                [i, chapterIds[i], subjectId]
            );
        }
        await pool.query('COMMIT');
        res.json({ message: 'Chapters reordered' });
    } catch (err) {
        await pool.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
};

// GET /subjects/:id/groups
const listChapterGroups = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM chapter_groups WHERE subject_id = $1 ORDER BY order_num, name',
            [req.params.id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /subjects/:id/groups
const createChapterGroup = async (req, res) => {
    const { name, order_num } = req.body;
    if (!name) return res.status(400).json({ error: 'Group name is required' });
    try {
        const result = await pool.query(
            'INSERT INTO chapter_groups (subject_id, name, order_num) VALUES ($1, $2, $3) RETURNING *',
            [req.params.id, name, order_num || 0]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// PATCH /subjects/:id/groups/:groupId
const editChapterGroup = async (req, res) => {
    const { id: subjectId, groupId } = req.params;
    const { name, order_num } = req.body;
    try {
        const result = await pool.query(
            'UPDATE chapter_groups SET name = COALESCE($1, name), order_num = COALESCE($2, order_num) WHERE id = $3 AND subject_id = $4 RETURNING *',
            [name || null, order_num || null, groupId, subjectId]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Group not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// DELETE /subjects/:id/groups/:groupId
const deleteChapterGroup = async (req, res) => {
    const { id: subjectId, groupId } = req.params;
    try {
        const result = await pool.query(
            'DELETE FROM chapter_groups WHERE id = $1 AND subject_id = $2 RETURNING id',
            [groupId, subjectId]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Group not found' });
        res.json({ message: 'Group deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// PATCH /subjects/:id/chapters/bulk-move
const bulkMoveChapters = async (req, res) => {
    const { id: subjectId } = req.params;
    const { chapterIds, groupId } = req.body; // groupId can be null
    if (!Array.isArray(chapterIds)) return res.status(400).json({ error: 'chapterIds array required' });

    try {
        await pool.query('BEGIN');
        for (const chapterId of chapterIds) {
            await pool.query(
                'UPDATE chapters SET group_id = $1 WHERE id = $2 AND subject_id = $3',
                [groupId || null, chapterId, subjectId]
            );
        }
        await pool.query('COMMIT');
        res.json({ message: 'Chapters moved successfully' });
    } catch (err) {
        await pool.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
};

module.exports = { 
    listSubjects, createSubject, deleteSubject, editSubject, getSubjectById, 
    listChapters, createChapter, editChapter, deleteChapter, reorderChapters,
    listChapterGroups, createChapterGroup, editChapterGroup, deleteChapterGroup, bulkMoveChapters
};
