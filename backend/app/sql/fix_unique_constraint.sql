-- Run this in Supabase SQL Editor.
-- It finds and removes ALL unique constraints/indexes on messages
-- except the primary key and foreign key.

-- Step 1: List ALL constraints on messages
SELECT
    c.conname AS name,
    CASE c.contype
        WHEN 'p' THEN 'primary key'
        WHEN 'f' THEN 'foreign key'
        WHEN 'u' THEN 'unique'
        WHEN 'c' THEN 'check'
    END AS type,
    pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
WHERE c.conrelid = 'public.messages'::regclass;

-- Step 2: List ALL indexes on messages
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'messages' AND schemaname = 'public';

-- Step 3: Drop ALL unique constraints on messages
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'public.messages'::regclass AND contype = 'u'
    LOOP
        EXECUTE format('ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS %I', r.conname);
        RAISE NOTICE 'Dropped constraint: %', r.conname;
    END LOOP;
END $$;

-- Step 4: Drop ALL unique indexes on messages
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'messages' AND schemaname = 'public'
          AND indexdef LIKE '%UNIQUE%'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS public.%I', r.indexname);
        RAISE NOTICE 'Dropped index: %', r.indexname;
    END LOOP;
END $$;

-- Step 5: Verify — should only show primary key and foreign key
SELECT
    c.conname AS name,
    CASE c.contype
        WHEN 'p' THEN 'primary key'
        WHEN 'f' THEN 'foreign key'
        WHEN 'u' THEN 'unique'
    END AS type
FROM pg_constraint c
WHERE c.conrelid = 'public.messages'::regclass;
