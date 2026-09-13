/*
# Task Tracker PWA - Database Schema

## Overview
Creates the core tables for a task/agenda tracker PWA with Microsoft Teams integration and cloud sync.

## New Tables

### tasks
- Personal tasks created by the user.
- `id` (uuid, PK)
- `user_id` (uuid, FK to auth.users, owner-scoped)
- `title` (text, not null)
- `description` (text, nullable)
- `priority` (text: low/medium/high, default medium)
- `category` (text, nullable - e.g. "Personal", "Work", "Study")
- `due_date` (timestamptz, nullable)
- `completed` (boolean, default false)
- `completed_at` (timestamptz, nullable)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### assignments
- Assignments synced from Microsoft Teams or added manually.
- `id` (uuid, PK)
- `user_id` (uuid, FK to auth.users, owner-scoped)
- `title` (text, not null)
- `description` (text, nullable)
- `course_name` (text, nullable - Teams class name)
- `deadline` (timestamptz, nullable)
- `reference_url` (text, nullable - link to reference materials)
- `reference_files` (jsonb, nullable - array of {name, url} objects)
- `teams_id` (text, nullable - Microsoft Teams assignment ID for dedup)
- `status` (text: pending/in_progress/submitted/graded, default pending)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### events
- Standalone agenda/calendar events.
- `id` (uuid, PK)
- `user_id` (uuid, FK to auth.users, owner-scoped)
- `title` (text, not null)
- `description` (text, nullable)
- `start_time` (timestamptz, not null)
- `end_time` (timestamptz, nullable)
- `location` (text, nullable)
- `color` (text, nullable - for calendar display)
- `created_at` (timestamptz, default now())

### microsoft_connections
- Stores Microsoft OAuth connection info for Teams sync.
- `id` (uuid, PK)
- `user_id` (uuid, FK to auth.users, owner-scoped)
- `microsoft_user_id` (text, nullable)
- `microsoft_email` (text, nullable)
- `access_token` (text, nullable)
- `refresh_token` (text, nullable)
- `token_expires_at` (timestamptz, nullable)
- `connected_at` (timestamptz, default now())
- `last_synced_at` (timestamptz, nullable)

## Security
- RLS enabled on all tables.
- All tables are owner-scoped (user_id = auth.uid()).
- 4 policies per table (SELECT, INSERT, UPDATE, DELETE).
- Owner columns default to auth.uid() so client inserts work without passing user_id.

## Indexes
- Indexes on user_id for all tables.
- Index on tasks.due_date for agenda queries.
- Index on assignments.deadline for sorting.
- Index on events.start_time for calendar queries.
- Unique index on assignments(user_id, teams_id) for dedup during Teams sync.
*/

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  category text,
  due_date timestamptz,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
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

-- Assignments table
CREATE TABLE IF NOT EXISTS assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  course_name text,
  deadline timestamptz,
  reference_url text,
  reference_files jsonb,
  teams_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'submitted', 'graded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
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

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  location text,
  color text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_events" ON events;
CREATE POLICY "select_own_events" ON events FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_events" ON events;
CREATE POLICY "insert_own_events" ON events FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_events" ON events;
CREATE POLICY "update_own_events" ON events FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_events" ON events;
CREATE POLICY "delete_own_events" ON events FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Microsoft connections table
CREATE TABLE IF NOT EXISTS microsoft_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  microsoft_user_id text,
  microsoft_email text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz
);

ALTER TABLE microsoft_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ms_connection" ON microsoft_connections;
CREATE POLICY "select_own_ms_connection" ON microsoft_connections FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_ms_connection" ON microsoft_connections;
CREATE POLICY "insert_own_ms_connection" ON microsoft_connections FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_ms_connection" ON microsoft_connections;
CREATE POLICY "update_own_ms_connection" ON microsoft_connections FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_ms_connection" ON microsoft_connections;
CREATE POLICY "delete_own_ms_connection" ON microsoft_connections FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_assignments_user_id ON assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_deadline ON assignments(deadline);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);
CREATE INDEX IF NOT EXISTS idx_microsoft_connections_user_id ON microsoft_connections(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_assignments_user_teams_id ON assignments(user_id, teams_id) WHERE teams_id IS NOT NULL;

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tasks_updated_at ON tasks;
CREATE TRIGGER trigger_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_assignments_updated_at ON assignments;
CREATE TRIGGER trigger_assignments_updated_at BEFORE UPDATE ON assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
