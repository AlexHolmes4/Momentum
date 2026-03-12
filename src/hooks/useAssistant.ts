'use client'

import { useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// --- Types ---

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export interface ProposedTask {
  title: string
  priority: 'high' | 'medium' | 'low'
  dueDate: string | null
  category: string | null
}

export interface ProposedGoal {
  title: string
  description: string | null
  targetDate: string | null
  tasks: ProposedTask[]
}

export interface Proposal {
  goals: ProposedGoal[]
}

// --- Hook ---

export function useAssistant() {
  const [messages, setMessages] = useState<Message[]>([])
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sessionIdRef = useRef<string>(crypto.randomUUID())
  const isStreamingRef = useRef(false)

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isStreamingRef.current) return

    isStreamingRef.current = true
    setIsStreaming(true)
    setError(null)

    // Add user message
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
    }
    setMessages(prev => [...prev, userMsg])

    // Create placeholder assistant message
    const assistantMsgId = crypto.randomUUID()
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
    }
    setMessages(prev => [...prev, assistantMsg])

    try {
      // Get auth token
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) {
        setError('Session expired \u2014 please refresh')
        isStreamingRef.current = false
        setIsStreaming(false)
        return
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL
      const response = await fetch(`${apiUrl}/api/assistant/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          messages: [{ role: 'user', content: content.trim() }],
        }),
      })

      if (!response.ok) {
        if (response.status === 401) {
          setError('Session expired \u2014 please refresh')
        } else {
          setError("Couldn't connect to the assistant")
        }
        // Remove empty assistant message
        setMessages(prev => prev.filter(m => m.id !== assistantMsgId))
        isStreamingRef.current = false
        setIsStreaming(false)
        return
      }

      // Parse SSE stream
      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let currentEvent = ''
      let currentData = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()! // keep incomplete last line

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            currentData = line.slice(6)
          } else if (line === '') {
            // Empty line = end of SSE event
            if (currentData) {
              try {
                const parsed = JSON.parse(currentData)

                if (currentEvent === 'proposal') {
                  setProposal(parsed)
                } else if (currentEvent === 'done') {
                  // Stream complete — no action needed
                } else {
                  // Default event = token
                  if (parsed.type === 'token' && parsed.content) {
                    setMessages(prev =>
                      prev.map(m =>
                        m.id === assistantMsgId
                          ? { ...m, content: m.content + parsed.content }
                          : m
                      )
                    )
                  }
                }
              } catch {
                // Skip malformed JSON
              }
            }
            currentEvent = ''
            currentData = ''
          }
        }
      }
    } catch {
      setError("Couldn't connect to the assistant")
      // Remove empty assistant message on network error
      setMessages(prev => {
        const msg = prev.find(m => m.id === assistantMsgId)
        if (msg && msg.content === '') {
          return prev.filter(m => m.id !== assistantMsgId)
        }
        return prev
      })
    } finally {
      isStreamingRef.current = false
      setIsStreaming(false)
    }
  }, [])

  return {
    messages,
    proposal,
    setProposal,
    isStreaming,
    error,
    sendMessage,
  }
}
