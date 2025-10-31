-- Migration: High-Precision Location System
-- Upgrades location tracking with:
-- - High-precision coordinates (8 decimal places for latitude, longitude)
-- - Location accuracy tracking
-- - Location history for movement validation
-- - Spatial indexes for efficient proximity queries
-- - Configurable proximity thresholds

-- ============================================================
-- 1. Upgrade Users Table for High-Precision Location Tracking
-- ============================================================

-- Drop existing location columns (they use FLOAT which lacks precision)
ALTER TABLE users DROP COLUMN IF EXISTS latitude;
ALTER TABLE users DROP COLUMN IF EXISTS longitude;

-- Add high-precision location columns
-- DECIMAL(10,8) for latitude: -90.00000000 to 90.00000000 (~1.1mm precision)
-- DECIMAL(11,8) for longitude: -180.00000000 to 180.00000000 (~1.1mm precision)
ALTER TABLE users ADD COLUMN latitude DECIMAL(10,8);
ALTER TABLE users ADD COLUMN longitude DECIMAL(11,8);

-- Add location metadata columns
ALTER TABLE users ADD COLUMN location_accuracy DECIMAL(8,2); -- Accuracy in meters
ALTER TABLE users ADD COLUMN location_source VARCHAR(50); -- 'gps', 'network', 'manual'
ALTER TABLE users ADD COLUMN proximity_threshold INTEGER DEFAULT 500; -- Custom threshold in meters (100-2000)

-- Ensure last_location_update and location_sharing_enabled exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS location_sharing_enabled BOOLEAN DEFAULT FALSE;

