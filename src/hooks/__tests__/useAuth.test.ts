import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted so these refs are available inside the vi.mock factory,
// which Vitest hoists to the top of the module before any imports run.
const { mockGetSession, mockOnAuthStateChange, mockSignInWithOtp, mockSignOut, mockVerifyOtp } =
  vi.hoisted(() => ({
    mockGetSession: vi.fn(),
    mockOnAuthStateChange: vi.fn(),
    mockSignInWithOtp: vi.fn(),
    mockSignOut: vi.fn(),
    mockVerifyOtp: vi.fn(),
  }))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signInWithOtp: mockSignInWithOtp,
      signOut: mockSignOut,
      verifyOtp: mockVerifyOtp,
    },
  },
}))

import { renderHook, act, waitFor } from '@testing-library/react'
import { useAuth } from '../useAuth'

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
  })

  it('starts in loading state', () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current.loading).toBe(true)
    expect(result.current.user).toBeNull()
  })

  it('resolves to no user when session is null', async () => {
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toBeNull()
  })

  it('resolves to user when session exists', async () => {
    const fakeUser = { id: 'user-123', email: 'test@example.com' }
    mockGetSession.mockResolvedValue({
      data: { session: { user: fakeUser } },
      error: null,
    })
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toEqual(fakeUser)
  })

  it('signIn calls signInWithOtp with email', async () => {
    mockSignInWithOtp.mockResolvedValue({ data: {}, error: null })
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.signIn('test@example.com')
    })
    expect(mockSignInWithOtp).toHaveBeenCalledWith({ email: 'test@example.com' })
  })

  it('signIn throws on error', async () => {
    mockSignInWithOtp.mockResolvedValue({
      data: null,
      error: { message: 'Rate limit exceeded' },
    })
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await expect(
      act(async () => {
        await result.current.signIn('test@example.com')
      })
    ).rejects.toThrow('Rate limit exceeded')
  })

  it('signOut calls supabase signOut', async () => {
    mockSignOut.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.signOut()
    })
    expect(mockSignOut).toHaveBeenCalled()
  })

  it('verifyOtp calls supabase verifyOtp with email, token, and type email', async () => {
    mockVerifyOtp.mockResolvedValue({ data: {}, error: null })
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.verifyOtp('test@example.com', '123456')
    })
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: 'test@example.com',
      token: '123456',
      type: 'email',
    })
  })

  it('verifyOtp throws on error', async () => {
    mockVerifyOtp.mockResolvedValue({
      data: null,
      error: { message: 'Token has expired or is invalid' },
    })
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await expect(
      act(async () => {
        await result.current.verifyOtp('test@example.com', '000000')
      })
    ).rejects.toThrow('Token has expired or is invalid')
  })
})
