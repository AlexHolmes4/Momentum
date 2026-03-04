'use client'
import { useState } from 'react'
import { Goal } from '@/hooks/useGoals'
import { GoalProgressBar } from '@/components/GoalProgressBar'
import { EditGoalForm } from '@/components/EditGoalForm'
import type { Task } from '@/hooks/useTasks'

type Props = {
  goal: Goal
  progress: number // 0-100
  linkedTasks?: Task[]
  onEdit?: (id: string, input: { title?: string; description?: string; target_date?: string }) => Promise<Goal>
  onDelete?: (id: string) => Promise<void>
  onArchive?: (id: string) => Promise<Goal>
}

export function GoalCard({ goal, progress, linkedTasks, onEdit, onDelete, onArchive }: Props) {
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [expanded, setExpanded] = useState(false)

  if (editing && onEdit) {
    return (
      <EditGoalForm
        goal={goal}
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
        <p className="text-xs text-gray-500 mb-3">
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

      {/* Progress */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500">Progress</span>
          <span className="text-xs text-gray-400">{progress}%</span>
        </div>
        <GoalProgressBar progress={progress} />
      </div>

      {/* Linked tasks — expandable */}
      {linkedTasks && linkedTasks.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
          >
            <span className={`inline-block transition-transform ${expanded ? 'rotate-90' : ''}`}>&#9654;</span>
            {linkedTasks.length} linked task{linkedTasks.length !== 1 ? 's' : ''}
          </button>
          {expanded && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {linkedTasks.map(task => (
                <li
                  key={task.id}
                  className="flex items-center gap-2 text-sm text-gray-400 pl-4"
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    task.priority === 'high' ? 'bg-red-500' :
                    task.priority === 'medium' ? 'bg-amber-400' :
                    'bg-green-400'
                  }`} />
                  <span className="truncate">{task.title}</span>
                  {task.due_date && (
                    <span className="text-xs text-gray-600 shrink-0">
                      {new Date(task.due_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Delete confirmation bar */}
      {confirmingDelete && (
        <div className="flex items-center justify-between mt-4 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
          <span className="text-sm text-red-400">Delete this goal?</span>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (onDelete) await onDelete(goal.id)
              }}
              className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-md transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {(onEdit || onDelete || onArchive) && !confirmingDelete && (
        <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-gray-800">
          {onEdit && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Edit
            </button>
          )}
          {onArchive && (
            <button
              onClick={() => onArchive(goal.id)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Archive
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => setConfirmingDelete(true)}
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
