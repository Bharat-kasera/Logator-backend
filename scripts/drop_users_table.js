// Script to drop the users table from the database
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function dropUsersTable() {
  try {
    await pool.query('DROP TABLE IF EXISTS users CASCADE;');
    console.log('users table dropped.');
    process.exit(0);
  } catch (err) {
    console.error('Error dropping users table:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

dropUsersTable();
