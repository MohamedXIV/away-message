// src/internet/worldSiteHelpers.ts
// Helpers to make every .local site react to the same governed WorldEventsEngine state.
// Each site filters the same canonical triggeredEvents — no duplicate sources of truth.

import type { GlobalEvent, WorldState } from '../engine/types';

export function getTriggeredForDay(world: WorldState | null | undefined, currentDay: number): GlobalEvent[] {
  if (!world?.triggeredEvents) return [];
  return world.triggeredEvents.filter((e) => e.triggerDay <= currentDay);
}

export function filterByCategory(events: GlobalEvent[], categories: string[]): GlobalEvent[] {
  const set = new Set(categories);
  return events.filter((e) => set.has(e.category));
}

export function filterByHost(events: GlobalEvent[], hostSubstring: string): GlobalEvent[] {
  return events.filter((e) => (e.siteUrl || '').includes(hostSubstring));
}

// --- TechMart: stock & pricing reacts to OS/economy events ---
export interface TechMartDynamicState {
  banners: Array<{ text: string; tone: 'info' | 'warning' | 'success' }>;
  priceModifiers: Record<string, number>; // productId -> multiplier (e.g. 1.15 = +15%)
  featuredProductIds: string[]; // highlight these
  newProducts: Array<{ id: string; name: string; category: 'OS' | 'RAM'; price: number; description: string; specs: string; eventId: string }>;
}

export function getTechMartDynamicState(world: WorldState | null | undefined, currentDay: number): TechMartDynamicState {
  const triggered = getTriggeredForDay(world, currentDay);
  const banners: TechMartDynamicState['banners'] = [];
  const priceModifiers: Record<string, number> = {};
  const featuredProductIds: string[] = [];
  const newProducts: TechMartDynamicState['newProducts'] = [];

  for (const e of triggered) {
    if (e.id.includes('orion_os_7') || e.category === 'os_release') {
      if (e.id === 'orion_os_7_release' || e.title.toLowerCase().includes('orion 7')) {
        banners.push({ text: `NOW STOCKED: ${e.title} — boxed copies at counter, also on DownloadHub mirrors`, tone: 'success' });
        // Price pressure on RAM when OS 7 requires 1GB
        if (e.knowledgePrompt.toLowerCase().includes('1gb') || e.title.toLowerCase().includes('1gb')) {
          priceModifiers['ram_512'] = 1.25;
          priceModifiers['ram_768'] = 1.18;
          priceModifiers['ram_1024'] = 1.12;
          featuredProductIds.push('ram_1024');
        }
        // Add Orion 7 product dynamically if not in static catalog
        if (!newProducts.some((p) => p.id === 'os_orion7')) {
          newProducts.push({
            id: 'os_orion7',
            name: 'Orion OS 7 Gloss Edition (Boxed)',
            category: 'OS',
            price: 59.0,
            description: 'Glossy dock, new screensavers, requires 768MB min / 1GB recommended. Midnight launch poster included.',
            specs: 'DVD-ROM, Gloss Slipcase, 2 Reboots “for drama”',
            eventId: e.id,
          });
        }
      } else if (e.id.includes('beta') || e.title.toLowerCase().includes('beta')) {
        banners.push({ text: `Beta chatter: ${e.title} — TechMart staff testing on back bench`, tone: 'info' });
      }
    }
    if (e.category === 'economy' && (e.title.toLowerCase().includes('ram') || e.knowledgePrompt.toLowerCase().includes('ram'))) {
      banners.push({ text: `Market: ${e.title} — used sticks climbing`, tone: 'warning' });
      priceModifiers['ram_512'] = Math.max(priceModifiers['ram_512'] ?? 1, 1.15);
      priceModifiers['ram_1024'] = Math.max(priceModifiers['ram_1024'] ?? 1, 1.08);
    }
    if (e.category === 'system' && e.title.toLowerCase().includes('dsl')) {
      banners.push({ text: `Network: ${e.title}`, tone: 'info' });
    }
  }

  // Deduplicate banners
  const seen = new Set<string>();
  const deduped = banners.filter((b) => {
    if (seen.has(b.text)) return false;
    seen.add(b.text);
    return true;
  });

  return { banners: deduped.slice(0, 3), priceModifiers, featuredProductIds, newProducts };
}

// --- DownloadHub: catalog grows with site_launch / os_release mirrors ---
export interface DownloadHubDynamicItem {
  id: string;
  name: string;
  category: 'Utilities' | 'Multimedia' | 'Internet' | 'Security';
  version: string;
  fileSizeBytes: number;
  downloadUrl: string;
  description: string;
  eventId: string;
  triggerDay: number;
  isNew?: boolean;
}

