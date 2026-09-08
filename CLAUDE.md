# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page web tool ("Prompt Engine" / RV-DATA) that generates Anthropic-style
authoring artifacts — `SKILL.md` files, agent system prompts (standard + extended
Chain-of-Thought), and `CLAUDE.md` files — from a short natural-language description.
The UI is in Hebrew (RTL). Generation runs through one of four LLM providers —
Google Gemini, Anthropic Claude, OpenAI, or xAI Grok — proxied by a thin Express
server so the API keys never reach the browser. Each provider is enabled only
when its API-key env var is set; unconfigured providers are reported as
unavailable by `GET /api/providers` and rejected by `POST /api/generate`.

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

Frontend + thin proxy, one round trip per generation:

1. **`server.js`** — Express app that does three things:
   - Serves the `public/` directory as static content
     (`express.static(path.join(__dirname, 'public'))`) — only `public/` is
     exposed, never the repo root. `GET /` redirects to `/prompt_eng.html`.
   - Exposes `GET /api/providers` → `{ defaultProvider, providers[] }` listing
     all four providers, their model lists / defaults, temperature and maxTokens
     ranges, and an `available` flag (true when that provider's key is set).
   - Exposes `POST /api/generate`
     `{ provider?, model?, temperature?, maxTokens?, prompt, systemInstruction }`
     → `{ text }`. It dispatches to the chosen provider (default `gemini`)
     through a `PROVIDERS` registry, clamps `temperature` / `maxTokens` to that
     provider's range (Anthropic gets no `temperature` param at all), retries
     with a fixed 5-attempt exponential backoff (1s, 2s, 4s, 8s, 16s), unwraps
     the provider-specific response shape, and returns 400 (bad input / unknown
     or unconfigured provider / invalid model), 429 (rate limit exceeded), or
     502 (upstream failed after retries).
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
   non-MCP project need not contain those words.
   - **Settings panel** (`#settingsPanel`, `initSettings`): on load it fetches
     `/api/providers` and populates the provider select, model combo (editable
     `<datalist>`), temperature slider, and max-tokens field. `getGenerationSettings()`
     merges these into every `/api/generate` body. Choices persist in
     `localStorage` under `promptEngineSettings`. The temperature control hides
     when the provider reports `temperature: null` (Anthropic). If the
     `/api/providers` fetch fails the panel disables itself and requests fall
     back to server defaults.
   - **Download buttons** (`downloadPanel` / `downloadText`): each output panel
     offers a file download named by generation kind — `SKILL.md`,
     `system-prompt.md`, `system-prompt-cot.md`, `CLAUDE.md`. `currentPromptKind`
     tracks which kind `#promptOutput` currently holds.
   - History (last 50 generations) is persisted in `localStorage` under
     `promptEngineHistory` — nothing server-side is stored. Newer entries also
     record `settings: { provider, model }`; entries without it still render.

3. **`public/ai_agents_expert_cheat_sheet.html`** — a standalone static reference page
   (uses Chart.js via CDN). Not wired to the server or the generator; safe to
   edit independently.

### Config

Environment (via `.env`, git-ignored):

| var                    | used by     | default in code                                      |
|------------------------|-------------|------------------------------------------------------|
| `GEMINI_API_KEY`       | server only | none — enables the Gemini provider                   |
| `ANTHROPIC_API_KEY`    | server only | none — enables the Anthropic Claude provider         |
| `OPENAI_API_KEY`       | server only | none — enables the OpenAI provider                   |
| `XAI_API_KEY`          | server only | none — enables the xAI Grok provider                 |
| `GEMINI_MODEL`         | server only | `gemini-2.5-flash` — overrides Gemini's default model |
| `PORT`                 | server      | `3000`                                              |
| `RATE_LIMIT_MAX`       | server only | `20` (requests per window)                          |
| `RATE_LIMIT_WINDOW_MS` | server only | `60000` (window length in ms)                       |

At least one provider key must be set or every `/api/generate` call fails (the
server logs a startup warning listing unconfigured providers, and a louder one
if none are configured). Each provider has a built-in default model; the
frontend may send an explicit `model` (free-form, validated against
`/^[A-Za-z0-9._:\-]{1,100}$/`, not restricted to the advertised list).
`GEMINI_MODEL` overrides Gemini's default model only.

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
