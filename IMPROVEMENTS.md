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

## Next up (added 2026-09-08)

Prioritized. #1–#3 and #9 are the recommended first batch.

### Robustness

- [ ] **1. Abort the upstream call on client disconnect + per-request timeout.**
  If the browser closes mid-stream, the provider `fetch` keeps running and burns
  tokens. Wire an `AbortController` to `req.on('close')` in
  `/api/generate/stream`, and give every provider `fetch` a hard timeout so a
  hung provider doesn't tie up a slot through the whole 5-retry cycle.
- [ ] **2. Per-model capability flags.** Anthropic's "no `temperature`" is a
  hardcoded special case. Make it a general `capabilities` field per model:
  OpenAI reasoning models (`o*`, `gpt-5*`) also reject `temperature` and need
  `max_completion_tokens` instead of `max_tokens` — the current code 400s on
  them. Same mechanism lets the "חשיבה מעמיקה (CoT)" button turn on native
  extended thinking for Claude / Gemini `thinkingConfig` instead of only
  changing prompt wording.
- [ ] **3. Auto-populate model dropdowns from each provider's list-models API**
  at server start (Gemini, OpenAI, Anthropic `/v1/models`, xAI). Ends dropdown
  staleness; keep the free-text model field as the escape hatch.

### Product

- [ ] **4. Side-by-side compare** — run one task description against two
  models/providers and show both outputs next to each other.
- [ ] **5. Prompt preset library** — a dropdown of starter task descriptions.
- [ ] **6. Diff view on refine** — highlight what changed between the original
  and the rewrite.
- [ ] **7. Stop button** for an in-flight generation + Ctrl/Cmd+Enter to generate.
- [ ] **8. "Lint an existing SKILL.md / CLAUDE.md" mode** — paste one in, get
  structured feedback instead of only generating from scratch.

### Infra

- [ ] **9. GitHub Actions CI** — `node -c server.js` + the inline-script parse
  check (+ tests once they exist) on every PR. Gives the monthly skills-refresh
  PRs a green check.
- [ ] **10. `.gitattributes`** with `* text=auto eol=lf` — stops the
  "LF will be replaced by CRLF" warning on every commit.
- [ ] **12. SessionStart hook** to auto-run `tools/sync-skills.*` after a
  `git pull` so merged skills land in `~/.claude/skills/` without a manual step.
- [ ] **13. Let the monthly routine also propose `PROVIDERS` model-list /
  `PRICING` updates** in a clearly-labeled section of its PR, not just skills.

(#11 = the two existing open items in "Nice-to-have engineering" below.)

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
- [x] **Monthly skills refresh.** _(added 2026-09-08)_ `tools/skills-refresh.md`
  is the brief for a scheduled cloud routine that researches recent Anthropic /
  OpenAI / xAI / Google changes, writes `SKILL.md` files under `.claude/skills/`,
  and opens a review PR. `tools/sync-skills.*` pushes merged skills to
  `~/.claude/skills/`. Routine created (`trig_016jRAyGht5qWkTsh3ZG1hQe`, monthly);
  first test run opened PR #1. Still to do: consider a SessionStart hook that runs
  the sync automatically.
- [x] **Stream provider responses.** _(done 2026-09-08)_ `POST /api/generate/stream`
  (SSE) proxies streaming from all four providers, forwarding `{delta}` events and
  a terminal `{done,usage}`. Frontend renders text as it arrives via
  `sendGenerateRequestStream` / `generateInto`, with a one-shot fallback to the
  non-stream endpoint on any error. Non-stream `/api/generate` kept as-is.
- [x] **Export / import history as JSON.** _(done 2026-09-08)_ Buttons in the
  history header. Import merges by `id` (dedupe, re-sort, 50-cap) and reports
  imported / duplicate / invalid counts.
- [x] **English / Hebrew UI toggle.** _(done 2026-09-08)_ ~66 keys in a
  `TRANSLATIONS` table with a `t()` helper and `data-i18n*` markup; header button
  flips language + text direction and persists to `localStorage.promptEngineLang`.
  The four generator system-prompt templates follow the UI language for their
  output-language instruction only.
- [x] **Token / cost estimate per generation.** _(done 2026-09-08)_ Both generate
  paths return `usage: {inputTokens, outputTokens, estCostUsd}`; cost from an
  approximate per-model `PRICING` table in `server.js` (prefix fallback; `null`
  when unpriced). Shown as a muted line under each output panel and in history.
- [x] **Refine step.** _(done 2026-09-08)_ Each output panel has an inline
  "describe a change" input that re-sends the current document with an edit
  instruction and replaces it with the rewrite; saved to history with a
  "(שוכתב)" / "(rewritten)" label.

## Nice-to-have engineering

- [ ] Add tests for `/api/generate` and `/api/generate/stream` (mock `fetch`,
  assert retry + 400 / 429 / 502, SSE `delta`/`done`/`error` framing, and the
  `usage` / `estCostUsd` shape). Server already exports internals for this.
- [ ] The rate limiter's `Map` never evicts stale IP buckets — fine for localhost
  but add a periodic sweep (or swap in `express-rate-limit`) before exposing the
  server publicly.
- [ ] Add a linter (eslint) and a `format` script.
- [ ] Dockerfile for one-command run.
- [ ] Split `prompt_eng.html` inline script into a served `app.js` for readability
  (still no build step needed) — the file is now large.
- [~] Centralize the system-instruction templates — partly done: they live in
  `TRANSLATIONS[lang].tpl.sys.*`. Could still move to a standalone module.
