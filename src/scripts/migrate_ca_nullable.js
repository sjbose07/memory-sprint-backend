require('dotenv').config({ path: 'backend/.env' });
const pool = require('../config/db');

async function migrate() {
    try {
        console.log('--- Migrating Current Affairs Table ---');
        
        // 1. Make content nullable
        await pool.query(`ALTER TABLE current_affairs ALTER COLUMN content DROP NOT NULL`);
        console.log('✅ Made content nullable');

        // 2. Set default for content to empty string
        await pool.query(`ALTER TABLE current_affairs ALTER COLUMN content SET DEFAULT ''`);
        console.log('✅ Set default content to empty string');

        // 3. Remove is_practice_enabled if you want, but better to just ignore it in UI
        // We'll keep it in DB for now to avoid breaking existing data, but we'll stop using it in UI/Controller as per user request.

        console.log('--- Migration Complete ---');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

migrate();
