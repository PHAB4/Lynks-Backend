-- ============================================================
-- FIX BAD TRIGGERS
-- Run this in Supabase SQL Editor BEFORE re-testing.
--
-- Problem: The on_auth_user_created trigger (or its function)
-- is firing on conversations/roadmaps/etc. tables that have
-- no "email" column, causing:
--   UndefinedColumnError: record "new" has no field "email"
-- ============================================================

-- Step 1: See what triggers exist on ALL your tables
SELECT
    t.tgname AS trigger_name,
    c.relname AS table_name,
    p.proname AS function_name,
    pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal
ORDER BY n.nspname, c.relname, t.tgname;

-- Step 2: Drop signup triggers from all PUBLIC tables
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT t.tgname AS trigger_name,
               c.relname AS table_name
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'public'
          AND NOT t.tgisinternal
          AND (t.tgname LIKE '%user%'
               OR t.tgname LIKE '%signup%'
               OR t.tgname LIKE '%auth%')
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS %I ON public.%I',
            r.trigger_name, r.table_name
        );
        RAISE NOTICE 'Dropped trigger % on public.%', r.trigger_name, r.table_name;
    END LOOP;
END $$;

-- Step 3: Verify the trigger ONLY exists on auth.users
SELECT
    t.tgname AS trigger_name,
    n.nspname AS schema_name,
    c.relname AS table_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE NOT t.tgisinternal
  AND (t.tgname LIKE '%user%' OR t.tgname LIKE '%signup%' OR t.tgname LIKE '%auth%')
ORDER BY n.nspname, c.relname;

-- Step 4: If the signup trigger was removed from auth.users, re-create it:
-- CREATE TRIGGER on_new_user
--   AFTER INSERT ON auth.users
--   FOR EACH ROW
--   EXECUTE FUNCTION public.handle_new_user();
