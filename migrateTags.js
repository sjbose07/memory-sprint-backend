const pool = require('./src/config/db');

async function migrate() {
    try {
        await pool.query('ALTER TABLE chapters ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT \'{}\'');
        console.log('Migration successful: added tags to chapters');
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        pool.end();
    }
}

migrate();
