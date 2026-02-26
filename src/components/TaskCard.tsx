'use client'
import { useState } from 'react'
import type { Task, UpdateTaskInput } from '@/hooks/useTasks'
import type { Goal } from '@/hooks/useGoals'
import { EditTaskForm } from '@/components/EditTaskForm'

const PRIORITY_STYLES: Record<string, string> = {
  high:   'text-red-500 bg-red-500/10 border-red-500/20',
  medium: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  low:    'text-green-400 bg-green-400/10 border-green-400/20',
}

type Props = {
  task: Task
  goalTitle?: string
  goals?: Goal[]
  onEdit?: (id: string, input: UpdateTaskInput) => Promise<unknown>
  onDelete?: (id: string) => Promise<void>
  onComplete?: (id: string) => Promise<void>
}

export function TaskCard({ task, goalTitle, goals, onEdit, onDelete, onComplete }: Props) {
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState<'none' | 'complete' | 'delete'>('none')

  if (editing && onEdit) {
    return (
      <EditTaskForm
        task={task}
        goals={goals ?? []}
        onSave={async (id, input) => {
          await onEdit(id, input)
          setEditing(false)
        }}
        onCancel={() => setEditing(false)}
      />
    )
  }

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

      {/* Complete confirmation bar */}
      {confirming === 'complete' && (
        <div className="flex items-center justify-between mt-4 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
          <span className="text-sm text-green-400">Mark task complete?</span>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (onComplete) await onComplete(task.id)
              }}
              className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-xs font-medium rounded-md transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirming('none')}
              className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation bar */}
      {confirming === 'delete' && (
        <div className="flex items-center justify-between mt-4 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
          <span className="text-sm text-red-400">Delete this task?</span>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (onDelete) await onDelete(task.id)
              }}
              className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-md transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirming('none')}
              className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {(onEdit || onDelete || onComplete) && confirming === 'none' && (
        <div className="flex gap-3 mt-4 pt-3 border-t border-gray-800">
          {onComplete && (
            <button
              onClick={() => setConfirming('complete')}
              className="text-xs text-gray-500 hover:text-green-400 transition-colors"
            >
              Complete
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => setConfirming('delete')}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  )
}
