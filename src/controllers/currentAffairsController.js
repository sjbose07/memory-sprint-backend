const pool = require('../config/db');

// GET /current-affairs
const listCurrentAffairs = async (req, res) => {
    const { year, month, topic, tags } = req.query;
    try {
        let query = 'SELECT * FROM current_affairs WHERE 1=1';
        const params = [];

        if (year) {
            params.push(parseInt(year));
            query += ` AND year = $${params.length}`;
        }
        if (month) {
            params.push(parseInt(month));
            query += ` AND month = $${params.length}`;
        }
        if (topic) {
            params.push(topic);
            query += ` AND topic ILIKE $${params.length}`;
        }
        if (tags) {
            const tagsArray = Array.isArray(tags) ? tags : [tags];
            params.push(tagsArray);
            query += ` AND tags && $${params.length}`;
        }

        query += ' ORDER BY created_at DESC';

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
    const { title, content, year, month, topic, tags, is_practice_enabled } = req.body;
    if (!title || !content || !year || !month) {
        return res.status(400).json({ error: 'Title, content, year, and month are required' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO current_affairs (title, content, year, month, topic, tags, is_practice_enabled, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [title, content, year, month, topic || null, tags || [], is_practice_enabled || false, req.user.id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// PATCH /current-affairs/:id
const editCurrentAffairs = async (req, res) => {
    const { id } = req.params;
    const { title, content, year, month, topic, tags, is_practice_enabled } = req.body;
    try {
        const result = await pool.query(
            `UPDATE current_affairs 
             SET title = COALESCE($1, title), 
                 content = COALESCE($2, content), 
                 year = COALESCE($3, year), 
                 month = COALESCE($4, month), 
                 topic = COALESCE($5, topic), 
                 tags = COALESCE($6, tags), 
                 is_practice_enabled = COALESCE($7, is_practice_enabled)
             WHERE id = $8 RETURNING *`,
            [title, content, year, month, topic, tags, is_practice_enabled, id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Current Affairs not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// DELETE /current-affairs/:id
const deleteCurrentAffairs = async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM current_affairs WHERE id = $1 RETURNING id', [req.params.id]);
        if (!result.rows.length) return res.status(404).json({ error: 'Current Affairs not found' });
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
