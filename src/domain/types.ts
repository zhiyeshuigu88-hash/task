/**
 * アプリ全体で使うドメイン型。
 * DB のカラム名（snake_case）ではなく、UI から扱いやすい camelCase で表現する。
 * 変換は src/db/repo/* が担当する。
 */

/** 素材。要件定義書 4.2 の select 項目に対応する */
export type Material = 'PLA' | 'PLA+' | 'PETG' | 'TPU' | 'ABS' | 'ASA' | 'OTHER';

/** フィラメント直径 */
export type Diameter = 1.75 | 2.85;

/**
 * フィラメントのステータス。
 * - unopened: 未開封（乾燥判定の対象外）
 * - in_use:   使用中
 * - used_up:  使い切り済み（一覧の既定表示から外す）
 */
export type FilamentStatus = 'unopened' | 'in_use' | 'used_up';

/** 印刷結果 */
export type PrintResult = 'success' | 'failed' | 'aborted';

/** 保管場所の種別 */
export type StorageType = 'dry_box' | 'dryer' | 'shelf' | 'other';

/** 残量更新の方式（要件定義書 4.4） */
export type AdjustMethod = 'subtract' | 'measure';

export type Filament = {
  id: number;
  manufacturer: string;
  productName: string | null;
  material: Material;
  colorName: string;
  colorHex: string;
  diameter: Diameter;
  /** 初期フィラメント重量(g)。スプール自重を含まない正味重量 */
  initialWeightG: number;
  /** スプール自重(g) */
  spoolWeightG: number;
  /** 現在の正味残量(g) */
  currentWeightG: number;
  priceYen: number;
  /** YYYY-MM-DD */
  purchasedAt: string | null;
  purchasedFrom: string | null;
  /** YYYY-MM-DD。未開封なら null */
  openedAt: string | null;
  storageLocationId: number | null;
  status: FilamentStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type PrintLog = {
  id: number;
  filamentId: number;
  usedWeightG: number;
  modelName: string | null;
  /** ISO8601 */
  printedAt: string;
  durationMin: number | null;
  result: PrintResult;
  costYen: number;
  note: string | null;
  createdAt: string;
};

export type DryLog = {
  id: number;
  filamentId: number;
  /** YYYY-MM-DD */
  driedAt: string;
  temperatureC: number | null;
  durationMin: number | null;
  note: string | null;
};

export type WeightAdjustment = {
  id: number;
  filamentId: number;
  method: AdjustMethod;
  /** 入力された生の値。subtract なら使用量、measure なら実測総重量 */
  valueG: number;
  /** 反映後の正味残量(g) */
  resultingWeightG: number;
  /** ISO8601 */
  adjustedAt: string;
  note: string | null;
};

export type StorageLocation = {
  id: number;
  name: string;
  type: StorageType;
  /** YYYY-MM-DD */
  desiccantReplacedAt: string | null;
  replaceIntervalDays: number;
};

export type PrintSettings = {
  id: number;
  filamentId: number;
  nozzleTempC: number | null;
  bedTempC: number | null;
  speedMms: number | null;
  fanPercent: number | null;
  note: string | null;
};

/** 素材ごとの再乾燥推奨日数 */
export type DryThresholds = Record<Material, number>;

/** 残量アラートの判定方式 */
export type LowStockMode = 'percent' | 'gram';

export type AppSettings = {
  dryThresholds: DryThresholds;
  lowStockMode: LowStockMode;
  lowStockPercent: number;
  lowStockGram: number;
  defaultInitialWeightG: number;
  defaultSpoolWeightG: number;
  themeMode: 'system' | 'light' | 'dark';
  notifyEnabled: boolean;
  /** 0-23 */
  notifyHour: number;
  /** 0-59 */
  notifyMinute: number;
};

/**
 * 一覧・ホームで使う「フィラメント + 算出値」。
 * 算出値は DB に持たず、読み出し時に計算する（要件定義書 6.算出値）。
 */
export type FilamentView = Filament & {
  /** 1gあたり単価(円) */
  unitPriceYen: number;
  /** 残量% (0-100) */
  remainingPercent: number;
  /** 現在の資産価値(円) = 残量 × 単価 */
  remainingValueYen: number;
  /** 最終乾燥日 YYYY-MM-DD（乾燥ログがなければ null） */
  lastDriedAt: string | null;
  /** 乾燥判定の基準日 = 最終乾燥日 ?? 開封日 */
  dryBaseDate: string | null;
  /** 基準日からの経過日数（判定不能なら null） */
  daysSinceDryBase: number | null;
  /** 再乾燥推奨までの残り日数（マイナスなら超過。判定不能なら null） */
  dryDueInDays: number | null;
  /** 要乾燥フラグ */
  needsDrying: boolean;
  /** 残りわずかフラグ */
  isLowStock: boolean;
  /** 保管場所名（未設定なら null） */
  storageLocationName: string | null;
};
