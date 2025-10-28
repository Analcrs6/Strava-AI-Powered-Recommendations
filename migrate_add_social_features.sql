-- Migration: Add Social Features (Followers/Following)
-- Date: 2025-10-28

-- Add new columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Create follows table for social relationships
CREATE TABLE IF NOT EXISTS follows (
    id SERIAL PRIMARY KEY,
    follower_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followed_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(follower_id, followed_id),
    CHECK (follower_id != followed_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_followed ON follows(followed_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Add comments
COMMENT ON TABLE follows IS 'User follow relationships (Instagram-style followers/following)';
COMMENT ON COLUMN follows.follower_id IS 'User who is following';
COMMENT ON COLUMN follows.followed_id IS 'User being followed';

