const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function migrate() {
    try {
        await pool.query('ALTER TABLE tests ALTER COLUMN timer_minutes TYPE NUMERIC(5,2);');
        console.log('Successfully altered timer_minutes to NUMERIC(5,2)');
    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        await pool.end();
    }
}

migrate();
