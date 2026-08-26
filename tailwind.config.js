/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Orion OS 4.8 Palette (Windows 98 aesthetic)
        orion4: {
          desktop: '#008080',      // Classic Teal desktop
          gray: '#c0c0c0',         // Window chrome face
          light: '#ffffff',        // 3D bevel top-left highlight
          shadow: '#808080',       // 3D bevel bottom-right shadow
          darkShadow: '#000000',   // 3D bevel bottom-right dark border
          titleActive: '#000080',  // Classic Navy Blue title bar
          titleActiveText: '#ffffff',
          titleInactive: '#808080',
          titleInactiveText: '#c0c0c0',
        },
        // Orion OS 6.0 Palette (XP / 2000s aesthetic)
        orion6: {
          desktop: '#245edb',      // XP Royale / Bliss Blue
          gray: '#ece9d8',         // XP Sand chrome
          titleActive: '#0055ea',  // XP Blue gradient
          titleActiveText: '#ffffff',
          taskbar: '#1f48ab',      // Rich royal blue taskbar
          startBtn: '#388e3c',     // Emerald start button
        },
        retro: {
          crtGreen: '#33ff33',
          crtAmber: '#ffb000',
        },
      },
      fontFamily: {
        pixel: ['"MS Sans Serif"', 'Tahoma', 'Geneva', 'sans-serif'],
        orionModern: ['Tahoma', '"Segoe UI"', 'sans-serif'],
        terminal: ['"Lucida Console"', 'Monaco', '"Courier New"', 'monospace'],
      },
      boxShadow: {
        'orion-outset': 'inset 1px 1px #fff, inset -1px -1px #808080, 1px 1px 0px #000',
        'orion-inset': 'inset 1px 1px #808080, inset -1px -1px #fff, inset 2px 2px #000',
        'orion-window': 'inset 1px 1px 0px #dfdfdf, inset -1px -1px 0px #000000, inset 2px 2px 0px #ffffff, inset -2px -2px 0px #808080',
      },
    },
  },
  plugins: [],
};
