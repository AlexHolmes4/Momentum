'use client'
import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Goal } from '@/hooks/useGoals'

export type ArchivedTask = {
  id: string
  title: string
  priority: 'high' | 'medium' | 'low'
  due_date: string | null
  category: string | null
  goal_id: string | null
  completed_at: string | null
  original_created_at: string | null
}

export function useArchive() {
  const [archivedTasks, setArchivedTasks] = useState<ArchivedTask[]>([])
  const [archivedGoals, setArchivedGoals] = useState<Goal[]>([])
  const [goalMap, setGoalMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchArchive = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [tasksRes, goalsRes, allGoalsRes] = await Promise.all([
      supabase
        .from('archived_tasks')
        .select('*')
        .order('completed_at', { ascending: false }),
      supabase
        .from('goals')
        .select('*')
        .in('status', ['archived', 'completed'])
        .order('created_at', { ascending: false }),
      supabase
        .from('goals')
        .select('id, title'),
    ])

    if (tasksRes.error) {
      setError(tasksRes.error.message)
      setLoading(false)
      return
    }
    if (goalsRes.error) {
      setError(goalsRes.error.message)
      setLoading(false)
      return
    }

    setArchivedTasks(tasksRes.data ?? [])
    setArchivedGoals((goalsRes.data ?? []) as Goal[])

    // Build goalMap from all goals for name resolution on archived tasks
    if (allGoalsRes.error) {
      console.warn('Failed to load goal map for archive:', allGoalsRes.error.message)
    }
    const map: Record<string, string> = {}
    for (const g of (allGoalsRes.data ?? [])) {
      map[g.id] = g.title
    }
    setGoalMap(map)

    setLoading(false)
  }, [])

  return { archivedTasks, archivedGoals, goalMap, loading, error, fetchArchive }
}
