/**
 * Update schema to add approval status
 * Run: node src/scripts/update_schema_v2.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

async function updateSchema() {
    const sqlPath = path.join(__dirname, '../config/update_schema_v2.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('🔄 Updating database schema for user approval...');
    try {
        await pool.query(sql);
        console.log('✅ Schema updated successfully!');
    } catch (err) {
        console.error('❌ Update failed:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

updateSchema();
