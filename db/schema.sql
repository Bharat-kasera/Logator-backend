-- Logator Database Schema

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(255),
  firstname VARCHAR(255),
  lastname VARCHAR(255),
  photo_url TEXT,
  plan NUMERIC,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE establishments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255),
  address1 TEXT,
  address2 TEXT,
  pincode VARCHAR(20) NOT NULL,
  gst_number VARCHAR(50),
  pan_number VARCHAR(50),
  latitude DECIMAL(9,6),
  longitude DECIMAL(9,6),
  plan NUMERIC,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE subscriptions (
  id SERIAL PRIMARY KEY,
  establishment_id INTEGER REFERENCES establishments(id) ON DELETE CASCADE,
  plan NUMERIC,
  visitors_limit INTEGER,
  start_date DATE,
  end_date DATE
);

CREATE TABLE departments (
  id SERIAL PRIMARY KEY,
  establishment_id INTEGER REFERENCES establishments(id) ON DELETE CASCADE,
  name VARCHAR(255),
  CONSTRAINT unique_department_per_establishment UNIQUE (establishment_id, name)
);

CREATE TABLE gates (
  id SERIAL PRIMARY KEY,
  establishment_id INTEGER REFERENCES establishments(id) ON DELETE CASCADE,
  name VARCHAR(255),
  latitude DECIMAL(9,6),
  longitude DECIMAL(9,6),
  geofencing BOOLEAN DEFAULT FALSE,
  radius INTEGER DEFAULT 100,
  CONSTRAINT unique_gate_per_establishment UNIQUE (establishment_id, name)
);

CREATE TABLE user_department_map (
  id SERIAL PRIMARY KEY,
  department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  status NUMERIC DEFAULT 0, -- 0: pending, 1: approved, 2: rejected (example mapping)
  CONSTRAINT unique_user_department_map UNIQUE (department_id, user_id)
);

CREATE TABLE user_gate_map (
  id SERIAL PRIMARY KEY,
  gate_id INTEGER REFERENCES gates(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  status NUMERIC DEFAULT 0, -- 0: pending, 1: approved, 2: rejected (example mapping)
  CONSTRAINT unique_user_gate_map UNIQUE (gate_id, user_id)
);

CREATE TABLE visitor_logs (
  id SERIAL PRIMARY KEY,
  establishment_id INTEGER REFERENCES establishments(id) ON DELETE CASCADE,
  department_id INTEGER REFERENCES departments(id),
  visitor_id INTEGER REFERENCES users(id), -- the visiting person
  to_meet TEXT,
  check_in_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  check_out_at TIMESTAMP,
  date_of_entry DATE,
  checkin_user_id INTEGER REFERENCES users(id),    -- user who performed check-in
  checkout_user_id INTEGER REFERENCES users(id),   -- user who performed check-out
  checkin_gate_id INTEGER REFERENCES gates(id),    -- gate for check-in
  checkout_gate_id INTEGER REFERENCES gates(id)    -- gate for check-out
);

CREATE TABLE checkin (
  id SERIAL PRIMARY KEY,
  establishment_id INTEGER REFERENCES establishments(id) ON DELETE CASCADE,
  department_id INTEGER REFERENCES departments(id),
  visitor_id INTEGER REFERENCES users(id), -- the visiting person
  to_meet TEXT,
  check_in_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  check_out_at TIMESTAMP,
  date_of_entry DATE,
  checkin_user_id INTEGER REFERENCES users(id),    -- user who performed check-in
  checkout_user_id INTEGER REFERENCES users(id),   -- user who performed check-out
  checkin_gate_id INTEGER REFERENCES gates(id),    -- gate for check-in
  checkout_gate_id INTEGER REFERENCES gates(id)    -- gate for check-out
);



CREATE TABLE face_ids (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  encoding TEXT -- JSON or comma-separated vector
);

-- Table for pending mapping requests (gate or department)
CREATE TABLE pending_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- the user being invited
  type CHAR(1) NOT NULL, -- 'D' for department, 'G' for gate
  target_id INTEGER NOT NULL, -- gate_id or department_id
  requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL, -- who sent the invite
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX idx_visitor_logs_establishment_id ON visitor_logs(establishment_id);
CREATE INDEX idx_visitor_logs_check_in_at ON visitor_logs(check_in_at);
CREATE INDEX idx_visitor_logs_check_out_at ON visitor_logs(check_out_at);
CREATE INDEX idx_subscriptions_establishment_id ON subscriptions(establishment_id); 