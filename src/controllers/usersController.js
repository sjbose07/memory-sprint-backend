const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { validatePassword } = require('../utils/passwordValidator');
const { sendResetEmail, sendVerificationEmail } = require('../utils/mailer');


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

    // Enforce strong password
    const { isValid, message } = validatePassword(password);
    if (!isValid) return res.status(400).json({ error: message });

    try {
        // Check if user exists
        const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Generate verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');

        // Create user
        const result = await pool.query(
            `INSERT INTO users (name, email, password_hash, role, is_approved, email_verification_token)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, name, email, role, is_approved`,
            [name, email, passwordHash, role || 'user', is_approved !== undefined ? is_approved : true, verificationToken]
        );

        const user = result.rows[0];

        // Send verification email
        try {
            await sendVerificationEmail(email, verificationToken);
        } catch (mailErr) {
            console.error('Admin create verification mail failed:', mailErr);
        }

        res.status(201).json(user);
    } catch (err) {
        console.error('Admin user creation error:', err);
        res.status(500).json({ error: 'Server error during user creation' });
    }
};

// POST /users/:id/reset-password — admin only trigger
const triggerPasswordReset = async (req, res) => {
    const { id } = req.params;
    try {
        const userResult = await pool.query('SELECT email, id FROM users WHERE id = $1', [id]);
        const user = userResult.rows[0];

        if (!user) return res.status(404).json({ error: 'User not found' });

        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenExpires = new Date(Date.now() + 3600000); // 1 hour

        await pool.query(
            'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
            [resetToken, tokenExpires, user.id]
        );

        await sendResetEmail(user.email, resetToken);
        res.json({ message: `Reset link sent to ${user.email}` });
    } catch (err) {
        console.error('Trigger reset error:', err);
        res.status(500).json({ error: 'Failed to trigger reset email' });
    }
};

// PATCH /users/me — current user update
const updateProfile = async (req, res) => {
    const { name, avatarUrl } = req.body;
    try {
        const result = await pool.query(
            'UPDATE users SET name = COALESCE($1, name), avatar_url = COALESCE($2, avatar_url) WHERE id = $3 RETURNING id, name, email, avatar_url, role',
            [name, avatarUrl, req.user.id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    listUsers,
    updateUserRole,
    approveUser,
    deleteUser,
    getMyHistory,
    getMySuggestions,
    adminCreateUser,
    triggerPasswordReset,
    updateProfile
};

