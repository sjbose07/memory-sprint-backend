const pool = require('../config/db');
const bcrypt = require('bcryptjs');


// GET /users — admin only
const listUsers = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, email, avatar_url, role, is_approved, created_at FROM users ORDER BY created_at DESC'
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// PATCH /users/:id/role — admin only
const updateUserRole = async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    if (!['admin', 'moderator', 'user'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role. Must be admin, moderator, or user' });
    }
    try {
        const result = await pool.query(
            'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role',
            [role, id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// PATCH /users/:id/approve — admin only
const approveUser = async (req, res) => {
    const { id } = req.params;
    const { is_approved } = req.body;
    try {
        const result = await pool.query(
            'UPDATE users SET is_approved = $1 WHERE id = $2 RETURNING id, name, email, is_approved',
            [is_approved, id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// DELETE /users/:id — admin only
const deleteUser = async (req, res) => {
    const { id } = req.params;
    if (String(id) === String(req.user.id)) return res.status(400).json({ error: 'Cannot delete your own profile. You need another admin to do this.' });
    try {
        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
        if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /users/me/history — current user's test history
const getMyHistory = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT ta.id, t.title, c.name AS chapter_name, s.name AS subject_name,
              ta.score, ta.total,
              ROUND(ta.score::numeric / NULLIF(ta.total, 0) * 100, 1) AS percentage,
              ta.started_at, ta.completed_at
       FROM test_attempts ta
       JOIN tests t ON t.id = ta.test_id
       JOIN chapters c ON c.id = t.chapter_id
       JOIN subjects s ON s.id = c.subject_id
       WHERE ta.user_id = $1
       ORDER BY ta.completed_at DESC NULLS LAST`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /users/me/suggestions — wrong questions for review
const getMySuggestions = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT DISTINCT q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
              q.correct_option, q.explanation,
              c.name AS chapter_name, s.name AS subject_name,
              aa.selected_option AS my_answer
       FROM attempt_answers aa
       JOIN questions q ON q.id = aa.question_id
       JOIN chapters c ON c.id = q.chapter_id
       JOIN subjects s ON s.id = c.subject_id
       JOIN test_attempts ta ON ta.id = aa.attempt_id
       WHERE ta.user_id = $1 AND aa.is_correct = FALSE
       ORDER BY q.id`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /users — admin only
const adminCreateUser = async (req, res) => {
    const { name, email, password, role, is_approved } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email and password are required' });
    }

    try {
        // Check if user exists
        const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Create user
        const result = await pool.query(
            `INSERT INTO users (name, email, password_hash, role, is_approved)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, name, email, role, is_approved`,
            [name, email, passwordHash, role || 'user', is_approved !== undefined ? is_approved : true]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Admin user creation error:', err);
        res.status(500).json({ error: 'Server error during user creation' });
    }
};

module.exports = {
    listUsers,
    updateUserRole,
    approveUser,
    deleteUser,
    getMyHistory,
    getMySuggestions,
    adminCreateUser
};

