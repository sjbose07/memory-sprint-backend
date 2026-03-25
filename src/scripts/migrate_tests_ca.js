const pool = require('../config/db');

async function migrate() {
    try {
        console.log('Starting migration: Add current_affair_id to tests table...');
        
        await pool.query(`
            ALTER TABLE tests 
            ADD COLUMN IF NOT EXISTS current_affair_id UUID REFERENCES current_affairs(id) ON DELETE CASCADE;
        `);
        
        console.log('Migration successful: current_affair_id added to tests table.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
