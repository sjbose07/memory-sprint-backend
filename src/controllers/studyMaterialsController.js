const pool = require('../config/db');

// GET /study-materials?chapter_id=...
const listMaterials = async (req, res) => {
    const { chapter_id } = req.query;
    try {
        let query = `SELECT sm.*, c.name AS chapter_name, s.name AS subject_name 
                     FROM study_materials sm
                     JOIN chapters c ON c.id = sm.chapter_id
                     JOIN subjects s ON s.id = c.subject_id`;
        const params = [];
        if (chapter_id) {
            query += ' WHERE sm.chapter_id = $1';
            params.push(chapter_id);
        }
        query += ' ORDER BY sm.created_at DESC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /study-materials
const createMaterial = async (req, res) => {
    const { chapter_id, title, content, tags } = req.body;
    if (!chapter_id || !title || !content) {
        return res.status(400).json({ error: 'chapter_id, title, and content are required' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO study_materials (chapter_id, title, content, tags, created_by)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [chapter_id, title, content, tags || [], req.user.id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// PATCH /study-materials/:id
const updateMaterial = async (req, res) => {
    const { id } = req.params;
    const { title, content, tags } = req.body;
    try {
        const result = await pool.query(
            `UPDATE study_materials 
             SET title = COALESCE($1, title), 
                 content = COALESCE($2, content), 
                 tags = COALESCE($3, tags) 
             WHERE id = $4 RETURNING *`,
            [title, content, tags, id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Material not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// DELETE /study-materials/:id
const deleteMaterial = async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM study_materials WHERE id = $1 RETURNING id', [req.params.id]);
        if (!result.rows.length) return res.status(404).json({ error: 'Material not found' });
        res.json({ message: 'Material deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { listMaterials, createMaterial, updateMaterial, deleteMaterial };
