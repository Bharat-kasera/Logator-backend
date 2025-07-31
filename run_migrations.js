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

    // 3. Recreate pending_request table with proper structure
    console.log("📋 Recreating pending_request table...");
    await pool.query(`
      DROP TABLE IF EXISTS pending_request;
      CREATE TABLE pending_request (
          id SERIAL PRIMARY KEY,
          sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
          gate_id INTEGER REFERENCES gates(id) ON DELETE CASCADE NOT NULL,
          status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          establishment_id INTEGER REFERENCES establishments(id) ON DELETE CASCADE NOT NULL,
          UNIQUE(recipient_id, gate_id)
      );
    `);

    // 4. Update face_ids table for verification tracking
    console.log("👤 Updating face_ids table for verification tracking...");
    await pool.query(`
      ALTER TABLE face_ids 
      ADD COLUMN IF NOT EXISTS verification_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS verified_by_1 INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS verified_by_2 INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS verified_by_3 INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS verified_by_4 INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS verified_by_5 INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    // 5. Add department_id column to pending_request table for department invitations
    console.log("🏢 Adding department support to pending_request table...");
    await pool.query(`
      ALTER TABLE pending_request 
      ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE;
    `);

    // Add unique constraint if it doesn't exist
    await pool.query(`
      DO $$ 
      BEGIN 
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'face_ids_user_id_key') THEN
              ALTER TABLE face_ids ADD CONSTRAINT face_ids_user_id_key UNIQUE (user_id);
          END IF;
      END $$;
    `);

    // Update existing records to have timestamps
    await pool.query(`
      UPDATE face_ids SET 
          created_at = CURRENT_TIMESTAMP, 
          updated_at = CURRENT_TIMESTAMP 
      WHERE created_at IS NULL OR updated_at IS NULL;
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
