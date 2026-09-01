import React from 'react';
import { renderEmoticonNodes } from './emoticonParser';
import { getFileInfoFromUrl, formatFileSize } from '../../../engine/fileUtils';

const LOCAL_URL_REGEX = /(?:https?:\/\/)?[a-z0-9-]+\.local(?:\/[^\s"'<>]*)?/gi;

export interface DetectedLink {
  url: string;
  host: string;
  href: string;
  raw: string;
}

function normalizeLocalUrl(raw: string): string {
  let cleaned = raw.trim().replace(/[.,;!?]+$/g, '');
  if (!cleaned) return '';
  // Ensure protocol
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = `http://${cleaned}`;
  }
  try {
    const parsed = new URL(cleaned);
    const host = parsed.hostname.toLowerCase();
    if (!host.endsWith('.local')) return '';
    // Keep pathname but strip hash
    const pathname = parsed.pathname || '/';
    const search = parsed.search || '';
    return `${parsed.protocol}//${host}${pathname}${search}`;
  } catch {
    return '';
  }
}

export function extractLocalLinks(text: string): DetectedLink[] {
  if (!text || typeof text !== 'string') return [];
  const matches = text.match(LOCAL_URL_REGEX);
  if (!matches) return [];
  const seen = new Set<string>();
  const links: DetectedLink[] = [];
  for (const raw of matches) {
    const url = normalizeLocalUrl(raw);
    if (!url) continue;
    if (seen.has(url.toLowerCase())) continue;
    seen.add(url.toLowerCase());
    try {
      const parsed = new URL(url);
      links.push({
        url,
        host: parsed.hostname.toLowerCase(),
        href: parsed.pathname + (parsed.search || ''),
        raw,
      });
    } catch {
      // ignore
    }
  }
  return links;
}

export function hasLocalLink(text: string): boolean {
  return extractLocalLinks(text).length > 0;
}

export function renderMessageWithLinks(
  text: string,
  onOpenLink: (url: string) => void,
  isOrion60: boolean,
  onDownload?: (url: string) => void
): React.ReactNode[] {
  if (!text) return [text];
  const links = extractLocalLinks(text);
  if (links.length === 0) {
    return [text];
  }

  const parts: React.ReactNode[] = [];
  let linkIndex = 0;
  const globalRegex = new RegExp(LOCAL_URL_REGEX.source, 'gi');
  let match: RegExpExecArray | null;
  let lastIndex = 0;
  while ((match = globalRegex.exec(text)) !== null) {
    const raw = match[0];
    const matchIndex = match.index;
    const url = normalizeLocalUrl(raw);
    if (!url) continue;
    if (matchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, matchIndex));
    }
    const link = links.find((l) => l.url.toLowerCase() === url.toLowerCase());
    if (link) {
      const info = getFileInfoFromUrl(url);
      const isFile = Boolean(info);
      if (isFile && onDownload) {
        parts.push(
          <span key={`link-${linkIndex++}-${url}`} className="inline-flex items-center gap-1">
            <button
              onClick={(event) => {
                event.stopPropagation();
                onOpenLink(url);
              }}
              className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px] font-bold underline decoration-dotted underline-offset-2 hover:no-underline ${isOrion60 ? 'bg-[#d9e9f7] text-[#1c4167] hover:bg-[#c4d9ed] border border-[#8ab4e0]' : 'bg-[#fff7c7] text-[#6d5000] hover:bg-[#ffed8e] border border-[#c39a35]'}`}
              title={`Open ${url} in Voyager Browser`}
            >
              <span>🔗</span>
              <span className="truncate max-w-[120px]">{link.host}</span>
              <span className="opacity-60">{link.href !== '/' ? link.href.slice(0, 16) : ''}</span>
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation();
                onDownload(url);
              }}
              className="inline-flex items-center gap-0.5 rounded bg-[#d9e7f5] px-1.5 py-0.5 text-[10px] font-bold text-[#1c4167] hover:bg-[#c4d9ed] border border-[#8ab4e0]"
              title={`Download ${info?.fileName || 'file'} • ${info ? formatFileSize(info.totalBytes) : ''}`}
            >
              ⬇ {info ? formatFileSize(info.totalBytes) : 'Save'}
            </button>
          </span>
        );
      } else {
        parts.push(
          <button
            key={`link-${linkIndex++}-${url}`}
            onClick={(event) => {
              event.stopPropagation();
              onOpenLink(url);
            }}
            className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px] font-bold underline decoration-dotted underline-offset-2 hover:no-underline ${isOrion60 ? 'bg-[#d9e9f7] text-[#1c4167] hover:bg-[#c4d9ed] border border-[#8ab4e0]' : 'bg-[#fff7c7] text-[#6d5000] hover:bg-[#ffed8e] border border-[#c39a35]'}`}
            title={`Open ${url} in Voyager Browser`}
          >
            <span>🔗</span>
            <span className="truncate max-w-[160px]">{link.host}</span>
            <span className="opacity-60">{link.href !== '/' ? link.href.slice(0, 20) : ''}</span>
          </button>
        );
      }
    } else {
      parts.push(raw);
    }
    lastIndex = matchIndex + raw.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? parts : [text];
}

