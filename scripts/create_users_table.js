// Script to create the users table if it doesn't exist
// Run with: node scripts/create_users_table.js

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const createTableSQL = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(255),
  firstname VARCHAR(255),
  lastname VARCHAR(255),
  country_code VARCHAR(10),
  photo_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

async function createTable() {
  try {
    await pool.query(createTableSQL);
    console.log('users table created or already exists.');
  } catch (err) {
    console.error('Error creating users table:', err.message);
  } finally {
    await pool.end();
  }
}

createTable();
