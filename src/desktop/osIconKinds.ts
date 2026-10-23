export type OsIconKind =
  | 'computer'
  | 'folder'
  | 'browser'
  | 'web'
  | 'notepad'
  | 'terminal'
  | 'control'
  | 'trash'
  | 'save'
  | 'ailab'
  | 'pulse'
  | 'mail'
  | 'download'
  | 'archive'
  | 'photo'
  | 'audio'
  | 'weather'
  | 'security'
  | 'installer'
  | 'dialup'
  | 'run'
  | 'power'
  | 'home'
  | 'desktop'
  | 'app';

/** Stable app-id -> authored icon language. Presentation only; it never
 * changes which programs are installed or launchable. */
export function resolveOsIconKind(appId: string | null | undefined): OsIconKind {
  const id = String(appId ?? '').toLowerCase().replace(/^app\./, '');
  switch (id) {
    case 'fileexplorer':
    case 'mycomputer':
    case 'computer':
      return 'computer';
    case 'browser':
    case 'voyager':
      return 'browser';
    case 'publicweb':
    case 'townsites':
      return 'web';
    case 'notepad':
      return 'notepad';
    case 'terminal':
    case 'cmd':
      return 'terminal';
    case 'system':
    case 'controlpanel':
    case 'control':
      return 'control';
    case 'trash':
    case 'recyclebin':
      return 'trash';
    case 'savegame':
      return 'save';
    case 'ailab':
      return 'ailab';
    case 'pulse':
      return 'pulse';
    case 'mailbox':
      return 'mail';
    case 'flashfetch':
      return 'download';
    case 'zipmate':
      return 'archive';
    case 'photobox':
      return 'photo';
    case 'retroamp':
      return 'audio';
    case 'weatherbuddy':
      return 'weather';
    case 'safesweep':
      return 'security';
    case 'installer':
      return 'installer';
    case 'dialup':
      return 'dialup';
    case 'run':
      return 'run';
    case 'power':
      return 'power';
    case 'home':
      return 'home';
    case 'desktop':
      return 'desktop';
    default:
      return 'app';
  }
}
