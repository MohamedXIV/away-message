---
name: orchestrating-external-agents
description: Use when working on non-trivial Away Message repository tasks that could benefit from delegation, or when OpenCode, Muse, agy, Gemini, external workers, subagents, event-driven waiting, completion, or input-needed handling are involved.
---

# Orchestrating External Agents

Use OpenCode and Antigravity CLI (`agy`) as bounded workers. The user may approve proactive delegation when it saves time or improves quality. Codex remains responsible for scope, decisions, diff review, verification, and final sign-off.

## Project boundary

Away Message is React 19 + Vite + Tailwind + Zustand + Dexie + Phaser. Do not use or configure Unity MCP. A text-only worker cannot claim visual or audio QA.

## Choose a worker

- OpenCode/Muse: focused review, investigation, or bounded implementation. Preserve the user's saved Muse 1.3 model and `xhigh` variant unless the task requires another model.
- `agy`: first inspect `agy models` and use the newest Gemini Flash exposed there. Currently that is `gemini-3.8-flash-high` for implementation and UI work; choose the newest available Flash variant for smaller review work when appropriate. Do not silently switch to Claude or another model family.
- Delegate independent tasks in parallel only when they do not share mutable files or sequential decisions.

## Dispatch contract

Before launch, check the worktree and available tools. Check `agy` quota when the CLI exposes a reliable percentage and warn below 20%; never invent quota data. Prefer an isolated branch or worktree for edits.

Every prompt must contain:

1. Exact objective and relevant project context.
2. Allowed files/directories and explicit out-of-scope areas.
3. Acceptance criteria and verification commands.
4. Expected deliverable.
5. A requirement to report assumptions and stop for material ambiguity.
6. A prohibition on invented APIs, assets, requirements, architecture, or test results.

## Execution and permissions

- Run OpenCode and `agy` outside the Codex sandbox only through the normal operating-system approval path when needed. Never pass a dangerous permission-bypass flag or weaken the approval policy merely to unblock a worker.
- Prefer structured, non-interactive execution. OpenCode can use `opencode serve` plus its event stream for resumable work, or `opencode run --format json` for one-shot work.
- For `agy`, use its structured stream format and preserve the conversation ID for follow-up turns. Start uncertain work in plan mode; after questions are resolved, resume the same conversation in the appropriate edit/build mode.
- Wait on completion or input-needed events rather than relying on arbitrary time-based polling. On `requires_input`, relay the exact question only when the answer cannot be inferred safely.

## Review and acceptance

After completion, inspect the actual diff and command output. Do not accept a worker's claims as evidence. Run proportionate local verification. Do not commit, push, merge, convert a PR to Ready, or broaden scope unless the user requested it.

Codex owns the final rendered and interaction QA layer. External workers, Playwright, and Chrome DevTools may provide automation evidence, screenshots, console/network data, and measurements; they do not replace built-in-browser or Computer Use judgment when those are available.

Codex owns checks that automation does not establish reliably: visual coherence across states, Phaser canvas framing and layering, interaction placement, readability, exploratory lifecycle behavior, screenshot interpretation, and whether a reported defect is visible to a player.

Before making any perceptual audio claim, confirm that an actual audio stream or capture is available to Codex. Without one, inspect only programmatic audio state and leave listening quality, spatial mix, and perceived volume as an explicit human gate.

If built-in browser or Computer Use is unavailable, report the final validation layer as blocked. Do not hand final sign-off back to an external worker or treat Playwright/CDP evidence as equivalent.

## Failure handling

If structured events are unavailable, state the limitation and use process completion as the signal. If a worker lacks a required capability, return that portion as blocked instead of simulating QA. Stop on permission requests, material ambiguity, repeated failure, or unexpected edits outside scope.
