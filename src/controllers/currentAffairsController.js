const pool = require('../config/db');
const { deleteAssetsFromText } = require('../utils/cloudinaryHelper');

// GET /current-affairs
const listCurrentAffairs = async (req, res) => {
    const { year, month, topic, tags, search, type } = req.query;
    try {
        let query = `
            SELECT ca.*, COUNT(q.id) as question_count 
            FROM current_affairs ca 
            LEFT JOIN questions q ON ca.id = q.current_affair_id 
            WHERE 1=1
        `;
        const params = [];

        if (year) {
            params.push(parseInt(year));
            query += ` AND ca.year = $${params.length}`;
        }
        if (month) {
            params.push(parseInt(month));
            query += ` AND ca.month = $${params.length}`;
        }
        if (topic) {
            params.push(topic);
            query += ` AND ca.topic ILIKE $${params.length}`;
        }
        if (type) {
            params.push(type);
            query += ` AND ca.type = $${params.length}`;
        }
        if (tags) {
            const tagsArray = Array.isArray(tags) ? tags : [tags];
            params.push(tagsArray);
            query += ` AND ca.tags && $${params.length}`;
        }
        if (search) {
            params.push(`%${search}%`);
            query += ` AND (ca.title ILIKE $${params.length} OR ca.content ILIKE $${params.length})`;
        }

        query += ' GROUP BY ca.id ORDER BY ca.created_at DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /current-affairs/:id
const getCurrentAffairsById = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM current_affairs WHERE id = $1', [id]);
        if (!result.rows.length) {
            return res.status(404).json({ error: 'Current Affairs not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /current-affairs
const createCurrentAffairs = async (req, res) => {
    const { title, content, year, month, topic, tags, is_practice_enabled, type } = req.body;
    if (!title || !content || !year || !month) {
        return res.status(400).json({ error: 'Title, content, year, and month are required' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO current_affairs (title, content, year, month, topic, tags, is_practice_enabled, type, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [title, content, year, month, topic || null, tags || [], is_practice_enabled || false, type || 'oneliner', req.user.id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// PATCH /current-affairs/:id
const editCurrentAffairs = async (req, res) => {
    const { id } = req.params;
    const { title, content, year, month, topic, tags, is_practice_enabled, type } = req.body;
    try {
        const result = await pool.query(
            `UPDATE current_affairs 
             SET title = COALESCE($1, title), 
                 content = COALESCE($2, content), 
                 year = COALESCE($3, year), 
                 month = COALESCE($4, month), 
                 topic = COALESCE($5, topic), 
                 tags = COALESCE($6, tags), 
                 is_practice_enabled = COALESCE($7, is_practice_enabled),
                 type = COALESCE($8, type)
             WHERE id = $9 RETURNING *`,
            [title, content, year, month, topic, tags, is_practice_enabled, type, id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Current Affairs not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// DELETE /current-affairs/:id
const deleteCurrentAffairs = async (req, res) => {
    const { id } = req.params;
    try {
        // 1. Fetch content for cleanup
        const caRes = await pool.query('SELECT content FROM current_affairs WHERE id = $1', [id]);
        if (!caRes.rows.length) return res.status(404).json({ error: 'Current Affairs not found' });
        
        const content = caRes.rows[0].content;

        // 2. Delete from database
        await pool.query('DELETE FROM current_affairs WHERE id = $1', [id]);
        
        // 3. Cloudinary cleanup
        deleteAssetsFromText(content).catch(err => console.error('Cloudinary cleanup error (CA):', err));
        
        res.json({ message: 'Current Affairs deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    listCurrentAffairs,
    getCurrentAffairsById,
    createCurrentAffairs,
    editCurrentAffairs,
    deleteCurrentAffairs
};
