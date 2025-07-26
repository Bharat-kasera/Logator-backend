-- Add geofencing columns to gates table
ALTER TABLE gates 
ADD COLUMN geofencing BOOLEAN DEFAULT FALSE,
ADD COLUMN radius INTEGER DEFAULT 100; 