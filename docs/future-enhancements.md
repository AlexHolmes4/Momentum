# Momentum — Future Enhancements

## Completed Features: Open Questions and Enhancements

Items discovered during implementation that were deferred. Grouped by the feature/session that surfaced them.

### API Session 1 — Scaffold
- [ ] FluentValidation — deferred to Session 2 (no DTOs yet)
- [ ] Open question: Redis vs in-memory for conversation session state (single replica works for now)
- [ ] Open question: Model choice — Claude Sonnet vs Haiku, evals will determine (Session 7)

### Frontend Session 8 — Subtasks
- [ ] UUID ordering for subtasks is stable but not strictly chronological (schema improvement)
- [ ] No subtask delete UI (hook method exists)

### Frontend Session 7 — Task Actions
- [ ] Async confirm buttons (complete/delete) have no error feedback

### Frontend Session 9 — Dashboard
- [ ] Goal progress always 0% on dashboard (completed tasks are archived, only active tasks counted)

## Future Enhancements

New ideas and features not yet tied to implementation sessions.

- [ ] OTP Code Auth Flow — replace magic link with same-tab OTP for better UX
- [ ] AI Usage Metering — Postman-style monthly token quotas with progressive warnings (design doc §13)
- [ ] Email Summary — stub exists at `src/app/api/send-summary/`, needs server runtime (Cloudflare Worker + Resend/SendGrid)
