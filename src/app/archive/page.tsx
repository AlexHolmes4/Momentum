'use client'
import { useEffect } from 'react'
import { useArchive } from '@/hooks/useArchive'
import type { ArchivedTask } from '@/hooks/useArchive'

const PRIORITY_STYLES: Record<string, string> = {
  high:   'text-red-500 bg-red-500/10 border-red-500/20',
  medium: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  low:    'text-green-400 bg-green-400/10 border-green-400/20',
}

const STATUS_STYLES: Record<string, string> = {
  archived:  'text-gray-400 bg-gray-400/10 border-gray-400/20',
  completed: 'text-green-400 bg-green-400/10 border-green-400/20',
}

function ArchivedTaskCard({ task, goalName }: { task: ArchivedTask; goalName?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-white font-semibold text-base leading-snug">{task.title}</h3>
        <span
          className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border ${
            PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.low
          }`}
        >
          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
        </span>
      </div>

      <div className="flex items-center gap-3 mt-2 flex-wrap">
        {task.completed_at && (
          <span className="text-xs text-gray-500">
            Completed:{' '}
            <span className="text-gray-300">
              {new Date(task.completed_at).toLocaleDateString('en-AU', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </span>
        )}
        {task.category && (
          <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
            {task.category}
          </span>
        )}
        {goalName && (
          <span className="text-xs text-indigo-400">→ {goalName}</span>
        )}
      </div>
    </div>
  )
}

function ArchivedGoalCard({ goal }: { goal: { id: string; title: string; description: string | null; target_date: string | null; status: string } }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h3 className="text-white font-semibold text-base leading-snug">{goal.title}</h3>
        <span
          className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border ${
            STATUS_STYLES[goal.status] ?? STATUS_STYLES.archived
          }`}
        >
          {goal.status.charAt(0).toUpperCase() + goal.status.slice(1)}
        </span>
      </div>

      {goal.description && (
        <p className="text-gray-400 text-sm mt-1 line-clamp-2">{goal.description}</p>
      )}

      {goal.target_date && (
        <p className="text-xs text-gray-500 mt-2">
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
    </div>
  )
}

export default function ArchivePage() {
  const { archivedTasks, archivedGoals, goalMap, loading, error, fetchArchive } = useArchive()

  useEffect(() => {
    fetchArchive()
  }, [fetchArchive])

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Archive</h1>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="animate-spin h-5 w-5" aria-hidden="true" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading archive…
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">
          Failed to load archive: {error}
        </div>
      )}

      {/* Content */}
      {!loading && !error && (
        <>
          {/* Archived Tasks section */}
          <section className="mb-10">
            <h2 className="text-lg font-semibold text-gray-300 mb-4">
              Archived Tasks
              {archivedTasks.length > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500">({archivedTasks.length})</span>
              )}
            </h2>

            {archivedTasks.length === 0 ? (
              <p className="text-gray-500 text-sm py-8 text-center">No archived tasks yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {archivedTasks.map(task => (
                  <li key={task.id}>
                    <ArchivedTaskCard
                      task={task}
                      goalName={task.goal_id ? goalMap[task.goal_id] : undefined}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Archived Goals section */}
          <section>
            <h2 className="text-lg font-semibold text-gray-300 mb-4">
              Archived Goals
              {archivedGoals.length > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500">({archivedGoals.length})</span>
              )}
            </h2>

            {archivedGoals.length === 0 ? (
              <p className="text-gray-500 text-sm py-8 text-center">No archived goals yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {archivedGoals.map(goal => (
                  <li key={goal.id}>
                    <ArchivedGoalCard goal={goal} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
