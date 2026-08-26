-- ============================================================
-- AI Memory System Migration
-- Run this in Supabase SQL Editor before deploying the new code
-- ============================================================

-- 1. Add summary column to conversations table
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS summary TEXT;

-- 2. Create user_memories table
CREATE TABLE IF NOT EXISTS user_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fact TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    source TEXT NOT NULL DEFAULT 'conversation',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. RLS policies for user_memories
ALTER TABLE user_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own memories"
    ON user_memories FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own memories"
    ON user_memories FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage memories"
    ON user_memories FOR ALL
    USING (true);

-- 4. Index for fast memory lookups
CREATE INDEX IF NOT EXISTS idx_user_memories_user_id
    ON user_memories(user_id, created_at DESC);

-- 5. Drop Conversations unique constraint on user_id
-- Each user needs MULTIPLE conversations, but this constraint
-- only allows ONE conversation per user.
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS "Conversations_user_id_key";
