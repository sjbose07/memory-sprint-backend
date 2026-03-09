-- Phase 3 Schema Updates

-- Add share_code, negative_marking, and is_strict to tests
ALTER TABLE tests ADD COLUMN IF NOT EXISTS share_code VARCHAR(10) UNIQUE;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS negative_marking BOOLEAN DEFAULT FALSE;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS is_strict BOOLEAN DEFAULT FALSE;

-- Update score to numeric for negative marking
ALTER TABLE test_attempts ALTER COLUMN score TYPE NUMERIC(10, 2);

-- Create bookmarks table

CREATE TABLE IF NOT EXISTS bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_tests_share_code ON tests(share_code);
