const jwt = require('jsonwebtoken');
const pool = require('../src/config/db');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

/**
 * Vercel JWT Test Utility
 * This script generates a valid Admin JWT for testing the production Vercel backend.
 */
async function runTest() {
    console.log('--- Vercel JWT Test Utility ---');
    console.log('Using Secret:', process.env.JWT_SECRET ? '✅ Found' : '❌ NOT FOUND');

    try {
        // 1. Find an admin user in the DB
        console.log('Searching for an admin user...');
        const res = await pool.query("SELECT id, email, role FROM users WHERE role = 'admin' LIMIT 1");
        
        if (res.rows.length === 0) {
            console.error('❌ No admin user found in database. Create one first.');
            process.exit(1);
        }

        const admin = res.rows[0];
        console.log(`✅ Found Admin: ${admin.email} (ID: ${admin.id})`);

        // 2. Generate JWT
        const payload = {
            id: admin.id,
            email: admin.email,
            role: admin.role
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
        console.log('\n🚀 GENERATED TOKEN:');
        console.log(`Bearer ${token}`);

        // 3. Example Curl Command
        console.log('\n🛠️ TEST COMMAND (Copy this):');
        const vercelUrl = 'https://memory-sprint-backend.vercel.app';
        console.log(`curl -X GET "${vercelUrl}/api/questions" \\`);
        console.log(`  -H "Authorization: Bearer ${token}" \\`);
        console.log(`  -H "Content-Type: application/json"`);

        console.log('\n--- End of Script ---');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

runTest();
