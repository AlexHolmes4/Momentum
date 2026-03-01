'use client'
import { useState, useMemo } from 'react'
import { useGoals } from '@/hooks/useGoals'
import { GoalCard } from '@/components/GoalCard'
import { CreateGoalForm } from '@/components/CreateGoalForm'
import { useTasks } from '@/hooks/useTasks'
import { calculateProgress } from '@/lib/goalHelpers'
import type { Task as GoalTask } from '@/lib/goalHelpers'

export default function GoalsPage() {
  const { goals, loading, error, createGoal, updateGoal, deleteGoal, archiveGoal } = useGoals()
  const { tasks } = useTasks()
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')

  const filteredGoals = useMemo(() => {
    if (!search.trim()) return goals
    const term = search.toLowerCase()
    return goals.filter(g =>
      g.title.toLowerCase().includes(term) ||
      (g.description && g.description.toLowerCase().includes(term))
    )
  }, [goals, search])

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Goals</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + Add Goal
          </button>
        )}
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search goals..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-gray-800 text-white text-sm rounded-lg px-3 py-1.5 placeholder-gray-500 border border-gray-700 focus:border-indigo-500 focus:outline-none w-full max-w-xs"
        />
      </div>

      {showForm && (
        <CreateGoalForm
          createGoal={createGoal}
          onCreated={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading goals…
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">
          Failed to load goals: {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && goals.length === 0 && !showForm && (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg font-medium mb-1">No active goals yet</p>
          <p className="text-sm">Add your first goal to get started.</p>
        </div>
      )}

      {/* No search results */}
      {!loading && !error && goals.length > 0 && filteredGoals.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-sm">No goals match your search.</p>
        </div>
      )}

      {/* Goals list */}
      {!loading && !error && filteredGoals.length > 0 && (
        <ul className="flex flex-col gap-4">
          {filteredGoals.map(goal => {
            const linkedTasks = tasks.filter(t => t.goal_id === goal.id)
            const progress = calculateProgress(linkedTasks as GoalTask[])
            return (
              <li key={goal.id}>
                <GoalCard
                  goal={goal}
                  progress={progress}
                  linkedTasks={linkedTasks}
                  onEdit={updateGoal}
                  onDelete={deleteGoal}
                  onArchive={archiveGoal}
                />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
