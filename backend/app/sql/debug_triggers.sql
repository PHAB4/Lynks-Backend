-- Run each query SEPARATELY. Screenshot each result.

-- QUERY 6: What does rls_auto_enable do?
SELECT pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'rls_auto_enable';

-- QUERY 7: Are there any RULES on conversations?
SELECT * FROM pg_rules
WHERE tablename = 'conversations' AND schemaname = 'public';

-- QUERY 8: ALL triggers on conversations specifically (including internal)
SELECT t.tgname, t.tgenabled, p.proname AS function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid = 'public.conversations'::regclass;

-- QUERY 9: Any function referencing NEW and email together
SELECT p.proname, pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND pg_get_functiondef(p.oid) LIKE '%NEW%'
  AND pg_get_functiondef(p.oid) LIKE '%email%';
