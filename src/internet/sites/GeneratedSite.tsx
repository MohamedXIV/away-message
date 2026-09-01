import React from 'react';
import type { SiteRouteProps } from '../types';
import type { GeneratedSiteContent, GeneratedSiteTheme } from '../../ai/types';
import { useSimulationStore } from '../../store/useSimulationStore';
import { getFileInfoFromUrl, formatFileSize } from '../../engine/fileUtils';
import { soundManager } from '../../audio/SoundManager';

interface GeneratedSiteProps extends SiteRouteProps {
  content: GeneratedSiteContent;
  meta?: { providerId: string; model: string; latencyMs: number; fromCache: boolean; fallback: boolean };
}

const layoutClasses: Record<GeneratedSiteContent['layout'], string> = {
  centered: 'mx-auto max-w-3xl space-y-4',
  columns: 'mx-auto max-w-5xl grid grid-cols-1 gap-4 md:grid-cols-2',
  forum: 'mx-auto max-w-4xl space-y-2',
  catalog: 'mx-auto max-w-5xl grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3',
  newspaper: 'mx-auto max-w-5xl columns-1 gap-6 md:columns-2',
  sidebar: 'mx-auto max-w-5xl grid grid-cols-1 gap-4 md:grid-cols-[minmax(150px,0.32fr)_minmax(0,1fr)]',
  geocities_table: 'mx-auto max-w-4xl border-4 bg-white p-2',
  myspace_profile: 'mx-auto max-w-4xl grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]',
  guestbook: 'mx-auto max-w-3xl space-y-4',
  blog_diary: 'mx-auto max-w-4xl grid grid-cols-1 gap-6 md:grid-cols-[1fr_200px]',
  webring: 'mx-auto max-w-3xl text-center space-y-4',
};

function sectionClasses(layout: GeneratedSiteContent['layout']): string {
  switch (layout) {
    case 'forum':
      return 'border-b bg-white/70 px-3 py-3 rounded';
    case 'catalog':
      return 'border-2 bg-white p-3 shadow-sm rounded-lg';
    case 'newspaper':
      return 'mb-5 break-inside-avoid border-b-2 bg-white/65 p-3 rounded-sm';
    case 'sidebar':
      return 'border bg-white/75 p-3 shadow-sm rounded-xl';
    case 'columns':
      return 'border bg-white/75 p-3 shadow-sm rounded';
    case 'geocities_table':
      return 'border-2 bg-white p-3 rounded-none shadow-[3px_3px_0_rgba(0,0,0,0.2)]';
    case 'myspace_profile':
      return 'border bg-white p-3 shadow rounded-lg';
    case 'guestbook':
      return 'border bg-white/90 p-4 shadow rounded-2xl';
    case 'blog_diary':
      return 'border bg-white p-4 shadow rounded-xl';
    case 'webring':
      return 'border-2 bg-white p-4 shadow rounded-full';
    default:
      return 'border bg-white/80 p-3 shadow-[2px_2px_0_rgba(0,0,0,0.18)] rounded-lg';
  }
}

function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}

function getSiteImagePrompt(host: string, heading: string, archetype: string): string {
  const cleanHeading = heading.toLowerCase();
  const base = `${heading} — ${archetype} — ${host}`;
  // Era-appropriate prompts for 1998-2004 web
  if (/guestbook|diary/i.test(cleanHeading)) return `${base}, handwritten guestbook page, warm paper, small photo, 2002, soft light, low-res`;
  if (/archive|download/i.test(cleanHeading)) return `${base}, old computer archive, floppy disks, CRT monitor, 2001, small photo, muted`;
  if (/store|shop|catalog/i.test(cleanHeading)) return `${base}, small storefront, products on shelf, 2003, bright, compact camera`;
  if (/forum|board|thread/i.test(cleanHeading)) return `${base}, community forum, people at computers, 2002, indoor, small photo`;
  if (/profile|myspace|about/i.test(cleanHeading)) return `${base}, personal profile, desk with photos, 2003, cozy, small photo`;
  if (/game|play|favorites/i.test(cleanHeading)) return `${base}, video games collection, 2000, colorful, small photo`;
  if (/music|radio|audio/i.test(cleanHeading)) return `${base}, music collection, CDs and headphones, 2001, small photo`;
  return `${base}, early 2000s website, small photo, 4:3, low-res, authentic, 2001`;
}

function getSectionImage(host: string, heading: string, index: number, _theme?: GeneratedSiteTheme, archetype?: string): string {
  // Primary: Pollinations (free, no key) — prompt is site-aware, cached by URL, before picsum
  const prompt = getSiteImagePrompt(host, heading, archetype || heading);
  const seed = Math.abs(hashString(`${host}-${heading}-${index}-${archetype || ''}`)) % 999999;
  const pollinationsUrl = `https://image.pollinations.ai/p/${encodeURIComponent(prompt)}?width=400&height=250&seed=${seed}&nologo=true&model=flux`;
  void _theme;
  return pollinationsUrl;
}

