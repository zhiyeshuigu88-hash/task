/**
 * SQLite の行（snake_case）とドメイン型（camelCase）の変換。
 * SQL を書く側とドメイン側の語彙をここだけで橋渡しする。
 */
import type {
  AdjustMethod,
  Diameter,
  DryLog,
  Filament,
  FilamentStatus,
  Material,
  PrintLog,
  PrintResult,
  PrintSettings,
  StorageLocation,
  StorageType,
  WeightAdjustment,
} from '@/domain/types';
import { MATERIALS } from '@/domain/materials';

export type FilamentRow = {
  id: number;
  manufacturer: string;
  product_name: string | null;
  material: string;
  color_name: string;
  color_hex: string;
  diameter: number;
  initial_weight_g: number;
  spool_weight_g: number;
  current_weight_g: number;
  price_yen: number;
  purchased_at: string | null;
  purchased_from: string | null;
  opened_at: string | null;
  storage_location_id: number | null;
  status: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type PrintLogRow = {
  id: number;
  filament_id: number;
  used_weight_g: number;
  model_name: string | null;
  printed_at: string;
  duration_min: number | null;
  result: string;
  cost_yen: number;
  note: string | null;
  created_at: string;
};

export type DryLogRow = {
  id: number;
  filament_id: number;
  dried_at: string;
  temperature_c: number | null;
  duration_min: number | null;
  note: string | null;
};

export type WeightAdjustmentRow = {
  id: number;
  filament_id: number;
  method: string;
  value_g: number;
  resulting_weight_g: number;
  adjusted_at: string;
  note: string | null;
};

export type StorageLocationRow = {
  id: number;
  name: string;
  type: string;
  desiccant_replaced_at: string | null;
  replace_interval_days: number;
};

export type PrintSettingsRow = {
  id: number;
  filament_id: number;
  nozzle_temp_c: number | null;
  bed_temp_c: number | null;
  speed_mms: number | null;
  fan_percent: number | null;
  note: string | null;
};

/* ------------------------------------------------------------------ *
 * 値の正規化。DB に想定外の文字列が入っていても落ちないようにする
 * ------------------------------------------------------------------ */

function toMaterial(value: string): Material {
  return (MATERIALS as string[]).includes(value) ? (value as Material) : 'OTHER';
}

function toStatus(value: string): FilamentStatus {
  return value === 'unopened' || value === 'used_up' || value === 'in_use'
    ? value
    : 'in_use';
}

function toDiameter(value: number): Diameter {
  return value === 2.85 ? 2.85 : 1.75;
}

function toResult(value: string): PrintResult {
  return value === 'failed' || value === 'aborted' || value === 'success' ? value : 'success';
}

function toStorageType(value: string): StorageType {
  return value === 'dry_box' || value === 'dryer' || value === 'shelf' || value === 'other'
    ? value
    : 'other';
}

function toMethod(value: string): AdjustMethod {
  return value === 'measure' ? 'measure' : 'subtract';
}

/* ------------------------------------------------------------------ *
 * 行 → ドメイン
 * ------------------------------------------------------------------ */

export function toFilament(row: FilamentRow): Filament {
  return {
    id: row.id,
    manufacturer: row.manufacturer,
    productName: row.product_name,
    material: toMaterial(row.material),
    colorName: row.color_name,
    colorHex: row.color_hex,
    diameter: toDiameter(row.diameter),
    initialWeightG: row.initial_weight_g,
    spoolWeightG: row.spool_weight_g,
    currentWeightG: row.current_weight_g,
    priceYen: row.price_yen,
    purchasedAt: row.purchased_at,
    purchasedFrom: row.purchased_from,
    openedAt: row.opened_at,
    storageLocationId: row.storage_location_id,
    status: toStatus(row.status),
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function toPrintLog(row: PrintLogRow): PrintLog {
  return {
    id: row.id,
    filamentId: row.filament_id,
    usedWeightG: row.used_weight_g,
    modelName: row.model_name,
    printedAt: row.printed_at,
    durationMin: row.duration_min,
    result: toResult(row.result),
    costYen: row.cost_yen,
    note: row.note,
    createdAt: row.created_at,
  };
}

export function toDryLog(row: DryLogRow): DryLog {
  return {
    id: row.id,
    filamentId: row.filament_id,
    driedAt: row.dried_at,
    temperatureC: row.temperature_c,
    durationMin: row.duration_min,
    note: row.note,
  };
}

export function toWeightAdjustment(row: WeightAdjustmentRow): WeightAdjustment {
  return {
    id: row.id,
    filamentId: row.filament_id,
    method: toMethod(row.method),
    valueG: row.value_g,
    resultingWeightG: row.resulting_weight_g,
    adjustedAt: row.adjusted_at,
    note: row.note,
  };
}

export function toStorageLocation(row: StorageLocationRow): StorageLocation {
  return {
    id: row.id,
    name: row.name,
    type: toStorageType(row.type),
    desiccantReplacedAt: row.desiccant_replaced_at,
    replaceIntervalDays: row.replace_interval_days,
  };
}

export function toPrintSettings(row: PrintSettingsRow): PrintSettings {
  return {
    id: row.id,
    filamentId: row.filament_id,
    nozzleTempC: row.nozzle_temp_c,
    bedTempC: row.bed_temp_c,
    speedMms: row.speed_mms,
    fanPercent: row.fan_percent,
    note: row.note,
  };
}

/** 空文字を null に落とす（任意項目のテキスト入力用） */
export function emptyToNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}
