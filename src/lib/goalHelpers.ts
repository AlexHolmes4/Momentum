// src/lib/goalHelpers.ts
// Pure utility functions for goal-related calculations.
// No side effects — safe to use anywhere (hooks, components, tests).

export type Task = {
  id: string
  title: string
  priority: 'high' | 'medium' | 'low'
  due_date: string | null
  category: string | null
  goal_id: string | null
  status: 'active' | 'completed'
  completed_at: string | null
  created_at: string
}

/**
 * Calculate goal progress as a percentage (0–100).
 *
 * Formula: completed tasks / total linked tasks * 100
 * - Returns 0 if no tasks are linked.
 * - Result is rounded to the nearest integer.
 *
 * @param tasks - All tasks linked to a single goal (already filtered by goal_id)
 */
export function calculateProgress(tasks: Task[]): number {
  if (tasks.length === 0) return 0
  const completed = tasks.filter(t => t.status === 'completed').length
  return Math.round((completed / tasks.length) * 100)
}
