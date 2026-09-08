---
name: claude-mid-conversation-controls
description: Adjust Claude's thinking effort, inject one-turn-only system
             instructions, and show live progress updates during a long
             multi-turn or agentic conversation via the Claude API — all
             without invalidating the prompt cache. Reach for this when
             building an agent loop that runs many turns/tool calls and
             needs to change behavior mid-run cheaply.
---

# Mid-conversation controls for long Claude API sessions

Three beta Claude API features (shipped 2026-08-18 through 2026-09-01) let a
long-running agent change how Claude behaves *mid-conversation* — without
re-sending the system prompt or breaking prompt caching, which a normal
system-prompt edit would do. Use them together when an agent loop runs many
turns/tool calls and needs cheaper turns, one-off instructions, or visible
progress.

## When to reach for this

- The agent has been thinking hard (high effort) but the remaining steps are
  mechanical — drop effort for the rest of the run without a new cache prefix.
- You need to inject a one-time instruction ("the next tool result is
  truncated, ask before retrying") without it lingering in every later turn.
- A tool-call-heavy turn is slow and the UI needs a short status string
  instead of (or in addition to) full extended-thinking output.

## Steps

1. **Change thinking effort mid-run** — append a `role: "system"` message to
   `messages` with `output_config.effort` set to the new level (e.g. `"low"`
   after an initial `"high"`-effort planning turn). Send the
   `mid-conversation-output-config-2026-07-01` beta header. The prompt cache
   prefix up to that message stays valid; only turns after it use the new
   effort.
2. **Inject a turn-scoped instruction** — append a `role: "system"` message
   with `clear_at: "next_user_message"`. It applies to the very next
   assistant turn only, then is excluded from the model's context on later
   turns (it stays in your local history at no token cost, so you can still
   log/audit it). Requires the
   `mid-conversation-system-clear-at-2026-08-21` beta header.
3. **Show progress instead of (or alongside) full thinking** — set
   `thinking.display: "updates"` with the
   `thinking-display-updates-2026-08-18` beta header. Claude returns short
   text progress updates (at most one `thinking` block before each tool
   call) instead of a full reasoning trace — good for a UI status line
   during a long tool-call chain.
4. **Combine all three headers** in one request when the agent needs all
   three behaviors (e.g. a long coding-agent run that throttles effort down,
   drops a one-off correction, and streams progress to a status bar).
5. **Mind thinking-block compatibility** across model upgrades: an older
   model can't read thinking blocks a newer model produced, and the API
   silently drops incompatible blocks for existing accounts (accounts
   created after 2026-08-31 get a 400 instead) whenever the system prompt or
   tools change mid-conversation. If you rotate models mid-run, expect this
   and don't rely on thinking blocks surviving the swap.

## Sources

- https://platform.claude.com/docs/en/release-notes/overview — Anthropic, seen 2026-09-08 (per-message effort, turn-scoped system messages, thinking display updates, thinking-block preservation — all dated 2026-08-18 to 2026-09-01)
- https://platform.claude.com/docs/en/build-with-claude/thinking — Anthropic, seen 2026-09-08
