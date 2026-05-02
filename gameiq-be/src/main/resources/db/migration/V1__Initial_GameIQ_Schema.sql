-- GameIQ Database Schema

CREATE TYPE subscription_tier AS ENUM ('FREE', 'INDIVIDUAL', 'FAMILY', 'TEAM');
CREATE TYPE user_role AS ENUM ('ATHLETE', 'PARENT', 'COACH');
CREATE TYPE sport_type AS ENUM ('FOOTBALL', 'BASKETBALL', 'BASEBALL', 'SOCCER', 'HOCKEY');
CREATE TYPE difficulty_level AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');
CREATE TYPE workout_category AS ENUM ('STRENGTH', 'SPEED_AGILITY', 'CONDITIONING', 'POSITION_SPECIFIC', 'INJURY_PREVENTION', 'RECOVERY', 'FLEXIBILITY');
CREATE TYPE equipment_type AS ENUM ('BODYWEIGHT', 'DUMBBELLS', 'BARBELLS', 'RESISTANCE_BANDS', 'KETTLEBELLS', 'MEDICINE_BALL', 'FOAM_ROLLER', 'GYM_ACCESS', 'NONE');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL DEFAULT 'ATHLETE',
    subscription_tier subscription_tier NOT NULL DEFAULT 'FREE',
    subscription_expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    facebook_id VARCHAR(255) UNIQUE,
    profile_image_url TEXT,
    timezone VARCHAR(50) DEFAULT 'America/New_York',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE athlete_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    primary_sport sport_type NOT NULL,
    primary_position VARCHAR(50) NOT NULL,
    secondary_sport sport_type,
    secondary_position VARCHAR(50),
    birth_date DATE,
    graduation_year INTEGER,
    school_name VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    country VARCHAR(50) DEFAULT 'US',
    height_inches INTEGER,
    weight_pounds INTEGER,
    dominant_hand VARCHAR(10),
    years_playing INTEGER DEFAULT 1,
    experience_level difficulty_level DEFAULT 'BEGINNER',
    available_equipment equipment_type[] DEFAULT '{}',
    training_goals TEXT[],
    training_frequency INTEGER DEFAULT 3,
    session_duration_minutes INTEGER DEFAULT 45,
    total_quiz_score INTEGER DEFAULT 0,
    total_workouts_completed INTEGER DEFAULT 0,
    current_streak_days INTEGER DEFAULT 0,
    longest_streak_days INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE TABLE quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sport sport_type NOT NULL,
    position VARCHAR(50),
    category VARCHAR(100) NOT NULL,
    difficulty difficulty_level NOT NULL,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) DEFAULT 'multiple_choice',
    diagram_data JSONB,
    options JSONB NOT NULL,
    correct_answer INTEGER NOT NULL,
    explanation TEXT NOT NULL,
    source VARCHAR(255),
    tags TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    usage_count INTEGER DEFAULT 0,
    avg_success_rate DECIMAL(5,2) DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE quiz_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sport sport_type NOT NULL,
    position VARCHAR(50),
    session_type VARCHAR(50) DEFAULT 'practice',
    questions_attempted INTEGER DEFAULT 0,
    questions_correct INTEGER DEFAULT 0,
    total_possible_points INTEGER DEFAULT 0,
    points_earned INTEGER DEFAULT 0,
    percentage_score DECIMAL(5,2) DEFAULT 0.0,
    time_started TIMESTAMP WITH TIME ZONE NOT NULL,
    time_completed TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    shared_to_facebook BOOLEAN DEFAULT FALSE,
    shared_to_tiktok BOOLEAN DEFAULT FALSE,
    share_card_generated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sport sport_type NOT NULL,
    position VARCHAR(50),
    conversation_title VARCHAR(255),
    topic VARCHAR(255),
    questions_asked INTEGER DEFAULT 1,
    tokens_used INTEGER DEFAULT 0,
    estimated_cost DECIMAL(8,4) DEFAULT 0.0,
    messages JSONB NOT NULL,
    system_prompt_used TEXT,
    user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
    was_helpful BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE social_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    share_type VARCHAR(50) NOT NULL,
    platform VARCHAR(50) NOT NULL,
    quiz_session_id UUID REFERENCES quiz_sessions(id),
    content_data JSONB,
    share_url VARCHAR(500),
    clicks_tracked INTEGER DEFAULT 0,
    conversions_tracked INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_subscription ON users(subscription_tier, subscription_expires_at);
CREATE INDEX idx_athlete_profiles_sport_position ON athlete_profiles(primary_sport, primary_position);
CREATE INDEX idx_quiz_questions_sport_position ON quiz_questions(sport, position);
CREATE INDEX idx_quiz_sessions_user_sport ON quiz_sessions(user_id, sport);
CREATE INDEX idx_ai_conversations_user_sport ON ai_conversations(user_id, sport);

-- Update triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_athlete_profiles_updated_at BEFORE UPDATE ON athlete_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample data
INSERT INTO users (email, password_hash, first_name, last_name, role, subscription_tier) VALUES
('test@gameiq.com', '$2a$12$dummy.hash.for.development.only', 'Test', 'Athlete', 'ATHLETE', 'FREE'),
('premium@gameiq.com', '$2a$12$dummy.hash.for.development.only', 'Premium', 'Player', 'ATHLETE', 'INDIVIDUAL');

INSERT INTO athlete_profiles (user_id, primary_sport, primary_position, birth_date, graduation_year, school_name, city, state, height_inches, weight_pounds, dominant_hand, years_playing, experience_level) VALUES 
((SELECT id FROM users WHERE email = 'test@gameiq.com'), 'FOOTBALL', 'QB', '2007-08-15', 2025, 'GameIQ High School', 'Nashville', 'TN', 70, 165, 'right', 3, 'INTERMEDIATE');
