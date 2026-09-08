# Skills catalog

Skills in this folder are generated/maintained by the monthly refresh routine
(`tools/skills-refresh.md`). They are auto-available to any Claude Code session
opened in this repo. To use them in every session on your machine, run
`tools/sync-skills.ps1` (or `.sh`) after merging a refresh PR.

| Skill | Last updated | Summary | Provider(s) | Source |
|-------|--------------|---------|-------------|--------|
| [ant-apply-resources-as-code](ant-apply-resources-as-code/SKILL.md) | 2026-09-08 | Declaratively deploy Claude agents/skills/environments from repo files with `ant apply`'s plan/apply/lockfile workflow | Anthropic | https://platform.claude.com/docs/en/cli-sdks-libraries/cli/apply |
| [claude-mid-conversation-controls](claude-mid-conversation-controls/SKILL.md) | 2026-09-08 | Change thinking effort, inject turn-scoped instructions, and stream progress updates mid-conversation without breaking prompt cache | Anthropic | https://platform.claude.com/docs/en/release-notes/overview |
| [migrate-openai-assistants-api](migrate-openai-assistants-api/SKILL.md) | 2026-09-08 | Port an app off the shut-down Assistants API onto the Responses API + Conversations API | OpenAI | https://developers.openai.com/api/docs/assistants/migration |
| [gemini-multimodal-file-search](gemini-multimodal-file-search/SKILL.md) | 2026-09-08 | Build a File Search RAG store that natively embeds and retrieves images alongside text via gemini-embedding-2 | Google | https://ai.google.dev/gemini-api/docs/file-search |

## Run log

- _(the routine appends a line here on months where nothing new met the bar)_
