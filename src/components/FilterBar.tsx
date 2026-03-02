'use client'

import type { TaskFilters } from '@/lib/taskHelpers'
import type { Goal } from '@/hooks/useGoals'

type FilterBarProps = {
  filters: TaskFilters
  onFiltersChange: (filters: TaskFilters) => void
  goals: Goal[]
  categories: string[]
}

export function FilterBar({ filters, onFiltersChange, goals, categories }: FilterBarProps) {
  const hasActiveFilters = !!(filters.priority || filters.goalId || filters.category || filters.dueDateRange || filters.search)

  const update = (patch: Partial<TaskFilters>) => {
    onFiltersChange({ ...filters, ...patch })
  }

  const clearAll = () => {
    onFiltersChange({})
  }

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      {/* Search */}
      <input
        type="text"
        placeholder="Search tasks..."
        value={filters.search ?? ''}
        onChange={e => update({ search: e.target.value || undefined })}
        className="bg-gray-800 text-white text-sm rounded-lg px-3 py-1.5 placeholder-gray-500 border border-gray-700 focus:border-indigo-500 focus:outline-none min-w-[180px]"
      />

      {/* Priority */}
      <select
        value={filters.priority ?? ''}
        onChange={e => update({ priority: (e.target.value || undefined) as TaskFilters['priority'] })}
        className="bg-gray-800 text-gray-300 text-sm rounded-lg px-3 py-1.5 border border-gray-700 focus:border-indigo-500 focus:outline-none"
      >
        <option value="">All priorities</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>

      {/* Goal */}
      <select
        value={filters.goalId ?? ''}
        onChange={e => update({ goalId: e.target.value || undefined })}
        className="bg-gray-800 text-gray-300 text-sm rounded-lg px-3 py-1.5 border border-gray-700 focus:border-indigo-500 focus:outline-none"
      >
        <option value="">All goals</option>
        {goals.map(g => (
          <option key={g.id} value={g.id}>{g.title}</option>
        ))}
      </select>

      {/* Category */}
      <select
        value={filters.category ?? ''}
        onChange={e => update({ category: e.target.value || undefined })}
        className="bg-gray-800 text-gray-300 text-sm rounded-lg px-3 py-1.5 border border-gray-700 focus:border-indigo-500 focus:outline-none"
      >
        <option value="">All categories</option>
        {categories.map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {/* Due date range */}
      <select
        value={filters.dueDateRange ?? ''}
        onChange={e => update({ dueDateRange: (e.target.value || undefined) as TaskFilters['dueDateRange'] })}
        className="bg-gray-800 text-gray-300 text-sm rounded-lg px-3 py-1.5 border border-gray-700 focus:border-indigo-500 focus:outline-none"
      >
        <option value="">All dates</option>
        <option value="today">Today</option>
        <option value="this_week">This week</option>
        <option value="overdue">Overdue</option>
      </select>

      {/* Clear all */}
      {hasActiveFilters && (
        <button
          onClick={clearAll}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Clear all
        </button>
      )}
    </div>
  )
}
