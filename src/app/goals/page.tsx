'use client'
import { useGoals } from '@/hooks/useGoals'

export default function GoalsPage() {
  const { goals, loading, error } = useGoals()

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Goals</h1>

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
      {!loading && !error && goals.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg font-medium mb-1">No active goals yet</p>
          <p className="text-sm">Add your first goal to get started.</p>
        </div>
      )}

      {/* Goals list */}
      {!loading && !error && goals.length > 0 && (
        <ul className="flex flex-col gap-4">
          {goals.map(goal => (
            <li
              key={goal.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5"
            >
              {/* Title + status badge */}
              <div className="flex items-start justify-between gap-4 mb-1">
                <h2 className="text-white font-semibold text-base leading-snug">
                  {goal.title}
                </h2>
                <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
                  {goal.status}
                </span>
              </div>

              {/* Description */}
              {goal.description && (
                <p className="text-gray-400 text-sm mb-3">{goal.description}</p>
              )}

              {/* Target date */}
              {goal.target_date && (
                <p className="text-xs text-gray-500">
                  Target:{' '}
                  <span className="text-gray-300">
                    {new Date(goal.target_date).toLocaleDateString('en-AU', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
