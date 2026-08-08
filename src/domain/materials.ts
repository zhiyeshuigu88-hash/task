import type { Diameter, FilamentStatus, Material, PrintResult, StorageType } from './types';

export const MATERIALS: Material[] = ['PLA', 'PLA+', 'PETG', 'TPU', 'ABS', 'ASA', 'OTHER'];

export const MATERIAL_LABELS: Record<Material, string> = {
  PLA: 'PLA',
  'PLA+': 'PLA+',
  PETG: 'PETG',
  TPU: 'TPU',
  ABS: 'ABS',
  ASA: 'ASA',
  OTHER: 'その他',
};

export const DIAMETERS: Diameter[] = [1.75, 2.85];

export const STATUS_LABELS: Record<FilamentStatus, string> = {
  unopened: '未開封',
  in_use: '使用中',
  used_up: '使用済み',
};

export const RESULT_LABELS: Record<PrintResult, string> = {
  success: '成功',
  failed: '失敗',
  aborted: '途中中止',
};

export const STORAGE_TYPE_LABELS: Record<StorageType, string> = {
  dry_box: '防湿ボックス',
  dryer: '乾燥機',
  shelf: '棚',
  other: 'その他',
};

/**
 * メーカー別のスプール自重プリセット(g)。
 * 要件定義書 8. のとおり、あくまで目安でありユーザーが上書きできる。
 */
export const SPOOL_WEIGHT_PRESETS: { label: string; weightG: number }[] = [
  { label: 'Bambu Lab（プラスプール）', weightG: 250 },
  { label: 'Bambu Lab（リフィル・芯なし）', weightG: 0 },
  { label: 'eSUN', weightG: 220 },
  { label: 'Polymaker', weightG: 215 },
  { label: 'SUNLU', weightG: 220 },
  { label: 'Overture', weightG: 235 },
  { label: 'Creality', weightG: 190 },
  { label: '厚紙スプール（一般）', weightG: 140 },
];

/**
 * カラーコード入力を補助するためのプリセット。
 * 3Dプリント用フィラメントでよく使われる色を並べている。
 */
export const COLOR_PRESETS: { name: string; hex: string }[] = [
  { name: 'ブラック', hex: '#1A1A1A' },
  { name: 'ホワイト', hex: '#F5F5F5' },
  { name: 'グレー', hex: '#9AA0A6' },
  { name: 'シルバー', hex: '#C9CDD2' },
  { name: 'レッド', hex: '#E03131' },
  { name: 'オレンジ', hex: '#F76707' },
  { name: 'イエロー', hex: '#FCC419' },
  { name: 'グリーン', hex: '#2F9E44' },
  { name: 'ブルー', hex: '#1971C2' },
  { name: 'スカイブルー', hex: '#4DABF7' },
  { name: 'パープル', hex: '#7048E8' },
  { name: 'ピンク', hex: '#E64980' },
  { name: 'ブラウン', hex: '#8B5E34' },
  { name: 'ベージュ', hex: '#E8D9BE' },
  { name: 'ゴールド', hex: '#C9A227' },
  { name: 'トランスペアレント', hex: '#D8E6E8' },
];

/** 統計グラフで素材ごとに使う色 */
export const MATERIAL_COLORS: Record<Material, string> = {
  PLA: '#4C8DFF',
  'PLA+': '#7A5AF8',
  PETG: '#12B886',
  TPU: '#F59F00',
  ABS: '#E8590C',
  ASA: '#E64980',
  OTHER: '#868E96',
};

/** 表示用に素材ラベルへ変換する（未知の値もそのまま出す） */
export function materialLabel(material: Material | string): string {
  return MATERIAL_LABELS[material as Material] ?? String(material);
}
