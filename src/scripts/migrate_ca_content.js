/**
 * Data Migration script for Current Affairs content
 * Run: node src/scripts/migrate_ca_content.js
 * Moves data from current_affairs.content to study_materials table.
 */
require('dotenv').config();
const pool = require('../config/db');

async function migrate() {
    console.log('🔄 Starting Current Affairs content migration...');
    try {
        // 1. Fetch all Current Affairs with non-empty content
        const result = await pool.query(`
            SELECT id, title, content, created_by 
            FROM current_affairs 
            WHERE content IS NOT NULL AND TRIM(content) <> ''
        `);

        if (result.rows.length === 0) {
            console.log('ℹ️ No content found in current_affairs table to migrate.');
            return;
        }

        console.log(`📦 Found ${result.rows.length} entries to migrate.`);

        for (const row of result.rows) {
            // Check if it's already been migrated (to avoid duplicates)
            const check = await pool.query(
                'SELECT id FROM study_materials WHERE current_affair_id = $1 AND content = $2',
                [row.id, row.content]
            );

            if (check.rows.length === 0) {
                console.log(`🚀 Migrating content for: ${row.title}`);
                await pool.query(`
                    INSERT INTO study_materials (current_affair_id, title, content, created_by)
                    VALUES ($1, $2, $3, $4)
                `, [row.id, 'Main Article', row.content, row.created_by]);
            } else {
                console.log(`⏩ Skipping duplicate for: ${row.title}`);
            }
        }

        console.log('🎉 Migration complete!');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
    } finally {
        await pool.end();
    }
}

migrate();
