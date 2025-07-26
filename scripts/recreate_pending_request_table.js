require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function recreateTable() {
  try {
    await client.connect();
    console.log('Connected to database.');
    const sql = require('fs').readFileSync(require('path').resolve(__dirname, './recreate_pending_request_table.sql'), 'utf8');
    await client.query(sql);
    console.log('pending_request table dropped and recreated successfully.');
  } catch (error) {
    console.error('Error recreating table:', error);
  } finally {
    await client.end();
  }
}

recreateTable();
