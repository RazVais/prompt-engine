---
name: claude-on-demand-context-compaction
description: Compact a long Claude conversation on demand via the Messages API
             beta instead of writing your own summarizer, so a multi-turn agent
             loop or long chat keeps fitting in the context window — reach for
             this when input tokens are approaching the model's context limit.
---

# Claude on-demand context compaction

Anthropic's Messages API can summarize a conversation server-side, on request,
and hand back a signed "compaction" block that replaces the summarized
messages in every later request. Use it instead of a hand-rolled summarizer
when your application (not a fixed token threshold) should decide when to
compact — e.g. a long agent loop, a chat that must keep the last few turns
word for word, or a summary that should be produced in the background while
the conversation keeps going.

## Steps

1. Before relying on it, confirm the model supports on-demand compaction: call
   the Models API with the beta header and check `capabilities.compaction`.
2. Add the `anthropic-beta: compact-2026-09-04` header to every request that
   asks for a summary **and** to every later request that sends the signed
   block back.
3. Decide when to compact: after each turn, sum the last response's
   `usage.input_tokens` + `usage.output_tokens` (plus
   `cache_read_input_tokens` / `cache_creation_input_tokens` if you use prompt
   caching) and compare against a limit set below the model's context window.
4. When the limit is crossed, resend the conversation as it stands with
   `"compaction": {"type": "summarize"}` — no new user turn. If the last
   assistant turn ends in a tool call with no result yet, send that tool
   result first; the API rejects the request otherwise.
5. Check `stop_reason == "compaction"` before reading the response. Other stop
   reasons mean no summary came back: `max_tokens` → retry with a larger
   `max_tokens`; `model_context_window_exceeded` → shorten `instructions` or
   the message list; `tool_use` → resend with `instructions` telling the model
   not to call tools; `refusal` / `end_turn` → just continue uncompacted and
   try again later.
6. On success, replace your **entire** history with the single returned
   assistant message (one `compaction` content block). Put it first in
   `messages`, drop every message it summarized, and never edit its `content`
   or `signature` — altering either raises `compaction_signature_invalid` /
   `compaction_content_mismatch`.
7. On every subsequent request, keep sending that block first in `messages`
   (exactly one `compaction` block per request), with the same `system`
   prompt and `tools` you use elsewhere. A `role: "system"` message inside the
   summarized range stops applying once compacted — restate it after the next
   user turn if it still matters.
8. To compact again later, just send `"compaction": {"type": "summarize"}` a
   second time; the new block summarizes the old block plus everything since.
9. Optionally pass `compaction.instructions` (custom summarization prompt, up
   to 16,384 characters) when the default summary would drop something a
   later turn needs — and explicitly tell it not to call tools.
10. If you use an Anthropic SDK tool runner, create it with the
    `compact-2026-09-04` beta and call `compact_before_next_turn()` (or the
    per-language equivalent) instead of managing the swap by hand.

Don't combine `compaction` with `context_management` (threshold compaction) on
the same request — pick one per conversation. Images, documents,
`container_upload` blocks, and fetched URLs inside summarized messages are
gone once the block replaces them; re-upload anything a later turn still
needs.

## Sources

- https://platform.claude.com/docs/en/build-with-claude/compaction-on-demand — Anthropic, 2026-09-28 (beta header `compact-2026-09-04`)
- https://platform.claude.com/docs/en/build-with-claude/compaction — Anthropic, 2026-09-28
