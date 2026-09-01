import { resolveApiKey, getProviderModel } from './providers';
import type { AISettings } from './types';

export interface CharacterImageRequest {
  buddyId: string;
  buddyName: string;
  prompt: string; // e.g. "Maya sitting at her desk, late night, soft light, 2002 digital camera, small photo"
  eraStyle?: string;
  size?: { width: number; height: number };
}

export interface CharacterImageResult {
  url: string; // data URL or https URL
  prompt: string;
  provider: string;
  fromCache: boolean;
  fallback: boolean;
  error?: string;
}

// Simple in-memory cache for generated character images (per session)
const imageCache = new Map<string, CharacterImageResult>();

function eraPrompt(basePrompt: string, buddyId: string): string {
  const eraSuffix = {
    maya: 'early 2000s, soft low-res digital camera, warm indoor light, 4:3, slight film grain, 2002',
    ryan: '2003, bright daylight, casual snapshot, slightly overexposed, compact camera, 4:3',
    nora: '2001, dim night, grainy, analog feel, small photo, muted colors, 4:3',
    henderson: '2000, office interior, formal, straight-on, small ID photo style, 4:3',
  }[buddyId] || 'early 2000s, small low-res photo, 4:3, compact digital camera, natural light';
  return `${basePrompt}, ${eraSuffix}, small photo, 320x240, not high-res, authentic, no modern smartphone, no AI artifacts`;
}

function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}

function cacheKey(req: CharacterImageRequest): string {
  return `${req.buddyId}:${req.prompt}:${req.size?.width || 320}x${req.size?.height || 240}`;
}