function getFallbackImage(host: string, heading: string, index: number, theme?: GeneratedSiteTheme): string {
  const seedHash = hashString(`${host}-${heading}-${index}`);
  const bg = theme?.paper || '#f5f5dc';
  const accent = theme?.accent || '#ff6b35';
  const primary = theme?.primary || '#0047ab';
  const textColor = theme?.text || '#1a1a1a';
  const isMuted = /guestbook|diary|archive|newsletter/i.test(heading);
  const patternOpacity = isMuted ? '0.07' : '0.09';
  const headingText = heading.slice(0, 28).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const hostText = host.toLowerCase();
  const idxText = `IMG_${String(index + 1).padStart(2, '0')} • ${(seedHash % 900) + 100}KB • ${isMuted ? 'grayscale' : 'color'}`;
  const svg = `<svg width="400" height="250" xmlns="http://www.w3.org/2000/svg" role="img">
  <rect width="400" height="250" fill="${bg}"/>
  <rect width="400" height="250" fill="${primary}" opacity="${patternOpacity}"/>
  <g opacity="0.12">
    <path d="M0 0 L400 250 M400 0 L0 250" stroke="${accent}" stroke-width="1" stroke-dasharray="6 6"/>
    <rect x="12" y="12" width="376" height="226" fill="none" stroke="${accent}" stroke-width="1.5" stroke-dasharray="8 4" opacity="0.5"/>
  </g>
  <rect x="20" y="20" width="360" height="160" rx="6" fill="white" opacity="0.92" stroke="${accent}" stroke-width="1.2"/>
  <text x="200" y="85" text-anchor="middle" font-family="monospace" font-size="13" font-weight="bold" fill="${textColor}">${headingText}</text>
  <text x="200" y="108" text-anchor="middle" font-family="monospace" font-size="9" fill="${textColor}" opacity="0.75">${hostText}</text>
  <text x="200" y="128" text-anchor="middle" font-family="monospace" font-size="8" fill="${accent}" opacity="0.9">${idxText}</text>
  <g transform="translate(200,150)">
    <rect x="-32" y="-10" width="64" height="20" rx="4" fill="${primary}" opacity="0.9"/>
    <text x="0" y="4" text-anchor="middle" font-family="monospace" font-size="7" font-weight="bold" fill="white">320 × 200</text>
  </g>
  <text x="200" y="205" text-anchor="middle" font-family="monospace" font-size="8" fill="${textColor}" opacity="0.55">free image • era 1998-2004 • via local generator</text>
  <text x="200" y="220" text-anchor="middle" font-family="monospace" font-size="7" fill="${textColor}" opacity="0.4">seed: ${seedHash.toString(16).slice(0, 6)}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const SectionImage: React.FC<{ host: string; heading: string; index: number; theme?: GeneratedSiteTheme; archetype?: string; className?: string; style?: React.CSSProperties }> = ({ host, heading, index, theme, archetype, className, style }) => {
  const [stage, setStage] = React.useState(0); // 0: pollinations, 1: picsum, 2: local svg
  const pollinationsUrl = getSectionImage(host, heading, index, theme, archetype);
  const picsumSeed = `${host}-${heading}-${index}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  const picsumUrl = `https://picsum.photos/seed/${encodeURIComponent(picsumSeed)}/400/250`;
  const fallbackUrl = getFallbackImage(host, heading, index, theme);
  const src = stage === 0 ? pollinationsUrl : stage === 1 ? picsumUrl : fallbackUrl;
  return (
    <img
      src={src}
      alt={heading}
      className={className}
      style={style}
      loading="lazy"
      onError={() => setStage((s) => Math.min(s + 1, 2))}
    />
  );
};

