'use client'
import { Goal } from '@/hooks/useGoals'
import { GoalProgressBar } from '@/components/GoalProgressBar'

type Props = {
  goal: Goal
  progress: number // 0-100
}

export function GoalCard({ goal, progress }: Props) {
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
    </div>
  )
}
