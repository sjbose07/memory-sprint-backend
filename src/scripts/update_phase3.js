require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const applyUpdates = async () => {
    try {
        const sqlPath = path.join(__dirname, '../config/phase3_updates.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('🔄 Applying Phase 3 updates...');
        await pool.query(sql);
        console.log('✅ Phase 3 updates applied successfully.');

        process.exit(0);
    } catch (err) {
        console.error('❌ Error applying updates:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
};

applyUpdates();
