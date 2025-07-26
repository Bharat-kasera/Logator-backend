const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigrations() {
  try {
    console.log("🚀 Starting migrations...");

    // 1. Add geofencing columns to gates table
    console.log("📍 Adding geofencing columns to gates...");
    await pool.query(`
      ALTER TABLE gates 
      ADD COLUMN IF NOT EXISTS geofencing BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS radius INTEGER DEFAULT 100;
    `);

    // 2. Add firstname/lastname to users table
    console.log("👤 Updating users table structure...");
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS firstname VARCHAR(255),
      ADD COLUMN IF NOT EXISTS lastname VARCHAR(255);
    `);

    // 3. Recreate pending_request table
    console.log("📋 Recreating pending_request table...");
    await pool.query(`
      DROP TABLE IF EXISTS pending_request;
      CREATE TABLE pending_request (
          gate_dept_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          type VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          establishment_id INTEGER NOT NULL
      );
    `);

    console.log("✅ All migrations completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

runMigrations();
