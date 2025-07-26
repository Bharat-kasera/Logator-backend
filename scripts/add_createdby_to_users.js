// Script to add 'createdby' column to users table
// Run with: node scripts/add_createdby_to_users.js

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const alterTableSQL = `
ALTER TABLE users ADD COLUMN IF NOT EXISTS createdby VARCHAR(255);
`;

async function addCreatedBy() {
  try {
    await pool.query(alterTableSQL);
    console.log("'createdby' column added to users table (if not already present).");
  } catch (err) {
    console.error('Error adding createdby column:', err.message);
  } finally {
    await pool.end();
  }
}

addCreatedBy();
