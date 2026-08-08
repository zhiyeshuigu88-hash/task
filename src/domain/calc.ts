/**
 * ドメイン計算ロジック（純粋関数のみ）。
 *
 * このファイルは実行時 import を一切持たない（型は `import type` のみ）ため、
 * React Native からも Node の test runner からも同じコードを検証できる。
 * `npm test` を参照。
 */
import type {
  DryThresholds,
  Filament,
  FilamentStatus,
  LowStockMode,
  Material,
  PrintLog,
  StorageLocation,
} from './types';

const MS_PER_DAY = 86_400_000;

/* ------------------------------------------------------------------ *
 * 日付ユーティリティ（YYYY-MM-DD をタイムゾーン非依存で扱う）
 * ------------------------------------------------------------------ */

/** 'YYYY-MM-DD' または ISO8601 を UTC 深夜のミリ秒に変換する。不正値は null */
export function parseDateOnly(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  const [, y, mo, d] = m;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const ms = Date.UTC(year, month - 1, day);
  const back = new Date(ms);
  // 2026-02-31 のような存在しない日付を弾く
  if (back.getUTCMonth() !== month - 1 || back.getUTCDate() !== day) return null;
  return ms;
}

/** 日付文字列として妥当か */
export function isValidDateString(value: string): boolean {
  return parseDateOnly(value) !== null;
}

/** from から to までの日数。どちらかが不正なら null */
export function daysBetween(from: string | null, to: string): number | null {
  const a = parseDateOnly(from);
  const b = parseDateOnly(to);
  if (a === null || b === null) return null;
  return Math.floor((b - a) / MS_PER_DAY);
}

/** 'YYYY-MM' を取り出す。不正値は null */
export function monthKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})/.exec(value);
  return m ? `${m[1]}-${m[2]}` : null;
}

