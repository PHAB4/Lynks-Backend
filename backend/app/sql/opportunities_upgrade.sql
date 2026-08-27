-- ============================================================
-- Lynks Opportunities Scraper Upgrade — Schema Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- Phase 1.1: Add new columns to opportunities table
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'event',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS source_name TEXT DEFAULT 'curated',
  ADD COLUMN IF NOT EXISTS salary_min NUMERIC,
  ADD COLUMN IF NOT EXISTS salary_max NUMERIC,
  ADD COLUMN IF NOT EXISTS salary_currency TEXT DEFAULT 'JMD',
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Indexes for time-based filtering
CREATE INDEX IF NOT EXISTS idx_opportunities_posted_at ON opportunities(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_first_seen ON opportunities(first_seen_at DESC);

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_opportunities_category ON opportunities(category);

-- Composite index for common queries (category + time sort)
CREATE INDEX IF NOT EXISTS idx_opportunities_cat_time ON opportunities(category, posted_at DESC);

-- Phase 1.2: Create saved_opportunities junction table
CREATE TABLE IF NOT EXISTS saved_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, opportunity_id)
);

-- RLS policies for saved_opportunities
ALTER TABLE saved_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can save opportunities"
  ON saved_opportunities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their saved opportunities"
  ON saved_opportunities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can unsave opportunities"
  ON saved_opportunities FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for saved_opportunities
CREATE INDEX IF NOT EXISTS idx_saved_opportunities_user ON saved_opportunities(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_opportunities_opp ON saved_opportunities(opportunity_id);
