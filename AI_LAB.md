# Away Message AI Lab — Sandbox Core

**Update (sandbox):** AI is no longer test-only. The game is now online & AI-heavy by design — Pulse chats, room NPCs, and `.local` site generation all require a provider. Offline deterministic Ink beats have been removed; `WorldEventsEngine` (`src/engine/WorldEventsEngine.ts`) feeds `worldKnowledge` into every `generateChat` call.

Frontend-only BYOK via Vite env is still the current implementation, but it is now **core**, not optional. The provider layer remains isolated so it can move behind a server without changing contracts.

## Setup

Copy `.env.example` to `.env.local` and fill in one or more keys:

```bash
VITE_GEMINI_API_KEY=...
VITE_GROQ_API_KEY=...
VITE_OPENROUTER_API_KEY=...
```

The default models are configured in `.env.example`. They can be overridden with `VITE_GEMINI_MODEL`, `VITE_GROQ_MODEL`, and `VITE_OPENROUTER_MODEL`.

Start the game with:

```bash
npm run dev
```

Open the **AI Lab** desktop icon. Select a provider, optionally save a BYOK key for the current browser session, and run the all-provider benchmark. Benchmark calls intentionally bypass the ten-day cache so latency and output differences are visible.

## Current behavior

Unknown hosts ending in `.local` are treated as generated fictional sites. The response is validated with Zod, rendered by a safe generic component, and cached in the `ai_cache` Dexie table for ten days. The cache key includes provider, model, prompt version, world seed, locale, host, and path.

Free-form Pulse messages are sent to the selected provider with `persona + relationshipSummary + worldKnowledge (global events)` (`src/ai/service.ts:168 buildChatPrompts`). The result is validated (Zod, closed `socialAction` enum) before it is converted into the simulated typing flow and applied via `SocialEngine.applySocialAction()`.

Ink beats are removed. Global sandbox events (e.g. MyPlace v2, Orion OS 7) are triggered by `WorldEventsEngine.checkAndTriggerEvents(day)` and injected as `worldKnowledge` so every NPC shares the same timeline.

If no key is configured, the provider fails, or the request times out, the game shows a fallback message (no longer a full offline story) — sandbox play requires online.

## Important limitation (now core)

Any `VITE_*` value is available to the browser bundle. This is acceptable only for a private local experiment. Do not deploy this configuration publicly, reuse valuable production keys, or treat sessionStorage as a secure secret vault. The migration path is a Next.js server-side provider proxy and short-lived authentication. Because sandbox is AI-heavy, a server proxy is now recommended before any public playtest.
