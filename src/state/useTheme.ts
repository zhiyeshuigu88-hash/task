import { useColorScheme } from 'react-native';

import { useApp } from '@/state/AppProvider';
import { createTheme, darkTheme, lightTheme, type Theme } from '@/ui/theme';

/**
 * 設定のテーマモードと端末の外観設定からテーマを決める。
 * 既定は 'system' なので、何も設定しなければ OS のダークモードに追従する。
 */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  const { settings } = useApp();

  if (settings.themeMode === 'dark') return darkTheme;
  if (settings.themeMode === 'light') return lightTheme;
  return scheme === 'dark' ? darkTheme : lightTheme;
}

/** AppProvider の外側（起動直後のスプラッシュなど）で使うテーマ */
export function useSystemTheme(): Theme {
  const scheme = useColorScheme();
  return createTheme(scheme === 'dark');
}
