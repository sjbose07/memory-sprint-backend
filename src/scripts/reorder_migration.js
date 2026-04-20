require('dotenv').config();
const pool = require('../config/db');

async function runMigration() {
    console.log('🔄 Running increment migration...');
    try {
        // 1. Add column if not exists
        await pool.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='study_materials' AND column_name='order_num') THEN
                    ALTER TABLE study_materials ADD COLUMN order_num INT NOT NULL DEFAULT 0;
                END IF;
            END $$;
        `);
        console.log('✅ Column order_num added to study_materials');

        // 2. Initialize order_num based on creation date
        await pool.query(`
            WITH ordered AS (
                SELECT id, ROW_NUMBER() OVER (PARTITION BY chapter_id, current_affair_id ORDER BY created_at) - 1 as new_order 
                FROM study_materials
            ) 
            UPDATE study_materials sm SET order_num = o.new_order 
            FROM ordered o WHERE sm.id = o.id;
        `);
        console.log('✅ Initialized order_num for existing materials');

    } catch (err) {
        console.error('❌ Migration failed:', err.message);
    } finally {
        await pool.end();
    }
}

runMigration();
