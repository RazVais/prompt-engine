# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page web tool ("Prompt Engine" / RV-DATA) that generates Anthropic-style
authoring artifacts — `SKILL.md` files, agent system prompts (standard + extended
Chain-of-Thought), and `CLAUDE.md` files — from a short natural-language description.
The UI is in Hebrew (RTL). Generation runs through Google's Gemini API, proxied by a
thin Express server so the API key never reaches the browser.

## Commands

```bash
npm install        # install deps (express, dotenv)
npm start          # start server on http://localhost:3000 (node server.js)
```

There is no build step, no linter, and no test suite. Node >= 18 is required
(the server relies on the global `fetch`).

To try a change: `npm start`, then open `http://localhost:3000/` (redirects to
`/prompt_eng.html`).

## Architecture

Two layers, one round trip:

1. **`server.js`** — Express app that does three things:
   - Serves the `public/` directory as static content
     (`express.static(path.join(__dirname, 'public'))`) — only `public/` is
     exposed, never the repo root. `GET /` redirects to `/prompt_eng.html`.
   - Exposes `POST /api/generate` `{ prompt, systemInstruction }` → `{ text }`.
     It calls Gemini `:generateContent` at temperature 0 with a fixed 5-attempt
     exponential backoff (1s, 2s, 4s, 8s, 16s), unwraps
     `candidates[0].content.parts[0].text`, and returns 400 (bad input),
     500 (missing key), 429 (rate limit exceeded), or 502 (upstream failed
     after retries).
   - Applies a small in-process fixed-window rate limiter (per `req.ip`) to
     `/api/generate` only — default 20 requests / 60s, tunable via
     `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS`. On exceed it returns 429 with
     a `Retry-After` header.

2. **`public/prompt_eng.html`** — the entire frontend: markup, Tailwind (CDN), and all
   logic in one inline `<script>`. Each generator button builds a hardcoded
   `systemInstruction` string (these prompt templates are the core IP of the
   project — see `generateSkill`, `generateSystemPrompt`, `generateClaudeMd`),
   POSTs to `/api/generate`, then runs a cheap post-validation on the result.
   The SKILL.md check (output must contain `name:` and `description:`) is a hard
   requirement and throws a user-facing error on failure. The CLAUDE.md check
   (output mentions `mcp`, `build`, and `skill`) is advisory only — it
   `console.warn`s and still shows the output, since a valid CLAUDE.md for a
   non-MCP project need not contain those words. The frontend does not send a
   model name; the server's `GEMINI_MODEL` env is the single source of truth.
   History (last 50 generations) is persisted in `localStorage` under
   `promptEngineHistory` — nothing server-side is stored.

3. **`public/ai_agents_expert_cheat_sheet.html`** — a standalone static reference page
   (uses Chart.js via CDN). Not wired to the server or the generator; safe to
   edit independently.

### Config

Environment (via `.env`, git-ignored):

| var                    | used by     | default in code                        |
|------------------------|-------------|----------------------------------------|
| `GEMINI_API_KEY`       | server only | none — `/api/generate` 500s without it  |
| `GEMINI_MODEL`         | server only | `gemini-2.5-flash`                      |
| `PORT`                 | server      | `3000`                                 |
| `RATE_LIMIT_MAX`       | server only | `20` (requests per window)             |
| `RATE_LIMIT_WINDOW_MS` | server only | `60000` (window length in ms)          |

The model name has one source of truth: the server's `GEMINI_MODEL` env (the
`.env` file sets it to `gemini-2.5-flash`). The frontend no longer sends a model
in the request body. To change the model, change `GEMINI_MODEL`.

## Conventions

- Frontend is deliberately dependency-free and single-file. Keep new UI logic in
  the same inline script unless there's a strong reason to add a build step.
- User-facing copy is Hebrew; keep structural/XML tokens in prompts in English
  (the existing system instructions already state this).
- When editing a generator, update its post-validation check to match the new
  expected output shape, or generations will spuriously "fail validation".
- Only `public/` is served. The two HTML pages live in `public/`; the repo root
  (`.env`, `CLAUDE.md`, etc.) is not exposed. Put anything meant to be reachable
  in the browser into `public/`, and keep everything else out of it.
