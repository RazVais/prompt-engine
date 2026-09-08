# Prompt Engine

A small web tool that turns a plain-language description of a workflow into
Anthropic-style authoring files:

- **`SKILL.md`** – a valid Claude Code skill file (frontmatter, imperative steps, XML tags)
- **Agent system prompt** – standard XML-structured, or an extended Chain-of-Thought variant
- **`CLAUDE.md`** – a project configuration file with MCP / skills / build sections

The interface is in Hebrew (right-to-left). Text generation runs through one of
four LLM providers — **Google Gemini, Anthropic Claude, OpenAI, or xAI Grok** —
called through a small local proxy server. A provider shows up in the UI only
when its API key is configured.

**Each person runs their own copy with their own API key(s).** No key is bundled
with this project, and keys never reach the browser — they stay in your local
`.env` and are used only by the server on your machine.

## Requirements

- Node.js 18 or newer ([nodejs.org](https://nodejs.org))
- At least one provider API key:
  - **Google Gemini** — free at https://aistudio.google.com/apikey
  - **Anthropic Claude** — https://console.anthropic.com/
  - **OpenAI** — https://platform.openai.com/api-keys
  - **xAI Grok** — https://console.x.ai/

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your `.env` from the template:

   ```bash
   cp .env.example .env        # Windows PowerShell: copy .env.example .env
   ```

   Then open `.env` and paste your key(s) into the matching line(s):
   `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `XAI_API_KEY`.

   At least one provider key is required; unconfigured providers are disabled in
   the UI. The other values have working defaults. `.env` is git-ignored — it is
   never committed or shared. `GEMINI_MODEL` optionally overrides Gemini's
   default model. `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` control the per-IP
   fixed-window rate limit on `POST /api/generate` (default: 20 requests per
   60000 ms; a 429 with a `Retry-After` header is returned when exceeded).

## Run

```bash
npm start
```

Then open **http://localhost:3000/** (it redirects to
**/prompt_eng.html**).

The cheat-sheet page is at **http://localhost:3000/ai_agents_expert_cheat_sheet.html**.

Only the `public/` directory is served; the rest of the repo (including `.env`)
is not reachable from the browser.

## How to use

1. In **הגדרות יצירה** (Generation settings) at the top, pick the provider, model,
   temperature, and max tokens. Only providers with a configured key are
   selectable; the model box accepts any model ID (not just the suggestions).
   The temperature control is hidden for Anthropic (current Claude models don't
   take one). Your choices are remembered in the browser.
2. Type a description of your task in the main box (e.g. "build a weekly triathlon
   training plan from heart-rate data in Excel files").
3. Click one of:
   - **צור קובץ SKILL.md** – generate a skill file
   - **פרומפט סוכן רגיל** – generate a standard agent system prompt
   - **חשיבה מעמיקה (CoT)** – generate a deep-reasoning system prompt
4. For a project config file, use the smaller **CLAUDE.md** box on the right.
5. Use **העתק הכל** to copy or **הורד** to download the result as a correctly named
   file (`SKILL.md`, `system-prompt.md`, `system-prompt-cot.md`, `CLAUDE.md`).
6. Every result is saved to browser history (last 50). Use **שחזר** to restore one,
   or **נקה הכל** to wipe history. History lives only in your browser.

## Files

| File | Purpose |
|------|---------|
| `server.js` | Express server: serves `public/`, exposes `GET /api/providers`, proxies `POST /api/generate` to the chosen provider (Gemini / Claude / OpenAI / Grok), rate-limits it |
| `public/prompt_eng.html` | The generator app (UI + all logic, single file) |
| `public/ai_agents_expert_cheat_sheet.html` | Standalone reference page, not connected to the server |
| `CLAUDE.md` | Guidance for Claude Code working in this repo |
| `IMPROVEMENTS.md` | Known issues and ideas for future work |

## Notes

- The server retries failed upstream provider calls up to 5 times with exponential backoff.
- Only `public/` is served. Put browser-facing files there; keep secrets and
  scratch files in the repo root, which is not exposed.
