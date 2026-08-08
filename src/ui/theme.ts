/** ライト / ダークのカラートークン（要件: システム設定に追従するダークモード） */

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  danger: string;
  warning: string;
  success: string;
  info: string;
  track: string;
  overlay: string;
};

export type Theme = {
  dark: boolean;
  colors: ThemeColors;
  spacing: (multiplier: number) => number;
  radius: { sm: number; md: number; lg: number; pill: number };
};

const lightColors: ThemeColors = {
  background: '#F2F3F5',
  surface: '#FFFFFF',
  surfaceAlt: '#F7F8FA',
  border: '#E1E4E8',
  text: '#16181D',
  textMuted: '#6B7280',
  primary: '#2563EB',
  onPrimary: '#FFFFFF',
  danger: '#DC2626',
  warning: '#D97706',
  success: '#059669',
  info: '#0891B2',
  track: '#E5E7EB',
  overlay: 'rgba(0, 0, 0, 0.4)',
};

const darkColors: ThemeColors = {
  background: '#0E1116',
  surface: '#171B22',
  surfaceAlt: '#1F242D',
  border: '#2A303B',
  text: '#E8EAED',
  textMuted: '#9BA3AF',
  primary: '#60A5FA',
  onPrimary: '#0B1220',
  danger: '#F87171',
  warning: '#FBBF24',
  success: '#34D399',
  info: '#22D3EE',
  track: '#2A303B',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

const BASE_UNIT = 4;

export function createTheme(dark: boolean): Theme {
  return {
    dark,
    colors: dark ? darkColors : lightColors,
    spacing: (multiplier: number) => BASE_UNIT * multiplier,
    radius: { sm: 6, md: 10, lg: 16, pill: 999 },
  };
}

export const lightTheme = createTheme(false);
export const darkTheme = createTheme(true);
