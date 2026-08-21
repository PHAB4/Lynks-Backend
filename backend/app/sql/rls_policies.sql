-- Lynks Backend - Row Level Security Policies
-- Run this ONCE in Supabase SQL Editor
-- Allows authenticated users to read/write their own data

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Service can insert users" ON users FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can read own roadmaps" ON roadmaps FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own roadmaps" ON roadmaps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own roadmaps" ON roadmaps FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can read own steps" ON steps FOR SELECT USING (EXISTS (SELECT 1 FROM roadmaps WHERE roadmaps.id = steps.roadmap_id AND roadmaps.user_id = auth.uid()));
CREATE POLICY "Users can create own steps" ON steps FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM roadmaps WHERE roadmaps.id = steps.roadmap_id AND roadmaps.user_id = auth.uid()));
CREATE POLICY "Users can update own steps" ON steps FOR UPDATE USING (EXISTS (SELECT 1 FROM roadmaps WHERE roadmaps.id = steps.roadmap_id AND roadmaps.user_id = auth.uid()));

CREATE POLICY "Users can read own tasks" ON tasks FOR SELECT USING (EXISTS (SELECT 1 FROM steps JOIN roadmaps ON roadmaps.id = steps.roadmap_id WHERE steps.id = tasks.step_id AND roadmaps.user_id = auth.uid()));
CREATE POLICY "Users can create own tasks" ON tasks FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM steps JOIN roadmaps ON roadmaps.id = steps.roadmap_id WHERE steps.id = tasks.step_id AND roadmaps.user_id = auth.uid()));
CREATE POLICY "Users can update own tasks" ON tasks FOR UPDATE USING (EXISTS (SELECT 1 FROM steps JOIN roadmaps ON roadmaps.id = steps.roadmap_id WHERE steps.id = tasks.step_id AND roadmaps.user_id = auth.uid()));

CREATE POLICY "Users can read own evidence" ON evidence FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own evidence" ON evidence FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own evidence" ON evidence FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can read own resumes" ON resumes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own resumes" ON resumes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own resumes" ON resumes FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can read own conversations" ON conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own conversations" ON conversations FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own messages" ON messages FOR SELECT USING (EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.user_id = auth.uid()));
CREATE POLICY "Users can create own messages" ON messages FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.user_id = auth.uid()));
