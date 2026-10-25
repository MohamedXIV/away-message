import { getReleaseById, type OsThemeId } from '../../engine/OsCatalog';
import type { OsVersion } from '../../engine/types';

export type WindowTransitionId =
  | 'snap'
  | 'classic-scale'
  | 'soft-scale'
  | 'gloss-zoom'
  | 'fade-collapse';

export type WindowTransitionAction = 'open' | 'close' | 'minimize' | 'restore';

export type OsDefaultWallpaperId = 'classic_teal' | 'bliss_green';

export type OsDesktopWallpaperId =
  | 'harbor_classic'
  | 'aperture_sand'
  | 'canal_bliss'
  | 'lumen_gloss';

export type OsIconStyleId = 'classic' | 'soft' | 'gloss';

export interface OsPresentationProfile {
  themeId: OsThemeId;
  uiFontStack: string;
  titlebar: {
    fontStack: string;
    fontWeight: number;
  };
  baseFontSizePx: number;
  /** Authored desktop surface identity. Keep icon language and wallpaper out
   * of individual applications so every Orion generation stays coherent. */
  desktop: {
    wallpaperId: OsDesktopWallpaperId;
    iconStyle: OsIconStyleId;
    iconCellWidthPx: number;
    iconCellHeightPx: number;
    iconGlyphSizePx: number;
  };
  window: {
    chromeId: 'beveled' | 'flat-classic' | 'soft-classic' | 'gloss';
    borderRadiusPx: number;
    shadow: 'none' | 'hard' | 'soft' | 'gloss';
    animation: {
      open: WindowTransitionId;
      close: WindowTransitionId;
      minimize: WindowTransitionId;
      restore: WindowTransitionId;
    };
  };
  shell: {
    taskbarId: 'classic' | 'aperture' | 'canal' | 'gloss';
    taskbarHeightPx: number;
    startMenuId: 'classic' | 'aperture' | 'canal' | 'gloss';
    defaultWallpaperId: OsDefaultWallpaperId;
  };
  soundSchemeId: 'orion48' | 'orion50' | 'orion60' | 'orion70';
  capabilities: {
    glossyChrome: boolean;
    animatedWindowTransitions: boolean;
  };
}

const PRESENTATION_BY_THEME: Record<OsThemeId, OsPresentationProfile> = {
  orion48: {
    themeId: 'orion48',
    uiFontStack: '"MS Sans Serif", Tahoma, Arial, sans-serif',
    titlebar: { fontStack: '"MS Sans Serif", Tahoma, Arial, sans-serif', fontWeight: 700 },
    baseFontSizePx: 12,
    desktop: {
      wallpaperId: 'harbor_classic',
      iconStyle: 'classic',
      iconCellWidthPx: 84,
      iconCellHeightPx: 88,
      iconGlyphSizePx: 38,
    },
    window: {
      chromeId: 'beveled',
      borderRadiusPx: 0,
      shadow: 'hard',
      animation: {
        open: 'snap',
        close: 'snap',
        minimize: 'fade-collapse',
        restore: 'snap',
      },
    },
    shell: {
      taskbarId: 'classic',
      taskbarHeightPx: 28,
      startMenuId: 'classic',
      defaultWallpaperId: 'classic_teal',
    },
    soundSchemeId: 'orion48',
    capabilities: { glossyChrome: false, animatedWindowTransitions: false },
  },
  orion50: {
    themeId: 'orion50',
    uiFontStack: 'Tahoma, Arial, sans-serif',
    titlebar: { fontStack: 'Tahoma, Arial, sans-serif', fontWeight: 700 },
    baseFontSizePx: 12,
    desktop: {
      wallpaperId: 'aperture_sand',
      iconStyle: 'soft',
      iconCellWidthPx: 86,
      iconCellHeightPx: 90,
      iconGlyphSizePx: 40,
    },
    window: {
      chromeId: 'flat-classic',
      borderRadiusPx: 2,
      shadow: 'hard',
      animation: {
        open: 'classic-scale',
        close: 'classic-scale',
        minimize: 'fade-collapse',
        restore: 'classic-scale',
      },
    },
    shell: {
      taskbarId: 'aperture',
      taskbarHeightPx: 28,
      startMenuId: 'aperture',
      defaultWallpaperId: 'classic_teal',
    },
    soundSchemeId: 'orion50',
    capabilities: { glossyChrome: false, animatedWindowTransitions: true },
  },
  orion60: {
    themeId: 'orion60',
    uiFontStack: 'Tahoma, "Trebuchet MS", Arial, sans-serif',
    titlebar: { fontStack: '"Trebuchet MS", Tahoma, Arial, sans-serif', fontWeight: 700 },
    baseFontSizePx: 13,
    desktop: {
      wallpaperId: 'canal_bliss',
      iconStyle: 'soft',
      iconCellWidthPx: 88,
      iconCellHeightPx: 92,
      iconGlyphSizePx: 42,
    },
    window: {
      chromeId: 'soft-classic',
      borderRadiusPx: 5,
      shadow: 'soft',
      animation: {
        open: 'soft-scale',
        close: 'soft-scale',
        minimize: 'fade-collapse',
        restore: 'soft-scale',
      },
    },
    shell: {
      taskbarId: 'canal',
      taskbarHeightPx: 32,
      startMenuId: 'canal',
      defaultWallpaperId: 'bliss_green',
    },
    soundSchemeId: 'orion60',
    capabilities: { glossyChrome: false, animatedWindowTransitions: true },
  },
  orion70: {
    themeId: 'orion70',
    uiFontStack: '"Segoe UI", Tahoma, Arial, sans-serif',
    titlebar: { fontStack: '"Segoe UI", Tahoma, Arial, sans-serif', fontWeight: 600 },
    baseFontSizePx: 13,
    desktop: {
      wallpaperId: 'lumen_gloss',
      iconStyle: 'gloss',
      iconCellWidthPx: 88,
      iconCellHeightPx: 90,
      iconGlyphSizePx: 40,
    },
    window: {
      chromeId: 'gloss',
      borderRadiusPx: 8,
      shadow: 'gloss',
      animation: {
        open: 'gloss-zoom',
        close: 'gloss-zoom',
        minimize: 'fade-collapse',
        restore: 'gloss-zoom',
      },
    },
    shell: {
      taskbarId: 'gloss',
      taskbarHeightPx: 28,
      startMenuId: 'gloss',
      defaultWallpaperId: 'classic_teal',
    },
    soundSchemeId: 'orion70',
    capabilities: { glossyChrome: true, animatedWindowTransitions: true },
  },
};

export function getOsPresentationProfile(osId: OsVersion): OsPresentationProfile {
  const release = getReleaseById(osId);
  if (!release) throw new Error(`Unknown Orion release: ${osId}`);
  return PRESENTATION_BY_THEME[release.theme];
}

export function resolveActiveOsPresentation(osId: OsVersion | null): OsPresentationProfile | null {
  return osId ? getOsPresentationProfile(osId) : null;
}

export function resolveWindowTransition(
  profile: OsPresentationProfile,
  action: WindowTransitionAction,
  reducedMotion: boolean,
): WindowTransitionId {
  return reducedMotion ? 'snap' : profile.window.animation[action];
}
