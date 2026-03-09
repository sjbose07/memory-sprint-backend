/**
 * Database migration script
 * Run: node src/scripts/migrate.js
 * This will create all tables in your Neon PostgreSQL database.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

async function migrate() {
    const schemaPath = path.join(__dirname, '../config/schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf-8');

    console.log('🔄 Running database migration...');
    try {
        await pool.query(sql);
        console.log('✅ Migration complete! All tables created.');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();
