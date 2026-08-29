# Away Message AI Lab

This test-only implementation keeps the game frontend-only. It reads provider keys from Vite environment variables and optionally lets the player enter a BYOK key in the AI Lab window. The provider layer is deliberately isolated so it can later move behind a server without changing the generated-site or chat contracts.

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

Free-form Pulse messages are sent to the selected provider. The result is validated before it is converted into the existing simulated typing flow. Only a closed list of social actions can be returned, and those actions are passed through the existing relationship engine. Authored Ink dialogue remains available for story-critical beats.

If no key is configured, the provider fails, or the request times out, the game shows a deterministic offline fallback rather than breaking the browser or chat window.

## Important test-only limitation

Any `VITE_*` value is available to the browser bundle. This is acceptable only for a private local benchmark. Do not deploy this configuration publicly, reuse valuable production keys, or treat sessionStorage as a secure secret vault. The future migration path is a Next.js server-side provider proxy and short-lived authentication for any third-party agent service.
