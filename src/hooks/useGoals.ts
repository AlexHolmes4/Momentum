'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/components/AuthProvider'

export type Goal = {
  id: string
  title: string
  description: string | null
  target_date: string | null
  status: 'active' | 'completed' | 'archived'
  created_at: string
}

type CreateGoalInput = {
  title: string
  description?: string
  target_date?: string
}

type UpdateGoalInput = {
  title?: string
  description?: string
  target_date?: string
  status?: 'active' | 'completed' | 'archived'
}

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuthContext()

  const fetchGoals = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('goals')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    if (err) {
      setError(err.message)
    } else {
      setGoals(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchGoals()
  }, [fetchGoals])

  const createGoal = useCallback(async (input: CreateGoalInput): Promise<Goal> => {
    const { data, error: err } = await supabase
      .from('goals')
      .insert([{ ...input, status: 'active', user_id: user!.id }])
      .select()
      .single()
    if (err) throw err
    const goal = data as Goal
    setGoals(prev => [goal, ...prev])
    return goal
  }, [])

  const updateGoal = useCallback(async (id: string, input: UpdateGoalInput): Promise<Goal> => {
    const { data, error: err } = await supabase
      .from('goals')
      .update(input)
      .eq('id', id)
      .select()
      .single()
    if (err) throw err
    const goal = data as Goal
    setGoals(prev => prev.map(g => (g.id === id ? goal : g)))
    return goal
  }, [])

  const deleteGoal = useCallback(async (id: string): Promise<void> => {
    const { error: err } = await supabase
      .from('goals')
      .delete()
      .eq('id', id)
    if (err) throw err
    setGoals(prev => prev.filter(g => g.id !== id))
  }, [])

  // Sets status to 'archived' and removes from active list
  const archiveGoal = useCallback(async (id: string): Promise<Goal> => {
    const { data, error: err } = await supabase
      .from('goals')
      .update({ status: 'archived' })
      .eq('id', id)
      .select()
      .single()
    if (err) throw err
    const goal = data as Goal
    setGoals(prev => prev.filter(g => g.id !== id))
    return goal
  }, [])

  return {
    goals,
    loading,
    error,
    createGoal,
    updateGoal,
    deleteGoal,
    archiveGoal,
    refetch: fetchGoals,
  }
}
