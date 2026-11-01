---
name: claude-strict-tool-use
description: Build reliable tool-calling agents against the Claude API using `strict: true` tool schemas instead of (now-deprecated-on-new-models) `tool_choice: {"type": "any"|"tool"}`. Reach for this when defining Claude tools, forcing a specific tool call, or debugging a 400 error on `tool_choice` with a Claude 5.x model.
---

# Strict tool use instead of forced tool_choice on new Claude models

On the Claude 5.5 family (Opus 5.5, Sonnet 5.5, Haiku 5.5) and the broader
5.x/Fable/Mythos line, `tool_choice` values `{"type": "any"}` and
`{"type": "tool", "name": "..."}` — previously the standard way to force
Claude to call a tool, or any tool — return a 400 error. Use strict tool
schemas with `tool_choice: {"type": "auto"}` instead: it gets you guaranteed
schema-valid arguments without forcing a specific call shape.

## Steps

1. If a 400 error names `tool_choice` on `claude-opus-5-5`, `claude-sonnet-5-5`,
   `claude-haiku-5-5`, or another Fable/Mythos/5.x model, don't just resend
   with `"auto"` and hope — add `"strict": true` to the tool definition(s) at
   the same time, or you lose the guarantee the old `any`/`tool` choice gave
   you.
2. Add `"strict": true` as a top-level key on the tool definition, alongside
   `name`, `description`, and `input_schema`:
   ```json
   {
     "name": "get_weather",
     "description": "Get the current weather in a given location",
     "strict": true,
     "input_schema": {
       "type": "object",
       "properties": {
         "location": {"type": "string"},
         "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]}
       },
       "required": ["location"],
       "additionalProperties": false
     }
   }
   ```
   `strict: true` constrains Claude's token sampling (grammar-constrained
   sampling) so the `tool_use` block's `input` always matches `input_schema`
   exactly — no more `"2"` where you asked for `2`, no missing required
   fields.
3. Keep `tool_choice` at `"auto"` (the default) rather than `"any"`/`"tool"`.
   Strict mode already guarantees valid arguments *when* a tool is called;
   `auto` just lets Claude decide whether to call a tool or respond with
   text, which is what `any`/`tool` could no longer do on these models anyway.
4. Respect the schema subset strict tool use allows: `additionalProperties:
   false` on every object, no recursive schemas, and watch two numeric caps
   per request — at most 20 strict tools, and at most 24 optional parameters
   summed across all strict tool schemas and any `output_config.format`
   JSON-output schema in the same request.
5. Don't put PHI in a strict tool's `input_schema` (property names, `enum`/
   `const` values, or `pattern` regexes) — the compiled schema is cached for
   up to 24 hours as part of the grammar pipeline and isn't covered by the
   same HIPAA protections as message content.
6. The `computer_toolset_20260801` and `browser_toolset_20260801` toolset
   entries reject `strict: true` outright — don't try to combine strict mode
   with computer-use/browser-use tools.
7. Changing which tools are in a request invalidates Claude's grammar cache
   for that request (added latency on the next call); renaming a tool's
   `description` alone does not. Keep tool sets stable across turns where you
   care about latency.

## Sources

- [Strict tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use) — Anthropic docs, seen 2026-11-01
- [Claude Platform release notes, Sept 1/22/28 2026 — `tool_choice` "any"/"tool" return 400 on Fable 5.1, Opus 5.5, Sonnet 5.5](https://platform.claude.com/docs/en/release-notes/overview) — Anthropic, seen 2026-11-01
