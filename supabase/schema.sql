-- Momentum App — Supabase Schema
-- Run this in your Supabase project's SQL Editor before starting the app.
-- Recommended region: ap-southeast-1 (Singapore — closest to Perth, Western Australia)

create extension if not exists "pgcrypto";

-- =====================
-- GOALS
-- =====================
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  target_date date,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_at timestamp with time zone default now()
);

-- =====================
-- TASKS
-- =====================
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  due_date date,
  category text,
  goal_id uuid references goals(id) on delete set null,  -- nullable: tasks can be standalone
  status text not null default 'active' check (status in ('active', 'completed')),
  completed_at timestamp with time zone,                  -- set when task is completed
  created_at timestamp with time zone default now()
);

-- =====================
-- SUBTASKS
-- =====================
create table if not exists subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  title text not null,
  completed boolean not null default false
);

-- =====================
-- ARCHIVED TASKS
-- =====================
-- Completed tasks are moved here via INSERT + DELETE from tasks.
-- This table is NEVER loaded in normal app context.
-- Only queried when user explicitly opens the Archive view.
create table if not exists archived_tasks (
  id uuid,
  title text,
  priority text,
  due_date date,
  category text,
  goal_id uuid,
  completed_at timestamp with time zone,
  original_created_at timestamp with time zone
);

-- =====================
-- ROW LEVEL SECURITY
-- =====================
-- Single-user app — no auth required yet.
-- To add auth later: enable RLS and add per-user policies.
alter table goals disable row level security;
alter table tasks disable row level security;
alter table subtasks disable row level security;
alter table archived_tasks disable row level security;

-- =====================
-- MCP-FRIENDLY COMMENTS
-- =====================
-- Schema designed for intuitive Supabase MCP queries via Claude chat:
--   "What tasks are overdue?"
--     → SELECT * FROM tasks WHERE due_date < CURRENT_DATE AND status = 'active';
--   "Show active goals and their progress"
--     → SELECT g.*, COUNT(t.id) as total_tasks, COUNT(CASE WHEN t.status='completed' THEN 1 END) as done
--        FROM goals g LEFT JOIN tasks t ON t.goal_id = g.id WHERE g.status = 'active' GROUP BY g.id;
--   "Mark the fitness goal as completed"
--     → UPDATE goals SET status = 'completed' WHERE title ILIKE '%fitness%';
