const pool = require('../config/db');

// GET /admin/notices
const listNotices = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM admin_notices ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PATCH /admin/notices/:id/read
const markAsRead = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'UPDATE admin_notices SET is_read = TRUE WHERE id = $1 RETURNING *',
      [id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Notice not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /admin/notices/:id
const deleteNotice = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM admin_notices WHERE id = $1 RETURNING id', [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Notice not found' });
    res.json({ message: 'Notice deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { listNotices, markAsRead, deleteNotice };
