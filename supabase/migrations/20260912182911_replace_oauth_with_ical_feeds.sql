/*
# Replace Microsoft OAuth with iCal Calendar Feeds

## Overview
Removes the microsoft_connections table and replaces it with calendar_feeds,
which stores iCal/ICS subscription URLs that users paste from Outlook/Teams.

## Changes
1. Drop microsoft_connections table (no user data — OAuth was never configured)
2. Create calendar_feeds table: id, user_id, name, feed_url, last_synced_at, created_at
3. Enable RLS + owner-scoped policies
4. Enable Realtime on calendar_feeds

## New Table

### calendar_feeds
- id (uuid, PK, default gen_random_uuid())
- user_id (uuid, not null, default auth.uid(), FK auth.users ON DELETE CASCADE)
- name (text, not null — user-given label e.g. "My Teams Calendar")
- feed_url (text, not null — the iCal/ICS subscription URL from Outlook/Teams)
- last_synced_at (timestamptz, nullable)
- created_at (timestamptz, default now())

## Security
- RLS enabled
- 4 owner-scoped policies (SELECT, INSERT, UPDATE, DELETE)
- TO authenticated with auth.uid() = user_id checks
*/

DROP TABLE IF EXISTS microsoft_connections CASCADE;

CREATE TABLE calendar_feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  feed_url text NOT NULL,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE calendar_feeds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_calendar_feeds" ON calendar_feeds;
CREATE POLICY "select_own_calendar_feeds" ON calendar_feeds FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_calendar_feeds" ON calendar_feeds;
CREATE POLICY "insert_own_calendar_feeds" ON calendar_feeds FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_calendar_feeds" ON calendar_feeds;
CREATE POLICY "update_own_calendar_feeds" ON calendar_feeds FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_calendar_feeds" ON calendar_feeds;
CREATE POLICY "delete_own_calendar_feeds" ON calendar_feeds FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_calendar_feeds_user_id ON calendar_feeds(user_id);

ALTER TABLE calendar_feeds REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'calendar_feeds'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE calendar_feeds;
  END IF;
END $$;
