# Momentum — Future Enhancements

## Completed Features: Open Questions and Enhancements

Items discovered during implementation that were deferred. Grouped by the feature/session that surfaced them.

### API Session 1 — Scaffold
- [x] FluentValidation — done in Session 2 (ChatRequestValidator)
- [ ] Open question: Redis vs in-memory for conversation session state (single replica works for now)
- [ ] Open question: Model choice — Claude Sonnet vs Haiku, evals will determine (Session 7)

### API Session 3 — propose_goals + Proposal SSE
- [ ] Priority validation on ProposedTask — `string` accepts any value, not constrained to high/medium/low (validate before Supabase write)
- [ ] Real AI provider needed — `FunctionChoiceBehavior.Auto()` only activates with a real IChatCompletionService (Anthropic connector in future session)

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