function getRadiusForLayout(layout: GeneratedSiteContent['layout'], element: 'card' | 'header' | 'nav' | 'button' | 'image'): string {
  const map: Record<string, Record<string, string>> = {
    centered: { card: 'rounded-xl', header: 'rounded-t-xl', nav: 'rounded-b-xl', button: 'rounded-full', image: 'rounded-lg' },
    columns: { card: 'rounded-lg', header: 'rounded-lg', nav: 'rounded-full', button: 'rounded', image: 'rounded-md' },
    forum: { card: 'rounded-md', header: 'rounded', nav: 'rounded', button: 'rounded', image: 'rounded' },
    catalog: { card: 'rounded-xl', header: 'rounded-xl', nav: 'rounded-lg', button: 'rounded-full', image: 'rounded-lg' },
    newspaper: { card: 'rounded-sm', header: 'rounded-sm', nav: 'rounded-sm', button: 'rounded-sm', image: 'rounded-sm' },
    sidebar: { card: 'rounded-2xl', header: 'rounded-2xl', nav: 'rounded-xl', button: 'rounded-full', image: 'rounded-xl' },
    geocities_table: { card: 'rounded-none', header: 'rounded-none', nav: 'rounded-none', button: 'rounded-none', image: 'rounded-none' },
    myspace_profile: { card: 'rounded-xl', header: 'rounded-xl', nav: 'rounded-lg', button: 'rounded-full', image: 'rounded-full' },
    guestbook: { card: 'rounded-2xl', header: 'rounded-2xl', nav: 'rounded-full', button: 'rounded-full', image: 'rounded-xl' },
    blog_diary: { card: 'rounded-xl', header: 'rounded-xl', nav: 'rounded-lg', button: 'rounded-lg', image: 'rounded-lg' },
    webring: { card: 'rounded-full', header: 'rounded-full', nav: 'rounded-full', button: 'rounded-full', image: 'rounded-full' },
  };
  return map[layout]?.[element] || 'rounded-lg';
}

