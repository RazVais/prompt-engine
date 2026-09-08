# Setting up the monthly skills-refresh routine

The routine is a **cloud** Claude Code agent (a "routine") that runs on a cron in
Anthropic's cloud, clones this repo, does the work in `tools/skills-refresh.md`,
and opens a PR. It is not a local cron job.

## One-time prerequisite: connect GitHub

Saving a routine that uses a GitHub repo requires the Claude GitHub account/app
to be connected — this is separate from the `gh` CLI. Do one of:

- Run `/web-setup` in Claude Code, **or**
- Install the Claude GitHub App on `RazVais/prompt-engine`:
  https://claude.ai/code/onboarding?magic=github-app-setup

Until this is done, `/schedule` returns
`401 authentication_error: Connect your GitHub account before saving a routine`.

## Create the routine

In Claude Code: `/schedule` → create, with this config:

| Field | Value |
|---|---|
| Name | `skills-refresh` |
| Cron (UTC) | `0 5 1 * *` — 1st of each month, 05:00 UTC = 08:00 Asia/Jerusalem in summer (IDT), 07:00 in winter (IST) |
| Repo | `https://github.com/RazVais/prompt-engine` |
| Model | `claude-sonnet-5` |
| Allowed tools | `Bash`, `Read`, `Write`, `Edit`, `Glob`, `Grep`, `WebSearch`, `WebFetch` |
| Environment | Default (`anthropic_cloud`) |
| MCP connectors | none |

Prompt:

```
You are the monthly skills-refresh agent for github.com/RazVais/prompt-engine,
running as a scheduled cloud job with a fresh checkout and no prior context.

Read tools/skills-refresh.md and follow it exactly — it is the authoritative brief.

In summary: use web search to research the last ~6 weeks of changes from Anthropic
(Claude), OpenAI, xAI (Grok), and Google (Gemini); turn genuinely new, reusable,
procedural techniques into SKILL.md files under .claude/skills/; update
.claude/skills/CATALOG.md; open a pull request from branch skills/refresh-<YYYY-MM>
with title 'skills: monthly refresh <YYYY-MM>'.

Hard rules: never merge the PR; never modify anything outside .claude/skills/. If
you cannot open a PR, commit your work to the skills/refresh-<YYYY-MM> branch, push
it if possible, and end your run by stating clearly what changed and that a PR
still needs to be opened manually. If nothing meets the bar this month, follow the
'nothing meets the bar' path in the brief.
```

## After it's created

- Do a `run now` from `/schedule` to test it end to end.
- Manage or disable it at https://claude.ai/code/routines
- After merging a refresh PR: `git pull`, then `pwsh tools/sync-skills.ps1` to make
  the skills global on your machine.
