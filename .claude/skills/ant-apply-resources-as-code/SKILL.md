---
name: ant-apply-resources-as-code
description: Manage Claude API resources (agents, environments, skills,
             memory stores, deployments) declaratively from files in a repo
             using `ant apply`, Anthropic's Terraform-style CLI workflow, so
             changes are reviewable and reproducible instead of made by hand
             in the Console. Reach for this when a project's Claude agents
             or skills should be version-controlled and deployed from CI.
---

# Deploy Claude resources declaratively with `ant apply`

`ant apply` (CLI v1.30.0+, shipped 2026-09-03) reads agent, environment,
skill, memory-store, and deployment definitions from Markdown/YAML files in
a repository and syncs the Claude API's resources to match — the same
plan/apply/lockfile workflow as Terraform, applied to Claude resources
instead of cloud infra.

## When to reach for this

- A project's Claude Code agents, skills, or Managed-Agents environments
  should live in version control, get reviewed in PRs, and deploy the same
  way every time — not be edited by hand in the Console.
- You want CI to show *what would change* before merging, and apply it only
  after merge.

## Steps

1. Describe each resource (agent, environment, skill, memory store,
   deployment) as a file in the repo, in the Markdown/YAML shape `ant apply`
   expects (see the CLI docs for the per-resource-type schema).
2. Run `ant apply` locally to preview the plan (create/update/no-op per
   resource) and approve it interactively.
3. On approval, `ant apply` writes `claude-lock.json`, recording the API
   resource ID created for each file plus its organization/workspace.
   **Commit this lockfile** — without it, the next run can't find the
   resources it already created and will duplicate them instead of updating.
4. To change a resource, edit its file and rerun `ant apply` — it diffs
   against the lockfile and shows only the delta.
5. Wire it into CI as a two-step gate: `ant apply --dry-run` on the PR to
   post the plan for review, then `ant apply --yes` after merge to apply it.
   Commit the updated `claude-lock.json` from the apply step even if the run
   partially failed, so the next run's diff is accurate.
6. If a resource was edited by hand in the Console instead of through a
   file, the next `ant apply` refuses to proceed on that resource and
   explains the drift — reconcile by importing the Console change back into
   the file (or reapplying the file to overwrite the manual edit) rather
   than ignoring the warning.

## Sources

- https://platform.claude.com/docs/en/cli-sdks-libraries/cli/apply — Anthropic, seen 2026-09-08
- https://platform.claude.com/docs/en/release-notes/overview — Anthropic, seen 2026-09-08 (v1.30.0, 2026-09-03)
