-- V20__Production_Baseline.sql
-- Consolidated production baseline schema.
-- Replaces all previous migrations (V1–V19) which had type conflicts.
-- This migration only runs on a fresh database where V1 is the current version.
-- ── Functions ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.update_tags_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.update_user_conversations_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.update_user_workout_preferences_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.update_workout_plans_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.update_quiz_session_stats()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    UPDATE quiz_sessions
    SET
        total_attempts = total_attempts + 1,
        best_score = GREATEST(best_score, NEW.total_score),
        passed = CASE WHEN GREATEST(best_score, NEW.total_score) >= 70 THEN TRUE ELSE FALSE END,
        best_attempt_id = CASE WHEN NEW.total_score > best_score THEN NEW.id ELSE best_attempt_id END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.quiz_session_id;
    RETURN NEW;
END; $$;

-- ── Drop old UUID-based users table and recreate with BIGINT ──────────────────

-- Drop dependent objects first
DROP TABLE IF EXISTS public.social_shares CASCADE;
DROP TABLE IF EXISTS public.quiz_result_tags CASCADE;
DROP TABLE IF EXISTS public.quiz_session_question_results CASCADE;
DROP TABLE IF EXISTS public.quiz_session_attempts CASCADE;
DROP TABLE IF EXISTS public.quiz_sessions CASCADE;
DROP TABLE IF EXISTS public.quiz_results CASCADE;
DROP TABLE IF EXISTS public.quiz_questions CASCADE;
DROP TABLE IF EXISTS public.quiz_categories CASCADE;
DROP TABLE IF EXISTS public.workout_plan_tags CASCADE;
DROP TABLE IF EXISTS public.workout_plans CASCADE;
DROP TABLE IF EXISTS public.conversation_tags CASCADE;
DROP TABLE IF EXISTS public.user_conversations CASCADE;
DROP TABLE IF EXISTS public.user_workout_preferences CASCADE;
DROP TABLE IF EXISTS public.tags CASCADE;
DROP TABLE IF EXISTS public.claude_conversations CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Drop old enum types if they exist
DROP TYPE IF EXISTS public.subscription_tier CASCADE;
DROP TYPE IF EXISTS public.user_role CASCADE;
DROP TYPE IF EXISTS public.workout_category CASCADE;

-- ── Users ─────────────────────────────────────────────────────────────────────

CREATE SEQUENCE public.users_id_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE public.users (
    id                      bigint NOT NULL DEFAULT nextval('public.users_id_seq'),
    email                   character varying(255),
    password_hash           character varying(255),
    first_name              character varying(100),
    last_name               character varying(100),
    role                    character varying(50),
    subscription_tier       character varying(50) DEFAULT 'TRIAL',
    subscription_expires_at timestamp with time zone,
    is_active               boolean DEFAULT true,
    email_verified          boolean DEFAULT false,
    facebook_id             character varying(255),
    profile_image_url       text,
    timezone                character varying(50) DEFAULT 'America/New_York',
    created_at              timestamp with time zone DEFAULT now(),
    updated_at              timestamp with time zone DEFAULT now(),
    display_name            character varying(255) NOT NULL DEFAULT '',
    firebase_uid            character varying(255),
    primary_sport           character varying(50),
    primary_position        character varying(50),
    age                     integer,
    last_active_at          timestamp with time zone,
    trial_chats_used        integer NOT NULL DEFAULT 0,
    trial_workouts_used     integer NOT NULL DEFAULT 0,
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_email_key UNIQUE (email)
);

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;

-- ── Claude conversations ──────────────────────────────────────────────────────

CREATE SEQUENCE public.claude_conversations_id_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE public.claude_conversations (
    id                   bigint NOT NULL DEFAULT nextval('public.claude_conversations_id_seq'),
    user_id              bigint NOT NULL,
    session_id           character varying(255),
    user_message         text,
    claude_response      text,
    message_content      text,
    response_content     text,
    conversation_type    character varying(50),
    sport                character varying(50),
    position             character varying(50),
    system_prompt_used   text,
    claude_model         character varying(100),
    api_cost_cents       integer DEFAULT 0,
    tokens_used_input    integer DEFAULT 0,
    tokens_used_output   integer DEFAULT 0,
    response_time_ms     integer,
    user_rating          integer,
    flagged_inappropriate boolean DEFAULT false,
    created_at           timestamp with time zone DEFAULT now(),
    updated_at           timestamp with time zone DEFAULT now(),
    CONSTRAINT claude_conversations_pkey PRIMARY KEY (id)
);

