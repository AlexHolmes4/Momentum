// src/app/api/send-summary/route.ts
//
// Email Summary Stub — MCP Integration Hook
//
// DEPLOYMENT NOTE: Next.js API routes require a server runtime.
// This file does NOT work with `output: 'export'` (static site).
// To enable this route, switch to @cloudflare/next-on-pages adapter:
//   npm install --save-dev @cloudflare/next-on-pages
//   Build command: npx @cloudflare/next-on-pages
//   Output directory: .vercel/output/static
//
// Future wiring: Replace console.log with Resend/SendGrid/Gmail API via MCP.
// MCP Hook: Claude can trigger this via Supabase MCP + a webhook, or directly
// by calling this endpoint when deployed with Workers runtime.

// Required for static export compatibility — generates a static JSON file at build time.
// Remove this line when switching to @cloudflare/next-on-pages server runtime.
export const dynamic = 'force-static'

export async function GET() {
  // TODO: fetch from Supabase and build real summary
  const summary = {
    generated_at: new Date().toISOString(),
    active_goals: 0,
    active_tasks: 0,
    overdue_tasks: 0,
    message: 'Email summary stub — wire to Resend/SendGrid to activate',
  }

  console.log('[send-summary]', summary)

  return Response.json(summary)
}
