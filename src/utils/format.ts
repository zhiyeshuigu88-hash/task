/** 表示用の数値フォーマット */

/** 円。既定で整数に丸める */
export function yen(value: number, fractionDigits = 0): string {
  if (!Number.isFinite(value)) return '—';
  return `¥${value.toLocaleString('ja-JP', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

/** グラム。小数第1位まで、整数なら小数を出さない */
export function grams(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}g`;
}

/** パーセント */
export function percent(value: number, fractionDigits = 0): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(fractionDigits)}%`;
}

/** 1gあたり単価。円未満が意味を持つので小数第2位まで */
export function unitPrice(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `¥${value.toFixed(2)}/g`;
}

/** 分を '2時間30分' 形式にする */
export function duration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return '—';
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}

/**
 * 文字列を数値に変換する。空文字・不正値は null。
 * 全角数字と全角ピリオドも受け付ける（日本語キーボードからの入力対策）。
 */
export function parseNumberInput(raw: string): number | null {
  const normalized = raw
    .trim()
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[．。]/g, '.')
    .replace(/[,、]/g, '');
  if (normalized === '') return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** 背景色に対して読みやすい文字色（黒か白）を返す */
export function contrastText(hex: string): string {
  const normalized = hex.replace('#', '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized;
  if (full.length !== 6) return '#000000';
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return '#000000';
  // ITU-R BT.601 の輝度
  const luminance = (r * 299 + g * 587 + b * 114) / 1000;
  return luminance > 140 ? '#000000' : '#FFFFFF';
}

/** '#RRGGBB' として妥当か（3桁表記も許容） */
export function isValidHex(hex: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex.trim());
}
