'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Proposal, ProposedGoal, ProposedTask } from '@/hooks/useAssistant'

type Props = {
  proposal: Proposal
  onProposalChange: (proposal: Proposal) => void
  createGoal: (input: {
    title: string
    description?: string
    target_date?: string
  }) => Promise<{ id: string }>
  createTask: (input: {
    title: string
    priority?: 'high' | 'medium' | 'low'
    due_date?: string
    category?: string
    goal_id?: string | null
  }) => Promise<unknown>
}

export default function ProposalReview({
  proposal,
  onProposalChange,
  createGoal,
  createTask,
}: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateGoal = (goalIdx: number, updates: Partial<ProposedGoal>) => {
    const goals = proposal.goals.map((g, i) =>
      i === goalIdx ? { ...g, ...updates } : g
    )
    onProposalChange({ goals })
  }

  const deleteGoal = (goalIdx: number) => {
    onProposalChange({ goals: proposal.goals.filter((_, i) => i !== goalIdx) })
  }

  const addGoal = () => {
    const newGoal: ProposedGoal = {
      title: '',
      description: null,
      targetDate: null,
      tasks: [],
    }
    onProposalChange({ goals: [...proposal.goals, newGoal] })
  }

  const updateTask = (goalIdx: number, taskIdx: number, updates: Partial<ProposedTask>) => {
    const goals = proposal.goals.map((g, gi) => {
      if (gi !== goalIdx) return g
      const tasks = g.tasks.map((t, ti) =>
        ti === taskIdx ? { ...t, ...updates } : t
      )
      return { ...g, tasks }
    })
    onProposalChange({ goals })
  }

  const deleteTask = (goalIdx: number, taskIdx: number) => {
    const goals = proposal.goals.map((g, gi) => {
      if (gi !== goalIdx) return g
      return { ...g, tasks: g.tasks.filter((_, ti) => ti !== taskIdx) }
    })
    onProposalChange({ goals })
  }

  const addTask = (goalIdx: number) => {
    const newTask: ProposedTask = {
      title: '',
      priority: 'medium',
      dueDate: null,
      category: null,
    }
    const goals = proposal.goals.map((g, gi) => {
      if (gi !== goalIdx) return g
      return { ...g, tasks: [...g.tasks, newTask] }
    })
    onProposalChange({ goals })
  }

  const handleConfirm = async () => {
    setSaving(true)
    setError(null)

    try {
      for (const goal of proposal.goals) {
        if (!goal.title.trim()) continue

        const created = await createGoal({
          title: goal.title.trim(),
          description: goal.description?.trim() || undefined,
          target_date: goal.targetDate || undefined,
        })

        for (const task of goal.tasks) {
          if (!task.title.trim()) continue

          await createTask({
            title: task.title.trim(),
            priority: task.priority,
            due_date: task.dueDate || undefined,
            category: task.category?.trim() || undefined,
            goal_id: created.id,
          })
        }
      }

      router.push('/goals')
    } catch {
      setError('Failed to create goals \u2014 please try again')
    } finally {
      setSaving(false)
    }
  }

  const hasContent = proposal.goals.some(g => g.title.trim())

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Proposed Goals</h2>
        <button
          onClick={addGoal}
          className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          + Add Goal
        </button>
      </div>

      {proposal.goals.map((goal, gi) => (
        <div key={gi} className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
          {/* Goal fields */}
          <div className="flex items-start gap-2">
            <input
              type="text"
              value={goal.title}
              onChange={e => updateGoal(gi, { title: e.target.value })}
              placeholder="Goal title"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              onClick={() => deleteGoal(gi)}
              className="text-gray-500 hover:text-red-400 text-sm px-2 py-2 transition-colors"
              title="Delete goal"
            >
              &#x2715;
            </button>
          </div>

          <textarea
            value={goal.description ?? ''}
            onChange={e => updateGoal(gi, { description: e.target.value || null })}
            placeholder="Description (optional)"
            rows={2}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />

          <input
            type="date"
            value={goal.targetDate ?? ''}
            onChange={e => updateGoal(gi, { targetDate: e.target.value || null })}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />

          {/* Tasks */}
          <div className="space-y-2 pl-4 border-l-2 border-gray-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Tasks</span>
              <button
                onClick={() => addTask(gi)}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                + Add Task
              </button>
            </div>

            {goal.tasks.map((task, ti) => (
              <div key={ti} className="flex items-center gap-2">
                <input
                  type="text"
                  value={task.title}
                  onChange={e => updateTask(gi, ti, { title: e.target.value })}
                  placeholder="Task title"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <select
                  value={task.priority}
                  onChange={e => updateTask(gi, ti, { priority: e.target.value as ProposedTask['priority'] })}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <input
                  type="date"
                  value={task.dueDate ?? ''}
                  onChange={e => updateTask(gi, ti, { dueDate: e.target.value || null })}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <input
                  type="text"
                  value={task.category ?? ''}
                  onChange={e => updateTask(gi, ti, { category: e.target.value || null })}
                  placeholder="Category"
                  className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onClick={() => deleteTask(gi, ti)}
                  className="text-gray-500 hover:text-red-400 text-sm px-1 transition-colors"
                  title="Delete task"
                >
                  &#x2715;
                </button>
              </div>
            ))}

            {goal.tasks.length === 0 && (
              <p className="text-xs text-gray-600 italic">No tasks yet</p>
            )}
          </div>
        </div>
      ))}

      {/* Error */}
      {error && (
        <div className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Confirm button */}
      <button
        onClick={handleConfirm}
        disabled={saving || !hasContent}
        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white text-sm font-medium rounded-lg px-4 py-3 transition-colors"
      >
        {saving ? 'Creating...' : 'Create in Momentum'}
      </button>
    </div>
  )
}
