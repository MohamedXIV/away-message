import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type WallpaperPreset = 'classic_teal' | 'bliss_green' | 'starry_night' | 'matrix_rain' | 'solid_navy';

interface DesktopStore {
  wallpaper: WallpaperPreset;
  setWallpaper: (preset: WallpaperPreset) => void;
  crtEnabled: boolean;
  setCrtEnabled: (enabled: boolean) => void;
}

export const useDesktopStore = create<DesktopStore>()(
  persist(
    (set) => ({
      wallpaper: 'classic_teal',
      setWallpaper: (wallpaper) => set({ wallpaper }),
      crtEnabled: true,
      setCrtEnabled: (crtEnabled) => set({ crtEnabled }),
    }),
    {
      name: 'away-message-desktop',
      partialize: (state) => ({ wallpaper: state.wallpaper, crtEnabled: state.crtEnabled }),
    }
  )
);
