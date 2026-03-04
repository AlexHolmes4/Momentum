-- Migration: Add user_id columns and enable Row Level Security
-- Run this in Supabase SQL Editor AFTER running schema.sql
-- Pre-requisite: At least one user must exist in auth.users (invite via dashboard first)

-- =====================
-- ADD user_id COLUMNS
-- =====================

-- Goals
ALTER TABLE goals ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Archived tasks
ALTER TABLE archived_tasks ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- =====================
-- BACKFILL EXISTING DATA (optional)
-- =====================
-- If you have existing data, assign it to your user.
-- Replace YOUR_USER_ID with your auth.users id from Supabase dashboard.
-- Uncomment and run once:
--
-- UPDATE goals SET user_id = 'YOUR_USER_ID' WHERE user_id IS NULL;
-- UPDATE tasks SET user_id = 'YOUR_USER_ID' WHERE user_id IS NULL;
-- UPDATE archived_tasks SET user_id = 'YOUR_USER_ID' WHERE user_id IS NULL;

-- After backfill, make user_id NOT NULL:
-- ALTER TABLE goals ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE tasks ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE archived_tasks ALTER COLUMN user_id SET NOT NULL;

-- =====================
-- ENABLE ROW LEVEL SECURITY
-- =====================

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE archived_tasks ENABLE ROW LEVEL SECURITY;

-- =====================
-- RLS POLICIES — goals
-- =====================
CREATE POLICY "Users can view own goals"
  ON goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own goals"
  ON goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals"
  ON goals FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals"
  ON goals FOR DELETE
  USING (auth.uid() = user_id);

-- =====================
-- RLS POLICIES — tasks
-- =====================
CREATE POLICY "Users can view own tasks"
  ON tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tasks"
  ON tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks"
  ON tasks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks"
  ON tasks FOR DELETE
  USING (auth.uid() = user_id);

-- =====================
-- RLS POLICIES — subtasks (via parent task ownership)
-- =====================
CREATE POLICY "Users can view own subtasks"
  ON subtasks FOR SELECT
  USING (task_id IN (SELECT id FROM tasks WHERE user_id = auth.uid()));

CREATE POLICY "Users can create own subtasks"
  ON subtasks FOR INSERT
  WITH CHECK (task_id IN (SELECT id FROM tasks WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own subtasks"
  ON subtasks FOR UPDATE
  USING (task_id IN (SELECT id FROM tasks WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own subtasks"
  ON subtasks FOR DELETE
  USING (task_id IN (SELECT id FROM tasks WHERE user_id = auth.uid()));

-- =====================
-- RLS POLICIES — archived_tasks
-- =====================
CREATE POLICY "Users can view own archived tasks"
  ON archived_tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own archived tasks"
  ON archived_tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own archived tasks"
  ON archived_tasks FOR DELETE
  USING (auth.uid() = user_id);
