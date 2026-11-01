---
name: claude-on-demand-compaction
description: Summarize a Claude API conversation on your own schedule (not a fixed token threshold) using the beta `compaction` request parameter, to keep a long-running agent or chat session inside the context window. Reach for this when building an agent loop that needs to compact context explicitly, or when you see a `compaction_*` error code from the Claude Messages API.
---

# On-demand compaction (Claude API, beta)

On-demand compaction lets *your application* decide when to summarize a
Claude conversation, rather than relying on the server's fixed input-token
threshold (the older `compact_20260112` / "threshold compaction" feature).
Send one request with a `compaction` parameter; Claude replies with a single
`compaction` block containing a summary instead of a normal turn. Swap that
block in for the messages it covers, and continue the conversation from
there.

## Steps

1. Add the beta header `compact-2026-09-04` to the compaction request *and*
   to every later request that carries the resulting `compaction` block
   (Python/TS/etc. SDKs: use the `client.beta.messages` namespace and pass
   `betas=["compact-2026-09-04"]`).
2. To ask for a summary, send the conversation as it stands with
   `"compaction": {"type": "summarize"}` and no new user turn. The response
   has `stop_reason: "compaction"` and one content block:
   ```json
   {
     "content": [{"type": "compaction", "content": "Summary of the conversation: ...", "signature": "EuYB..."}],
     "stop_reason": "compaction"
   }
   ```
   Keep `max_tokens` generous (several thousand) — it caps the whole
   summarization call, thinking included.
3. Before compacting, resolve any dangling tool call: if the last `assistant`
   turn ends in a tool use with no result yet, send that tool's result first
   — a compaction request is rejected otherwise. Also don't set
   `stop_sequences`, a structured-output `output_config.format`, or
   `tool_choice` of type `"any"`/`"tool"` on the compaction request itself —
   all three are rejected on this call.
4. Check `stop_reason` before assuming you got a summary — a 200 response
   with empty content is normal when the model couldn't summarize cleanly
   (`"max_tokens"` → resend with a larger budget; `"tool_use"` → add
   `instructions` telling it not to call tools; `"refusal"`/`"end_turn"` →
   just continue without a summary and try again after the next turn).
5. To continue, **replace** (don't append) your history: put the returned
   `compaction` block first in `messages` — either as its own `assistant`
   message or as the first content block — remove every message it
   summarizes, and keep the block's `signature` byte-for-byte as returned.
   Forgetting to strip the summarized messages, or editing the block, causes
   a 400 (`compaction_block_misplaced`, `compaction_signature_invalid`, or a
   generic "extra inputs are not permitted" schema error if you re-serialize
   with a plain `model_dump()`/`to_dict()`-equivalent that injects null
   fields — use `exclude_none=True` style serialization).
6. Pick your own trigger instead of a server threshold: after each turn, sum
   `usage.input_tokens + usage.output_tokens` (plus
   `cache_read_input_tokens`/`cache_creation_input_tokens` if you use prompt
   caching) and compact once that total approaches your real budget — well
   below the model's context window, not at the edge of it.
7. Billing: the summarization call's own `input_tokens`/`output_tokens` are
   reported only inside `usage.iterations` (as a `"compaction"` entry); the
   top-level `usage.input_tokens`/`output_tokens` on that response are zero.
   Sum `usage.iterations` to get the true billed total for a turn that
   triggers compaction.
8. If you use the SDK tool runner, don't hand-roll the request at all — call
   `compact_before_next_turn()` (TS/Java/PHP: `compactBeforeNextTurn()`;
   C#/Go: `CompactBeforeNextTurn()`) on a runner created with the
   `compact-2026-09-04` beta; it swaps history for you after the current
   turn's tool calls finish.
9. Don't combine this with threshold compaction: `compaction` and
   `context_management` (the `compact_20260112` edit) can't be set on the
   same request, and a runner refuses to compact on-demand while its
   `context_management` still has a compaction edit configured.

## Sources

- [Compaction on demand](https://platform.claude.com/docs/en/build-with-claude/compaction-on-demand) — Anthropic docs, seen 2026-11-01
- [Claude Platform release notes, Sept 14 2026 — on-demand compaction beta (`compact-2026-09-04`)](https://platform.claude.com/docs/en/release-notes/overview) — Anthropic, seen 2026-11-01
