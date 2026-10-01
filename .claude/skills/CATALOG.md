# Skills catalog

Skills in this folder are generated/maintained by the monthly refresh routine
(`tools/skills-refresh.md`). They are auto-available to any Claude Code session
opened in this repo. To use them in every session on your machine, run
`tools/sync-skills.ps1` (or `.sh`) after merging a refresh PR.

| Skill | Last updated | Summary | Provider(s) | Source |
|-------|--------------|---------|-------------|--------|
| [openai-computer-use-browser-approvals](openai-computer-use-browser-approvals/SKILL.md) | 2026-10-01 | Gate an Agents API computer-use session's browser access behind a per-origin approve/deny/cancel decision | OpenAI | [docs](https://developers.openai.com/api/docs/guides/agents-api/tools/computer-use) |
| [claude-on-demand-context-compaction](claude-on-demand-context-compaction/SKILL.md) | 2026-10-01 | Summarize a long Claude conversation on demand via the Messages API beta and swap the signed block back in | Anthropic | [docs](https://platform.claude.com/docs/en/build-with-claude/compaction-on-demand) |
| [claude-inline-tool-definitions](claude-inline-tool-definitions/SKILL.md) | 2026-10-01 | Define or redefine a Claude tool mid-conversation via a system message, without touching `tools` or the prompt cache | Anthropic | [docs](https://platform.claude.com/docs/en/build-with-claude/mid-conversation-system-messages) |
| [gemini-live-async-function-calling](gemini-live-async-function-calling/SKILL.md) | 2026-10-01 | Use non-blocking tool calls and `interaction_status` (not `turn_complete`) to keep a Gemini Live voice agent responsive | Google | [docs](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/live-api/asynchronous-function-calling) |

## Run log

- _(the routine appends a line here on months where nothing new met the bar)_
