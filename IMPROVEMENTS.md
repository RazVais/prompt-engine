# Improvements & Roadmap

Running list of known issues and upgrade ideas. Keep it current — check items off
or delete them as they land.

## Known issues / inconsistencies

- [x] **Model name is set in three places and they disagree.** _(fixed 2026-09-08)_
  The stale hardcoded frontend constant was removed. The server owns the default
  per provider (`GEMINI_MODEL` overrides Gemini's); the frontend now sends an
  explicit, user-chosen `model` from the settings panel, validated server-side.
- [x] **`generateClaudeMd` validation is brittle.** _(fixed 2026-09-08)_ The
  `mcp` / `build` / `skill` substring check is now advisory: it `console.warn`s
  and still shows the output instead of throwing. `generateSkill`'s frontmatter
  check (`name:` / `description:`) stays a hard requirement by design.
- [x] **No rate limiting or auth on `/api/generate`.** _(fixed 2026-09-08)_ Added
  a per-IP fixed-window limiter in `server.js` (default 20 req / 60s, tunable via
  `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS`); returns 429 + `Retry-After` on
  exceed. In-memory only — see the eviction note below if this is ever exposed
  beyond localhost.
- [ ] **Rotate the Gemini key.** _(needs owner action — not a code change)_ The
  working copy on this machine contains a live key in `.env`. `.env` is
  git-ignored, but rotate the key if it was ever shared, pasted elsewhere, or
  committed in history.
- [x] **Static server exposed the whole repo root.** _(fixed 2026-09-08)_ The two
  HTML pages moved to `public/`; `express.static` now serves only `public/`, and
  `GET /` redirects to `/prompt_eng.html`.
- [x] **No `LICENSE` file.** _(fixed 2026-09-08)_ Added MIT `LICENSE`
  (Copyright 2026 RazVais); `package.json` now sets `"license": "MIT"` and
  `"author"`.
- [x] **`.gitignore` was thin.** _(fixed 2026-09-08)_ Expanded to cover editor/OS
  files, logs, and `.env.*` (with a `!.env.example` exception); added a committed
  `.env.example` template.

## Feature ideas

- [x] **Multi-provider support.** _(added 2026-09-08)_ `server.js` now proxies
  Google Gemini, Anthropic Claude, OpenAI, and xAI Grok via a `PROVIDERS`
  registry (raw `fetch`, no SDKs). `GET /api/providers` reports which are
  configured (key present) plus each one's model list, temperature range, and
  token cap. Keys: `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
  `XAI_API_KEY`.
- [x] **Let the user pick the model / temperature / max tokens from the UI.**
  _(done 2026-09-08)_ Settings panel in `prompt_eng.html` (provider select,
  editable model combo, temperature slider, max-tokens field), fed by
  `/api/providers` and persisted to `localStorage` (`promptEngineSettings`).
  The temperature control auto-hides for Anthropic (current Claude models reject
  a `temperature` param). Model field is free-text so newer model IDs work even
  if not in the dropdown.
- [x] **Add a "download as file" button.** _(done 2026-09-08)_ Both output panels
  have a הורד button. Filenames: skill → `SKILL.md`, standard prompt →
  `system-prompt.md`, CoT prompt → `system-prompt-cot.md`, `CLAUDE.md` → `CLAUDE.md`.
- [ ] Stream provider responses so long generations show progress.
- [ ] Export / import history as JSON.
- [ ] English UI toggle alongside the Hebrew default.
- [ ] Show token/cost estimate per generation.
- [ ] A "refine" step: feed the generated artifact back with an edit instruction.

## Nice-to-have engineering

- [ ] Add a minimal test for `/api/generate` (mock `fetch`, assert retry + error
  codes 400 / 500 / 502 / 429).
- [ ] The rate limiter's `Map` never evicts stale IP buckets — fine for localhost
  but add a periodic sweep (or swap in `express-rate-limit`) before exposing the
  server publicly.
- [ ] Add a linter (eslint) and a `format` script.
- [ ] Dockerfile for one-command run.
- [ ] Split `prompt_eng.html` inline script into a served `app.js` for readability
  (still no build step needed).
- [ ] Centralize the four system-instruction templates into one object/module so
  they are easy to review and version.
