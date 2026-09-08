---
name: migrate-openai-assistants-api
description: Migrate an app off OpenAI's Assistants API (shut down
             2026-08-26, fully removed) onto the Responses API plus the
             Conversations API. Reach for this whenever you find code
             calling `client.beta.assistants` / `client.beta.threads` — it
             is now dead code that must be ported, not a style choice.
---

# Migrate off the OpenAI Assistants API

The Assistants API shut down on 2026-08-26 with **no automated migration** —
any codebase still calling it is broken. OpenAI's replacement is two
separate APIs used together: the **Responses API** for the model call and
tools, and the **Conversations API** for persisting chat history across
turns.

## When to reach for this

- Any project with `client.beta.assistants.*` or `client.beta.threads.*`
  calls — these endpoints no longer exist.
- Before advising "just switch models" on an OpenAI integration — check
  first whether it's actually on the old Assistants API.

## Steps

1. **Inventory the Assistant objects.** For each `assistant` your app
   created (instructions, model, tools, tool resources), find it in the
   OpenAI dashboard and use "Create prompt" to turn it into a reusable
   **prompt object** — this becomes the Responses-API equivalent of the
   assistant's configuration.
2. **Replace the model call.** Send requests to `/v1/responses` instead of
   the Assistants run/thread endpoints. Read output from the Responses API's
   typed output array instead of polling run status.
3. **Choose a state-carrying strategy** for multi-turn conversations — pick
   one, don't mix:
   - **Client-managed**: pass `previous_response_id` on each call and let
     your app hold the conversation state, or
   - **Conversations API**: create a `conversation` object and let OpenAI
     persist turns server-side, closer to how Threads worked.
4. **Port existing Thread history by hand.** OpenAI provides no automated
   Threads → Conversations migration. Iterate your app's stored Thread
   messages and recreate them as Conversation items, one by one, before
   cutting old threads over.
5. **Re-point vector stores.** Files and vector stores attached to old
   Assistants persist and now belong to the Responses API's `file_search`
   tool — attach them there instead of via `tool_resources` on an assistant.
6. **Cut over and verify**: run the new `/v1/responses` + conversation-state
   path against a copy of real conversation data before removing the old
   `client.beta.assistants` / `client.beta.threads` call sites.

## Sources

- https://developers.openai.com/api/docs/assistants/migration — OpenAI, seen 2026-09-08
- https://developers.openai.com/api/docs/guides/migrate-to-responses — OpenAI, seen 2026-09-08 (Assistants API shutdown 2026-08-26)
