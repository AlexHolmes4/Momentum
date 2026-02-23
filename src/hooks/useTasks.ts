'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export type Task = {
  id: string
  title: string
  priority: 'high' | 'medium' | 'low'
  due_date: string | null
  category: string | null
  goal_id: string | null
  status: 'active' | 'completed'
  completed_at: string | null
  created_at: string
}

export type CreateTaskInput = {
  title: string
  priority?: 'high' | 'medium' | 'low'
  due_date?: string
  category?: string
  goal_id?: string | null
}

export type UpdateTaskInput = {
  title?: string
  priority?: 'high' | 'medium' | 'low'
  due_date?: string | null
  category?: string | null
  goal_id?: string | null
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('tasks')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    if (err) {
      setError(err.message)
    } else {
      setTasks(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const createTask = useCallback(async (input: CreateTaskInput): Promise<Task> => {
    const { data, error: err } = await supabase
      .from('tasks')
      .insert([{ ...input, status: 'active' }])
      .select()
      .single()
    if (err) throw err
    const task = data as Task
    setTasks(prev => [task, ...prev])
    return task
  }, [])

  const updateTask = useCallback(async (id: string, input: UpdateTaskInput): Promise<Task> => {
    const { data, error: err } = await supabase
      .from('tasks')
      .update(input)
      .eq('id', id)
      .select()
      .single()
    if (err) throw err
    const task = data as Task
    setTasks(prev => prev.map(t => (t.id === id ? task : t)))
    return task
  }, [])

  const deleteTask = useCallback(async (id: string): Promise<void> => {
    const { error: err } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
    if (err) throw err
    setTasks(prev => prev.filter(t => t.id !== id))
  }, [])

  const completeTask = useCallback(async (id: string): Promise<void> => {
    // Step 1: Fetch the task from Supabase
    const { data, error: fetchErr } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single()
    if (fetchErr) throw fetchErr
    const task = data as Task

    // Step 2: Insert into archived_tasks
    const { error: archiveErr } = await supabase
      .from('archived_tasks')
      .insert([{
        id: task.id,
        title: task.title,
        priority: task.priority,
        due_date: task.due_date,
        category: task.category,
        goal_id: task.goal_id,
        completed_at: new Date().toISOString(),
        original_created_at: task.created_at,
      }])
    if (archiveErr) throw archiveErr

    // Step 3: Delete from tasks
    const { error: deleteErr } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
    if (deleteErr) throw deleteErr

    // Step 4: Remove from local state
    setTasks(prev => prev.filter(t => t.id !== id))
  }, [])

  return {
    tasks,
    loading,
    error,
    createTask,
    updateTask,
    deleteTask,
    completeTask,
    refetch: fetchTasks,
  }
}
