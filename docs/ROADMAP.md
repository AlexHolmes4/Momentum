# Momentum Roadmap

Project-level tracking of all features — done, in progress, planned, and ideas.
Updated at the end of each development session via `session-wrap-up`.

## Completed

| Feature | Design Doc | Notes |
|---------|-----------|-------|
| Frontend core (Sessions 1-14) | — | Goals, tasks, subtasks, dashboard, archive, auth, RLS, Cloudflare deployment |
| AI Assistant: API Scaffold | [ai-assistant-design.md](plans/2026-03-09-ai-assistant-design.md) | Session 1 — CORS, JWT auth, rate limiting, error handling, logging |

## In Progress / Next

| Feature | Design Doc | Status | Notes |
|---------|-----------|--------|-------|
| AI Assistant: SSE Chat Endpoint | [ai-assistant-design.md](plans/2026-03-09-ai-assistant-design.md) | **Next** | Session 2 — needs writing-plans first. Includes FluentValidation (deferred from Session 1) |
| AI Assistant: Propose Goals | [ai-assistant-design.md](plans/2026-03-09-ai-assistant-design.md) | Planned | Session 3 |
| AI Assistant: Frontend Chat UI | [ai-assistant-design.md](plans/2026-03-09-ai-assistant-design.md) | Planned | Session 4 |
| AI Assistant: Proposal Review UI | [ai-assistant-design.md](plans/2026-03-09-ai-assistant-design.md) | Planned | Session 5 |
| AI Assistant: MCP Server | [ai-assistant-design.md](plans/2026-03-09-ai-assistant-design.md) | Planned | Session 6 |
| AI Assistant: Eval Framework | [ai-assistant-design.md](plans/2026-03-09-ai-assistant-design.md) | Planned | Session 7 |
| AI Assistant: Azure Deployment | [ai-assistant-design.md](plans/2026-03-09-ai-assistant-design.md) | Planned | Session 8 |

## Ideas / Future

| Feature | Notes |
|---------|-------|
| OTP Code Auth Flow | Replace magic link with same-tab OTP for better UX |
| AI Usage Metering | Postman-style monthly token quotas with progressive warnings (design doc §13) |
| Email Summary | Stub exists at `src/app/api/send-summary/` — needs server runtime |
