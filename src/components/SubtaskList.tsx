'use client'
import { useState } from 'react'
import type { Subtask } from '@/hooks/useSubtasks'

type SubtaskListProps = {
  subtasks: Subtask[]
  loading: boolean
  onAdd: (title: string) => Promise<unknown>
  onToggle: (id: string, completed: boolean) => Promise<unknown>
  onAllComplete?: () => void
}

export function SubtaskList({ subtasks, loading, onAdd, onToggle, onAllComplete }: SubtaskListProps) {
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)

  const handleAdd = async () => {
    const trimmed = newTitle.trim()
    if (!trimmed) return
    setAdding(true)
    try {
      await onAdd(trimmed)
      setNewTitle('')
    } finally {
      setAdding(false)
    }
  }

  const handleToggle = async (subtask: Subtask) => {
    const newCompleted = !subtask.completed
    await onToggle(subtask.id, newCompleted)

    // After toggling, check if ALL subtasks are now completed
    // We check the current list with this one flipped
    if (newCompleted && onAllComplete) {
      const allDone = subtasks.every(s =>
        s.id === subtask.id ? true : s.completed
      )
      if (allDone) onAllComplete()
    }
  }

  if (loading) {
    return (
      <div className="text-xs text-gray-500 py-2">Loading subtasks...</div>
    )
  }

  return (
    <div className="mt-3 bg-gray-800/50 rounded-lg p-3 space-y-2">
      {/* Subtask checkboxes */}
      {subtasks.length > 0 && (
        <ul className="space-y-1.5">
          {subtasks.map(subtask => (
            <li key={subtask.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={subtask.completed}
                onChange={() => handleToggle(subtask)}
                className="accent-indigo-500 rounded"
              />
              <span className={`text-sm ${subtask.completed ? 'line-through text-gray-600' : 'text-gray-300'}`}>
                {subtask.title}
              </span>
            </li>
          ))}
        </ul>
      )}

      {subtasks.length === 0 && (
        <p className="text-xs text-gray-600">No subtasks yet.</p>
      )}

      {/* Add subtask input */}
      <div className="flex gap-2 pt-1">
        <input
          type="text"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          placeholder="Add a subtask..."
          className="flex-1 bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-md px-2.5 py-1.5 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !newTitle.trim()}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded-md transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  )
}