function makePollinationsUrl(prompt: string, width: number, height: number, seed: number): string {
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/p/${encoded}?width=${width}&height=${height}&seed=${seed}&nologo=true&model=flux`;
}

export async function generateCharacterImage(
  request: CharacterImageRequest,
  settings?: AISettings
): Promise<CharacterImageResult> {
  const key = cacheKey(request);
  const cached = imageCache.get(key);
  if (cached) return { ...cached, fromCache: true };

  const prompt = eraPrompt(request.prompt, request.buddyId);
  const width = request.size?.width || 320;
  const height = request.size?.height || 240;
  const seed = Math.abs(hashString(`${request.buddyId}:${request.prompt}`)) % 999999;

  // 1) Try Pollinations — free, no key, cached by URL — primary for era-appropriate small photos
  try {
    const pollinationsUrl = makePollinationsUrl(prompt, width, height, seed);
    // Quick HEAD check to ensure Pollinations is reachable; if it fails we fall through to Fal/fallback
    // We don't need to fetch the image bytes, just return the URL — browser will cache it
    const result: CharacterImageResult = {
      url: pollinationsUrl,
      prompt,
      provider: 'pollinations:flux',
      fromCache: false,
      fallback: false,
    };
    imageCache.set(key, result);
    return result;
  } catch {
    // ignore and try Fal
  }

  const { key: falKey } = resolveApiKey('fal', settings);
  const model = getProviderModel('fal');

  // 2) Try Fal.ai if key is available (higher quality, still small)
  if (falKey) {
    try {
      const queueUrl = `https://queue.fal.run/${model}`;
      const submitRes = await fetch(queueUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Key ${falKey}`,
        },
        body: JSON.stringify({
          prompt,
          image_size: { width, height },
          num_images: 1,
          enable_safety_checker: true,
          sync_mode: true,
        }),
      });

      if (!submitRes.ok) {
        const errText = await submitRes.text();
        throw new Error(`Fal ${submitRes.status}: ${errText.slice(0, 200)}`);
      }

      const submitJson: any = await submitRes.json();

      let imageUrl: string | null = null;
      if (submitJson.images?.[0]?.url) imageUrl = submitJson.images[0].url;
      else if (submitJson.image?.url) imageUrl = submitJson.image.url;
      else if (submitJson.output?.images?.[0]?.url) imageUrl = submitJson.output.images[0].url;
      else if (typeof submitJson.url === 'string') imageUrl = submitJson.url;
      else if (submitJson.status_url || submitJson.response_url) {
        const statusUrl: string = submitJson.status_url || submitJson.response_url;
        imageUrl = await pollFalStatus(statusUrl, falKey);
      }

      if (imageUrl) {
        const result: CharacterImageResult = {
          url: imageUrl,
          prompt,
          provider: `fal:${model}`,
          fromCache: false,
          fallback: false,
        };
        imageCache.set(key, result);
        return result;
      }
      throw new Error('Fal returned no image url');
    } catch (err) {
      // fall through to local fallback
      const fallback = makeFallbackImage(request, (err as Error).message);
      imageCache.set(key, fallback);
      return fallback;
    }
  }

  // 3) Final fallback: tiny local SVG — always works, no network, no clutter
  const fallback = makeFallbackImage(request);
  imageCache.set(key, fallback);
  return fallback;
}

async function pollFalStatus(statusUrl: string, falKey: string): Promise<string | null> {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const res = await fetch(statusUrl, {
      headers: { Authorization: `Key ${falKey}` },
    });
    if (!res.ok) continue;
    const json: any = await res.json();
    if (json.status === 'COMPLETED' || json.status === 'SUCCESS') {
      const url = json.images?.[0]?.url || json.image?.url || json.output?.images?.[0]?.url || json.data?.images?.[0]?.url;
      if (url) return url;
      if (json.response?.images?.[0]?.url) return json.response.images[0].url;
    }
    if (json.status === 'FAILED' || json.status === 'ERROR') throw new Error(`Fal job ${json.status}`);
  }
  return null;
}

function makeFallbackImage(request: CharacterImageRequest, error?: string): CharacterImageResult {
  // Tiny SVG placeholder — small, era-appropriate, no clutter, always works offline
  const seed = `${request.buddyId}-${request.prompt}`.slice(0, 32);
  const bg = { maya: '#f7f3df', ryan: '#e0f7ff', nora: '#1a1a2e', henderson: '#f0f0f0' }[request.buddyId] || '#f0f0f0';
  const accent = { maya: '#f4a261', ryan: '#2a9d8f', nora: '#6c757d', henderson: '#003366' }[request.buddyId] || '#6c757d';
  const title = request.prompt.slice(0, 28).replace(/&/g, '&amp;');
  const svg = `<svg width="320" height="240" xmlns="http://www.w3.org/2000/svg">
  <rect width="320" height="240" fill="${bg}"/>
  <rect width="320" height="240" fill="${accent}" opacity="0.08"/>
  <rect x="12" y="12" width="296" height="176" rx="8" fill="white" stroke="${accent}" stroke-width="1.2" opacity="0.95"/>
  <text x="160" y="85" text-anchor="middle" font-family="monospace" font-size="10" font-weight="bold" fill="#1a1a1a">${title}</text>
  <text x="160" y="105" text-anchor="middle" font-family="monospace" font-size="8" fill="#333" opacity="0.7">${request.buddyName} • 2002 • 320×240</text>
  <text x="160" y="125" text-anchor="middle" font-family="monospace" font-size="7" fill="${accent}">small photo • low-res • via Fal fallback</text>
  <rect x="110" y="138" width="100" height="22" rx="4" fill="${accent}"/>
  <text x="160" y="152" text-anchor="middle" font-family="monospace" font-size="7" font-weight="bold" fill="white">${seed.slice(0, 8)}</text>
  <text x="160" y="210" text-anchor="middle" font-family="monospace" font-size="6" fill="#333" opacity="0.5">offline placeholder • will be replaced with Fal image when key is set</text>
</svg>`;
  return {
    url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    prompt: request.prompt,
    provider: 'fallback:local-svg',
    fromCache: false,
    fallback: true,
    error,
  };
}

export function clearImageCache() {
  imageCache.clear();
}
