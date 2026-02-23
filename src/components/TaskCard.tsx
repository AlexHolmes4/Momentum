'use client'
import type { Task } from '@/hooks/useTasks'

const PRIORITY_STYLES: Record<string, string> = {
  high:   'text-red-500 bg-red-500/10 border-red-500/20',
  medium: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  low:    'text-green-400 bg-green-400/10 border-green-400/20',
}

type Props = {
  task: Task
  goalTitle?: string
}

export function TaskCard({ task, goalTitle }: Props) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      {/* Row 1: Title + priority badge */}
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-white font-semibold text-base leading-snug">
          {task.title}
        </h3>
        <span
          className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border ${
            PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.low
          }`}
        >
          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
        </span>
      </div>

      {/* Row 2: Metadata */}
      {(task.due_date || task.category || goalTitle) && (
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {task.due_date && (
            <span className="text-xs text-gray-500">
              Due:{' '}
              <span className="text-gray-300">
                {new Date(task.due_date).toLocaleDateString('en-AU', {
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
            </span>
          )}
          {task.category && (
            <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
              {task.category}
            </span>
          )}
          {goalTitle && (
            <span className="text-xs text-indigo-400">
              → {goalTitle}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
