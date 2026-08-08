/**
 * 端末のローカルタイムゾーンを基準にした「今日 / 今」の文字列化。
 *
 * 日付は 'YYYY-MM-DD'、日時は 'YYYY-MM-DDTHH:mm' で保存する。
 * `toISOString()` を使うと UTC に寄って日付が1日ずれるため、必ずローカル値から組み立てる。
 */

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

/** 今日の 'YYYY-MM-DD' */
export function todayISO(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 現在時刻の 'YYYY-MM-DDTHH:mm' */
export function nowISO(date: Date = new Date()): string {
  return `${todayISO(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** ISO8601 から日付部分 'YYYY-MM-DD' を取り出す。取り出せなければ今日を返す */
export function toDateOnly(value: string): string {
  return /^(\d{4}-\d{2}-\d{2})/.exec(value)?.[1] ?? todayISO();
}

/** 'YYYY-MM-DD' / ISO8601 を '2026/08/08' 形式にする */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  return `${m[1]}/${m[2]}/${m[3]}`;
}

/** ISO8601 を '2026/08/08 14:30' 形式にする */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(value);
  if (!m) return formatDate(value);
  return `${m[1]}/${m[2]}/${m[3]} ${m[4]}:${m[5]}`;
}

/** 'YYYY-MM' を '2026年8月' にする */
export function formatMonth(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return month;
  return `${m[1]}年${Number(m[2])}月`;
}

/** 'YYYY-MM' を '8月' にする（グラフの軸ラベル用） */
export function formatMonthShort(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return month;
  return `${Number(m[2])}月`;
}
