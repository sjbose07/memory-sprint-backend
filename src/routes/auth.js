const express = require('express');
const router = express.Router();
const { 
    register, 
    login, 
    getMe, 
    googleLogin, 
    forgotPassword, 
    resetPassword, 
    changePassword, 
    verifyEmail 
} = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.get('/me', authMiddleware, getMe);

// Password Management
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/change-password', authMiddleware, changePassword);
router.get('/verify-email', verifyEmail);

module.exports = router;