export function renderWithLinksAndEmoticons(
  text: string,
  isOrion60: boolean,
  onOpenLink: (url: string) => void,
  onDownload?: (url: string) => void
): React.ReactNode {
  const linkParts = renderMessageWithLinks(text, onOpenLink, isOrion60, onDownload);
  return linkParts.map((part, index) => {
    if (typeof part === 'string') {
      return <React.Fragment key={`text-${index}`}>{renderEmoticonNodes(part, isOrion60)}</React.Fragment>;
    }
    return <React.Fragment key={`linkwrap-${index}`}>{part}</React.Fragment>;
  });
}

// For AI prompt: suggest links to include
export const BUDDY_LINK_POOLS: Record<string, Array<{ host: string; path: string; title: string; snippet: string }>> = {
  maya: [
    { host: 'rain-archive.local', path: '/', title: 'Rain Archive — field recordings from the canal', snippet: 'Maya\'s collection of late-night rain and street hum recordings.' },
    { host: 'myplace.local', path: '/maya_x', title: 'Maya — myplace photography', snippet: 'Maya\'s photos from 4th Street Diner and night walks.' },
    { host: 'nightboard.local', path: '/thread/104', title: 'NightBoard thread #104 — hum near the canal', snippet: 'Audio observations near the waterworks bridge.' },
    { host: 'retroamp.local', path: '/playlist/maya-blue', title: 'RetroAmp — Maya Blue playlist', snippet: 'A slow, rainy playlist Maya put together.' },
  ],
  ryan: [
    { host: 'downloadhub.local', path: '/files/flashfetch', title: 'FlashFetch 3.1 — download accelerator', snippet: 'Ryan\'s favorite download helper for slow connections.' },
    { host: 'techmart.local', path: '/product/ram512', title: 'TechMart — 512MB RAM upgrade', snippet: 'Ryan recommends this RAM stick for 1024MB total.' },
    { host: 'taco-cart.local', path: '/', title: 'Taco Cart — corner stand menu', snippet: 'The cart where Ryan grabs tacos after shifts.' },
    { host: 'pc-help.local', path: '/', title: 'PC Help & Tweaks — mirror links', snippet: 'Ryan hangs out here for driver mirrors.' },
  ],
  nora: [
    { host: 'nightboard.local', path: '/thread/112', title: 'NightBoard — WeatherBuddy warning', snippet: 'Nora flagged the SearchMate toolbar bundle.' },
    { host: 'canal-hum.local', path: '/recording', title: 'Canal Hum — 60Hz field recording', snippet: 'Nora\'s low-frequency recording from the industrial canal.' },
    { host: 'citywire.local', path: '/article/power_grid', title: 'CityWire — power grid upgrades', snippet: 'Overnight maintenance affecting the motel district.' },
    { host: 'archive.local', path: '/logs/nora-index', title: 'Archive — Nora\'s log index', snippet: 'An indexed collection of old motel logs.' },
  ],
  henderson: [
    { host: 'motellink.local', path: '/', title: 'Starlite Motel — guest network', snippet: 'Official motel notices and rent schedule.' },
    { host: 'citywire.local', path: '/article/motel-district', title: 'CityWire — motel district updates', snippet: 'News about the north motel corridor.' },
    { host: 'goldnet.local', path: '/', title: 'GoldNet — rent payment portal', snippet: 'Where Henderson tracks rent payments.' },
  ],
};

export function pickRandomBuddyLink(buddyId: string, seedMinute: number): { host: string; path: string; title: string; snippet: string; url: string } | null {
  const pool = BUDDY_LINK_POOLS[buddyId];
  if (!pool || pool.length === 0) return null;
  let hash = 0;
  const str = `${buddyId}:${seedMinute}`;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  const entry = pool[hash % pool.length];
  if (!entry) return null;
  return { ...entry, url: `http://${entry.host}${entry.path}` };
}

export function getDiscoverableLinkForQuery(query: string, host: string): string {
  // Helper to generate a fictional URL for a query that was shared via Pulse
  const clean = query.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'discovery';
  return `http://${host}/${clean}`;
}
