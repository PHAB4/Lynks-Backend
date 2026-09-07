-- Ensure the opportunities table exists with all required columns.
-- This migration is idempotent — safe to run multiple times.

-- Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT DEFAULT 'Unknown',
  location TEXT DEFAULT 'Caribbean',
  pay TEXT DEFAULT 'Varies',
  url TEXT DEFAULT '',
  age_requirement TEXT,
  experience_required TEXT DEFAULT 'None',
  category TEXT NOT NULL DEFAULT 'event',
  description TEXT DEFAULT '',
  posted_at TIMESTAMPTZ DEFAULT now(),
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  source_name TEXT DEFAULT 'curated',
  salary_min NUMERIC,
  salary_max NUMERIC,
  salary_currency TEXT DEFAULT 'JMD',
  image_url TEXT
);

-- Add any missing columns (idempotent)
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS id TEXT PRIMARY KEY;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'Unknown';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS company TEXT DEFAULT 'Unknown';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS location TEXT DEFAULT 'Caribbean';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS pay TEXT DEFAULT 'Varies';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS url TEXT DEFAULT '';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS age_requirement TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS experience_required TEXT DEFAULT 'None';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'event';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS source_name TEXT DEFAULT 'curated';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS salary_min NUMERIC;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS salary_max NUMERIC;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS salary_currency TEXT DEFAULT 'JMD';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_opportunities_posted_at ON opportunities(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_first_seen ON opportunities(first_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_category ON opportunities(category);
CREATE INDEX IF NOT EXISTS idx_opportunities_cat_time ON opportunities(category, posted_at DESC);
