
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Starting migration for tests table...');

    // 1. Add current_affair_id if it doesn't exist
    await client.query(`
      ALTER TABLE tests 
      ADD COLUMN IF NOT EXISTS current_affair_id UUID REFERENCES current_affairs(id) ON DELETE CASCADE;
    `);
    console.log('Checked current_affair_id column.');

    // 2. Add share_code if it doesn't exist
    await client.query(`
      ALTER TABLE tests 
      ADD COLUMN IF NOT EXISTS share_code VARCHAR(20) UNIQUE;
    `);
    console.log('Checked share_code column.');

    // 3. Handle is_negative -> negative_marking renaming/sync
    // Check if negative_marking exists
    const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tests' AND column_name = 'negative_marking';
    `);

    if (res.rows.length === 0) {
      console.log('Column negative_marking does not exist. Adding/Renaming...');
      
      // Check if is_negative exists to rename it
      const resOld = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'tests' AND column_name = 'is_negative';
      `);

      if (resOld.rows.length > 0) {
        await client.query(`ALTER TABLE tests RENAME COLUMN is_negative TO negative_marking;`);
        console.log('Renamed is_negative to negative_marking.');
      } else {
        await client.query(`ALTER TABLE tests ADD COLUMN negative_marking BOOLEAN DEFAULT false;`);
        console.log('Added negative_marking column.');
      }
    } else {
      console.log('Column negative_marking already exists.');
    }

    // 4. Ensure negative_marking is of correct type (boolean)
    await client.query(`
      ALTER TABLE tests 
      ALTER COLUMN negative_marking SET DEFAULT false;
    `);

    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
