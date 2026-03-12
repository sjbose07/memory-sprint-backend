require('dotenv').config();
const pool = require('../config/db');

async function migrate() {
    console.log('🔄 Running manual migration...');
    try {
        await pool.query('ALTER TABLE questions ALTER COLUMN chapter_id DROP NOT NULL;');
        await pool.query('ALTER TABLE questions ADD COLUMN IF NOT EXISTS current_affair_id UUID REFERENCES current_affairs(id) ON DELETE CASCADE;');
        await pool.query('ALTER TABLE tests ALTER COLUMN chapter_id DROP NOT NULL;');
        console.log('✅ Manual migration complete!');
    } catch (err) {
        console.error('❌ Manual migration failed:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();
