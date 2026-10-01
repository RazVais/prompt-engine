---
name: gemini-live-async-function-calling
description: Keep a Gemini Live voice/real-time session responsive while a
             tool call is still running, and correctly detect when the agent
             has actually gone idle — use when building a Live API voice
             agent that calls backend functions mid-conversation.
---

# Gemini Live asynchronous function calling

Gemini Live API (3.8 Live and later) runs tool calls asynchronously by
default so a voice session never freezes waiting on a backend call. Getting
this right means controlling *when* the model speaks about a tool result, and
not confusing "this turn finished" with "the agent is actually done."

## Steps

1. Default to non-blocking tool calls: function calls execute with
   `behavior: NON_BLOCKING` by default, so the audio session keeps running —
   including letting the model speak a conversational filler — while your
   client executes the actual function.
2. Only set `behavior: BLOCKING` on a specific tool declaration if that tool's
   result must land before the model can say anything else.
3. When you return a function's result, set `scheduling` on the
   `function_response` to control when (or whether) the model speaks about
   it: `SILENT` adds the result to context without generating a spoken
   response and without interrupting the user; `WHEN_IDLE` waits until there
   is no active user interaction before responding; `INTERRUPT` (reported
   back as `INTERRUPTED`) breaks in immediately.
4. Never rely on `turn_complete: true` alone to decide the agent is done. With
   async tool calls and interleaved reasoning, a turn can report complete
   while background work — a pending tool call, ongoing reasoning — is still
   in flight.
5. Instead, watch `message.interaction_status` on server events:
   `IN_PROGRESS` means the server is still reasoning, speaking a filler, or
   waiting on an async tool response; `IDLE` means all background reasoning
   and tool calls have actually finished. Gate "the agent is done" logic on
   `IDLE`, not on `turn_complete`.
6. Note that Gemini 3.8 Live does not accept a `thinkingLevel` parameter
   (unlike the Extended Thinking variant) — its interleaved reasoning is not
   configurable the same way.

## Sources

- https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/live-api/asynchronous-function-calling — Google, 2026-09-15
- https://ai.google.dev/gemini-api/docs/models/gemini-3.8-live — Google, 2026-09-15
