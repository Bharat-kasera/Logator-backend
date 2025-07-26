// Migration script: make phone NUMERIC, add country_code TEXT to users table
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  try {
    // Add country_code column if not exists
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS country_code TEXT;`);
    // Change phone to NUMERIC (drop and recreate column)
    await pool.query(`ALTER TABLE users ALTER COLUMN phone TYPE NUMERIC USING phone::numeric;`);
    console.log('Migration complete: phone is now NUMERIC, country_code column added.');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