/** today を含む直近 n ヶ月の 'YYYY-MM' を古い順で返す */
export function recentMonthKeys(today: string, n: number): string[] {
  const base = parseDateOnly(today);
  if (base === null || n <= 0) return [];
  const d = new Date(base);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const t = new Date(Date.UTC(year, month - i, 1));
    keys.push(`${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

/** offset ヶ月ずらした 'YYYY-MM' を返す（-1 で先月） */
export function shiftMonthKey(today: string, offset: number): string | null {
  const base = parseDateOnly(today);
  if (base === null) return null;
  const d = new Date(base);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ *
 * 単価・残量
 * ------------------------------------------------------------------ */

/** 1gあたり単価 = 購入価格 ÷ 初期フィラメント重量 */
export function unitPriceYen(priceYen: number, initialWeightG: number): number {
  if (!Number.isFinite(priceYen) || !Number.isFinite(initialWeightG) || initialWeightG <= 0) {
    return 0;
  }
  return priceYen / initialWeightG;
}

/** 残量% (0-100 にクランプ) */
export function remainingPercent(currentWeightG: number, initialWeightG: number): number {
  if (!Number.isFinite(initialWeightG) || initialWeightG <= 0) return 0;
  const pct = (currentWeightG / initialWeightG) * 100;
  if (!Number.isFinite(pct)) return 0;
  return Math.min(100, Math.max(0, pct));
}

/** 材料費 = 使用量 × 1gあたり単価。円未満の誤差蓄積を避けるため小数2桁に丸める */
export function materialCostYen(usedWeightG: number, unitPrice: number): number {
  const cost = usedWeightG * unitPrice;
  if (!Number.isFinite(cost)) return 0;
  return Math.round(cost * 100) / 100;
}

export type WeightUpdate = {
  /** 反映後の正味残量(g) */
  resultingWeightG: number;
  /** 0 でクランプされたか（警告表示に使う） */
  clamped: boolean;
  /** 残量が 0 になったか（「使用済み」への変更提案に使う） */
  depleted: boolean;
};

/** 方式A：使用量を引く。残量はマイナスにならないよう 0 でクランプする */
export function applySubtract(currentWeightG: number, usedWeightG: number): WeightUpdate {
  const raw = currentWeightG - usedWeightG;
  return finalizeWeight(raw);
}

/** 方式B：実測総重量から算出。残量 = 総重量 − スプール自重 */
export function applyMeasure(totalWeightG: number, spoolWeightG: number): WeightUpdate {
  const raw = totalWeightG - spoolWeightG;
  return finalizeWeight(raw);
}

function finalizeWeight(raw: number): WeightUpdate {
  const safe = Number.isFinite(raw) ? raw : 0;
  const clamped = safe < 0;
  const resulting = Math.round(Math.max(0, safe) * 100) / 100;
  return { resultingWeightG: resulting, clamped, depleted: resulting <= 0 };
}

/* ------------------------------------------------------------------ *
 * 乾燥推奨判定（要件定義書 4.8）
 * ------------------------------------------------------------------ */

export type DryingEvaluation = {
  /** 基準日 = 最終乾燥日 ?? 開封日 */
  baseDate: string | null;
  /** 基準日からの経過日数 */
  daysSince: number | null;
  /** 推奨日数までの残り（マイナスは超過） */
  dueInDays: number | null;
  /** 素材別の閾値(日) */
  thresholdDays: number;
  needsDrying: boolean;
};

/** 素材別の再乾燥推奨日数を取り出す（未設定なら OTHER の値、それも無ければ 60） */
export function dryThresholdFor(material: Material, thresholds: DryThresholds): number {
  const value = thresholds[material];
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  const fallback = thresholds.OTHER;
  return typeof fallback === 'number' && Number.isFinite(fallback) && fallback > 0 ? fallback : 60;
}

/**
 * 乾燥推奨判定。
 * - 未開封 / 使用済みは対象外
 * - 基準日が無い（開封日も乾燥ログも無い）場合は判定不能として false
 */
export function evaluateDrying(
  input: {
    material: Material;
    status: FilamentStatus;
    openedAt: string | null;
    lastDriedAt: string | null;
  },
  thresholds: DryThresholds,
  today: string,
): DryingEvaluation {
  const thresholdDays = dryThresholdFor(input.material, thresholds);
  const baseDate = input.lastDriedAt ?? input.openedAt;

  if (input.status === 'unopened' || input.status === 'used_up') {
    return { baseDate, daysSince: null, dueInDays: null, thresholdDays, needsDrying: false };
  }

  const daysSince = daysBetween(baseDate, today);
  if (daysSince === null) {
    return { baseDate, daysSince: null, dueInDays: null, thresholdDays, needsDrying: false };
  }

  const dueInDays = thresholdDays - daysSince;
  return { baseDate, daysSince, dueInDays, thresholdDays, needsDrying: daysSince > thresholdDays };
}

/* ------------------------------------------------------------------ *
 * 残量アラート（要件定義書 4.9）
 * ------------------------------------------------------------------ */

export type LowStockSettings = {
  lowStockMode: LowStockMode;
  lowStockPercent: number;
  lowStockGram: number;
};

/** 残りわずか判定。使用済みは対象外 */
export function isLowStock(
  input: { currentWeightG: number; initialWeightG: number; status: FilamentStatus },
  settings: LowStockSettings,
): boolean {
  if (input.status === 'used_up') return false;
  if (settings.lowStockMode === 'gram') {
    return input.currentWeightG <= settings.lowStockGram;
  }
  return remainingPercent(input.currentWeightG, input.initialWeightG) <= settings.lowStockPercent;
}

/* ------------------------------------------------------------------ *
 * 乾燥剤の交換期限（要件定義書 4.7）
 * ------------------------------------------------------------------ */

export type DesiccantStatus = {
  /** 経過日数（最終交換日が無ければ null） */
  daysSince: number | null;
  /** 期限までの残り日数（マイナスは超過） */
  dueInDays: number | null;
  overdue: boolean;
};

export function evaluateDesiccant(location: StorageLocation, today: string): DesiccantStatus {
  const daysSince = daysBetween(location.desiccantReplacedAt, today);
  if (daysSince === null) return { daysSince: null, dueInDays: null, overdue: false };
  const interval =
    Number.isFinite(location.replaceIntervalDays) && location.replaceIntervalDays > 0
      ? location.replaceIntervalDays
      : 60;
  const dueInDays = interval - daysSince;
  return { daysSince, dueInDays, overdue: daysSince > interval };
}

/* ------------------------------------------------------------------ *
 * 統計（要件定義書 4.10）
 * ------------------------------------------------------------------ */

export type MonthlyCost = { month: string; costYen: number };

/** 月別の材料費を、直近 months ヶ月ぶん（データが無い月は 0）で返す */
export function monthlyCosts(logs: PrintLog[], today: string, months: number): MonthlyCost[] {
  const keys = recentMonthKeys(today, months);
  const totals = new Map<string, number>(keys.map((k) => [k, 0]));
  for (const log of logs) {
    const key = monthKey(log.printedAt);
    if (key === null) continue;
    const current = totals.get(key);
    if (current === undefined) continue; // 対象期間外
    totals.set(key, current + log.costYen);
  }
  return keys.map((month) => ({ month, costYen: round2(totals.get(month) ?? 0) }));
}

/** 指定した 'YYYY-MM' の材料費合計 */
export function costInMonth(logs: PrintLog[], month: string | null): number {
  if (!month) return 0;
  let total = 0;
  for (const log of logs) {
    if (monthKey(log.printedAt) === month) total += log.costYen;
  }
  return round2(total);
}

/** 全期間の材料費合計 */
export function totalCost(logs: PrintLog[]): number {
  return round2(logs.reduce((sum, log) => sum + log.costYen, 0));
}

export type LossSummary = {
  /** 失敗・途中中止による損失額 */
  lossYen: number;
  /** 全体の材料費 */
  totalYen: number;
  /** 損失が占める割合(%) */
  lossPercent: number;
  /** 失敗・途中中止の件数 */
  lossCount: number;
};

/** 失敗印刷によるロス額と割合。「成功」以外を損失として扱う */
export function lossSummary(logs: PrintLog[]): LossSummary {
  let lossYen = 0;
  let totalYen = 0;
  let lossCount = 0;
  for (const log of logs) {
    totalYen += log.costYen;
    if (log.result !== 'success') {
      lossYen += log.costYen;
      lossCount += 1;
    }
  }
  return {
    lossYen: round2(lossYen),
    totalYen: round2(totalYen),
    lossPercent: totalYen > 0 ? round2((lossYen / totalYen) * 100) : 0,
    lossCount,
  };
}

export type MaterialUsage = { material: Material; usedWeightG: number; percent: number };

/** 素材別の消費量割合。消費量の多い順 */
export function materialUsage(
  logs: PrintLog[],
  filaments: Pick<Filament, 'id' | 'material'>[],
): MaterialUsage[] {
  const materialById = new Map(filaments.map((f) => [f.id, f.material]));
  const totals = new Map<Material, number>();
  let grandTotal = 0;
  for (const log of logs) {
    const material = materialById.get(log.filamentId);
    if (!material) continue;
    totals.set(material, (totals.get(material) ?? 0) + log.usedWeightG);
    grandTotal += log.usedWeightG;
  }
  return [...totals.entries()]
    .map(([material, usedWeightG]) => ({
      material,
      usedWeightG: round2(usedWeightG),
      percent: grandTotal > 0 ? round2((usedWeightG / grandTotal) * 100) : 0,
    }))
    .sort((a, b) => b.usedWeightG - a.usedWeightG);
}

/** 保有フィラメントの資産額 = Σ(残量 × 1gあたり単価)。使用済みは除く */
export function inventoryValueYen(
  filaments: Pick<Filament, 'currentWeightG' | 'initialWeightG' | 'priceYen' | 'status'>[],
): number {
  let total = 0;
  for (const f of filaments) {
    if (f.status === 'used_up') continue;
    total += f.currentWeightG * unitPriceYen(f.priceYen, f.initialWeightG);
  }
  return round2(total);
}

/** 使用中フィラメントの総残量(g)。使用済みは除く */
export function totalRemainingG(
  filaments: Pick<Filament, 'currentWeightG' | 'status'>[],
): number {
  let total = 0;
  for (const f of filaments) {
    if (f.status === 'used_up') continue;
    total += f.currentWeightG;
  }
  return round2(total);
}

function round2(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}
