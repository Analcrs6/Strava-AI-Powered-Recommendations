-- Comprehensive Migration V2: Advanced Features
-- Date: 2025-10-28
-- Description: Adds JWT auth, email verification, user preferences, A/B testing, analytics

BEGIN;

-- ==================================================
-- USER TABLE ENHANCEMENTS
-- ==================================================

-- Email verification
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(500);

-- Account status
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;

-- User preferences (basic)
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_strategy VARCHAR(50) DEFAULT 'content_mmr';
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_lambda FLOAT DEFAULT 0.3;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_sport VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS units VARCHAR(20) DEFAULT 'metric';

-- A/B Testing
ALTER TABLE users ADD COLUMN IF NOT EXISTS ab_test_group VARCHAR(10);

-- ==================================================
-- NEW TABLES
-- ==================================================

-- User Preferences (detailed)
CREATE TABLE IF NOT EXISTS user_preferences (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Recommendation preferences
    preferred_strategy VARCHAR(50) DEFAULT 'content_mmr',
    preferred_lambda FLOAT DEFAULT 0.3,
    exclude_seen BOOLEAN DEFAULT FALSE,
    
    -- Activity preferences
    preferred_sports JSONB DEFAULT '[]'::jsonb,
    min_distance FLOAT,
    max_distance FLOAT,
    min_elevation FLOAT,
    max_elevation FLOAT,
    preferred_surface VARCHAR(50),
    
    -- Notification preferences
    email_notifications BOOLEAN DEFAULT TRUE,
    push_notifications BOOLEAN DEFAULT TRUE,
    weekly_summary BOOLEAN DEFAULT TRUE,
    
    -- Display preferences
    units VARCHAR(20) DEFAULT 'metric',
    theme VARCHAR(20) DEFAULT 'light',
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Recommendation Logs (for analytics and A/B testing)
CREATE TABLE IF NOT EXISTS recommendation_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    query_activity_id VARCHAR(255) NOT NULL,
    recommended_activity_id VARCHAR(255) NOT NULL,
    strategy VARCHAR(50) NOT NULL,
    lambda_diversity FLOAT,
    score FLOAT NOT NULL,
    rank INTEGER NOT NULL,
    clicked BOOLEAN DEFAULT FALSE,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    ab_test_group VARCHAR(10)
);

-- A/B Test Experiments
CREATE TABLE IF NOT EXISTS ab_test_experiments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    variants JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    start_date TIMESTAMP DEFAULT NOW(),
    end_date TIMESTAMP,
    total_users INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ==================================================
-- INDEXES FOR PERFORMANCE
-- ==================================================

-- User preferences
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Recommendation logs
CREATE INDEX IF NOT EXISTS idx_recommendation_logs_user_id ON recommendation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_logs_query_activity ON recommendation_logs(query_activity_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_logs_strategy ON recommendation_logs(strategy);
CREATE INDEX IF NOT EXISTS idx_recommendation_logs_created_at ON recommendation_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_recommendation_logs_ab_group ON recommendation_logs(ab_test_group);

-- A/B experiments
CREATE INDEX IF NOT EXISTS idx_ab_experiments_active ON ab_test_experiments(is_active);
CREATE INDEX IF NOT EXISTS idx_ab_experiments_name ON ab_test_experiments(name);

-- ==================================================
-- NOTIFICATIONS TABLE
-- ==================================================

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read) WHERE read = FALSE;

-- ==================================================
-- INSERT DEFAULT A/B TEST EXPERIMENT
-- ==================================================

INSERT INTO ab_test_experiments (name, description, variants, is_active)
VALUES (
    'ensemble_vs_content_mmr',
    'Compare ensemble_mmr strategy (Group B) vs content_mmr (Group A)',
    '{"A": "content_mmr", "B": "ensemble_mmr"}'::jsonb,
    TRUE
)
ON CONFLICT (name) DO NOTHING;

-- ==================================================
-- CREATE DEFAULT PREFERENCES FOR EXISTING USERS
-- ==================================================

INSERT INTO user_preferences (user_id, preferred_strategy, preferred_lambda)
SELECT 
    id,
    COALESCE(preferred_strategy, 'content_mmr'),
    COALESCE(preferred_lambda, 0.3)
FROM users
WHERE id NOT IN (SELECT user_id FROM user_preferences);

-- ==================================================
-- VERIFICATION
-- ==================================================

SELECT 
    'Migration V2 completed successfully!' as status,
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM user_preferences) as users_with_preferences,
    (SELECT COUNT(*) FROM ab_test_experiments WHERE is_active = TRUE) as active_experiments,
    (SELECT COUNT(*) FROM notifications) as total_notifications;

COMMIT;

