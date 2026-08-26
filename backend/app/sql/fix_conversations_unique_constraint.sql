-- ============================================================
-- FIX: Drop unique constraint on conversations.user_id
-- ============================================================
-- Each user needs MULTIPLE conversations, but this constraint
-- only allows ONE conversation per user.
-- Run this in Supabase SQL Editor BEFORE deploying the
-- feature/ai-memory-system branch.
-- ============================================================

-- Drop the unique constraint on user_id in conversations
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS "Conversations_user_id_key";

-- Verify it's gone
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'conversations'::regclass
  AND contype = 'u';
-- Should return 0 rows after running the DROP above

-- Also ensure no duplicate conversation exists for any user
-- (keep the most recent one if duplicates exist)
DELETE FROM conversations
WHERE id NOT IN (
    SELECT DISTINCT ON (user_id) id
    FROM conversations
    ORDER BY user_id, created_at DESC
);

-- Now add a composite unique constraint if you want to prevent
-- duplicate conversations for the same user on the same day:
-- ALTER TABLE conversations ADD CONSTRAINT "Conversations_user_date_unique"
--   UNIQUE (user_id, created_at::date);
-- (Uncomment the line above if you want this behavior)