-- Add spatial index for proximity queries
CREATE INDEX IF NOT EXISTS idx_users_location ON users (latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_location_update ON users (last_location_update) WHERE last_location_update IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_location_sharing ON users (location_sharing_enabled) WHERE location_sharing_enabled = TRUE;

-- ============================================================
-- 2. Create Location History Table for Movement Validation
-- ============================================================

CREATE TABLE IF NOT EXISTS location_history (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- High-precision coordinates
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    
    -- Location metadata
    accuracy DECIMAL(8,2), -- Accuracy in meters
    source VARCHAR(50), -- 'gps', 'network', 'manual'
    altitude DECIMAL(8,2), -- Altitude in meters (optional)
    speed DECIMAL(8,2), -- Speed in m/s (optional)
    heading DECIMAL(6,2), -- Direction in degrees (0-360)
    
    -- Movement validation
    distance_from_previous DECIMAL(10,2), -- Distance from previous point in meters
    time_from_previous INTEGER, -- Time from previous point in seconds
    speed_calculated DECIMAL(8,2), -- Calculated speed in m/s
    is_valid BOOLEAN DEFAULT TRUE, -- False if movement seems erratic
    
    -- Timestamps
    recorded_at TIMESTAMP NOT NULL DEFAULT NOW(), -- When device recorded location
    created_at TIMESTAMP NOT NULL DEFAULT NOW(), -- When server received it
    
    -- Indexes for efficient queries
    CONSTRAINT check_latitude CHECK (latitude >= -90 AND latitude <= 90),
    CONSTRAINT check_longitude CHECK (longitude >= -180 AND longitude <= 180),
    CONSTRAINT check_accuracy CHECK (accuracy >= 0),
    CONSTRAINT check_speed CHECK (speed >= 0),
    CONSTRAINT check_heading CHECK (heading >= 0 AND heading <= 360)
);

-- Indexes for location history
CREATE INDEX idx_location_history_user ON location_history (user_id, recorded_at DESC);
CREATE INDEX idx_location_history_valid ON location_history (user_id, is_valid, recorded_at DESC);
CREATE INDEX idx_location_history_created ON location_history (created_at);

-- ============================================================
-- 3. Create Proximity Events Table for Notification Management
-- ============================================================

CREATE TABLE IF NOT EXISTS proximity_events (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nearby_user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Event details
    event_type VARCHAR(20) NOT NULL, -- 'entered', 'exited', 'within'
    distance_meters DECIMAL(10,2) NOT NULL,
    threshold_meters INTEGER NOT NULL,
    
    -- User locations at time of event
    user_latitude DECIMAL(10,8) NOT NULL,
    user_longitude DECIMAL(11,8) NOT NULL,
    nearby_latitude DECIMAL(10,8) NOT NULL,
    nearby_longitude DECIMAL(11,8) NOT NULL,
    
    -- Notification tracking
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_sent_at TIMESTAMP,
    
    -- Timestamps
    detected_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT check_event_type CHECK (event_type IN ('entered', 'exited', 'within')),
    CONSTRAINT check_different_users CHECK (user_id != nearby_user_id)
);

-- Indexes for proximity events
CREATE INDEX idx_proximity_events_user ON proximity_events (user_id, detected_at DESC);
CREATE INDEX idx_proximity_events_notification ON proximity_events (notification_sent, detected_at);
CREATE INDEX idx_proximity_events_type ON proximity_events (event_type, detected_at DESC);

-- ============================================================
-- 4. Create User Location Preferences Table
-- ============================================================

CREATE TABLE IF NOT EXISTS user_location_preferences (
    user_id VARCHAR PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    
    -- Proximity notification preferences
    notify_on_proximity BOOLEAN DEFAULT TRUE,
    proximity_cooldown_minutes INTEGER DEFAULT 30, -- Min time between notifications for same user
    notify_only_favorites BOOLEAN DEFAULT FALSE, -- Only notify for favorited users
    
    -- Location sharing preferences
    share_with_all_mutual BOOLEAN DEFAULT TRUE, -- Share with all mutual followers
    share_accuracy BOOLEAN DEFAULT TRUE, -- Include accuracy in shared data
    
    -- Movement tracking preferences
    min_movement_meters INTEGER DEFAULT 10, -- Minimum movement to trigger update
    max_update_frequency_seconds INTEGER DEFAULT 30, -- Max update frequency
    
    -- Privacy settings
    ghost_mode BOOLEAN DEFAULT FALSE, -- Appear offline even when sharing
    visible_distance_limit INTEGER, -- Limit how far away people can see you (meters)
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. Add Triggers for Automated Location History
-- ============================================================

-- Function to automatically log location changes
CREATE OR REPLACE FUNCTION log_location_change()
RETURNS TRIGGER AS $$
DECLARE
    prev_lat DECIMAL(10,8);
    prev_lon DECIMAL(11,8);
    prev_time TIMESTAMP;
    distance DECIMAL(10,2);
    time_diff INTEGER;
    calc_speed DECIMAL(8,2);
    is_valid_movement BOOLEAN DEFAULT TRUE;
BEGIN
    -- Only log if location actually changed
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL AND
       (OLD.latitude IS DISTINCT FROM NEW.latitude OR OLD.longitude IS DISTINCT FROM NEW.longitude) THEN
        
        -- Get previous location from history
        SELECT latitude, longitude, recorded_at
        INTO prev_lat, prev_lon, prev_time
        FROM location_history
        WHERE user_id = NEW.id
        ORDER BY recorded_at DESC
        LIMIT 1;
        
        -- Calculate movement metrics if we have previous data
        IF prev_lat IS NOT NULL AND prev_lon IS NOT NULL THEN
            -- Use Haversine formula for distance (Vincenty will be in application code)
            distance := (
                6371000 * acos(
                    cos(radians(prev_lat)) * cos(radians(NEW.latitude)) *
                    cos(radians(NEW.longitude) - radians(prev_lon)) +
                    sin(radians(prev_lat)) * sin(radians(NEW.latitude))
                )
            );
            
            time_diff := EXTRACT(EPOCH FROM (NEW.last_location_update - prev_time));
            
            IF time_diff > 0 THEN
                calc_speed := distance / time_diff;
                
                -- Flag as invalid if speed > 150 m/s (~540 km/h, faster than commercial plane)
                IF calc_speed > 150 THEN
                    is_valid_movement := FALSE;
                END IF;
            END IF;
        END IF;
        
        -- Insert into location history
        INSERT INTO location_history (
            user_id,
            latitude,
            longitude,
            accuracy,
            source,
            distance_from_previous,
            time_from_previous,
            speed_calculated,
            is_valid,
            recorded_at
        ) VALUES (
            NEW.id,
            NEW.latitude,
            NEW.longitude,
            NEW.location_accuracy,
            NEW.location_source,
            distance,
            time_diff,
            calc_speed,
            is_valid_movement,
            COALESCE(NEW.last_location_update, NOW())
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic location history logging
DROP TRIGGER IF EXISTS trigger_log_location_change ON users;
CREATE TRIGGER trigger_log_location_change
    AFTER UPDATE OF latitude, longitude ON users
    FOR EACH ROW
    EXECUTE FUNCTION log_location_change();

-- ============================================================
-- 6. Cleanup Function for Old Location History
-- ============================================================

-- Function to clean up old location history (keep last 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_location_history()
RETURNS void AS $$
BEGIN
    DELETE FROM location_history
    WHERE created_at < NOW() - INTERVAL '7 days';
    
    DELETE FROM proximity_events
    WHERE detected_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 7. Create Spatial Query Helper Functions
-- ============================================================

-- Function to find users within radius using high-precision coordinates
CREATE OR REPLACE FUNCTION find_users_within_radius(
    center_lat DECIMAL(10,8),
    center_lon DECIMAL(11,8),
    radius_meters INTEGER,
    exclude_user_id VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    user_id VARCHAR,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    distance_meters DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id,
        u.latitude,
        u.longitude,
        (
            6371000 * acos(
                LEAST(1.0, GREATEST(-1.0,
                    cos(radians(center_lat)) * cos(radians(u.latitude)) *
                    cos(radians(u.longitude) - radians(center_lon)) +
                    sin(radians(center_lat)) * sin(radians(u.latitude))
                ))
            )
        )::DECIMAL(10,2) AS distance_meters
    FROM users u
    WHERE u.latitude IS NOT NULL
        AND u.longitude IS NOT NULL
        AND u.location_sharing_enabled = TRUE
        AND (exclude_user_id IS NULL OR u.id != exclude_user_id)
        AND u.last_location_update > NOW() - INTERVAL '30 minutes'
    HAVING (
        6371000 * acos(
            LEAST(1.0, GREATEST(-1.0,
                cos(radians(center_lat)) * cos(radians(u.latitude)) *
                cos(radians(u.longitude) - radians(center_lon)) +
                sin(radians(center_lat)) * sin(radians(u.latitude))
            ))
        )
    ) <= radius_meters
    ORDER BY distance_meters;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 8. Grant Permissions (if using specific database user)
-- ============================================================

-- Uncomment and adjust if you have a specific application user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON location_history TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON proximity_events TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON user_location_preferences TO your_app_user;
-- GRANT USAGE, SELECT ON SEQUENCE location_history_id_seq TO your_app_user;
-- GRANT USAGE, SELECT ON SEQUENCE proximity_events_id_seq TO your_app_user;

-- ============================================================
-- Migration Complete
-- ============================================================

-- Verification queries (optional):
-- SELECT column_name, data_type, numeric_precision, numeric_scale 
-- FROM information_schema.columns 
-- WHERE table_name = 'users' AND column_name IN ('latitude', 'longitude');

-- SELECT * FROM pg_indexes WHERE tablename IN ('location_history', 'proximity_events', 'users');

