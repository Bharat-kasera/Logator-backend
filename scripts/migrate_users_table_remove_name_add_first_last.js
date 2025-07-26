// Migration script to drop 'name' column and add 'firstname' and 'lastname' columns to users table
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  try {
    // Remove 'name' column if exists
    await pool.query(`ALTER TABLE users DROP COLUMN IF EXISTS name;`);
    // Add 'firstname' and 'lastname' columns if not exist
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS firstname TEXT;`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS lastname TEXT;`);
    console.log('Migration complete: name column removed, firstname and lastname columns added.');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
