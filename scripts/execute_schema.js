// Node.js script to execute db/schema.sql on your Railway PostgreSQL DB
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function executeSchema() {
  const schemaPath = path.join(__dirname, '../db/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  try {
    await pool.query(schema);
    console.log('Schema executed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Error executing schema:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

executeSchema();
