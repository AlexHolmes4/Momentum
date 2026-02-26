'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export type Subtask = {
  id: string
  task_id: string
  title: string
  completed: boolean
}

export function useSubtasks(taskId: string) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSubtasks = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('subtasks')
      .select('*')
      .eq('task_id', taskId)
      .order('id', { ascending: true })
    if (err) {
      setError(err.message)
    } else {
      setSubtasks(data ?? [])
    }
    setLoading(false)
  }, [taskId])

  useEffect(() => {
    fetchSubtasks()
  }, [fetchSubtasks])

  const addSubtask = useCallback(async (title: string): Promise<Subtask> => {
    const { data, error: err } = await supabase
      .from('subtasks')
      .insert([{ task_id: taskId, title, completed: false }])
      .select()
      .single()
    if (err) throw err
    const subtask = data as Subtask
    setSubtasks(prev => [...prev, subtask])
    return subtask
  }, [taskId])

  const toggleSubtask = useCallback(async (id: string, completed: boolean): Promise<Subtask> => {
    const { data, error: err } = await supabase
      .from('subtasks')
      .update({ completed })
      .eq('id', id)
      .select()
      .single()
    if (err) throw err
    const subtask = data as Subtask
    setSubtasks(prev => prev.map(s => (s.id === id ? subtask : s)))
    return subtask
  }, [])

  const deleteSubtask = useCallback(async (id: string): Promise<void> => {
    const { error: err } = await supabase
      .from('subtasks')
      .delete()
      .eq('id', id)
    if (err) throw err
    setSubtasks(prev => prev.filter(s => s.id !== id))
  }, [])

  return { subtasks, loading, error, addSubtask, toggleSubtask, deleteSubtask, refetch: fetchSubtasks }
}
