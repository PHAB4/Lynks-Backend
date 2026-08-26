-- ============================================================
-- Notifications Table Migration
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT,
    type TEXT NOT NULL DEFAULT 'reminder',
    link JSONB,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
    ON notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
    ON notifications FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
    ON notifications FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage notifications"
    ON notifications FOR ALL
    USING (true);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_notifications_user_id
    ON notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
    ON notifications(user_id, is_read)
    WHERE is_read = false;
