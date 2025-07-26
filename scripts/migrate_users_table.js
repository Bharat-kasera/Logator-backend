// Migration script to update the users table as requested
// Run this file with: node scripts/migrate_users_table.js

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Railway typically uses DATABASE_URL
});

async function migrate() {
  try {
    // 1. Rename 'name' to 'firstname'
    await pool.query(`ALTER TABLE users RENAME COLUMN name TO firstname;`);
    console.log("Renamed 'name' to 'firstname'");
  } catch (err) {
    if (err.code === '42703') {
      console.log("Column 'name' does not exist or already renamed.");
    } else {
      console.error('Error renaming column:', err.message);
    }
  }

  try {
    // 2. Add 'lastname'
    await pool.query(`ALTER TABLE users ADD COLUMN lastname VARCHAR(255);`);
    console.log("Added 'lastname' column");
  } catch (err) {
    if (err.code === '42701') {
      console.log("Column 'lastname' already exists.");
    } else {
      console.error('Error adding lastname:', err.message);
    }
  }

  try {
    // 3. Add 'country_code'
    await pool.query(`ALTER TABLE users ADD COLUMN country_code VARCHAR(10);`);
    console.log("Added 'country_code' column");
  } catch (err) {
    if (err.code === '42701') {
      console.log("Column 'country_code' already exists.");
    } else {
      console.error('Error adding country_code:', err.message);
    }
  }

  await pool.end();
  console.log('Migration complete.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