export const GeneratedSite: React.FC<GeneratedSiteProps> = ({ content, navigate, url, meta }) => {
  const dispatchAction = useSimulationStore((s) => s.dispatchAction);
  const navigateWithinSite = (href: string) => {
    try {
      navigate(new URL(href, url.rawUrl).toString());
    } catch {
      navigate(`${url.protocol}//${url.host}/`);
    }
  };

  const handleDownloadItem = (itemText: string, sectionHeading: string) => {
    // Try to extract a file-like token from the item text, otherwise synthesize one
    const fileMatch = itemText.match(/[\w-]+\.(zip|exe|mp3|jpg|png|txt|rar|tar|gz|7z|msi|wav|mp4|pdf)(\b|$)/i);
    const rawFileName = fileMatch ? fileMatch[0] : `${sectionHeading.replace(/\s+/g, '_').slice(0, 20)}_${itemText.slice(0, 10).replace(/\W+/g, '_')}.zip`;
    const fakeUrl = `http://${url.host}${url.pathname}/${rawFileName}`;
    const info = getFileInfoFromUrl(fakeUrl);
    if (!info) return;
    dispatchAction({
      type: 'DOWNLOAD_START',
      sourceId: `generated_${url.host}_${sectionHeading}`,
      url: info.downloadUrl,
      fileName: info.fileName,
      totalBytes: info.totalBytes,
      sourceMaxKbps: info.sourceMaxKbps,
      fileKind: info.fileKind as any,
    });
    soundManager.play('im_send');
  };

  const isFileItem = (text: string) => /\.(zip|exe|mp3|jpg|jpeg|png|gif|mp4|pdf|rar|tar|gz|7z|msi|wav|txt)\b/i.test(text);

  const theme = content.theme;
  const layout = content.layout;
  const sections = content.sections;
  const primarySection = sections[0];
  const usesHero = layout !== 'forum' && layout !== 'catalog' && layout !== 'newspaper';
  const remainingSections = usesHero ? sections.slice(1) : sections;

  const headerRadius = getRadiusForLayout(layout, 'header');
  const navRadius = getRadiusForLayout(layout, 'nav');
  const imageRadius = getRadiusForLayout(layout, 'image');

  return (
    <div className="min-h-full font-sans select-text" style={{ backgroundColor: theme.paper, color: theme.text }}>
      <header className={`border-b-4 p-4 ${headerRadius}`} style={{ backgroundColor: theme.primary, borderColor: theme.accent, color: '#ffffff' }}>
        <div className="mx-auto flex max-w-5xl items-start justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] opacity-80">{content.archetype}</div>
            <h1 className="text-2xl font-bold tracking-tight">{content.siteName}</h1>
            <p className="mt-1 text-sm opacity-95">{content.tagline}</p>
          </div>
          <div className="max-w-[45%] border px-2 py-1 text-right text-[10px] rounded-lg" style={{ borderColor: theme.accent, backgroundColor: 'rgba(0,0,0,0.18)' }}>
            <div>{content.statusLine}</div>
            <div className="mt-1 opacity-75">{meta?.fromCache ? 'cached copy' : meta?.fallback ? 'offline copy' : `generated in ${meta?.latencyMs ?? 0}ms`}</div>
            <div className="mt-1 font-mono text-[9px] opacity-60">visits: {(hashString(content.siteName) % 9000) + 100} • online: {(hashString(content.title) % 12) + 1}</div>
          </div>
        </div>
      </header>

      {content.links.length > 0 && (
        <nav className={`flex flex-wrap gap-x-4 gap-y-1 border-b px-3 py-2 text-xs ${navRadius}`} style={{ backgroundColor: theme.secondary, borderColor: theme.accent }}>
          {content.links.map((link) => (
            <button key={`${link.label}-${link.href}`} className={`underline px-2 py-0.5 hover:bg-white/40 ${getRadiusForLayout(layout, 'button')}`} style={{ color: theme.primary }} onClick={() => navigateWithinSite(link.href)}>
              {link.label}
            </button>
          ))}
        </nav>
      )}

      <main className="p-4">
        <div className={layoutClasses[layout]}>
          {layout !== 'forum' && layout !== 'catalog' && layout !== 'newspaper' && primarySection && (
            <div className={`border-2 border-dashed p-3 ${getRadiusForLayout(layout, 'card')} overflow-hidden`} style={{ borderColor: theme.accent, backgroundColor: theme.secondary }}>
              <h2 className="text-lg font-bold" style={{ color: theme.primary }}>{content.title}</h2>
              <p className="mt-1 text-sm leading-6">{primarySection.body}</p>
              <SectionImage host={url.host} heading={primarySection.heading} index={99} theme={theme} archetype={content.archetype} className={`mt-2 h-32 w-full object-cover ${imageRadius} border`} style={{ borderColor: theme.accent }} />
            </div>
          )}

          {layout === 'sidebar' && primarySection && (
            <aside className={`border p-3 ${getRadiusForLayout(layout, 'card')} overflow-hidden`} style={{ backgroundColor: theme.primary, borderColor: theme.accent, color: '#ffffff' }}>
              <div className="text-[10px] uppercase tracking-widest opacity-80">{primarySection.heading}</div>
              <p className="mt-2 text-sm leading-6">{primarySection.body}</p>
              <SectionImage host={url.host} heading={primarySection.heading} index={98} theme={theme} archetype={content.archetype} className={`mt-2 h-28 w-full object-cover ${imageRadius} border border-white/30`} style={{}} />
              {primarySection.items.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-4 text-xs">{primarySection.items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>}
            </aside>
          )}

          {remainingSections.map((section, index) => {
            const cardRadius = getRadiusForLayout(layout, 'card');
            return (
              <section key={`${section.heading}-${index}`} className={`${sectionClasses(layout)} ${cardRadius} overflow-hidden`} style={{ borderColor: theme.accent }}>
                <div className="overflow-hidden">
                  <SectionImage host={url.host} heading={section.heading} index={index} theme={theme} archetype={content.archetype} className={`h-36 w-full object-cover ${imageRadius} border-b`} style={{ borderColor: theme.accent }} />
                  <div className="px-1 py-0.5 text-center font-mono text-[9px] opacity-50">{section.heading} • free image • pollinations → picsum → fallback</div>
                </div>
                <h3 className="border-b pb-2 font-bold px-1" style={{ borderColor: theme.secondary, color: theme.primary }}>{section.heading}</h3>
                <div className="px-1 pt-2 text-sm leading-6">
                  <p>{section.body}</p>
                  {section.items.length > 0 && (
                    <ul className={`mt-2 ${layout === 'forum' ? 'list-none' : 'list-disc pl-5'} space-y-1`}>
                      {section.items.map((item, itemIndex) => {
                        const isFile = isFileItem(item);
                        const info = isFile ? getFileInfoFromUrl(`http://${url.host}/${item.split(' ')[0]}`) : null;
                        return (
                          <li key={`${item}-${itemIndex}`} className="flex items-center justify-between gap-2">
                            <span>{item}</span>
                            {isFile && (
                              <button
                                onClick={() => handleDownloadItem(item, section.heading)}
                                className={`shrink-0 border border-gray-400 bg-[#d9e7f5] px-2 py-0.5 text-[11px] font-bold hover:bg-[#c4d9ed] ${getRadiusForLayout(layout, 'button')}`}
                                title={info ? `${info.fileName} • ${formatFileSize(info.totalBytes)}` : 'Download file'}
                              >
                                ⬇ {info ? formatFileSize(info.totalBytes) : 'Download'}
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </section>
            );
          })}
        </div>

        {content.quirks.length > 0 && (
          <aside className="mx-auto mt-5 max-w-5xl border p-3 text-xs" style={{ borderColor: theme.accent, backgroundColor: theme.secondary }}>
            <div className="font-bold" style={{ color: theme.primary }}>{content.quirks[0]}</div>
            {content.quirks.length > 1 && <ul className="mt-1 list-disc space-y-1 pl-5">{content.quirks.slice(1).map((quirk, index) => <li key={`${quirk}-${index}`}>{quirk}</li>)}</ul>}
          </aside>
        )}

        <footer className="mx-auto mt-5 max-w-5xl border-t pt-3 text-[10px] opacity-75" style={{ borderColor: theme.accent }}>
          <div>{content.footerNote}</div>
          <div className="mt-1">{meta?.providerId ? `${meta.providerId} / ${meta.model}` : 'fictional local web page'}</div>
        </footer>
      </main>
    </div>
  );
};
