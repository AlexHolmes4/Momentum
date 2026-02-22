// src/lib/taskHelpers.ts
// Pure utility functions for task filtering and sorting.
// No side effects — safe to use anywhere (hooks, components, tests).

import type { Task } from '@/lib/goalHelpers'

export type TaskFilters = {
  priority?: 'high' | 'medium' | 'low'
  category?: string
  goalId?: string
  search?: string
}

export type TaskSort = 'priority' | 'due_date' | 'created_at'

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

/**
 * Filter tasks by one or more criteria (AND logic).
 * Returns a new array — does not mutate the input.
 */
export function filterTasks(tasks: Task[], filters: TaskFilters): Task[] {
  return tasks.filter(task => {
    if (filters.priority && task.priority !== filters.priority) return false
    if (filters.category && task.category !== filters.category) return false
    if (filters.goalId && task.goal_id !== filters.goalId) return false
    if (filters.search) {
      const term = filters.search.toLowerCase()
      if (!task.title.toLowerCase().includes(term)) return false
    }
    return true
  })
}

/**
 * Sort tasks by a given key. Returns a new array — does not mutate the input.
 *
 * - 'priority': high → medium → low
 * - 'due_date': ascending, nulls last
 * - 'created_at': descending (newest first)
 */
export function sortTasks(tasks: Task[], sort: TaskSort): Task[] {
  const copy = [...tasks]
  switch (sort) {
    case 'priority':
      return copy.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2))
    case 'due_date':
      return copy.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return a.due_date.localeCompare(b.due_date)
      })
    case 'created_at':
      return copy.sort((a, b) => b.created_at.localeCompare(a.created_at))
    default:
      return copy
  }
}
