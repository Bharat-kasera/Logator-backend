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

    // 6. Create companies table if it doesn't exist
    console.log("🏢 Creating companies table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        logo_url TEXT,
        address1 TEXT,
        address2 TEXT,
        pincode VARCHAR(20),
        gst_number VARCHAR(50),
        pan_number VARCHAR(50),
        website VARCHAR(255),
        phone VARCHAR(20),
        email VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_company_name_per_user UNIQUE (user_id, name)
      );
    `);

    // Add company_id to establishments table if it doesn't exist
    console.log("🔗 Adding company_id to establishments table...");
    await pool.query(`
      ALTER TABLE establishments ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;
    `);

    // Add company_id to visitor_logs table if it doesn't exist
    await pool.query(`
      ALTER TABLE visitor_logs ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;
    `);

    // Add company_id to checkin table if it doesn't exist
    await pool.query(`
      ALTER TABLE checkin ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;
    `);

    // Create indexes for better performance
    console.log("📊 Creating indexes for companies...");
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_companies_user_id ON companies(user_id);
      CREATE INDEX IF NOT EXISTS idx_establishments_company_id ON establishments(company_id);
      CREATE INDEX IF NOT EXISTS idx_visitor_logs_company_id ON visitor_logs(company_id);
      CREATE INDEX IF NOT EXISTS idx_checkin_company_id ON checkin(company_id);
    `);

    // Create or replace the update trigger function and trigger
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await pool.query(`
      DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
      CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    // 7. Convert companies to use UUIDs for security
    console.log("🔒 Converting companies to use UUIDs...");
    
    // Enable UUID extension
    await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    
    // Add UUID column to companies table
    await pool.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS uuid UUID DEFAULT uuid_generate_v4();`);
    
    // Update existing companies to have UUIDs
    await pool.query(`UPDATE companies SET uuid = uuid_generate_v4() WHERE uuid IS NULL;`);
    
    // Make UUID not null and unique
    await pool.query(`
      DO $$ 
      BEGIN 
        BEGIN
          ALTER TABLE companies ALTER COLUMN uuid SET NOT NULL;
        EXCEPTION 
          WHEN others THEN NULL;
        END;
        
        BEGIN  
          ALTER TABLE companies ADD CONSTRAINT companies_uuid_unique UNIQUE (uuid);
        EXCEPTION 
          WHEN duplicate_object THEN NULL;
        END;
      END $$;
    `);
    
    // Add index on UUID for performance
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_companies_uuid ON companies(uuid);`);

    console.log("✅ All migrations completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

runMigrations();
