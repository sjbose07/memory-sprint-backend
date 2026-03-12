require('dotenv').config();
const pool = require('./src/config/db');

async function alterTable() {
    try {
        await pool.query(`ALTER TABLE current_affairs ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'oneliner';`);
        console.log('✅ Added type column to current_affairs successfully.');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
    } finally {
        await pool.end();
    }
}

alterTable();
