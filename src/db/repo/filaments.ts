import { getDatabase } from '@/db/client';
import { emptyToNull, toFilament, type FilamentRow } from '@/db/rows';
import type { Filament, FilamentStatus } from '@/domain/types';
import { nowISO } from '@/utils/date';

/** 登録・編集フォームから渡される値 */
export type FilamentInput = Omit<Filament, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

const SELECT_COLUMNS = `
  id, manufacturer, product_name, material, color_name, color_hex,
  diameter, initial_weight_g, spool_weight_g, current_weight_g,
  price_yen, purchased_at, purchased_from, opened_at,
  storage_location_id, status, note, created_at, updated_at, deleted_at
`;

/** 論理削除されていないフィラメントをすべて取得する */
export async function listFilaments(): Promise<Filament[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<FilamentRow>(
    `SELECT ${SELECT_COLUMNS} FROM filaments WHERE deleted_at IS NULL ORDER BY created_at DESC`,
  );
  return rows.map(toFilament);
}

/**
 * 論理削除されたものも含めて取得する。
 * 統計で「削除済みフィラメントの印刷ログ」を素材別に集計するために必要（要件定義書 4.2）。
 */
export async function listAllFilaments(): Promise<Filament[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<FilamentRow>(
    `SELECT ${SELECT_COLUMNS} FROM filaments ORDER BY created_at DESC`,
  );
  return rows.map(toFilament);
}

export async function getFilament(id: number): Promise<Filament | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<FilamentRow>(
    `SELECT ${SELECT_COLUMNS} FROM filaments WHERE id = ?`,
    [id],
  );
  return row ? toFilament(row) : null;
}

export async function createFilament(input: FilamentInput): Promise<number> {
  const db = await getDatabase();
  const timestamp = nowISO();
  const result = await db.runAsync(
    `INSERT INTO filaments (
       manufacturer, product_name, material, color_name, color_hex,
       diameter, initial_weight_g, spool_weight_g, current_weight_g,
       price_yen, purchased_at, purchased_from, opened_at,
       storage_location_id, status, note, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.manufacturer.trim(),
      emptyToNull(input.productName),
      input.material,
      input.colorName.trim(),
      input.colorHex,
      input.diameter,
      input.initialWeightG,
      input.spoolWeightG,
      input.currentWeightG,
      input.priceYen,
      emptyToNull(input.purchasedAt),
      emptyToNull(input.purchasedFrom),
      emptyToNull(input.openedAt),
      input.storageLocationId,
      input.status,
      emptyToNull(input.note),
      timestamp,
      timestamp,
    ],
  );
  return result.lastInsertRowId;
}

export async function updateFilament(id: number, input: FilamentInput): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE filaments SET
       manufacturer = ?, product_name = ?, material = ?, color_name = ?, color_hex = ?,
       diameter = ?, initial_weight_g = ?, spool_weight_g = ?, current_weight_g = ?,
       price_yen = ?, purchased_at = ?, purchased_from = ?, opened_at = ?,
       storage_location_id = ?, status = ?, note = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.manufacturer.trim(),
      emptyToNull(input.productName),
      input.material,
      input.colorName.trim(),
      input.colorHex,
      input.diameter,
      input.initialWeightG,
      input.spoolWeightG,
      input.currentWeightG,
      input.priceYen,
      emptyToNull(input.purchasedAt),
      emptyToNull(input.purchasedFrom),
      emptyToNull(input.openedAt),
      input.storageLocationId,
      input.status,
      emptyToNull(input.note),
      nowISO(),
      id,
    ],
  );
}

/**
 * 論理削除（要件定義書 4.2）。
 * 行を残すことで、削除済みフィラメントの印刷ログもコスト集計に残り続ける。
 */
export async function softDeleteFilament(id: number): Promise<void> {
  const db = await getDatabase();
  const timestamp = nowISO();
  await db.runAsync('UPDATE filaments SET deleted_at = ?, updated_at = ? WHERE id = ?', [
    timestamp,
    timestamp,
    id,
  ]);
}

export async function setFilamentStatus(id: number, status: FilamentStatus): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE filaments SET status = ?, updated_at = ? WHERE id = ?', [
    status,
    nowISO(),
    id,
  ]);
}

export async function setStorageLocation(
  id: number,
  storageLocationId: number | null,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE filaments SET storage_location_id = ?, updated_at = ? WHERE id = ?', [
    storageLocationId,
    nowISO(),
    id,
  ]);
}

/**
 * 開封日を記録し、未開封なら使用中に切り替える。
 * 未開封のままだと乾燥判定の対象にならないため、開封操作とセットで扱う。
 */
export async function markOpened(id: number, openedAt: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE filaments
     SET opened_at = ?, status = CASE WHEN status = 'unopened' THEN 'in_use' ELSE status END,
         updated_at = ?
     WHERE id = ?`,
    [openedAt, nowISO(), id],
  );
}

/** メーカー名のサジェスト候補（過去入力から。要件定義書 4.2） */
export async function listManufacturers(): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ manufacturer: string }>(
    `SELECT DISTINCT manufacturer FROM filaments WHERE manufacturer <> '' ORDER BY manufacturer`,
  );
  return rows.map((row) => row.manufacturer);
}

/** 購入先のサジェスト候補 */
export async function listPurchaseSources(): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ purchased_from: string }>(
    `SELECT DISTINCT purchased_from FROM filaments
     WHERE purchased_from IS NOT NULL AND purchased_from <> ''
     ORDER BY purchased_from`,
  );
  return rows.map((row) => row.purchased_from);
}
