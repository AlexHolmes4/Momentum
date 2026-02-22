// src/lib/supabase.ts
// Browser-side Supabase client using @supabase/ssr — the Supabase-recommended
// approach for Next.js projects (matches the official with-supabase template).
//
// Uses the new publishable key (sb_publishable_...) instead of the legacy anon JWT key.
// Get your publishable key from: Supabase dashboard → Settings → API Keys → Publishable key
//
// MCP Hook: Claude's Supabase MCP connector reads the same database directly —
// schema is designed to support intuitive natural-language queries via claude.ai.
import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase env vars. Copy .env.example → .env.local and add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
  )
}

// Singleton browser client — safe for static export (all queries are client-side).
export const supabase = createBrowserClient(supabaseUrl, supabaseKey)
