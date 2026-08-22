-- ============================================================
-- 1. REPRODUCTION TEST — run each step SEPARATELY
-- ============================================================

-- STEP 1: Get a valid user ID
SELECT id, email FROM public.users LIMIT 1;

-- STEP 2: Insert a conversation manually (replace the user ID from Step 1)
-- If this PASSES -> the DB is fine, the bug is in Python
-- If this FAILS with the same "email" error -> there is a hidden trigger
INSERT INTO public.conversations (id, user_id)
VALUES (gen_random_uuid(), 'PASTE_USER_ID_HERE')
RETURNING id, user_id, created_at;

-- STEP 3: Insert a message into that conversation (replace conversation ID from Step 2)
INSERT INTO public.messages (id, conversation_id, role, content)
VALUES (gen_random_uuid(), 'PASTE_CONVERSATION_ID_HERE', 'user', 'Hello!')
RETURNING id, role, content;

-- STEP 4: Clean up test data
DELETE FROM public.messages WHERE conversation_id = 'PASTE_CONVERSATION_ID_HERE';
DELETE FROM public.conversations WHERE id = 'PASTE_CONVERSATION_ID_HERE';


-- ============================================================
-- 2. CLEANUP — drop the unused duplicate function
-- ============================================================
DROP FUNCTION IF EXISTS public.handle_auth_user_inserts();


-- ============================================================
-- 3. FIX — recreate handle_new_user to be more robust
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.users (id, email, created_at)
  VALUES (NEW.id, NEW.email, NEW.created_at)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$function$;
