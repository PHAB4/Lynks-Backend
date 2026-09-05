-- Add sort_order column to conversations for manual reordering
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Initialize sort_order based on created_at (newer = lower number = higher in list)
UPDATE conversations
SET sort_order = EXTRACT(EPOCH FROM created_at)::int * -1
WHERE sort_order = 0;

CREATE INDEX IF NOT EXISTS idx_conversations_sort ON conversations (user_id, is_pinned DESC, sort_order ASC, created_at DESC);
