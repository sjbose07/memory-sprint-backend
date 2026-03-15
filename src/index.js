require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./config/db');
const bcrypt = require('bcryptjs');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const subjectsRoutes = require('./routes/subjects');
const questionsRoutes = require('./routes/questions');
const testsRoutes = require('./routes/tests');
const attemptsRoutes = require('./routes/attempts');
const aiRoutes = require('./routes/ai');
const analyticsRoutes = require('./routes/analytics');
const bookmarksRoutes = require('./routes/bookmarks');
const practiceRoutes = require('./routes/practice');
const currentAffairsRoutes = require('./routes/currentAffairs');
const studyMaterialsRoutes = require('./routes/studyMaterials');
const uploadRoutes = require('./routes/upload');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health checks
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'MCQ Practice API is running',
        environment: process.env.NODE_ENV || 'development'
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/subjects', subjectsRoutes);
app.use('/questions', questionsRoutes);
app.use('/tests', testsRoutes);
app.use('/attempts', attemptsRoutes);
app.use('/ai', aiRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/bookmarks', bookmarksRoutes);
app.use('/practice', practiceRoutes);
app.use('/current-affairs', currentAffairsRoutes);
app.use('/study-materials', studyMaterialsRoutes);
app.use('/upload', uploadRoutes);

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    if (err.message && err.message.includes('Only PDF')) {
        return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Internal server error', details: err.message, stack: err.stack });
});

// 404
app.use((req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

const PORT = process.env.PORT || 7860;

// Log environment status for debugging (don't log actual values of secrets!)
console.log('--- Environment Check ---');
console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'PRESENT' : 'MISSING'}`);
console.log(`JWT_SECRET: ${process.env.JWT_SECRET ? 'PRESENT' : 'MISSING'}`);
console.log(`GOOGLE_CLIENT_ID: ${process.env.GOOGLE_CLIENT_ID ? 'PRESENT' : 'MISSING'}`);
console.log(`GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? 'PRESENT' : 'MISSING'}`);
console.log('-------------------------');

const server = app.listen(PORT, '0.0.0.0', () => {
    const actualPort = server.address().port;
    console.log(`\n🚀 MCQ Backend running on port ${actualPort}`);
    console.log(`   Health: http://localhost:${actualPort}/health`);
    console.log(`   Mode: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
