import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rufvkwzqumerlwzkcevz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1ZnZrd3pxdW1lcmx3emtjZXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyMjk5NTEsImV4cCI6MjEwNDgwNTk1MX0.O791CjaIfhDjQFffhNYVPRNae1OoyH9WMEP4e5aLb98';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export type Task = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: TaskStatus;
  user_id: string;
  created_at: string;
};

export type AssignmentStatus = 'pending' | 'in_progress' | 'submitted' | 'graded';

export type Assignment = {
  id: string;
  title: string;
  subject: string | null;
  deadline: string | null;
  attachment_url: string | null;
  status: AssignmentStatus;
  source: string | null;
  user_id: string;
  created_at: string;
};

export type EventItem = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  location: string | null;
  color: string | null;
  created_at: string;
};

export type CalendarFeed = {
  id: string;
  user_id: string;
  name: string;
  feed_url: string;
  last_synced_at: string | null;
  created_at: string;
};

export type NewTask = Pick<Task, 'title' | 'description' | 'due_date' | 'status'>;
export type NewAssignment = Pick<Assignment, 'title' | 'subject' | 'deadline' | 'attachment_url' | 'status' | 'source'>;
export type NewEvent = Pick<EventItem, 'title' | 'description' | 'start_time' | 'end_time' | 'location' | 'color'>;
