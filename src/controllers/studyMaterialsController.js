const pool = require('../config/db');
const { deleteAssetsFromText } = require('../utils/cloudinaryHelper');

// GET /study-materials?chapter_id=...
const listMaterials = async (req, res) => {
    try {
        const { 
            chapter_id, subject_id, current_affair_id,
            chapterId, subjectId, currentAffairId 
        } = req.query;

        const cid = chapter_id || chapterId;
        const sid = subject_id || subjectId;
        const caid = current_affair_id || currentAffairId;

        console.log('[DEBUG] listMaterials Params:', { chapter_id, subject_id, current_affair_id, chapterId, subjectId, currentAffairId });
        console.log('[DEBUG] Resolved IDs:', { cid, sid, caid });

        let query = `SELECT sm.*, c.name AS chapter_name, s.name AS subject_name, c.subject_id 
                     FROM study_materials sm
                     LEFT JOIN chapters c ON c.id = sm.chapter_id
                     LEFT JOIN subjects s ON s.id = c.subject_id`;
        
        const params = [];
        const whereClauses = [];

        const isTrueVal = (v) => v && v !== 'null' && v !== 'undefined' && v !== '';

        if (isTrueVal(caid)) {
            // If filtering by Current Affair, we don't care about chapters/subjects
            params.push(caid);
            whereClauses.push(`sm.current_affair_id = $${params.length}::UUID`);
        } else {
            // Normal Subject/Chapter filtering
            if (isTrueVal(cid)) {
                params.push(cid);
                whereClauses.push(`sm.chapter_id = $${params.length}::UUID`);
            }
            if (isTrueVal(sid)) {
                params.push(sid);
                whereClauses.push(`c.subject_id = $${params.length}::UUID`);
            }
        }

        if (whereClauses.length > 0) {
            query += ' WHERE ' + whereClauses.join(' AND ');
        } else if (req.query.all !== 'true' || req.user.role !== 'admin') {
            // For security/leakage prevention: if no filters provided and not admin, return empty
            console.warn('[SECURITY] listMaterials: Unfiltered request blocked for non-admin or missing all=true.');
            return res.json([]);
        }

        query += ' ORDER BY sm.order_num, sm.created_at DESC';

        console.log('[DEBUG] Final SQL Query:', query);
        console.log('[DEBUG] SQL Params:', params);
        console.log('[DEBUG] Final WHERE Clauses:', whereClauses);

        const result = await pool.query(query, params);
        console.log('[DEBUG] Result Count:', result.rows.length);
        if (result.rows.length > 0) {
            console.log('[DEBUG] Sample Rows (Subject Names):', result.rows.slice(0, 5).map(r => `${r.title} [Subject: ${r.subject_name}] (SubjectID: ${r.subject_id})`));
        }
        console.log('------------------------');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /study-materials
const createMaterial = async (req, res) => {
    const { chapter_id, current_affair_id, title, content, tags } = req.body;
    console.log('[DEBUG] createMaterial Inputs:', { chapter_id, current_affair_id, title, content_length: content?.length, tags });
    
    if ((!chapter_id && !current_affair_id) || !title || !content) {
        console.warn('[WARN] createMaterial: Missing required fields');
        return res.status(400).json({ error: 'chapter_id or current_affair_id, title, and content are required' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO study_materials (chapter_id, current_affair_id, title, content, tags, created_by)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [chapter_id || null, current_affair_id || null, title, content, tags || [], req.user.id]
        );
        console.log('[DEBUG] createMaterial: Success, ID =', result.rows[0].id);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('❌ Create Material Error:', err.message);
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
    const { id } = req.params;
    try {
        // 1. Fetch content to find media URLs
        const materialRes = await pool.query('SELECT content FROM study_materials WHERE id = $1', [id]);
        if (!materialRes.rows.length) return res.status(404).json({ error: 'Material not found' });
        
        const content = materialRes.rows[0].content;

        // 2. Delete from database
        await pool.query('DELETE FROM study_materials WHERE id = $1', [id]);
        
        // 3. Delete from Cloudinary (don't block the response)
        deleteAssetsFromText(content).catch(err => console.error('Cloudinary cleanup error:', err));
        
        res.json({ message: 'Material deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// PATCH /study-materials/reorder
const reorderMaterials = async (req, res) => {
    const { materialIds } = req.body; // Array of UUIDs in new order

    if (!Array.isArray(materialIds)) return res.status(400).json({ error: 'materialIds array required' });

    try {
        await pool.query('BEGIN');
        for (let i = 0; i < materialIds.length; i++) {
            await pool.query(
                'UPDATE study_materials SET order_num = $1 WHERE id = $2',
                [i, materialIds[i]]
            );
        }
        await pool.query('COMMIT');
        res.json({ message: 'Materials reordered' });
    } catch (err) {
        await pool.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
};

module.exports = { listMaterials, createMaterial, updateMaterial, deleteMaterial, reorderMaterials };
