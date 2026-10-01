---
name: claude-inline-tool-definitions
description: Introduce a brand-new tool mid-conversation on the Claude Messages
             API (or change an existing tool's schema) without touching the
             top-level tools array or busting the prompt cache — use when an
             agent only learns what tool it needs after the conversation has
             started, e.g. tools fetched from an MCP server or generated from
             user input.
---

# Claude inline tool definitions

Anthropic's Messages API has a beta that lets you define a complete new tool
— name, description, input schema — partway through a conversation, by
appending a `role: "system"` message, instead of pre-declaring everything in
the top-level `tools` array. Because the array and every earlier message stay
byte-identical, the prompt cache still hits.

## Steps

1. Add the `anthropic-beta: inline-tools-2026-09-15` header to the request.
2. Keep the original `tools` array and every earlier message untouched —
   append a new `role: "system"` message instead of editing anything upfront.
3. In that message's `content`, add a block of type `tool_addition` wrapping a
   `tool` of type `tool_definition`, whose `definition` is a complete tool
   object (`name`, `description`, `input_schema`, and optionally
   `cache_control` / `defer_loading`) — the same shape it would have in
   `tools`.
4. Keep at least one non-deferred tool in the top-level `tools` array. If
   every tool defers, the first value-defined tool mid-conversation changes
   the start of the rendered prompt and costs one full cache miss on that
   request.
5. To change a tool's schema later, send a different `tool_definition` under
   the same `name` in a later system message — Claude uses the new schema
   from that point on. Sending an identical definition again is a safe no-op.
6. Don't reuse a tool's name for a different tool type — that returns a 400
   `tool_name_conflict`.
7. Don't try to define the computer-use tool (or other unsupported built-in
   tool types) by value mid-conversation; it returns a 400. Declare those in
   `tools` up front and toggle them by reference instead (see below).
8. Stay under the limits: at most 10,000 tools defined after the first user
   message, and at most 4 MB total for tool definitions sent after the first
   user message (and for the rendered tool text) — otherwise the API returns
   `available_tools_limit_exceeded`.
9. For a tool you already know about at the first request but want Claude to
   see only later, declare it in `tools` with `defer_loading: true` up front
   and activate it with a `tool_reference` block (the
   `mid-conversation-tool-changes-2026-07-01` beta) instead of redefining it
   by value — reserve `tool_addition` + `tool_definition` for tools that are
   genuinely unknown at the start of the conversation or whose schema changes.

## Sources

- https://platform.claude.com/docs/en/build-with-claude/mid-conversation-system-messages — Anthropic, 2026-09-15 (beta header `inline-tools-2026-09-15`)
