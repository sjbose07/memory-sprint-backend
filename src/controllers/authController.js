const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const pool = require('../config/db');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const googleLogin = async (req, res) => {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'idToken is required' });

    try {
        const ticket = await client.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { email, name, picture } = payload;

        // Check if user exists
        let result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        let user = result.rows[0];

        if (!user) {
            // Create user for Google login (auto-approved for now or keep pending?)
            // Based on previous discussions, let's keep it consistent with registration (pending approval)
            // UNLESS it's an admin email? No, let's just stick to FALSE for safety.
            result = await pool.query(
                `INSERT INTO users (name, email, avatar_url, is_approved)
                 VALUES ($1, $2, $3, FALSE)
                 RETURNING id, name, email, role, is_approved`,
                [name, email, picture]
            );
            user = result.rows[0];
        }

        // Check approval
        if (!user.is_approved && user.role !== 'admin') {
            return res.status(403).json({
                error: 'Your account is pending admin approval.',
                is_approved: false
            });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, name: user.name },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        delete user.password_hash;
        res.json({ token, user });
    } catch (err) {
        console.error('Google login error:', err);
        res.status(401).json({ error: 'Invalid Google token' });
    }
};

const register = async (req, res) => {
    const { name, email, password } = req.body;
    if (!email || !password || !name) {
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

        // Create user (unapproved by default)
        const result = await pool.query(
            `INSERT INTO users (name, email, password_hash, is_approved)
             VALUES ($1, $2, $3, FALSE)
             RETURNING id, name, email, role, is_approved`,
            [name, email, passwordHash]
        );

        const user = result.rows[0];
        res.status(201).json({
            message: 'Registration successful. Please wait for admin approval.',
            user
        });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Server error during registration' });
    }
};

const login = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        if (!user.password_hash) {
            return res.status(401).json({ error: 'Invalid credentials (please use Google Login)' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check approval
        if (!user.is_approved && user.role !== 'admin') {
            return res.status(403).json({
                error: 'Your account is pending admin approval.',
                is_approved: false
            });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, name: user.name },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        delete user.password_hash;
        res.json({ token, user });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error during login' });
    }
};

const getMe = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, email, avatar_url, role, is_approved, created_at FROM users WHERE id = $1',
            [req.user.id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { register, login, getMe, googleLogin };