export function getDownloadHubDynamicItems(world: WorldState | null | undefined, currentDay: number): DownloadHubDynamicItem[] {
  const triggered = getTriggeredForDay(world, currentDay);
  const out: DownloadHubDynamicItem[] = [];
  for (const e of triggered) {
    const host = (() => {
      try { return e.siteUrl ? new URL(e.siteUrl).hostname : ''; } catch { return ''; }
    })();
    if (host === 'downloadhub.local' || host === 'orionsoft.local' || e.category === 'os_release' || e.category === 'site_launch') {
      // Avoid duplicating static Pulse/RetroAmp etc — only add if siteUrl points to downloadhub or orionsoft
      if (host === 'downloadhub.local' || (e.siteUrl && e.siteUrl.includes('downloadhub.local')) || e.title.toLowerCase().includes('mirror') || e.title.toLowerCase().includes('skin') || e.title.toLowerCase().includes('orion')) {
        const fileName = `${e.id}.zip`.replace(/[^a-z0-9_.-]/g, '_');
        out.push({
          id: `dyn_${e.id}`,
          name: e.title,
          category: e.category === 'os_release' ? 'Utilities' : e.category === 'site_launch' ? 'Internet' : 'Utilities',
          version: `Day ${e.triggerDay}`,
          fileSizeBytes: 1024 * 1024 * (4 + (e.id.length % 6)), // 4-9 MB plausible
          downloadUrl: e.siteUrl || `http://downloadhub.local/files/${fileName}`,
          description: `${e.description} — ${e.knowledgePrompt}`,
          eventId: e.id,
          triggerDay: e.triggerDay,
          isNew: currentDay - e.triggerDay <= 2,
        });
      }
    }
  }
  // Most recent first, cap 4
  return out.sort((a, b) => b.triggerDay - a.triggerDay).slice(0, 4) as unknown as DownloadHubDynamicItem[];
}

// --- NightBoard: each triggered event becomes a thread ---
export interface NightBoardDynamicThread {
  id: number;
  title: string;
  category: string;
  replyCount: number;
  lastReplyDate: string;
  eventId: string;
  isDynamic: true;
}

export function getNightBoardDynamicThreads(world: WorldState | null | undefined, currentDay: number): NightBoardDynamicThread[] {
  const triggered = getTriggeredForDay(world, currentDay);
  // Only city_news / os_release / site_launch / culture become threads — economy/system less
  const eligible = triggered.filter((e) => ['city_news', 'os_release', 'site_launch', 'culture'].includes(e.category));
  return eligible.slice(-6).map((e) => {
    const hash = e.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const threadId = 200 + (hash % 700); // avoid colliding with static 52,89,104
    return {
      id: threadId,
      title: e.title,
      category: e.category === 'os_release' ? '/tech/ - Orion OS' : e.category === 'site_launch' ? '/web/ - Sites & Mirrors' : '/lounge/ - City Talk',
      replyCount: 1 + (hash % 5),
      lastReplyDate: `Day ${e.triggerDay}, ${String(e.triggerHour ?? 10).padStart(2, '0')}:00`,
      eventId: e.id,
      isDynamic: true as const,
    };
  });
}

// --- GoldNet: price driven by economy events ---
export function getGoldNetPrice(world: WorldState | null | undefined, currentDay: number, basePrice = 100): { price: number; delta: number; historyLabel: string } {
  const triggered = getTriggeredForDay(world, currentDay);
  let price = basePrice;
  let lastDelta = 0;
  for (const e of triggered) {
    if (e.category !== 'economy') continue;
    const lower = (e.title + ' ' + e.knowledgePrompt).toLowerCase();
    if (lower.includes('surge') || lower.includes('spike') || lower.includes('climb')) {
      const delta = 8 + (e.id.length % 7);
      price += delta;
      lastDelta = delta;
    } else if (lower.includes('dip') || lower.includes('cool') || lower.includes('correct')) {
      const delta = -(5 + (e.id.length % 6));
      price += delta;
      lastDelta = delta;
    }
  }
  const historyLabel = triggered.filter((e) => e.category === 'economy').slice(-2).map((e) => e.title).join(' / ') || 'Steady canal air';
  return { price: Math.max(40, Math.round(price * 100) / 100), delta: lastDelta, historyLabel };
}

// --- Search: procedural entries for FindIt ---
export interface ProceduralSearchEntry {
  id: string;
  title: string;
  url: string;
  snippet: string;
  category: 'software' | 'news' | 'community' | 'hardware' | 'social';
  keywords: string[];
  availableFromDay: number;
  datePublished: string;
}

export function getProceduralSearchEntries(world: WorldState | null | undefined, currentDay: number): ProceduralSearchEntry[] {
  const triggered = getTriggeredForDay(world, currentDay);
  return triggered.map((e) => {
    const host = (() => { try { return e.siteUrl ? new URL(e.siteUrl).hostname : 'citywire.local'; } catch { return 'citywire.local'; } })();
    const cat: ProceduralSearchEntry['category'] =
      e.category === 'os_release' || e.category === 'system' ? 'software' :
      e.category === 'economy' || e.category === 'site_launch' ? 'hardware' : 'news';
    const keywords = [...new Set([...e.title.toLowerCase().split(/\W+/), ...e.knowledgePrompt.toLowerCase().split(/\W+/)].filter((w) => w.length > 2).slice(0, 8))];
    return {
      id: `proc_search_${e.id}`,
      title: e.title,
      url: e.siteUrl || `http://${host}/`,
      snippet: `${e.description} — ${e.knowledgePrompt}`,
      category: cat,
      keywords,
      availableFromDay: e.triggerDay,
      datePublished: `Day ${e.triggerDay}, 2006`,
    };
  });
}
