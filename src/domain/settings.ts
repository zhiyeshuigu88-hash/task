import type { AppSettings, DryThresholds, LowStockMode, Material } from './types';

/** 素材別の再乾燥推奨日数の既定値（要件定義書 4.8） */
export const DEFAULT_DRY_THRESHOLDS: DryThresholds = {
  PLA: 90,
  'PLA+': 90,
  PETG: 45,
  TPU: 21,
  ABS: 45,
  ASA: 45,
  OTHER: 60,
};

export const DEFAULT_SETTINGS: AppSettings = {
  dryThresholds: DEFAULT_DRY_THRESHOLDS,
  lowStockMode: 'percent',
  lowStockPercent: 20,
  lowStockGram: 200,
  defaultInitialWeightG: 1000,
  defaultSpoolWeightG: 250,
  themeMode: 'system',
  notifyEnabled: false,
  notifyHour: 8,
  notifyMinute: 0,
};

/** app_settings テーブルのキー */
export const SETTING_KEYS = {
  dryThresholds: 'dry_thresholds',
  lowStockMode: 'low_stock_mode',
  lowStockPercent: 'low_stock_percent',
  lowStockGram: 'low_stock_gram',
  defaultInitialWeightG: 'default_initial_weight_g',
  defaultSpoolWeightG: 'default_spool_weight_g',
  themeMode: 'theme_mode',
  notifyEnabled: 'notify_enabled',
  notifyHour: 'notify_hour',
  notifyMinute: 'notify_minute',
} as const;

/** key-value の生データを AppSettings に組み立てる。壊れた値は既定値にフォールバックする */
export function settingsFromRecord(record: Record<string, string>): AppSettings {
  return {
    dryThresholds: parseThresholds(record[SETTING_KEYS.dryThresholds]),
    lowStockMode: parseMode(record[SETTING_KEYS.lowStockMode]),
    lowStockPercent: parseNumber(
      record[SETTING_KEYS.lowStockPercent],
      DEFAULT_SETTINGS.lowStockPercent,
      { min: 0, max: 100 },
    ),
    lowStockGram: parseNumber(record[SETTING_KEYS.lowStockGram], DEFAULT_SETTINGS.lowStockGram, {
      min: 0,
    }),
    defaultInitialWeightG: parseNumber(
      record[SETTING_KEYS.defaultInitialWeightG],
      DEFAULT_SETTINGS.defaultInitialWeightG,
      { min: 1 },
    ),
    defaultSpoolWeightG: parseNumber(
      record[SETTING_KEYS.defaultSpoolWeightG],
      DEFAULT_SETTINGS.defaultSpoolWeightG,
      { min: 0 },
    ),
    themeMode: parseTheme(record[SETTING_KEYS.themeMode]),
    notifyEnabled: record[SETTING_KEYS.notifyEnabled] === 'true',
    notifyHour: parseNumber(record[SETTING_KEYS.notifyHour], DEFAULT_SETTINGS.notifyHour, {
      min: 0,
      max: 23,
    }),
    notifyMinute: parseNumber(record[SETTING_KEYS.notifyMinute], DEFAULT_SETTINGS.notifyMinute, {
      min: 0,
      max: 59,
    }),
  };
}

/** AppSettings を key-value に展開する */
export function settingsToRecord(settings: AppSettings): Record<string, string> {
  return {
    [SETTING_KEYS.dryThresholds]: JSON.stringify(settings.dryThresholds),
    [SETTING_KEYS.lowStockMode]: settings.lowStockMode,
    [SETTING_KEYS.lowStockPercent]: String(settings.lowStockPercent),
    [SETTING_KEYS.lowStockGram]: String(settings.lowStockGram),
    [SETTING_KEYS.defaultInitialWeightG]: String(settings.defaultInitialWeightG),
    [SETTING_KEYS.defaultSpoolWeightG]: String(settings.defaultSpoolWeightG),
    [SETTING_KEYS.themeMode]: settings.themeMode,
    [SETTING_KEYS.notifyEnabled]: String(settings.notifyEnabled),
    [SETTING_KEYS.notifyHour]: String(settings.notifyHour),
    [SETTING_KEYS.notifyMinute]: String(settings.notifyMinute),
  };
}

function parseThresholds(raw: string | undefined): DryThresholds {
  if (!raw) return { ...DEFAULT_DRY_THRESHOLDS };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_DRY_THRESHOLDS };
    const source = parsed as Record<string, unknown>;
    const result = { ...DEFAULT_DRY_THRESHOLDS };
    // 既定値が持つ素材キーだけを見る。未知のキーは無視される
    for (const material of Object.keys(DEFAULT_DRY_THRESHOLDS) as Material[]) {
      const value = source[material];
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        result[material] = Math.round(value);
      }
    }
    return result;
  } catch {
    return { ...DEFAULT_DRY_THRESHOLDS };
  }
}

function parseMode(raw: string | undefined): LowStockMode {
  return raw === 'gram' ? 'gram' : 'percent';
}

function parseTheme(raw: string | undefined): AppSettings['themeMode'] {
  return raw === 'light' || raw === 'dark' ? raw : 'system';
}

function parseNumber(
  raw: string | undefined,
  fallback: number,
  bounds: { min?: number; max?: number } = {},
): number {
  const value = Number(raw);
  if (raw === undefined || raw === '' || !Number.isFinite(value)) return fallback;
  if (bounds.min !== undefined && value < bounds.min) return fallback;
  if (bounds.max !== undefined && value > bounds.max) return fallback;
  return value;
}
