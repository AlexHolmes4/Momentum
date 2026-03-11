# Skills Design Brief: Reference Context & Research

## Goal

Create two Claude Code **skills** (not just slash commands) that enhance any project with intelligent documentation reference management.

## Skill 1: `ref` — Pull Reference Context

**Trigger:** User discusses a technology topic that has entries in the project's reference docs, OR explicitly invokes `/ref <topic>`.

**Behavior:**
- Proactively detect when conversation topics match sections in `docs/*references*.md`
- Extract and surface only the relevant sections (links, notes, caveats)
- If no match found, suggest `/research-refs` to add coverage

**Scope:** Project-level (each project has its own reference docs)

## Skill 2: `research-refs` — Research & Add References

**Trigger:** User invokes `/research-refs <topic>` or asks to find latest docs on a technology.

**Behavior:**
- Web-search for official docs, SDKs, guides (prefer 2025+ content)
- Verify URLs resolve
- Deduplicate against existing entries
- Append to the project's reference file in its established format
- Summarize what was added

**Scope:** User-level (reusable across all projects). Should auto-detect the project's reference file location and format conventions.

## Key Difference from Commands

Skills have:
- **Trigger conditions** — can activate proactively, not just on explicit invocation
- **Tool access declarations** — specify which tools they need (Read, Glob, Grep, WebSearch, WebFetch, Edit)
- **Richer metadata** — descriptions shown in skill listings, context about when to use

## Open Questions for Implementation Session

1. What is the exact file format and registration mechanism for custom skills vs commands in Claude Code? (Research the latest Claude Code docs)
2. Can skills be distributed as a package/repo that multiple projects pull in?
3. Should `ref` be proactive (auto-trigger) or only on explicit invocation? Proactive is more useful but noisier.
4. Should `research-refs` support a `--dry-run` mode that shows what it would add before writing?
5. What's the right home for user-level skills that persist across cloud and local environments?

## Implementation Plan

1. Research current Claude Code skill format and capabilities (vs commands)
2. Build `ref` skill with proactive trigger detection
3. Build `research-refs` skill with web search, URL verification, dedup, and format detection
4. Test both in this project
5. Extract `research-refs` to user-level so it works across projects
