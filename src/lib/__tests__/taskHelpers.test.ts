import { describe, it, expect } from 'vitest'
import { filterTasks, sortTasks } from '@/lib/taskHelpers'
import type { Task } from '@/lib/goalHelpers'

// Factory helper — creates a minimal valid Task, overrides as needed
function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? 'task-1',
    title: overrides.title ?? 'Test task',
    priority: overrides.priority ?? 'medium',
    due_date: overrides.due_date ?? null,
    category: overrides.category ?? null,
    goal_id: overrides.goal_id ?? null,
    status: overrides.status ?? 'active',
    completed_at: overrides.completed_at ?? null,
    created_at: overrides.created_at ?? '2026-01-01T00:00:00Z',
  }
}

describe('filterTasks', () => {
  const tasks: Task[] = [
    makeTask({ id: '1', priority: 'high', category: 'work', goal_id: 'g1', due_date: '2026-02-20' }),
    makeTask({ id: '2', priority: 'low', category: 'personal', goal_id: null, due_date: '2026-02-25' }),
    makeTask({ id: '3', priority: 'medium', category: 'work', goal_id: 'g1', due_date: null }),
    makeTask({ id: '4', priority: 'high', category: 'health', goal_id: 'g2', due_date: '2026-02-22' }),
  ]

  it('returns all tasks when no filters', () => {
    expect(filterTasks(tasks, {})).toEqual(tasks)
  })

  it('filters by priority', () => {
    const result = filterTasks(tasks, { priority: 'high' })
    expect(result).toHaveLength(2)
    expect(result.every(t => t.priority === 'high')).toBe(true)
  })

  it('filters by category', () => {
    const result = filterTasks(tasks, { category: 'work' })
    expect(result).toHaveLength(2)
    expect(result.every(t => t.category === 'work')).toBe(true)
  })

  it('filters by goal_id', () => {
    const result = filterTasks(tasks, { goalId: 'g1' })
    expect(result).toHaveLength(2)
    expect(result.every(t => t.goal_id === 'g1')).toBe(true)
  })

  it('filters by search term (case-insensitive title match)', () => {
    const tasksWithTitles = [
      makeTask({ id: '1', title: 'Buy groceries' }),
      makeTask({ id: '2', title: 'Write report' }),
      makeTask({ id: '3', title: 'Buy birthday gift' }),
    ]
    const result = filterTasks(tasksWithTitles, { search: 'buy' })
    expect(result).toHaveLength(2)
  })

  it('combines multiple filters (AND logic)', () => {
    const result = filterTasks(tasks, { priority: 'high', category: 'work' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('returns empty array when no matches', () => {
    expect(filterTasks(tasks, { priority: 'low', category: 'work' })).toEqual([])
  })
})

describe('sortTasks', () => {
  const tasks: Task[] = [
    makeTask({ id: '1', priority: 'low', due_date: '2026-02-25', created_at: '2026-01-03T00:00:00Z' }),
    makeTask({ id: '2', priority: 'high', due_date: '2026-02-20', created_at: '2026-01-01T00:00:00Z' }),
    makeTask({ id: '3', priority: 'medium', due_date: null, created_at: '2026-01-02T00:00:00Z' }),
  ]

  it('sorts by priority (high → medium → low)', () => {
    const result = sortTasks(tasks, 'priority')
    expect(result.map(t => t.priority)).toEqual(['high', 'medium', 'low'])
  })

  it('sorts by due_date ascending (nulls last)', () => {
    const result = sortTasks(tasks, 'due_date')
    expect(result.map(t => t.id)).toEqual(['2', '1', '3'])
  })

  it('sorts by created_at descending (newest first)', () => {
    const result = sortTasks(tasks, 'created_at')
    expect(result.map(t => t.id)).toEqual(['1', '3', '2'])
  })

  it('returns copy, does not mutate original', () => {
    const original = [...tasks]
    sortTasks(tasks, 'priority')
    expect(tasks).toEqual(original)
  })
})
