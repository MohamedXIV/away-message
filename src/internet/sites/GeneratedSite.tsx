import type { SiteRouteProps } from '../types';
import type { GeneratedSiteContent } from '../../ai/types';

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
};

function sectionClasses(layout: GeneratedSiteContent['layout']): string {
  switch (layout) {
    case 'forum':
      return 'border-b bg-white/70 px-3 py-3';
    case 'catalog':
      return 'border-2 bg-white p-3 shadow-sm';
    case 'newspaper':
      return 'mb-5 break-inside-avoid border-b-2 bg-white/65 p-3';
    case 'sidebar':
      return 'border bg-white/75 p-3 shadow-sm';
    case 'columns':
      return 'border bg-white/75 p-3 shadow-sm';
    default:
      return 'border bg-white/80 p-3 shadow-[2px_2px_0_rgba(0,0,0,0.18)]';
  }
}

export const GeneratedSite: React.FC<GeneratedSiteProps> = ({ content, navigate, url, meta }) => {
  const navigateWithinSite = (href: string) => {
    try {
      navigate(new URL(href, url.rawUrl).toString());
    } catch {
      navigate(`${url.protocol}//${url.host}/`);
    }
  };

  const theme = content.theme;
  const layout = content.layout;
  const sections = content.sections;
  const primarySection = sections[0];
  const usesHero = layout !== 'forum' && layout !== 'catalog' && layout !== 'newspaper';
  const remainingSections = usesHero ? sections.slice(1) : sections;

  return (
    <div className="min-h-full font-sans select-text" style={{ backgroundColor: theme.paper, color: theme.text }}>
      <header className="border-b-4 p-4" style={{ backgroundColor: theme.primary, borderColor: theme.accent, color: '#ffffff' }}>
        <div className="mx-auto flex max-w-5xl items-start justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] opacity-80">{content.archetype}</div>
            <h1 className="text-2xl font-bold tracking-tight">{content.siteName}</h1>
            <p className="mt-1 text-sm opacity-95">{content.tagline}</p>
          </div>
          <div className="max-w-[45%] border px-2 py-1 text-right text-[10px]" style={{ borderColor: theme.accent, backgroundColor: 'rgba(0,0,0,0.18)' }}>
            <div>{content.statusLine}</div>
            <div className="mt-1 opacity-75">{meta?.fromCache ? 'cached copy' : meta?.fallback ? 'offline copy' : `generated in ${meta?.latencyMs ?? 0}ms`}</div>
          </div>
        </div>
      </header>

      {content.links.length > 0 && (
        <nav className="flex flex-wrap gap-x-4 gap-y-1 border-b px-3 py-2 text-xs" style={{ backgroundColor: theme.secondary, borderColor: theme.accent }}>
          {content.links.map((link) => (
            <button key={`${link.label}-${link.href}`} className="underline" style={{ color: theme.primary }} onClick={() => navigateWithinSite(link.href)}>
              {link.label}
            </button>
          ))}
        </nav>
      )}

      <main className="p-4">
        <div className={layoutClasses[layout]}>
          {layout !== 'forum' && layout !== 'catalog' && layout !== 'newspaper' && primarySection && (
            <div className="border-2 border-dashed p-3" style={{ borderColor: theme.accent, backgroundColor: theme.secondary }}>
              <h2 className="text-lg font-bold" style={{ color: theme.primary }}>{content.title}</h2>
              <p className="mt-1 text-sm leading-6">{primarySection.body}</p>
            </div>
          )}

          {layout === 'sidebar' && primarySection && (
            <aside className="border p-3" style={{ backgroundColor: theme.primary, borderColor: theme.accent, color: '#ffffff' }}>
              <div className="text-[10px] uppercase tracking-widest opacity-80">{primarySection.heading}</div>
              <p className="mt-2 text-sm leading-6">{primarySection.body}</p>
              {primarySection.items.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-4 text-xs">{primarySection.items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>}
            </aside>
          )}

          {remainingSections.map((section, index) => (
            <section key={`${section.heading}-${index}`} className={sectionClasses(layout)} style={{ borderColor: theme.accent }}>
              <h3 className="border-b pb-2 font-bold" style={{ borderColor: theme.secondary, color: theme.primary }}>{section.heading}</h3>
              <div className="pt-2 text-sm leading-6">
                <p>{section.body}</p>
                {section.items.length > 0 && (
                  <ul className={`mt-2 ${layout === 'forum' ? 'list-none' : 'list-disc pl-5'} space-y-1`}>
                    {section.items.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{item}</li>)}
                  </ul>
                )}
              </div>
            </section>
          ))}
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
