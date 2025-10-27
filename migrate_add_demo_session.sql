-- Add demo_session_id column to existing tables
-- Run this before starting the updated application

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS demo_session_id VARCHAR;

ALTER TABLE activities 
ADD COLUMN IF NOT EXISTS demo_session_id VARCHAR;

-- Optional: Add index for faster demo queries
CREATE INDEX IF NOT EXISTS idx_users_demo_session ON users(demo_session_id);
CREATE INDEX IF NOT EXISTS idx_activities_demo_session ON activities(demo_session_id);

