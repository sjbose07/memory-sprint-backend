/**
 * One-off fix script for study_materials table
 * Run: node src/scripts/fix_study_materials.js
 */
require('dotenv').config();
const pool = require('../config/db');

async function fix() {
    console.log('🔄 Checking database schema...');
    try {
        // 1. Ensure study_materials table exists (with original schema)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS study_materials (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                tags TEXT[] DEFAULT '{}',
                created_by UUID REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
        console.log('✅ Checked study_materials table.');

        // 2. Add current_affair_id to study_materials
        await pool.query(`
            ALTER TABLE study_materials 
            ADD COLUMN IF NOT EXISTS current_affair_id UUID REFERENCES current_affairs(id) ON DELETE SET NULL
        `);
        console.log('✅ Added current_affair_id column to study_materials.');

        // 3. Fix current_affairs table (ensure type can be nullable or has default)
        await pool.query(`
            ALTER TABLE current_affairs 
            ALTER COLUMN content DROP NOT NULL,
            ADD COLUMN IF NOT EXISTS is_practice_enabled BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'oneliner'
        `);
        console.log('✅ Updated current_affairs schema (nullable content and type columns).');

        console.log('🎉 Database fix complete!');
    } catch (err) {
        console.error('❌ Fix failed:', err.message);
    } finally {
        await pool.end();
    }
}

fix();
