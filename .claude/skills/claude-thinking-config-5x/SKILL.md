---
name: claude-thinking-config-5x
description: Configure or turn off extended/adaptive thinking on the Claude 5.x model family (Opus 5.5, Sonnet 5.5, Haiku 5.5, Fable 5.1, Mythos 5.1, and their 5.0 predecessors). Reach for this whenever a `thinking` parameter, `budget_tokens`, or a 400 error mentioning thinking comes up while building against the Claude Messages API.
---

# Configuring thinking on the Claude 5.x model family

Starting with Claude Opus 5, Sonnet 5, Haiku 5, Fable 5/5.1, and Mythos 5/5.1,
thinking is **on by default and adaptive** — the model decides when and how
deeply to think per request. This replaces the old `thinking: {"type":
"enabled", "budget_tokens": N}` pattern from Claude 4.x, which now returns a
400 error on every 5.x model. Each model also differs in whether thinking can
be turned off at all, so don't assume the Claude 4.x recipe still works.

## Steps

1. Identify the model's thinking behavior before writing the `thinking`
   parameter — don't reuse a Claude 4.x snippet unchanged. Behavior by model
   (Messages API, `thinking` field):
   - **No `thinking` field** or **`{"type": "adaptive"}`**: works on every
     5.x model, just "Adaptive thinking" (no-op change on 5.x, since it's
     already the default).
   - **`{"type": "enabled", "budget_tokens": N}`**: 400 error on every 5.x
     model. Remove it; use `effort` (see step 3) instead.
   - **`{"type": "disabled"}`**: 400 error on Opus 5.5, Fable 5.1, Mythos
     5.1, Opus 5, Fable 5, Mythos 5. Works (turns thinking off at `high`
     effort or below) on Haiku 5.5, Opus 5 (no — see table), Sonnet 5.
     Returns a 400 at `xhigh`/`max` effort on the models where it's
     otherwise accepted.
   - **`{"type": "between_tools"}`**: only accepted by Sonnet 5.5 — turns off
     *up-front* thinking (thinking between tool calls still happens) at
     `high` effort or below. 400 error on every other 5.x model, including
     Opus 5.5 and Haiku 5.5.
   - **Bottom line**: Opus 5.5, Fable 5/5.1, and Mythos 5/5.1 cannot have
     thinking disabled at all. If a workflow needs non-thinking responses for
     cost or latency, use a different model (e.g. Haiku 5.5 with
     `{"type": "disabled"}`) rather than fighting the 5.5/Fable/Mythos line.
2. If you hit a 400 error naming `thinking`, check the model name first —
   the fix is almost always "this model doesn't accept this thinking type at
   this effort," not a malformed request.
3. To control thinking *depth* instead of on/off, use the `effort` parameter
   (`output_config.effort`, values `low`/`medium`/`high`/`xhigh`/`max`) rather
   than the deprecated `budget_tokens`. `between_tools` and the off-states
   above only work at `high` effort or below — drop effort if you need one of
   them and get a 400 at `xhigh`/`max`.
4. Set `thinking.display` explicitly if you need to see the reasoning text.
   On 5.x models it defaults to `"omitted"` (thinking blocks come back with
   an empty `thinking` field but are still billed and must still be passed
   back unchanged in multi-turn/tool-use conversations). Use
   `thinking: {"type": "adaptive", "display": "summarized"}` to get the
   summarized reasoning text back.
5. When supporting multiple model versions dynamically, don't hard-code the
   table above — query the Models API (`GET /v1/models/{id}` with the
   relevant beta header) and read `capabilities.thinking.types` (e.g.
   `.disabled`, `.between_tools`) to check what a given model ID accepts
   before sending the parameter.
6. Thinking tokens are billed as output tokens and count toward `max_tokens`
   even when `display` hides the text — size `max_tokens` generously (several
   thousand tokens of headroom) on any adaptive-thinking model.

## Sources

- [Thinking](https://platform.claude.com/docs/en/build-with-claude/thinking) — Anthropic docs, seen 2026-11-01 (per-model configuration table)
- [Claude Platform release notes, Sept 22 2026 (Opus 5.5), Sept 28 2026 (Sonnet 5.5), Oct 7 2026 (Haiku 5.5), Oct 5/15 2026 (Models API capability fields)](https://platform.claude.com/docs/en/release-notes/overview) — Anthropic, seen 2026-11-01
