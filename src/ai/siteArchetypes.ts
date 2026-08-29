import type { GeneratedSiteLayout, GeneratedSiteTheme } from './types';

export type SiteArchetypeId =
  | 'personal_homepage'
  | 'community_forum'
  | 'local_directory'
  | 'small_storefront'
  | 'download_archive'
  | 'fan_club'
  | 'newsletter'
  | 'webring_portal';

export interface SiteArchetypeSpec {
  id: SiteArchetypeId;
  label: string;
  direction: string;
  recommendedSections: string;
  visualMotif: string;
  defaultLayout: GeneratedSiteLayout;
  theme: GeneratedSiteTheme;
}

export const SITE_ARCHETYPES: SiteArchetypeSpec[] = [
  {
    id: 'personal_homepage',
    label: 'personal homepage',
    direction: 'A small handmade personal page with a diary, favorites, guestbook, and an awkward welcome message.',
    recommendedSections: 'welcome, about the webmaster, updates, guestbook or links',
    visualMotif: 'handmade buttons, a narrow centered column, colored rules, and a personal signature',
    defaultLayout: 'centered',
    theme: { primary: '#1b4965', secondary: '#cae9ff', accent: '#f4a261', paper: '#f7f3df', text: '#1f2933' },
  },
  {
    id: 'community_forum',
    label: 'community forum',
    direction: 'A threaded message board with topic rows, usernames, timestamps, and a moderator note.',
    recommendedSections: 'pinned notice, recent threads, member roll call, rules or FAQ',
    visualMotif: 'dense rows, alternating thread colors, tiny metadata, and a visible reply count',
    defaultLayout: 'forum',
    theme: { primary: '#3c1642', secondary: '#d9c2f0', accent: '#f08a5d', paper: '#f5effb', text: '#24152b' },
  },
  {
    id: 'local_directory',
    label: 'local directory',
    direction: 'A practical city or neighborhood directory collecting small listings and contact notes.',
    recommendedSections: 'directory categories, featured listing, hours and contact notes, map or directions',
    visualMotif: 'index tabs, compact listing cards, columns, and a simple search-like header',
    defaultLayout: 'columns',
    theme: { primary: '#31572c', secondary: '#ecf39e', accent: '#90a955', paper: '#f7f7e8', text: '#243119' },
  },
  {
    id: 'small_storefront',
    label: 'small storefront',
    direction: 'A modest early-web shop with a product shelf, prices, ordering instructions, and shipping notes.',
    recommendedSections: 'featured item, catalog, ordering instructions, shipping or returns',
    visualMotif: 'product cards, price labels, order buttons that do nothing, and a loud promotional badge',
    defaultLayout: 'catalog',
    theme: { primary: '#5f0f40', secondary: '#fbf0f3', accent: '#e36414', paper: '#fff8f0', text: '#301934' },
  },
  {
    id: 'download_archive',
    label: 'download archive',
    direction: 'A hobbyist software or media archive with file entries, versions, mirror notes, and warnings.',
    recommendedSections: 'latest upload, file list, mirror status, compatibility notes',
    visualMotif: 'monospace metadata, compact rows, progress-like bars, and a technical status panel',
    defaultLayout: 'sidebar',
    theme: { primary: '#24423b', secondary: '#d9f0e2', accent: '#e5b567', paper: '#f4f8f0', text: '#1f2d28' },
  },
  {
    id: 'fan_club',
    label: 'fan club or interest page',
    direction: 'An enthusiastic fan page with a club manifesto, gallery descriptions, member shout-outs, and links.',
    recommendedSections: 'club welcome, favorites or gallery, member notes, joining instructions',
    visualMotif: 'bold title treatment, badges, stickers, a side rail, and playful color clashes',
    defaultLayout: 'sidebar',
    theme: { primary: '#7b2d26', secondary: '#f7d6bf', accent: '#f4a261', paper: '#fff5ed', text: '#3d2020' },
  },
  {
    id: 'newsletter',
    label: 'local newsletter',
    direction: 'A dated bulletin or newsletter with a masthead, short articles, classifieds, and an editor note.',
    recommendedSections: 'headline, short briefs, classifieds, editor note or next issue date',
    visualMotif: 'newspaper columns, date stamp, fine rules, and uneven article lengths',
    defaultLayout: 'newspaper',
    theme: { primary: '#2f3e46', secondary: '#cad2c5', accent: '#84a98c', paper: '#f7f7f1', text: '#253238' },
  },
  {
    id: 'webring_portal',
    label: 'webring portal',
    direction: 'A portal that links several related hobby pages, with previous/next navigation and a web ring badge.',
    recommendedSections: 'ring welcome, member sites, previous and next links, ring rules',
    visualMotif: 'left navigation rail, link clusters, badges, and a visible ring-of-sites widget',
    defaultLayout: 'columns',
    theme: { primary: '#355070', secondary: '#c6d8ef', accent: '#eaac8b', paper: '#f5f8fc', text: '#1f3046' },
  },
];

function hashText(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function getSiteArchetype(host: string, worldSeed = 'away-message-demo'): SiteArchetypeSpec {
  const index = hashText(`${worldSeed}:${host.toLowerCase()}`) % SITE_ARCHETYPES.length;
  return SITE_ARCHETYPES[index] || SITE_ARCHETYPES[0]!;
}
