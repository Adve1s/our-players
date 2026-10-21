import { useColorScheme } from 'react-native';

export type Theme = {
  colors: {
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    // Disabled controls only: dimmer than textMuted, so below 4.5:1 by design.
    textDisabled: string;
    border: string;
    accent: string;
    onAccent: string;
    // A switch's "on" thumb: light in both schemes so it reads against the accent track.
    thumb: string;
    danger: string;
  };
  space: { xs: 4; sm: 8; md: 12; lg: 16; xl: 24 };
  font: { caption: 13; body: 16; title: 20 };
  radius: 12;
  dark: boolean;
};

const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
const font = { caption: 13, body: 16, title: 20 } as const;

// Text and textMuted keep >= 4.5:1 contrast on both background and surface.
const light: Theme = {
  colors: {
    background: '#F2F2F5',
    surface: '#FFFFFF',
    text: '#1C1C1E',
    textMuted: '#5C5F66',
    textDisabled: '#9A9DA3',
    border: '#D1D1D6',
    accent: '#1A5FB4',
    onAccent: '#FFFFFF',
    thumb: '#FFFFFF',
    danger: '#B3261E',
  },
  space,
  font,
  radius: 12,
  dark: false,
};

const dark: Theme = {
  colors: {
    background: '#121212',
    surface: '#1E1E20',
    text: '#F2F2F2',
    textMuted: '#A8A8AD',
    textDisabled: '#6E6E73',
    border: '#3A3A3C',
    accent: '#8AB4F8',
    onAccent: '#0B1F3A',
    thumb: '#FFFFFF',
    danger: '#F2B8B5',
  },
  space,
  font,
  radius: 12,
  dark: true,
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
