-- Migration: Add authentication and cascade delete support
-- Date: 2025-10-28
-- Description: Adds password authentication, email uniqueness, and cascade delete for user activities

-- Add password_hash column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Add unique constraint to email (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'users_email_key'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
    END IF;
END $$;

-- Create index on email for faster lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Add cascade delete to activities.user_id foreign key
-- First, drop the existing FK constraint if it exists
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_user_id_fkey;

-- Add the FK constraint with CASCADE delete
ALTER TABLE activities 
ADD CONSTRAINT activities_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES users(id) 
ON DELETE CASCADE;

-- Add created_at to activities if it doesn't exist
ALTER TABLE activities ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Add cascade delete to follows table for user deletion
ALTER TABLE follows DROP CONSTRAINT IF EXISTS follows_follower_id_fkey;
ALTER TABLE follows DROP CONSTRAINT IF EXISTS follows_followed_id_fkey;

ALTER TABLE follows 
ADD CONSTRAINT follows_follower_id_fkey 
FOREIGN KEY (follower_id) 
REFERENCES users(id) 
ON DELETE CASCADE;

ALTER TABLE follows 
ADD CONSTRAINT follows_followed_id_fkey 
FOREIGN KEY (followed_id) 
REFERENCES users(id) 
ON DELETE CASCADE;

-- Verify changes
SELECT 
    'Migration completed successfully!' as status,
    COUNT(*) as total_users 
FROM users;

