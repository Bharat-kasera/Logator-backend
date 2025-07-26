// Script to add missing columns to users table
require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixUsersTable() {
  try {
    console.log("🔧 Adding missing columns to users table...");

    // Add plan column
    await pool.query(
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS plan INTEGER DEFAULT 1;"
    );
    console.log("✅ Added plan column");

    // Add representing column
    await pool.query(
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS representing TEXT;"
    );
    console.log("✅ Added representing column");

    // Add createdby column
    await pool.query(
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS createdby INTEGER;"
    );
    console.log("✅ Added createdby column");

    console.log("🎉 All missing columns added successfully!");
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    await pool.end();
  }
}

fixUsersTable();
