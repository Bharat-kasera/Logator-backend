-- Update users table to use firstname and lastname instead of name
ALTER TABLE users 
ADD COLUMN firstname VARCHAR(255),
ADD COLUMN lastname VARCHAR(255);

-- Optional: You can run this to copy existing name data to firstname if needed
-- UPDATE users SET firstname = name WHERE firstname IS NULL;

-- Drop the old name column after data migration
-- ALTER TABLE users DROP COLUMN name; 