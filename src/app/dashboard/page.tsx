'use client'
import { useState, useMemo, FormEvent } from 'react'
import { useTasks } from '@/hooks/useTasks'
import { useGoals } from '@/hooks/useGoals'
import { calculateProgress } from '@/lib/goalHelpers'
import type { Task as GoalTask } from '@/lib/goalHelpers'
import { TaskCard } from '@/components/TaskCard'
import { GoalProgressBar } from '@/components/GoalProgressBar'

export default function DashboardPage() {
  const { tasks, loading: tasksLoading, error: tasksError, createTask, updateTask, deleteTask, completeTask } = useTasks()
  const { goals, loading: goalsLoading, error: goalsError } = useGoals()

  // Quick-add form state
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [qaTitle, setQaTitle] = useState('')
  const [qaPriority, setQaPriority] = useState<'high' | 'medium' | 'low'>('medium')
  const [qaDueDate, setQaDueDate] = useState('')
  const [qaSaving, setQaSaving] = useState(false)
  const [qaError, setQaError] = useState<string | null>(null)

  // Date filtering
  const today = useMemo(() => new Date().toISOString().split('T')[0], [])

  const overdueTasks = useMemo(
    () => tasks.filter(t => t.due_date != null && t.due_date < today),
    [tasks, today]
  )

  const todayTasks = useMemo(
    () => tasks.filter(t => t.due_date === today),
    [tasks, today]
  )

  // Goal name lookup for TaskCard
  const goalMap = useMemo(
    () => Object.fromEntries(goals.map(g => [g.id, g.title])),
    [goals]
  )

  // Quick-add submit handler
  async function handleQuickAdd(e: FormEvent) {
    e.preventDefault()
    if (!qaTitle.trim()) return
    setQaSaving(true)
    setQaError(null)
    try {
      await createTask({
        title: qaTitle.trim(),
        priority: qaPriority,
        due_date: qaDueDate || undefined,
      })
      setQaTitle('')
      setQaPriority('medium')
      setQaDueDate('')
      setShowQuickAdd(false)
    } catch (err) {
      setQaError(err instanceof Error ? err.message : 'Failed to create task')
    } finally {
      setQaSaving(false)
    }
  }

  const loading = tasksLoading || goalsLoading
  const error = tasksError || goalsError

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        {!showQuickAdd && (
          <button
            onClick={() => setShowQuickAdd(true)}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + Quick Add
          </button>
        )}
      </div>

      {/* Quick-Add Form (F034) */}
      {showQuickAdd && (
        <form
          onSubmit={handleQuickAdd}
          className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6"
        >
          <h3 className="text-white font-semibold mb-4">Quick Add Task</h3>

          {qaError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm mb-4">
              {qaError}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {/* Title */}
            <div>
              <label htmlFor="qa-title" className="block text-xs text-gray-400 mb-1">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                id="qa-title"
                type="text"
                value={qaTitle}
                onChange={e => setQaTitle(e.target.value)}
                placeholder="What needs to be done?"
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Priority + Due date row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="qa-priority" className="block text-xs text-gray-400 mb-1">Priority</label>
                <select
                  id="qa-priority"
                  value={qaPriority}
                  onChange={e => setQaPriority(e.target.value as 'high' | 'medium' | 'low')}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label htmlFor="qa-due-date" className="block text-xs text-gray-400 mb-1">Due date</label>
                <input
                  id="qa-due-date"
                  type="date"
                  value={qaDueDate}
                  onChange={e => setQaDueDate(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              disabled={qaSaving || !qaTitle.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {qaSaving ? 'Adding...' : 'Add Task'}
            </button>
            <button
              type="button"
              onClick={() => { setShowQuickAdd(false); setQaError(null); setQaTitle(''); setQaPriority('medium'); setQaDueDate('') }}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading dashboard…
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm mb-6">
          Failed to load data: {error}
        </div>
      )}

      {/* Dashboard sections — only render when data is loaded */}
      {!loading && !error && (
        <div className="flex flex-col gap-8">
          {/* Overdue Tasks Section (F032) */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold text-white">Overdue</h2>
              {overdueTasks.length > 0 && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                  {overdueTasks.length}
                </span>
              )}
            </div>

            {overdueTasks.length === 0 ? (
              <p className="text-sm text-gray-500">No overdue tasks</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {overdueTasks.map(task => (
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
          </section>

          {/* Today's Tasks Section (F031) */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold text-white">Today</h2>
              {todayTasks.length > 0 && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {todayTasks.length}
                </span>
              )}
            </div>

            {todayTasks.length === 0 ? (
              <p className="text-sm text-gray-500">Nothing due today</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {todayTasks.map(task => (
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
          </section>

          {/* Goals Overview Section (F033) */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold text-white">Goals</h2>
              {goals.length > 0 && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
                  {goals.length}
                </span>
              )}
            </div>

            {goals.length === 0 ? (
              <p className="text-sm text-gray-500">No active goals</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {goals.map(goal => {
                  const linkedTasks = tasks.filter(t => t.goal_id === goal.id)
                  const progress = calculateProgress(linkedTasks as GoalTask[])
                  return (
                    <li
                      key={goal.id}
                      className="bg-gray-900 border border-gray-800 rounded-xl p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-white font-medium text-sm">{goal.title}</h3>
                        <span className="text-xs text-gray-400">{progress}%</span>
                      </div>
                      <GoalProgressBar progress={progress} />
                      {goal.target_date && (
                        <p className="text-xs text-gray-500 mt-2">
                          Target:{' '}
                          <span className="text-gray-400">
                            {new Date(goal.target_date).toLocaleDateString('en-AU', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
