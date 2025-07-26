// Migration script: add unique constraint on (country_code, phone) in users table
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  try {
    await pool.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_key;`); // Remove old unique on phone if exists
    await pool.query(`ALTER TABLE users ADD CONSTRAINT users_countrycode_phone_unique UNIQUE (country_code, phone);`);
    console.log('Migration complete: unique constraint added on (country_code, phone)');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
