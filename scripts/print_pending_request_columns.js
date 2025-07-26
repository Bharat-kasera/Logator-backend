const knex = require('../db/knex');

async function printColumns() {
  try {
    const columns = await knex('pending_request').columnInfo();
    console.log('pending_request columns:', columns);
  } catch (err) {
    console.error('Error getting columns:', err);
  } finally {
    process.exit(0);
  }
}

printColumns();
