'use client'
import { useSubtasks } from '@/hooks/useSubtasks'
import { SubtaskList } from '@/components/SubtaskList'

type Props = {
  taskId: string
  onAllComplete?: () => void
}

export function SubtaskListContainer({ taskId, onAllComplete }: Props) {
  const { subtasks, loading, addSubtask, toggleSubtask } = useSubtasks(taskId)

  return (
    <SubtaskList
      subtasks={subtasks}
      loading={loading}
      onAdd={addSubtask}
      onToggle={toggleSubtask}
      onAllComplete={onAllComplete}
    />
  )
}
