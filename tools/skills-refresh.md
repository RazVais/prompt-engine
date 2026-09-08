# Monthly skills refresh — agent instructions

You are refreshing this repository's skill library with genuinely new, durable
techniques from the four major LLM providers. This runs once a month as a
scheduled cloud agent. Work only inside `.claude/skills/` and open a PR — never
merge, never touch anything else.

## 1. Research — last ~6 weeks only

Use web search. Cover all four providers:

| Provider | Sources to check |
|---|---|
| Anthropic (Claude) | `docs.claude.com`, `anthropic.com/news`, model cards, API changelog |
| OpenAI | `platform.openai.com/docs`, `openai.com/blog`, API changelog |
| xAI (Grok) | `docs.x.ai`, `x.ai/news` |
| Google (Gemini) | `ai.google.dev`, `developers.googleblog.com/en/` (AI posts) |

For each provider capture: new models and their exact IDs, new API capabilities,
changed defaults or deprecations, and any newly *documented* agent / prompt-
engineering pattern. Ignore anything older than ~6 weeks from the run date.

## 2. Decide what is skill-worthy

Create or update a `SKILL.md` only if the technique is **all** of:

- **Reusable** across projects, not specific to one codebase
- **Procedural** — it tells you steps to follow, not a fact to memorize
- **Current** — still accurate as of the run date
- **Not already covered** by an existing skill in `.claude/skills/` (if it is,
  update that skill in place instead of adding a new one)

Skip: marketing copy, one-off product announcements, benchmarks, pricing-only
changes (note those in the PR body instead — see step 5).

## 3. Write the skills

For each technique: `.claude/skills/<kebab-case-slug>/SKILL.md`

```markdown
---
name: <kebab-case-slug>
description: <one line — what it does and when to reach for it, so a future
             session can decide relevance>
---

# <Title>

<Short "what / when" paragraph.>

## Steps

1. Imperative instruction — "Do X", "Check Y", not "you should".
2. ...

## Sources

- <dated link> — <provider>, <date seen>
```

When an existing skill's technique evolved, edit that file and bump its
`## Sources` dates rather than creating a near-duplicate.

## 4. Update the catalog

Edit `.claude/skills/CATALOG.md`: one row per skill — name, last-updated date
(the run date), one-line summary, provider(s), and the primary source link.
Keep it sorted by last-updated, newest first.

## 5. Open a PR — do not merge

- Branch: `skills/refresh-<YYYY-MM>`
- Commit only changes under `.claude/skills/`
- PR title: `skills: monthly refresh <YYYY-MM>`
- PR body, two sections:
  - **New / updated skills** — bullet per skill with a one-line rationale
  - **Provider changes not turned into skills** — new model IDs, deprecations,
    pricing shifts, and anything else worth the maintainer knowing for the
    `PROVIDERS` registry in `server.js` and the model dropdowns

If nothing meets the bar this month, open no PR — instead add a dated line to
`.claude/skills/CATALOG.md` under a `## Run log` heading ("YYYY-MM: reviewed, no
new skills") and open a PR with just that one-line change so there is a record.
