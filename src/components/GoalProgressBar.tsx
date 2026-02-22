'use client'

type Props = {
  progress: number // 0-100
}

export function GoalProgressBar({ progress }: Props) {
  const clamped = Math.min(100, Math.max(0, progress))
  return (
    <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
      <div
        className="h-full bg-indigo-500 rounded-full transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
