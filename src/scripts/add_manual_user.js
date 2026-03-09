/**
 * Manual user insertion script
 * Usage: node src/scripts/add_manual_user.js
 */
require('dotenv').config();
const pool = require('../config/db');

async function addManualUser() {
  const email = 'sjbose.app@gmail.com';
  const name = 'SJBose App';
  const googleId = 'manual_' + Date.now();

  console.log(`Attempting to add user: ${email}...`);
  try {
    const result = await pool.query(
      'INSERT INTO users (google_id, name, email, role) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO UPDATE SET role = $4 RETURNING *',
      [googleId, name, email, 'admin']
    );
    console.log('✅ User added/updated successfully as admin:', result.rows[0]);
  } catch (err) {
    console.error('❌ Error adding user:', err.message);
  } finally {
    await pool.end();
  }
}

addManualUser();
