require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function dropTable() {
  try {
    await client.connect();
    console.log('Connected to database.');
    const sql = require('fs').readFileSync(require('path').resolve(__dirname, './drop_pending_requests_table.sql'), 'utf8');
    await client.query(sql);
    console.log('pending_requests table dropped successfully.');
  } catch (error) {
    console.error('Error dropping table:', error);
  } finally {
    await client.end();
  }
}

dropTable();
