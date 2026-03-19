const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20, // Max clients in the pool
  idleTimeoutMillis: 30000, 
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  console.log('✅ Connected to Neon PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected DB error:', err);
});

module.exports = pool;
