# Prompt Engine

A small web tool that turns a plain-language description of a workflow into
Anthropic-style authoring files:

- **`SKILL.md`** – a valid Claude Code skill file (frontmatter, imperative steps, XML tags)
- **Agent system prompt** – standard XML-structured, or an extended Chain-of-Thought variant
- **`CLAUDE.md`** – a project configuration file with MCP / skills / build sections

The interface is in Hebrew (right-to-left). Text generation is done by Google
Gemini, called through a small local proxy server.

**Each person runs their own copy with their own free Gemini API key.** No key is
bundled with this project, and the key never reaches the browser — it stays in
your local `.env` and is used only by the server on your machine.

## Requirements

- Node.js 18 or newer ([nodejs.org](https://nodejs.org))
- A Google Gemini API key — free at https://aistudio.google.com/apikey
  (sign in with a Google account, click **Create API key**, copy the string)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your `.env` from the template:

   ```bash
   cp .env.example .env        # Windows PowerShell: copy .env.example .env
   ```

   Then open `.env` and paste your key into the `GEMINI_API_KEY=` line.

   Only `GEMINI_API_KEY` is required; the other values have working defaults.
   `.env` is git-ignored — it is never committed or shared. `GEMINI_MODEL` is the
   single source of truth for the model (the frontend does not send one).
   `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` control the per-IP fixed-window rate
   limit on `POST /api/generate` (default: 20 requests per 60000 ms; a 429 with a
   `Retry-After` header is returned when exceeded).

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

1. Type a description of your task in the main box (e.g. "build a weekly triathlon
   training plan from heart-rate data in Excel files").
2. Click one of:
   - **צור קובץ SKILL.md** – generate a skill file
   - **פרומפט סוכן רגיל** – generate a standard agent system prompt
   - **חשיבה מעמיקה (CoT)** – generate a deep-reasoning system prompt
3. For a project config file, use the smaller **CLAUDE.md** box on the right.
4. Every result is saved to browser history (last 50). Use **שחזר** to restore one,
   or **נקה הכל** to wipe history. History lives only in your browser.

## Files

| File | Purpose |
|------|---------|
| `server.js` | Express server: serves `public/`, proxies `POST /api/generate` to Gemini, rate-limits it |
| `public/prompt_eng.html` | The generator app (UI + all logic, single file) |
| `public/ai_agents_expert_cheat_sheet.html` | Standalone reference page, not connected to the server |
| `CLAUDE.md` | Guidance for Claude Code working in this repo |
| `IMPROVEMENTS.md` | Known issues and ideas for future work |

## Notes

- The server retries failed Gemini calls up to 5 times with exponential backoff.
- Only `public/` is served. Put browser-facing files there; keep secrets and
  scratch files in the repo root, which is not exposed.
