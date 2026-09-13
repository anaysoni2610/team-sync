/*
# Align schema to user spec + enable Realtime

## Overview
Recreates tasks and assignments tables to match the exact column spec provided by the user.
All tables had 0 rows, so no data is lost.

## Changes
1. Drop old tasks table (had: priority, category, completed, completed_at, updated_at — not in user spec)
2. Drop old assignments table (had: course_name, reference_url, reference_files, teams_id, updated_at — not in user spec)
3. Create new tasks table: id, title, description, due_date, status, user_id, created_at
4. Create new assignments table: id, title, subject, deadline, attachment_url, status, source, created_at
5. Enable RLS + owner-scoped policies on both tables
6. Add both tables to supabase_realtime publication for cross-device sync
7. Set REPLICA IDENTITY FULL for proper realtime DELETE payloads

## New Schema

### tasks
- id (uuid, PK, default gen_random_uuid())
- title (text, not null)
- description (text, nullable)
- due_date (timestamptz, nullable)
- status (text, not null, default 'pending', check: pending/in_progress/completed)
- user_id (uuid, not null, default auth.uid(), FK auth.users ON DELETE CASCADE)
- created_at (timestamptz, default now())

### assignments
- id (uuid, PK, default gen_random_uuid())
- title (text, not null)
- subject (text, nullable — course/class name)
- deadline (timestamptz, nullable)
- attachment_url (text, nullable — reference material link)
- status (text, not null, default 'pending', check: pending/in_progress/submitted/graded)
- source (text, nullable — 'teams' or 'manual' for origin tracking)
- user_id (uuid, not null, default auth.uid(), FK auth.users ON DELETE CASCADE)
- created_at (timestamptz, default now())

## Security
- RLS enabled on both tables
- 4 owner-scoped policies per table (SELECT, INSERT, UPDATE, DELETE)
- TO authenticated with auth.uid() = user_id checks
- user_id defaults to auth.uid() so client inserts work without passing it
*/

-- Drop old tables (0 rows, no data loss)
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS assignments CASCADE;

-- New tasks table
CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  due_date timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_tasks" ON tasks;
CREATE POLICY "select_own_tasks" ON tasks FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_tasks" ON tasks;
CREATE POLICY "insert_own_tasks" ON tasks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_tasks" ON tasks;
CREATE POLICY "update_own_tasks" ON tasks FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_tasks" ON tasks;
CREATE POLICY "delete_own_tasks" ON tasks FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- New assignments table
CREATE TABLE assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subject text,
  deadline timestamptz,
  attachment_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'submitted', 'graded')),
  source text,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_assignments" ON assignments;
CREATE POLICY "select_own_assignments" ON assignments FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_assignments" ON assignments;
CREATE POLICY "insert_own_assignments" ON assignments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_assignments" ON assignments;
CREATE POLICY "update_own_assignments" ON assignments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_assignments" ON assignments;
CREATE POLICY "delete_own_assignments" ON assignments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_assignments_user_id ON assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_deadline ON assignments(deadline);

-- Enable Realtime for cross-device sync
ALTER TABLE tasks REPLICA IDENTITY FULL;
ALTER TABLE assignments REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'assignments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE assignments;
  END IF;
END $$;
