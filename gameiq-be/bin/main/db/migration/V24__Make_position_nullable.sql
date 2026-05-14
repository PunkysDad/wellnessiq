ALTER TABLE workout_plans ALTER COLUMN position DROP NOT NULL;
ALTER TABLE workout_plans DROP CONSTRAINT IF EXISTS workout_plans_sport_check;
