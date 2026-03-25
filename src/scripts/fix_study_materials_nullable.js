/**
 * One-off fix script for study_materials table NULLABLE constraints
 * Run: node src/scripts/fix_study_materials_nullable.js
 */
require('dotenv').config();
const pool = require('../config/db');

async function fix() {
    console.log('🔄 Checking database schema...');
    try {
        // Ensure chapter_id can be null (since current_affair_id is the other option)
        await pool.query(`
            ALTER TABLE study_materials ALTER COLUMN chapter_id DROP NOT NULL;
        `);
        console.log('✅ Altered chapter_id to allow NULL.');

        console.log('🎉 Constraint fix complete!');
    } catch (err) {
        console.error('❌ Fix failed:', err.message);
    } finally {
        await pool.end();
    }
}

fix();
