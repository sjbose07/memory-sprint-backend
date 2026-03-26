const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const pool = require('../config/db');
const { validatePassword } = require('../utils/passwordValidator');
const { sendResetEmail, sendVerificationEmail, verifyConnection } = require('../utils/mailer');

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

        // Create user (unapproved by default, unverified)
        const result = await pool.query(
            `INSERT INTO users (name, email, password_hash, is_approved, email_verification_token)
             VALUES ($1, $2, $3, FALSE, $4)
             RETURNING id, name, email, role, is_approved`,
            [name, email, passwordHash, verificationToken]
        );

        const user = result.rows[0];

        // Send verification email
        try {
            await sendVerificationEmail(email, verificationToken);
        } catch (mailErr) {
            console.error('Initial verification mail failed:', mailErr);
            // Don't fail registration if mail fails, but log it
        }

        res.status(201).json({
            message: 'Registration successful. Please verify your email and wait for admin approval.',
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

const forgotPassword = async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            // Safety: Don't reveal if user exists
            return res.json({ message: 'If an account exists with this email, a reset link has been sent.' });
        }

        // Generate token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenExpires = new Date(Date.now() + 3600000); // 1 hour

        await pool.query(
            'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
            [resetToken, tokenExpires, user.id]
        );

        try {
            await sendResetEmail(email, resetToken);
            res.json({ message: 'If an account exists with this email, a reset link has been sent.' });
        } catch (mailErr) {
            console.error('Mail Send Error:', mailErr);
            res.status(500).json({ error: 'Failed to send reset email. Contact support.' });
        }
    } catch (err) {
        console.error('Forgot Password error:', err);
        res.status(500).json({ error: 'Server error during password reset request' });
    }
};

const resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password are required' });

    const { isValid, message } = validatePassword(newPassword);
    if (!isValid) return res.status(400).json({ error: message });

    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
            [token]
        );
        const user = result.rows[0];

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);

        await pool.query(
            'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
            [passwordHash, user.id]
        );

        res.json({ message: 'Password has been reset successfully. You can now login.' });
    } catch (err) {
        console.error('Reset Password error:', err);
        res.status(500).json({ error: 'Server error during password reset' });
    }
};

const changePassword = async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).json({ error: 'Both old and new passwords are required' });

    const { isValid, message } = validatePassword(newPassword);
    if (!isValid) return res.status(400).json({ error: message });

    try {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        const user = result.rows[0];

        if (!user || !user.password_hash) {
            return res.status(400).json({ error: 'Invalid user or password login not set up.' });
        }

        const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ error: 'Incorrect current password' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);

        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, user.id]);

        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error('Change Password error:', err);
        res.status(500).json({ error: 'Server error during password change' });
    }
};

const verifyEmail = async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token is required' });

    try {
        const result = await pool.query(
            'UPDATE users SET is_email_verified = TRUE, email_verification_token = NULL WHERE email_verification_token = $1 RETURNING id',
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired verification token' });
        }

        res.json({ message: 'Email verified successfully!' });
    } catch (err) {
        console.error('Email verification error:', err);
        res.status(500).json({ error: 'Server error during email verification' });
    }
};

const testEmail = async (req, res) => {
    const { email } = req.body;
    try {
        await sendVerificationEmail(email || process.env.EMAIL_USER, 'test-token');
        res.json({ message: 'Test email sent successfully' });
    } catch (err) {
        console.error('Test Email Error Details:', err);
        res.status(500).json({ 
            error: 'Failed to send test email', 
            details: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
        });
    }
};

module.exports = { register, login, getMe, googleLogin, forgotPassword, resetPassword, changePassword, verifyEmail, testEmail };
