'use client'
import { useMemo } from 'react'
import { useTasks } from '@/hooks/useTasks'
import { useGoals } from '@/hooks/useGoals'
import { sortTasks } from '@/lib/taskHelpers'
import { TaskCard } from '@/components/TaskCard'

export default function TasksPage() {
  const { tasks, loading, error } = useTasks()
  const { goals } = useGoals()

  // Build goal name lookup: id → title
  const goalMap = useMemo(
    () => Object.fromEntries(goals.map(g => [g.id, g.title])),
    [goals]
  )

  // Default sort: priority (high → medium → low)
  const sorted = useMemo(() => sortTasks(tasks, 'priority'), [tasks])

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Tasks</h1>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading tasks…
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">
          Failed to load tasks: {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && tasks.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg font-medium mb-1">No active tasks yet</p>
          <p className="text-sm">Create your first task to get started.</p>
        </div>
      )}

      {/* Task list */}
      {!loading && !error && sorted.length > 0 && (
        <ul className="flex flex-col gap-4">
          {sorted.map(task => (
            <li key={task.id}>
              <TaskCard
                task={task}
                goalTitle={task.goal_id ? goalMap[task.goal_id] : undefined}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
