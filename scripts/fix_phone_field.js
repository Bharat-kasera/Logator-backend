// Script to fix phone field type from NUMERIC to VARCHAR
require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixPhoneField() {
  try {
    // Change phone back to VARCHAR since our TypeScript code expects string
    await pool.query(`ALTER TABLE users ALTER COLUMN phone TYPE VARCHAR(20);`);
    console.log("Migration complete: phone field changed to VARCHAR(20).");
    process.exit(0);
  } catch (err) {
    console.error("Migration error:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixPhoneField();
