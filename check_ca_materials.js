const bcrypt = require('bcryptjs');
const pool = require('./src/config/db');

async function run() {
    const email = 'sjbose.apps@gmail.com';
    const newPass = '@#$AbMK#824';
    
    console.log(`Resetting password for ${email} to ${newPass}...`);
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPass, salt);
    
    const res = await pool.query(
        "UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id, name",
        [passwordHash, email]
    );
    
    if (res.rows.length === 0) {
        console.log("❌ User not found.");
    } else {
        console.log(`✅ Password reset successfully for ${res.rows[0].name}!`);
    }
    
    await pool.end();
}

run().catch(console.error);
