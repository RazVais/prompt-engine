# Skills catalog

Skills in this folder are generated/maintained by the monthly refresh routine
(`tools/skills-refresh.md`). They are auto-available to any Claude Code session
opened in this repo. To use them in every session on your machine, run
`tools/sync-skills.ps1` (or `.sh`) after merging a refresh PR.

| Skill | Last updated | Summary | Provider(s) | Source |
|-------|--------------|---------|-------------|--------|
| [claude-on-demand-compaction](claude-on-demand-compaction/SKILL.md) | 2026-11-01 | Summarize a Claude conversation on your own schedule via the beta `compaction` parameter, not a fixed token threshold | Anthropic | [Compaction on demand](https://platform.claude.com/docs/en/build-with-claude/compaction-on-demand) |
| [claude-strict-tool-use](claude-strict-tool-use/SKILL.md) | 2026-11-01 | Use `strict: true` tool schemas + `tool_choice: auto` instead of the now-400ing `any`/`tool` choice on new Claude models | Anthropic | [Strict tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use) |
| [claude-thinking-config-5x](claude-thinking-config-5x/SKILL.md) | 2026-11-01 | Per-model table + steps for configuring/disabling always-on adaptive thinking across the Claude 5.x/Fable/Mythos family | Anthropic | [Thinking](https://platform.claude.com/docs/en/build-with-claude/thinking) |

## Run log

- 2026-11: added 3 skills (Anthropic: on-demand compaction, strict tool use migration, 5.x thinking config). OpenAI, xAI, and Google Gemini changes reviewed but not turned into skills this month — see PR body for details and source-reliability caveats.
