-- Migration: Add companies table and update relationships
-- This introduces a company layer between users and establishments

-- Create companies table
CREATE TABLE companies (
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

-- Add company_id to establishments table
ALTER TABLE establishments ADD COLUMN company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;

-- Update visitor_logs to include company_id for better reporting
ALTER TABLE visitor_logs ADD COLUMN company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;

-- Update checkin table to include company_id for better reporting  
ALTER TABLE checkin ADD COLUMN company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;

-- Create indexes for better performance
CREATE INDEX idx_companies_user_id ON companies(user_id);
CREATE INDEX idx_establishments_company_id ON establishments(company_id);
CREATE INDEX idx_visitor_logs_company_id ON visitor_logs(company_id);
CREATE INDEX idx_checkin_company_id ON checkin(company_id);

-- Add trigger to update updated_at timestamp on companies
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();