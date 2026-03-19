const pool = require('../config/db');

const createNotice = async (type, title, message) => {
  try {
    const result = await pool.query(
      'INSERT INTO admin_notices (type, title, message) VALUES ($1, $2, $3) RETURNING *',
      [type, title, message]
    );
    console.log(`📝 Admin Notice Created: [${type}] ${title}`);
    return result.rows[0];
  } catch (err) {
    console.error('❌ Failed to create admin notice:', err);
  }
};

module.exports = { createNotice };
