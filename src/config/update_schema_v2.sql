-- Update users table to include approval status
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT FALSE;

-- Automatically approve existing users (especially the manual admin)
UPDATE users SET is_approved = TRUE WHERE role = 'admin' OR google_id LIKE 'manual_%';
