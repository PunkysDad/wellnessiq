-- Add GENERAL_FITNESS to the Sport enum
ALTER TYPE sport ADD VALUE IF NOT EXISTS 'GENERAL_FITNESS';

-- Add fitness_goals column to users table for General Fitness users
ALTER TABLE users ADD COLUMN IF NOT EXISTS fitness_goals TEXT DEFAULT '';
