// src/lib/taskHelpers.ts
// Pure utility functions for task filtering and sorting.
// No side effects — safe to use anywhere (hooks, components, tests).

import type { Task } from '@/lib/goalHelpers'

export type TaskFilters = {
  priority?: 'high' | 'medium' | 'low'
  category?: string
  goalId?: string
  search?: string
  dueDateRange?: 'today' | 'this_week' | 'overdue'
}

export type TaskSort = 'priority' | 'due_date' | 'created_at'

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

/**
 * Filter tasks by one or more criteria (AND logic).
 * Returns a new array — does not mutate the input.
 */
export function filterTasks(tasks: Task[], filters: TaskFilters, today?: string): Task[] {
  return tasks.filter(task => {
    if (filters.priority && task.priority !== filters.priority) return false
    if (filters.category && task.category !== filters.category) return false
    if (filters.goalId && task.goal_id !== filters.goalId) return false
    if (filters.search) {
      const term = filters.search.toLowerCase()
      if (!task.title.toLowerCase().includes(term)) return false
    }
    if (filters.dueDateRange) {
      if (!task.due_date) return false
      const todayStr = today ?? new Date().toISOString().slice(0, 10)
      switch (filters.dueDateRange) {
        case 'today':
          if (task.due_date !== todayStr) return false
          break
        case 'overdue':
          if (task.due_date >= todayStr) return false
          break
        case 'this_week': {
          const d = new Date(todayStr + 'T00:00:00Z')
          const dayOfWeek = d.getUTCDay() // 0=Sun,1=Mon,...,6=Sat
          const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
          const endOfWeek = new Date(d)
          endOfWeek.setUTCDate(d.getUTCDate() + daysUntilSunday)
          const endStr = endOfWeek.toISOString().slice(0, 10)
          if (task.due_date < todayStr || task.due_date > endStr) return false
          break
        }
      }
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
