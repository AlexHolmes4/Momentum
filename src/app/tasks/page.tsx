'use client'
import { useState, useMemo } from 'react'
import { useTasks } from '@/hooks/useTasks'
import { useGoals } from '@/hooks/useGoals'
import { filterTasks, sortTasks, type TaskFilters } from '@/lib/taskHelpers'
import { TaskCard } from '@/components/TaskCard'
import { CreateTaskForm } from '@/components/CreateTaskForm'
import { FilterBar } from '@/components/FilterBar'

export default function TasksPage() {
  const { tasks, loading, error, createTask, updateTask, deleteTask, completeTask } = useTasks()
  const { goals } = useGoals()
  const [showForm, setShowForm] = useState(false)
  const [filters, setFilters] = useState<TaskFilters>({})

  // Build goal name lookup: id -> title
  const goalMap = useMemo(
    () => Object.fromEntries(goals.map(g => [g.id, g.title])),
    [goals]
  )

  // Extract unique categories from tasks
  const categories = useMemo(
    () => [...new Set(tasks.map(t => t.category).filter((c): c is string => c !== null))].sort(),
    [tasks]
  )

  // Today string for due-date filtering
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  // Filter then sort
  const filtered = useMemo(() => {
    const f = filterTasks(tasks, filters, today)
    return sortTasks(f, 'priority')
  }, [tasks, filters, today])

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Tasks</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + Add Task
          </button>
        )}
      </div>

      {showForm && (
        <CreateTaskForm
          createTask={createTask}
          goals={goals}
          onCreated={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Filter bar */}
      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        goals={goals}
        categories={categories}
      />

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="animate-spin h-5 w-5" aria-hidden="true" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading tasks...
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">
          Failed to load tasks: {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && tasks.length === 0 && !showForm && (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg font-medium mb-1">No active tasks yet</p>
          <p className="text-sm">Create your first task to get started.</p>
        </div>
      )}

      {/* No filter results */}
      {!loading && !error && tasks.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-sm">No tasks match your filters.</p>
        </div>
      )}

      {/* Task list */}
      {!loading && !error && filtered.length > 0 && (
        <ul className="flex flex-col gap-4">
          {filtered.map(task => (
            <li key={task.id}>
              <TaskCard
                task={task}
                goalTitle={task.goal_id ? goalMap[task.goal_id] : undefined}
                goals={goals}
                onEdit={updateTask}
                onDelete={deleteTask}
                onComplete={completeTask}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
