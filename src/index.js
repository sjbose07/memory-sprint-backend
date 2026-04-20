require('dotenv').config();
// Backend entry point - Triggered restart
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const pool = require('./config/db');
const { createNotice } = require('./utils/noticeService');
const { startKeepAlive } = require('./utils/keepAlive');
const { verifyConnection } = require('./utils/mailer');

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
const homeRoutes = require('./routes/home');
const uploadRoutes = require('./routes/upload');
const adminNoticesRoutes = require('./routes/adminNotices');

const app = express();

// --- Security & Production Middleware ---
app.use(helmet());
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

const corsOptions = {
    origin: '*', // For development flexibility; restrict in production if needed
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Enable pre-flight for all

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// Stricter limiter for Auth (30 requests per 15 minutes)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { error: 'Too many auth attempts, please try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});


app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
app.use('/auth', authLimiter, authRoutes);
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
app.use('/home', homeRoutes);
app.use('/study-materials', studyMaterialsRoutes);
app.use('/upload', uploadRoutes);
app.use('/admin/notices', adminNoticesRoutes);

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);

    const isProd = process.env.NODE_ENV === 'production';

    if (!res.headersSent) {
        createNotice('SYSTEM_ERROR', 'API 500 Error', `${err.message || 'Unknown'}\n${err.stack || ''}`)
            .catch(e => console.error('Failed to create admin notice:', e));
    }

    if (err.message && err.message.includes('Only PDF')) {
        return res.status(400).json({ error: err.message });
    }

    res.status(500).json({
        error: 'Internal server error',
        details: isProd ? 'An unexpected error occurred. Please contact support.' : err.message,
        stack: isProd ? undefined : err.stack
    });
});

// 404
app.use((req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Process listeners for severe failures
process.on('uncaughtException', async (err) => {
    console.error('🔥 UNCAUGHT EXCEPTION:', err);
    try {
        await createNotice('SYSTEM_ERROR', 'Uncaught Exception (Server Crashing)', `${err.message}\n${err.stack}`);
    } finally {
        process.exit(1);
    }
});

process.on('unhandledRejection', async (reason) => {
    console.error('🔥 UNHANDLED REJECTION:', reason);
    await createNotice('SYSTEM_ERROR', 'Unhandled Promise Rejection', String(reason)).catch(console.error);
});

// SIGTERM / SIGINT for graceful shutdown notification
const gracefulShutdown = async (signal) => {
    console.log(`\n🛑 Received ${signal}. Notifying admin and shutting down...`);
    try {
        await createNotice('SERVER_EVENT', `Server Shutdown (${signal})`, `Server is shutting down on signal: ${signal}`);
    } finally {
        process.exit(0);
    }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Log environment status for debugging (don't log actual values of secrets!)
console.log('--- Environment Check ---');
console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'PRESENT' : 'MISSING'}`);
console.log(`JWT_SECRET: ${process.env.JWT_SECRET ? 'PRESENT' : 'MISSING'}`);
console.log(`GOOGLE_CLIENT_ID: ${process.env.GOOGLE_CLIENT_ID ? 'PRESENT' : 'MISSING'}`);
console.log(`GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? 'PRESENT' : 'MISSING'}`);
console.log('-------------------------');

const BASE_PORT = parseInt(process.env.PORT || '5005', 10);

function startServer(port) {
    const server = app.listen(port, '0.0.0.0');

    server.on('listening', async () => {
        const actualPort = server.address().port;
        console.log(`\n✅ MCQ Backend running on port ${actualPort}`);
        console.log(`   Health: http://localhost:${actualPort}/health`);
        console.log(`   Mode: ${process.env.NODE_ENV || 'development'}\n`);
        // Update env so other services know the actual port
        process.env.PORT = String(actualPort);
        verifyConnection();
        startKeepAlive(actualPort);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.warn(`⚠️  Port ${port} is busy. Trying port ${port + 1}...`);
            server.close();
            startServer(port + 1);
        } else {
            console.error('❌ Server error:', err);
            process.exit(1);
        }
    });

    return server;
}

const server = startServer(BASE_PORT);

module.exports = app;

