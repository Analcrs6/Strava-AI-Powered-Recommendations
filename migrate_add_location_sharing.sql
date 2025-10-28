-- Migration: Add Location Sharing for Mutual Followers
-- Date: 2025-10-28

-- Add location fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS latitude FLOAT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS longitude FLOAT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS location_sharing_enabled BOOLEAN DEFAULT FALSE;

-- Create index for location queries
CREATE INDEX IF NOT EXISTS idx_users_location ON users(latitude, longitude) WHERE location_sharing_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_last_location_update ON users(last_location_update);

-- Add comments
COMMENT ON COLUMN users.latitude IS 'User current latitude for location sharing';
COMMENT ON COLUMN users.longitude IS 'User current longitude for location sharing';
COMMENT ON COLUMN users.last_location_update IS 'Timestamp of last location update';
COMMENT ON COLUMN users.location_sharing_enabled IS 'Whether user has enabled location sharing with mutual followers';