ALTER SEQUENCE public.claude_conversations_id_seq OWNED BY public.claude_conversations.id;

-- ── Tags ──────────────────────────────────────────────────────────────────────

CREATE SEQUENCE public.tags_id_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE public.tags (
    id         bigint NOT NULL DEFAULT nextval('public.tags_id_seq'),
    user_id    bigint NOT NULL,
    name       character varying(100) NOT NULL,
    color      character varying(7) NOT NULL DEFAULT '#007AFF',
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT tags_pkey PRIMARY KEY (id),
    CONSTRAINT tags_color_format CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT tags_name_max_length CHECK (length(name) <= 100),
    CONSTRAINT tags_name_not_empty CHECK (length(TRIM(name)) > 0),
    CONSTRAINT fk_tags_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

ALTER SEQUENCE public.tags_id_seq OWNED BY public.tags.id;

CREATE INDEX idx_tags_user_id ON public.tags USING btree (user_id);
CREATE UNIQUE INDEX idx_tags_user_name_unique ON public.tags USING btree (user_id, lower(name));

CREATE TRIGGER tags_updated_at_trigger BEFORE UPDATE ON public.tags
    FOR EACH ROW EXECUTE FUNCTION public.update_tags_updated_at();

-- ── User conversations ────────────────────────────────────────────────────────

CREATE SEQUENCE public.user_conversations_id_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE public.user_conversations (
    id                bigint NOT NULL DEFAULT nextval('public.user_conversations_id_seq'),
    user_id           bigint NOT NULL,
    conversation_type character varying(50) NOT NULL DEFAULT 'coaching',
    conversation_data jsonb,
    created_at        timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at        timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_conversations_pkey PRIMARY KEY (id),
    CONSTRAINT user_conversations_type_check CHECK (conversation_type = ANY (ARRAY['coaching','quiz','general'])),
    CONSTRAINT fk_user_conversations_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

ALTER SEQUENCE public.user_conversations_id_seq OWNED BY public.user_conversations.id;

CREATE INDEX idx_user_conversations_user_id ON public.user_conversations USING btree (user_id);
CREATE INDEX idx_user_conversations_created_at ON public.user_conversations USING btree (created_at);
CREATE INDEX idx_user_conversations_type ON public.user_conversations USING btree (conversation_type);

CREATE TRIGGER user_conversations_updated_at_trigger BEFORE UPDATE ON public.user_conversations
    FOR EACH ROW EXECUTE FUNCTION public.update_user_conversations_updated_at();

-- ── Conversation tags ─────────────────────────────────────────────────────────

CREATE SEQUENCE public.conversation_tags_id_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE public.conversation_tags (
    id              bigint NOT NULL DEFAULT nextval('public.conversation_tags_id_seq'),
    conversation_id bigint NOT NULL,
    tag_id          bigint NOT NULL,
    created_at      timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT conversation_tags_pkey PRIMARY KEY (id),
    CONSTRAINT fk_conversation_tags_conversation_id FOREIGN KEY (conversation_id) REFERENCES public.claude_conversations(id) ON DELETE CASCADE,
    CONSTRAINT fk_conversation_tags_tag_id FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE
);

ALTER SEQUENCE public.conversation_tags_id_seq OWNED BY public.conversation_tags.id;

CREATE INDEX idx_conversation_tags_conversation_id ON public.conversation_tags USING btree (conversation_id);
CREATE INDEX idx_conversation_tags_tag_id ON public.conversation_tags USING btree (tag_id);
CREATE UNIQUE INDEX uq_conversation_tags ON public.conversation_tags USING btree (conversation_id, tag_id);

-- ── User workout preferences ──────────────────────────────────────────────────

CREATE SEQUENCE public.user_workout_preferences_id_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE public.user_workout_preferences (
    id                  bigint NOT NULL DEFAULT nextval('public.user_workout_preferences_id_seq'),
    user_id             bigint NOT NULL,
    experience_level    character varying(20),
    preferred_duration  integer,
    available_equipment text,
    training_goals      text,
    created_at          timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at          timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_workout_preferences_pkey PRIMARY KEY (id),
    CONSTRAINT user_workout_preferences_duration_positive CHECK (preferred_duration > 0),
    CONSTRAINT user_workout_preferences_experience_check CHECK (experience_level = ANY (ARRAY['beginner','intermediate','advanced'])),
    CONSTRAINT fk_user_workout_preferences_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

ALTER SEQUENCE public.user_workout_preferences_id_seq OWNED BY public.user_workout_preferences.id;

CREATE INDEX idx_user_workout_preferences_user_id ON public.user_workout_preferences USING btree (user_id);

CREATE TRIGGER user_workout_preferences_updated_at_trigger BEFORE UPDATE ON public.user_workout_preferences
    FOR EACH ROW EXECUTE FUNCTION public.update_user_workout_preferences_updated_at();

-- ── Workout plans ─────────────────────────────────────────────────────────────

CREATE SEQUENCE public.workout_plans_id_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE public.workout_plans (
    id               bigint NOT NULL DEFAULT nextval('public.workout_plans_id_seq'),
    user_id          bigint NOT NULL,
    sport            character varying(50) NOT NULL,
    position         character varying(100) NOT NULL,
    workout_name     character varying(255),
    position_focus   character varying(255),
    difficulty_level character varying(20),
    duration_minutes integer,
    equipment_needed text,
    generated_content text,
    is_saved         boolean DEFAULT false,
    created_at       timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at       timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT workout_plans_pkey PRIMARY KEY (id),
    CONSTRAINT workout_plans_difficulty_check CHECK (difficulty_level = ANY (ARRAY['BEGINNER','INTERMEDIATE','ADVANCED','ELITE'])),
    CONSTRAINT workout_plans_duration_positive CHECK (duration_minutes > 0),
    CONSTRAINT workout_plans_sport_check CHECK (sport = ANY (ARRAY['FOOTBALL','BASKETBALL','BASEBALL','SOCCER','HOCKEY'])),
    CONSTRAINT fk_workout_plans_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

ALTER SEQUENCE public.workout_plans_id_seq OWNED BY public.workout_plans.id;

CREATE INDEX idx_workout_plans_user_id ON public.workout_plans USING btree (user_id);
CREATE INDEX idx_workout_plans_created_at ON public.workout_plans USING btree (created_at);
CREATE INDEX idx_workout_plans_sport_position ON public.workout_plans USING btree (sport, position);

CREATE TRIGGER workout_plans_updated_at_trigger BEFORE UPDATE ON public.workout_plans
    FOR EACH ROW EXECUTE FUNCTION public.update_workout_plans_updated_at();

-- ── Workout plan tags ─────────────────────────────────────────────────────────

CREATE SEQUENCE public.workout_plan_tags_id_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE public.workout_plan_tags (
    id             bigint NOT NULL DEFAULT nextval('public.workout_plan_tags_id_seq'),
    workout_plan_id bigint NOT NULL,
    tag_id         bigint NOT NULL,
    created_at     timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT workout_plan_tags_pkey PRIMARY KEY (id),
    CONSTRAINT fk_workout_plan_tags_workout_plan_id FOREIGN KEY (workout_plan_id) REFERENCES public.workout_plans(id) ON DELETE CASCADE,
    CONSTRAINT fk_workout_plan_tags_tag_id FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE
);

ALTER SEQUENCE public.workout_plan_tags_id_seq OWNED BY public.workout_plan_tags.id;

CREATE INDEX idx_workout_plan_tags_workout_plan_id ON public.workout_plan_tags USING btree (workout_plan_id);
CREATE INDEX idx_workout_plan_tags_tag_id ON public.workout_plan_tags USING btree (tag_id);
CREATE UNIQUE INDEX uq_workout_plan_tags ON public.workout_plan_tags USING btree (workout_plan_id, tag_id);

-- ── Quiz categories ───────────────────────────────────────────────────────────

CREATE TABLE public.quiz_categories (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sport         character varying(50) NOT NULL,
    position      character varying(50) NOT NULL,
    category_name character varying(100) NOT NULL,
    description   text,
    created_at    timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at    timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT quiz_categories_sport_position_category_name_key UNIQUE (sport, position, category_name)
);

CREATE INDEX idx_quiz_categories_sport_position ON public.quiz_categories USING btree (sport, position);

CREATE TRIGGER update_quiz_categories_updated_at BEFORE UPDATE ON public.quiz_categories
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Quiz questions ────────────────────────────────────────────────────────────

CREATE TABLE public.quiz_questions (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_id bigint NOT NULL,
    question_id character varying(50) NOT NULL,
    scenario    text NOT NULL,
    question    text NOT NULL,
    options     jsonb NOT NULL,
    correct     character varying(10) NOT NULL,
    explanation text NOT NULL,
    difficulty  character varying(20) NOT NULL,
    tags        jsonb,
    created_at  timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at  timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT quiz_questions_difficulty_check CHECK (difficulty = ANY (ARRAY['beginner','intermediate','advanced'])),
    CONSTRAINT quiz_questions_category_id_question_id_key UNIQUE (category_id, question_id),
    CONSTRAINT quiz_questions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.quiz_categories(id) ON DELETE CASCADE
);

CREATE INDEX idx_quiz_questions_category_id ON public.quiz_questions USING btree (category_id);
CREATE INDEX idx_quiz_questions_difficulty ON public.quiz_questions USING btree (difficulty);
CREATE INDEX idx_quiz_questions_tags ON public.quiz_questions USING gin (tags);

CREATE TRIGGER update_quiz_questions_updated_at BEFORE UPDATE ON public.quiz_questions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Quiz results ──────────────────────────────────────────────────────────────

CREATE TABLE public.quiz_results (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id             bigint NOT NULL,
    question_id         bigint NOT NULL,
    score               integer NOT NULL,
    completed_at        timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    time_taken          integer,
    answer_selected     character varying(10) NOT NULL,
    is_correct          boolean NOT NULL,
    created_at          timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at          timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    sport               character varying(50),
    position            character varying(50),
    quiz_type           character varying(50) NOT NULL DEFAULT 'FORMATION_RECOGNITION',
    quiz_title          character varying(255) NOT NULL DEFAULT 'Default Quiz',
    questions_json      text NOT NULL DEFAULT '[]',
    user_answers_json   text NOT NULL DEFAULT '[]',
    correct_answers     integer NOT NULL DEFAULT 0,
    total_questions     integer NOT NULL DEFAULT 1,
    score_percentage    numeric(5,2) NOT NULL DEFAULT 0.0,
    time_taken_seconds  integer,
    difficulty_level    character varying(50) NOT NULL DEFAULT 'BEGINNER',
    generated_by_claude boolean NOT NULL DEFAULT true,
    shared_to_facebook  boolean NOT NULL DEFAULT false,
    shared_to_tiktok    boolean NOT NULL DEFAULT false,
    CONSTRAINT quiz_results_score_check CHECK (score >= 0 AND score <= 100),
    CONSTRAINT chk_score_percentage CHECK (score_percentage >= 0 AND score_percentage <= 100),
    CONSTRAINT chk_difficulty_level CHECK (difficulty_level = ANY (ARRAY['BEGINNER','INTERMEDIATE','ADVANCED','EXPERT'])),
    CONSTRAINT quiz_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT quiz_results_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.quiz_questions(id) ON DELETE CASCADE
);

CREATE INDEX idx_quiz_results_user_id ON public.quiz_results USING btree (user_id);
CREATE INDEX idx_quiz_results_question_id ON public.quiz_results USING btree (question_id);
CREATE INDEX idx_quiz_results_completed_at ON public.quiz_results USING btree (completed_at);
CREATE INDEX idx_quiz_results_user_score ON public.quiz_results USING btree (user_id, score DESC);
CREATE INDEX idx_quiz_results_user_sport ON public.quiz_results USING btree (user_id, sport);
CREATE INDEX idx_quiz_results_user_correct ON public.quiz_results USING btree (user_id, is_correct);

CREATE TRIGGER update_quiz_results_updated_at BEFORE UPDATE ON public.quiz_results
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Quiz result tags ──────────────────────────────────────────────────────────

CREATE TABLE public.quiz_result_tags (
    quiz_result_id bigint NOT NULL,
    tag_id         bigint NOT NULL,
    created_at     timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT quiz_result_tags_pkey PRIMARY KEY (quiz_result_id, tag_id),
    CONSTRAINT fk_quiz_result_tags_tag_id FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE
);

CREATE INDEX idx_quiz_result_tags_quiz_result_id ON public.quiz_result_tags USING btree (quiz_result_id);
CREATE INDEX idx_quiz_result_tags_tag_id ON public.quiz_result_tags USING btree (tag_id);

-- ── Quiz sessions ─────────────────────────────────────────────────────────────

CREATE TABLE public.quiz_sessions (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         bigint NOT NULL,
    quiz_type       character varying(50) NOT NULL,
    sport           character varying(50) NOT NULL,
    position        character varying(50) NOT NULL,
    question_ids    jsonb NOT NULL,
    session_name    character varying(200) NOT NULL,
    is_completed    boolean DEFAULT false,
    best_score      integer DEFAULT 0,
    best_attempt_id bigint,
    total_attempts  integer DEFAULT 0,
    passed          boolean DEFAULT false,
    created_at      timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at      timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT quiz_sessions_quiz_type_check CHECK (quiz_type = ANY (ARRAY['CORE','GENERATED'])),
    CONSTRAINT quiz_sessions_user_id_session_name_key UNIQUE (user_id, session_name),
    CONSTRAINT quiz_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_quiz_sessions_user_sport_position ON public.quiz_sessions USING btree (user_id, sport, position);
CREATE INDEX idx_quiz_sessions_user_passed ON public.quiz_sessions USING btree (user_id, passed);

CREATE TRIGGER update_quiz_sessions_updated_at BEFORE UPDATE ON public.quiz_sessions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Quiz session attempts ─────────────────────────────────────────────────────

CREATE TABLE public.quiz_session_attempts (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    quiz_session_id  bigint NOT NULL,
    user_id          bigint NOT NULL,
    attempt_number   integer NOT NULL,
    total_score      integer NOT NULL DEFAULT 0,
    correct_answers  integer NOT NULL DEFAULT 0,
    time_taken       integer,
    completed_at     timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_at       timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT quiz_session_attempts_quiz_session_id_attempt_number_key UNIQUE (quiz_session_id, attempt_number),
    CONSTRAINT quiz_session_attempts_quiz_session_id_fkey FOREIGN KEY (quiz_session_id) REFERENCES public.quiz_sessions(id) ON DELETE CASCADE,
    CONSTRAINT quiz_session_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_quiz_session_attempts_session_id ON public.quiz_session_attempts USING btree (quiz_session_id);
CREATE INDEX idx_quiz_session_attempts_user_completed ON public.quiz_session_attempts USING btree (user_id, completed_at);

CREATE TRIGGER trigger_update_quiz_session_stats AFTER INSERT ON public.quiz_session_attempts
    FOR EACH ROW EXECUTE FUNCTION public.update_quiz_session_stats();

-- ── Quiz session question results ─────────────────────────────────────────────

CREATE TABLE public.quiz_session_question_results (
    id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_attempt_id bigint NOT NULL,
    question_id        bigint NOT NULL,
    question_number    integer NOT NULL,
    answer_selected    character varying(10) NOT NULL,
    is_correct         boolean NOT NULL,
    time_taken         integer,
    created_at         timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT quiz_session_question_results_session_attempt_id_question_i_key UNIQUE (session_attempt_id, question_id),
    CONSTRAINT quiz_session_question_results_session_attempt_id_question_n_key UNIQUE (session_attempt_id, question_number),
    CONSTRAINT quiz_session_question_results_session_attempt_id_fkey FOREIGN KEY (session_attempt_id) REFERENCES public.quiz_session_attempts(id) ON DELETE CASCADE,
    CONSTRAINT quiz_session_question_results_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.quiz_questions(id) ON DELETE CASCADE
);

CREATE INDEX idx_quiz_session_question_results_attempt ON public.quiz_session_question_results USING btree (session_attempt_id);

-- ── Social shares ─────────────────────────────────────────────────────────────

CREATE TABLE public.social_shares (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id        bigint NOT NULL,
    quiz_result_id bigint NOT NULL,
    platform       character varying(50) NOT NULL,
    shared_at      timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    share_data     jsonb,
    created_at     timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at     timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT social_shares_platform_check CHECK (platform = ANY (ARRAY['facebook','tiktok','instagram','twitter'])),
    CONSTRAINT social_shares_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT social_shares_quiz_result_id_fkey FOREIGN KEY (quiz_result_id) REFERENCES public.quiz_results(id) ON DELETE CASCADE
);

CREATE INDEX idx_social_shares_user_id ON public.social_shares USING btree (user_id);
CREATE INDEX idx_social_shares_quiz_result_id ON public.social_shares USING btree (quiz_result_id);
CREATE INDEX idx_social_shares_platform ON public.social_shares USING btree (platform);
CREATE INDEX idx_social_shares_shared_at ON public.social_shares USING btree (shared_at);
CREATE INDEX idx_social_shares_platform_date ON public.social_shares USING btree (platform, shared_at);

CREATE TRIGGER update_social_shares_updated_at BEFORE UPDATE ON public.social_shares
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
