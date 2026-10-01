---
name: openai-computer-use-browser-approvals
description: Gate an OpenAI Agents API computer-use session's browser access
             behind an explicit per-origin approval before the agent can
             click, type, or navigate on a given site — use when building a
             browser-driving agent that must not touch an arbitrary site
             without a human or policy decision.
---

# OpenAI computer-use browser origin approvals

The Agents API can run an agent in an OpenAI-hosted browser (computer use).
Before the agent is allowed onto a new site, the session raises a blocking
approval request that your application must resolve — approve, deny, or
cancel — before the agent can proceed on that origin.

## Steps

1. Enable the computer-use tool on an Agents API session so the agent runs in
   the OpenAI-hosted browser rather than on infrastructure you control.
2. Watch for the session reaching `agent.session.requires_action`, then
   retrieve the session and inspect `required_actions`.
3. Filter `required_actions` for `computer_use_approval_request` entries whose
   nested `request.type` is `browser_origin_access` — these block the agent
   until resolved.
4. For each pending request, read `request.origin` and `request.reason` to
   show the user (or apply your own policy) what site the agent wants to
   access and why.
5. Submit the decision to the session events endpoint as an
   `agent.session.input.computer_use_approval_request_result` event, carrying
   the original `request_id` and a `response` of
   `{ type: "browser_origin_access", decision: "approve" | "deny" | "cancel" }`.
6. Treat an approved origin as approved for the rest of the session, not for a
   single action: once approved, the agent can click a purchase button,
   submit a form, or delete something on that origin without asking again. If
   your product needs a guaranteed checkpoint before one specific
   consequential action, constrain the browser to resources that can't
   perform it, or run your own browser runtime instead of the hosted one.
7. Use `cancel` rather than `deny` when you want to stop the current action
   without permanently blocking that origin for the rest of the session, if
   your flow distinguishes the two.

## Sources

- https://developers.openai.com/api/docs/guides/agents-api/tools/computer-use — OpenAI, 2026-09-29 (announced at DevDay 2026)
- https://developers.openai.com/api/docs/guides/agents-api/sessions/events — OpenAI, 2026-09-29
