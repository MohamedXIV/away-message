import React from 'react';
import { resolveOsIconKind, type OsIconKind } from './osIconKinds';

export type { OsIconKind } from './osIconKinds';
export { resolveOsIconKind } from './osIconKinds';

export interface OsIconProps {
  appId?: string | null;
  kind?: OsIconKind;
  size?: number;
  className?: string;
  title?: string;
}

/** Shared period icon language for desktop, Start menu, taskbar and windows.
 * Always SVG (never emoji) so every Orion generation reads consistently. */
export const OsIcon: React.FC<OsIconProps> = ({ appId, kind, size = 32, className, title }) => {
  const resolved = kind ?? resolveOsIconKind(appId);
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className ? `os-app-icon ${className}` : 'os-app-icon'}
      data-os-icon-kind={resolved}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title && <title>{title}</title>}
      {glyph(resolved)}
    </svg>
  );
};

function glyph(kind: OsIconKind): React.ReactNode {
  switch (kind) {
    case 'computer':
      return (
        <>
          <rect x="2" y="4" width="28" height="19" rx="1" fill="#4a4a4a" />
          <rect x="4" y="6" width="24" height="15" fill="#cfd3d6" />
          <rect x="5" y="7" width="22" height="13" fill="#0b3f8f" />
          <rect x="5" y="7" width="22" height="3" fill="#2f6fd0" />
          <rect x="7" y="13" width="10" height="1.5" fill="#8fd3ff" />
          <rect x="7" y="16" width="14" height="1.5" fill="#5fa8e8" />
          <rect x="12" y="23" width="8" height="3" fill="#b9bdc0" />
          <rect x="8" y="26" width="16" height="2" fill="#6f7478" />
          <rect x="25" y="9" width="2" height="2" fill="#28c76f" />
        </>
      );
    case 'folder':
      return (
        <>
          <path d="M3 7h10l3 3h13v16H3z" fill="#c99a12" stroke="#8a6a10" strokeWidth="1" />
          <path d="M4 11h24v14H4z" fill="#f2c14e" stroke="#8a6a10" strokeWidth="1" />
          <path d="M4 11h24v3H4z" fill="#ffe08a" />
        </>
      );
    case 'browser':
      return (
        <>
          <circle cx="16" cy="16" r="12" fill="#1f6fc4" stroke="#0d3d73" strokeWidth="1.5" />
          <path d="M5 13c4-3 7-2 10 0 3 2 7 3 12 0v-2c-5 2-8 1-11-1-3-2-7-2-11 1z" fill="#38a169" />
          <path d="M5 21c4 1 7 0 10-2 3-2 7-2 12 0v3c-5-2-8-1-11 1-3 2-7 2-11 1z" fill="#4caf50" />
          <path d="M16 4c-4 4-4 20 0 24M16 4c4 4 4 20 0 24M4 16h24" stroke="#d8eeff" strokeWidth="1" opacity=".85" fill="none" />
        </>
      );
    case 'web':
      return (
        <>
          <circle cx="16" cy="16" r="11" fill="#2e7d5b" stroke="#174a33" strokeWidth="1.2" />
          <path d="M6 12c4-2 7-1 9 1s6 2 11 0M6 20c4 1 7 0 9-2s6-2 11 0" fill="none" stroke="#8fd3a8" strokeWidth="1.5" />
          <circle cx="10" cy="9" r="2" fill="#ffd24a" />
          <circle cx="22" cy="22" r="2" fill="#ffd24a" />
          <circle cx="22" cy="10" r="1.5" fill="#d8eeff" />
          <path d="M10 9l12 13M22 10l-12 3" stroke="#d8eeff" strokeWidth="1" />
        </>
      );
    case 'notepad':
      return (
        <>
          <path d="M7 3h13l6 6v20H7z" fill="#f8f8f3" stroke="#4a4a4a" strokeWidth="1.2" />
          <path d="M20 3v6h6" fill="#d7d7d2" stroke="#4a4a4a" strokeWidth="1" />
          <path d="M10 13h12M10 16h12M10 19h9M10 22h12" stroke="#3a6ea5" strokeWidth="1.2" />
          <path d="M20 24l2-7 4 1-2 7z" fill="#e2b93b" stroke="#8a6a10" strokeWidth=".8" />
          <path d="M20 24l-1 3 3-1z" fill="#3b3b3b" />
        </>
      );
    case 'terminal':
      return (
        <>
          <rect x="2" y="5" width="28" height="21" rx="1" fill="#c9c9c4" stroke="#4a4a4a" strokeWidth="1.2" />
          <rect x="5" y="8" width="22" height="14" fill="#0c0c0c" />
          <path d="M8 11l4 3-4 3" fill="none" stroke="#42e66d" strokeWidth="1.6" />
          <path d="M15 18h6" stroke="#42e66d" strokeWidth="1.6" />
          <rect x="10" y="26" width="12" height="1.5" fill="#777" />
        </>
      );
    case 'control':
      return (
        <>
          <rect x="3" y="5" width="26" height="22" rx="1" fill="#d6d2c9" stroke="#5a5a5a" strokeWidth="1.2" />
          <path d="M7 11h18M7 16h18M7 21h18" stroke="#8a8a8a" strokeWidth="1.5" />
          <circle cx="12" cy="11" r="2.5" fill="#2f6fd0" stroke="#1a1a1a" />
          <circle cx="20" cy="16" r="2.5" fill="#c9a227" stroke="#1a1a1a" />
          <circle cx="14" cy="21" r="2.5" fill="#3d8b40" stroke="#1a1a1a" />
        </>
      );
    case 'trash':
      return (
        <>
          <path d="M8 10h16l-2 19H10z" fill="#b8bec4" stroke="#4b4b4b" strokeWidth="1.2" />
          <rect x="6" y="6" width="20" height="3" rx="1" fill="#8f979e" stroke="#4b4b4b" strokeWidth="1" />
          <path d="M13 5h6" stroke="#4b4b4b" strokeWidth="2" />
          <path d="M12 14v11M16 14v11M20 14v11" stroke="#7c848b" strokeWidth="1" />
          <path d="M12 13l2 1-1 2-2-1zM20 20l-2-1 1-2 2 1z" fill="#3d8b40" />
        </>
      );
    case 'save':
      return (
        <>
          <rect x="3" y="3" width="26" height="26" rx="1" fill="#2b4d8f" stroke="#172a4f" strokeWidth="1.2" />
          <rect x="8" y="4" width="16" height="9" fill="#d8d8d8" stroke="#333" />
          <rect x="11" y="5.5" width="8" height="2" fill="#555" />
          <rect x="7" y="17" width="18" height="11" fill="#eeeeea" stroke="#333" />
          <path d="M10 20h12M10 23h9" stroke="#5a6f92" strokeWidth="1" />
        </>
      );
    case 'ailab':
      return (
        <>
          <path d="M13 4h6v8l6 12a4 4 0 0 1-3.5 6h-11A4 4 0 0 1 7 24l6-12z" fill="#d9ccff" stroke="#4a2b8a" strokeWidth="1.2" />
          <path d="M10 22c2-2 4-2 6-1s4 1 6-1l2 4a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3z" fill="#7c4dff" />
          <circle cx="13" cy="24" r="1.4" fill="#e7ddff" />
          <circle cx="18" cy="25" r="1" fill="#e7ddff" />
          <path d="M13 4h6" stroke="#4a2b8a" strokeWidth="2" />
        </>
      );
    case 'pulse':
      return (
        <>
          <path d="M4 6h24v16H14l-6 5v-5H4z" fill="#ffd24a" stroke="#7a5a00" strokeWidth="1.3" />
          <circle cx="11" cy="14" r="2" fill="#2f6fd0" />
          <circle cx="16" cy="14" r="2" fill="#2f6fd0" />
          <circle cx="21" cy="14" r="2" fill="#2f6fd0" />
        </>
      );
    case 'mail':
      return (
        <>
          <rect x="3" y="8" width="26" height="17" fill="#f7f7f2" stroke="#3b4c63" strokeWidth="1.3" />
          <path d="M3 8l13 9 13-9" fill="none" stroke="#3b4c63" strokeWidth="1.3" />
          <path d="M3 25l10-9M29 25L19 16" stroke="#8fa4bd" strokeWidth="1" />
          <rect x="20" y="10" width="6" height="5" fill="#d9822b" />
        </>
      );
    case 'download':
      return (
        <>
          <rect x="4" y="4" width="24" height="24" rx="2" fill="#c7ccd1" stroke="#4a4a4a" strokeWidth="1.2" />
          <circle cx="16" cy="14" r="6.5" fill="#e8eef5" stroke="#7b8794" strokeWidth="1" />
          <circle cx="16" cy="14" r="1.8" fill="#7b8794" />
          <path d="M16 18v9M12 23l4 4 4-4" stroke="#2e9e4f" strokeWidth="3" fill="none" />
        </>
      );
    case 'archive':
      return (
        <>
          <path d="M4 9l3-5h18l3 5v18H4z" fill="#c9973f" stroke="#6b4a13" strokeWidth="1.2" />
          <rect x="4" y="9" width="24" height="4" fill="#e0b45f" />
          <path d="M14 13h4v4h-4zM14 20h4v7h-4z" fill="#6b4a13" />
          <path d="M15 15h2M15 22h2" stroke="#f0d9a6" />
        </>
      );
    case 'photo':
      return (
        <>
          <rect x="3" y="6" width="26" height="20" fill="#f3f0e8" stroke="#4a4a4a" strokeWidth="1.2" />
          <rect x="5" y="8" width="22" height="14" fill="#7fc7ef" />
          <circle cx="11" cy="12" r="2.5" fill="#ffe07a" />
          <path d="M5 22l7-7 5 5 4-3 6 5z" fill="#3d8b40" />
          <path d="M5 24h22" stroke="#b9b3a5" />
        </>
      );
    case 'audio':
      return (
        <>
          <path d="M6 18v-3a10 10 0 0 1 20 0v3" fill="none" stroke="#3b3b3b" strokeWidth="2.4" />
          <rect x="4" y="17" width="5" height="9" rx="1.5" fill="#5a5a5a" />
          <rect x="23" y="17" width="5" height="9" rx="1.5" fill="#5a5a5a" />
          <path d="M19 9v12a3 3 0 1 0 3 3" fill="none" stroke="#2f6fd0" strokeWidth="1.5" />
          <circle cx="19" cy="21" r="2.5" fill="#2f6fd0" />
        </>
      );
    case 'weather':
      return (
        <>
          <circle cx="12" cy="12" r="6" fill="#f5c542" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" stroke="#e0a800" strokeWidth="1" />
          <path d="M10 24a4 4 0 0 1 .5-8 6 6 0 0 1 11 1.5A3.5 3.5 0 0 1 21 24z" fill="#e8eef5" stroke="#7b8794" strokeWidth="1" />
        </>
      );
    case 'security':
      return (
        <>
          <path d="M16 3l11 4v9c0 7-4.5 11.5-11 13-6.5-1.5-11-6-11-13V7z" fill="#3d8b40" stroke="#1f4d21" strokeWidth="1.2" />
          <path d="M10 16l4 4 8-9" fill="none" stroke="#eaf7ea" strokeWidth="2.4" />
        </>
      );
    case 'installer':
      return (
        <>
          <path d="M4 8h24v20H4z" fill="#b9a27a" stroke="#5f4d2c" strokeWidth="1.2" />
          <rect x="7" y="4" width="18" height="8" fill="#d9c9a8" stroke="#5f4d2c" />
          <circle cx="16" cy="18" r="6" fill="#dfe7ef" stroke="#7b8794" strokeWidth="1" />
          <circle cx="16" cy="18" r="1.6" fill="#7b8794" />
          <path d="M16 12a6 6 0 0 1 5 2" stroke="#f3a6c8" strokeWidth="1.5" />
        </>
      );
    case 'dialup':
      return (
        <>
          <rect x="5" y="14" width="22" height="12" rx="2" fill="#c9c9c4" stroke="#4a4a4a" strokeWidth="1.2" />
          <path d="M9 14V9a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v5" fill="none" stroke="#4a4a4a" strokeWidth="2" />
          <circle cx="10" cy="20" r="1.5" fill="#3d8b40" />
          <circle cx="10" cy="23" r="1.5" fill="#c9a227" />
          <path d="M15 20h8" stroke="#7b8794" strokeWidth="1" />
        </>
      );
    case 'run':
      return (
        <>
          <rect x="3" y="5" width="26" height="20" rx="1" fill="#d4d0c8" stroke="#4a4a4a" strokeWidth="1.2" />
          <rect x="3" y="5" width="26" height="5" fill="#2f6fd0" />
          <path d="M9 15l5 3-5 3" fill="none" stroke="#2e9e4f" strokeWidth="1.6" />
          <path d="M16 21h8" stroke="#2e9e4f" strokeWidth="1.6" />
        </>
      );
    case 'power':
      return (
        <>
          <circle cx="16" cy="16" r="11" fill="#d4d0c8" stroke="#5a5a5a" strokeWidth="1.2" />
          <path d="M16 6v9" stroke="#c0392b" strokeWidth="3" />
          <path d="M10 10a8 8 0 1 0 12 0" fill="none" stroke="#c0392b" strokeWidth="2.4" />
        </>
      );
    case 'home':
      return (
        <>
          <path d="M4 15L16 5l12 10v12H4z" fill="#d8c9a8" stroke="#5f4d2c" strokeWidth="1.2" />
          <rect x="12" y="18" width="8" height="9" fill="#6b4a13" />
        </>
      );
    case 'desktop':
      return (
        <>
          <rect x="3" y="5" width="26" height="18" rx="1" fill="#cfd3d6" stroke="#4a4a4a" strokeWidth="1.2" />
          <rect x="5" y="7" width="22" height="12" fill="#2f6fd0" />
          <rect x="12" y="23" width="8" height="2" fill="#6f7478" />
          <rect x="8" y="26" width="16" height="2" fill="#6f7478" />
        </>
      );
    case 'app':
    default:
      return (
        <>
          <rect x="3" y="4" width="26" height="24" rx="2" fill="#e8e8e2" stroke="#5a5a5a" strokeWidth="1.2" />
          <rect x="3" y="4" width="26" height="6" fill="#2f6fd0" />
          <rect x="7" y="14" width="10" height="2" fill="#9aa0a6" />
          <rect x="7" y="18" width="16" height="2" fill="#c3c7cb" />
          <rect x="7" y="22" width="13" height="2" fill="#c3c7cb" />
        </>
      );
  }
}
