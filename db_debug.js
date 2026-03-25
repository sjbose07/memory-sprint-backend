const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function testQuery(subjectId) {
  try {
    console.log(`Testing Query for Subject ID: ${subjectId}`);
    
    let query = `SELECT sm.*, c.name AS chapter_name, s.name AS subject_name, c.subject_id 
                 FROM study_materials sm
                 LEFT JOIN chapters c ON c.id = sm.chapter_id
                 LEFT JOIN subjects s ON s.id = c.subject_id`;
    
    const chRes = await pool.query('SELECT name, type FROM chapters WHERE subject_id = $1::UUID', [subjectId]);
    console.log(`Chapters For Subject Found: ${chRes.rows.length}`);
    chRes.rows.forEach(r => console.log(`  - [${r.type}] ${r.name}`));

    query += ` WHERE c.subject_id = $1::UUID`;
    const res = await pool.query(query, [subjectId]);
    console.log(`Materials Found: ${res.rows.length}`);
    res.rows.forEach(r => console.log(`  - [${r.subject_name}] ${r.title} (Chapter: ${r.chapter_name})`));
    
    if (res.rows.length > 0) {
      console.log('Sample Row subject_id from DB:', res.rows[0].subject_id);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

// Geography ID from previous run
testQuery('f1983066-726a-4505-88df-1afca25cfdf9');
