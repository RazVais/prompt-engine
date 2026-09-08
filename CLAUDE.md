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

1. **`server.js`** — Express app:
   - Serves the `public/` directory as static content — only `public/` is
     exposed, never the repo root. `GET /` redirects to `/prompt_eng.html`.
   - `GET /api/providers` → `{ defaultProvider, providers[] }` listing all four
     providers, their model lists / defaults, temperature and maxTokens ranges,
     and an `available` flag (true when that provider's key is set).
   - `POST /api/generate`
     `{ provider?, model?, temperature?, maxTokens?, prompt, systemInstruction }`
     → `{ text, usage? }` where `usage` is `{ inputTokens, outputTokens,
     estCostUsd }` (`estCostUsd` from the approximate `PRICING` table, `null`
     when the model isn't priced). Dispatches through the `PROVIDERS` registry
     (default `gemini`), clamps `temperature` / `maxTokens` to the provider's
     range (Anthropic gets no `temperature` param at all), retries with a fixed
     5-attempt exponential backoff, and returns 400 / 429 / 502.
   - `POST /api/generate/stream` — same request/validation, returns SSE:
     `data: {"delta":"…"}` per chunk then `data: {"done":true,"usage":{…}}`, or
     `data: {"error":"…","status":…}`. Retries only before the first byte;
     mid-stream errors stop without retry. `streamProvider()` handles the
     per-provider SSE parsing (Gemini `streamGenerateContent?alt=sse`, Anthropic
     `stream:true`, OpenAI/Grok `stream:true` + `stream_options.include_usage`).
   - In-process fixed-window rate limiter (per `req.ip`) on both `/api/generate*`
     routes — default 20 req / 60s, tunable via `RATE_LIMIT_MAX` /
     `RATE_LIMIT_WINDOW_MS`; 429 + `Retry-After` on exceed.
   - `PROVIDERS` entries carry `buildRequest` / `extractText` / `extractUsage`
     (non-stream) and `buildStreamRequest` / `extractStreamDelta` /
     `extractStreamUsage` (stream). `module.exports` exposes internals for tests.

2. **`public/prompt_eng.html`** — the entire frontend: markup, Tailwind (CDN), and all
   logic in one inline `<script>`. Each generator (`generateSkill`,
   `generateSystemPrompt`, `generateClaudeMd`) builds a `systemInstruction` from
   the `TRANSLATIONS[lang]['tpl.sys.*']` templates (these prompt templates are
   the core IP of the project), calls `generateInto()` (streams via
   `sendGenerateRequestStream`, falls back once to `sendGenerateRequest`), then
   runs a cheap post-validation. The SKILL.md check (`name:` + `description:`) is
   a hard requirement and throws on failure; the CLAUDE.md check (`mcp` / `build`
   / `skill`) is advisory (`console.warn`, output still shown).
   - **i18n** (`TRANSLATIONS = { he, en }`, `t(key, vars)`, `applyLang(lang)`):
     ~66 keys, static markup tagged with `data-i18n` / `-html` / `-placeholder` /
     `-title` / `-aria-label`, dynamic strings via `t()`. `#langToggle` flips
     language + `<html dir>` and persists to `localStorage.promptEngineLang`
     (default `he`). Only the templates' output-language sentence differs by lang.
   - **Settings panel** (`#settingsPanel`, `initSettings`): fetches
     `/api/providers`, populates the provider select, editable model
     `<datalist>`, temperature slider, max-tokens field. `getGenerationSettings()`
     merges these into every generate request; persisted in
     `localStorage.promptEngineSettings`. Temperature control hides when the
     provider reports `temperature: null` (Anthropic). Fetch failure → panel
     disables, requests use server defaults.
   - **Streaming**: `generateInto(payload, outputDiv)` shows the panel, calls
     `showOutput` on each delta, returns `{ text, usage }`.
   - **Usage line** (`renderUsage`): muted token count + `~$cost` (or "עלות לא
     ידועה" / "unknown cost") under each panel, from the response `usage`.
   - **Refine** (`refinePanel`): the `.refine-bar` under each panel re-sends the
     current `<pre>` text + an edit instruction with a generic "edit this
     document" system prompt; result replaces the panel and is saved to history.
   - **Download buttons** (`downloadPanel` / `downloadText`): file named by
     `currentPromptKind` — `SKILL.md`, `system-prompt.md`, `system-prompt-cot.md`,
     `CLAUDE.md`.
   - History (last 50) in `localStorage.promptEngineHistory` — nothing
     server-side. Entries record `settings: { provider, model }` and `usage`
     when present; older entries without them still render. Export/import as JSON
     (`exportHistory` / `importHistory`, merge-by-`id`).

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
- Every user-facing string goes through the i18n system — add a key to BOTH
  `TRANSLATIONS.he` and `TRANSLATIONS.en` and reference it via `data-i18n*` or
  `t()`. Never hardcode a visible string. Keep structural/XML tokens in the
  generator templates in English in both languages.
- When editing a generator, update its post-validation check to match the new
  expected output shape, or generations will spuriously "fail validation".
- The `PROVIDERS` model lists and the `PRICING` table in `server.js` are
  hand-maintained and go stale — `PRICING` values are approximate. The monthly
  skills-refresh PR flags provider changes worth reconciling here.
- Only `public/` is served. The two HTML pages live in `public/`; the repo root
  (`.env`, `CLAUDE.md`, etc.) is not exposed. Put anything meant to be reachable
  in the browser into `public/`, and keep everything else out of it.
