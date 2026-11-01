// The S17 token set (design doc "Token set (approved)"). No react-native import, so Vitest can load it.

export type ColorRole =
  | 'background'
  | 'surface'
  | 'plate'
  | 'onPlate'
  | 'onPlateMuted'
  | 'text'
  | 'textMuted'
  | 'textDisabled'
  | 'border'
  | 'accent'
  | 'accentFill'
  | 'onAccent'
  | 'accentWash'
  | 'inverse'
  | 'onInverse'
  | 'thumb'
  | 'danger';

export type Colors = Record<ColorRole, string>;

// textDisabled is for disabled controls only, so it's exempt from 4.5:1; test/tokens.test.ts checks the rest.
export const light: Colors = {
  background: '#F1F1EF',
  surface: '#FFFFFF',
  plate: '#1D2024',
  onPlate: '#F5F5F4',
  onPlateMuted: '#A2A7AF',
  text: '#17191C',
  textMuted: '#5B6068',
  textDisabled: '#A3A6AB',
  border: '#E3E3E0',
  accent: '#8C5200',
  accentFill: '#FFB547',
  onAccent: '#2A1700',
  accentWash: '#FCEBCB',
  inverse: '#1D2024',
  onInverse: '#F5F5F4',
  thumb: '#FFFFFF',
  danger: '#B3261E',
};

export const dark: Colors = {
  background: '#131517',
  surface: '#1C1F22',
  plate: '#2B2F34',
  onPlate: '#F5F5F4',
  onPlateMuted: '#A8ADB4',
  text: '#ECEDEF',
  textMuted: '#A2A7AF',
  textDisabled: '#5E6268',
  border: '#2C3034',
  accent: '#FFB547',
  accentFill: '#FFB547',
  onAccent: '#2A1700',
  accentWash: '#3A2F1C',
  inverse: '#ECEDEF',
  onInverse: '#17191C',
  thumb: '#FFFFFF',
  danger: '#F2B8B5',
};

// Weight comes from the static family, never fontWeight, so Android doesn't synthesize bold.
export const FONTS = {
  regular: 'InstrumentSans_400Regular',
  medium: 'InstrumentSans_500Medium',
  semiBold: 'InstrumentSans_600SemiBold',
  bold: 'InstrumentSans_700Bold',
} as const;

export const type = {
  score: { fontFamily: FONTS.bold, fontSize: 30, lineHeight: 34 },
  scoreLarge: { fontFamily: FONTS.bold, fontSize: 34, lineHeight: 38 },
  title: { fontFamily: FONTS.bold, fontSize: 26, lineHeight: 32 },
  heading: { fontFamily: FONTS.semiBold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: FONTS.regular, fontSize: 15, lineHeight: 20 },
  bodyStrong: { fontFamily: FONTS.semiBold, fontSize: 15, lineHeight: 20 },
  meta: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: FONTS.semiBold, fontSize: 12, lineHeight: 16 },
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { control: 8, sheet: 12, full: 999 } as const;
// Milliseconds.
export const motion = { press: 100, expand: 200, pulse: 900 } as const;
export const icon = { inline: 16, bar: 22 } as const;
export const layout = {
  target: 48,
  maxWidth: 600,
  hairline: 1,
  markBar: 3,
  statColumn: 34,
  statColumnWide: 52,
  // Plate scores stop growing here, so two 3-digit scores and the status fit a 360 dp phone at font scale 2.
  scoreMaxScale: 1.3,
} as const;
// The Latest pill only; boxes stay flat.
export const shadow = { float: '0 4px 14px rgba(0, 0, 0, 0.25)' } as const;
export const opacity = { pressed: 0.6, disabled: 0.4, dimmed: 0.5 } as const;
