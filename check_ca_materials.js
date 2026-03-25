const pool = require('./src/config/db');

async function run() {
    const res = await pool.query("SELECT email, name, role, is_approved, created_at FROM users ORDER BY created_at DESC LIMIT 5");
    console.log("Recent users:", res.rows);
    await pool.end();
}

run().catch(console.error);
