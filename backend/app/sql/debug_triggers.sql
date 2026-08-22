-- ============================================================
-- COMPREHENSIVE DIAGNOSTIC
-- Run this in Supabase SQL Editor and screenshot ALL the results.
-- ============================================================

-- 1. ALL triggers on ALL tables
SELECT
    n.nspname AS schema,
    c.relname AS table_name,
    t.tgname AS trigger_name,
    p.proname AS function_name,
    pg_get_triggerdef(t.oid) AS full_definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE NOT t.tgisinternal
ORDER BY n.nspname, c.relname;

-- 2. ALL functions in public schema
SELECT
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS full_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- 3. Conversations table structure
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'conversations'
ORDER BY ordinal_position;

-- 4. Conversations RLS policies
SELECT
    policyname AS policy_name,
    cmd AS operation,
    qual AS using_expression,
    with_check AS check_expression
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'conversations';

-- 5. Functions that reference "email"
SELECT
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND pg_get_functiondef(p.oid) LIKE '%email%'
ORDER BY p.proname;
