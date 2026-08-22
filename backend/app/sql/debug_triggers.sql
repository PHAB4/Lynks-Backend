-- Run each query SEPARATELY in Supabase SQL Editor.
-- Screenshot each result and send them all to me.

-- QUERY 1: All triggers on all tables
SELECT
    n.nspname AS schema,
    c.relname AS table_name,
    t.tgname AS trigger_name,
    p.proname AS function_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE NOT t.tgisinternal
ORDER BY n.nspname, c.relname;

-- QUERY 2: Conversations table columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'conversations'
ORDER BY ordinal_position;

-- QUERY 3: RLS policies on conversations
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'conversations';

-- QUERY 4: All functions in public schema (names only first)
SELECT p.proname AS function_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- QUERY 5: Show the handle_new_user function body
SELECT pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'handle_new_user';
