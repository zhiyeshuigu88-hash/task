import type { SQLiteDatabase } from 'expo-sqlite';

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

/**
 * 未開封のまま消費されたフィラメントを「使用中」に切り替える。
 *
 * 印刷ログの登録や使用量の減算は「そのスプールを使った」ことを意味するので、
 * 未開封のままだと残量だけ減って、乾燥推奨判定（未開封は対象外）にもホームの
 * 「使用中の本数」にも入らない状態になってしまう。
 *
 * 開封日が未設定なら合わせて記録する。すでに入っている開封日は上書きしない。
 * 判定と更新を 1 文で行うため、同時に呼ばれても二重に切り替わらない。
 *
 * 呼び出し側のトランザクションに参加させたいので、db を引数で受け取る。
 */
export async function markOpenedIfUnopened(
  db: SQLiteDatabase,
  filamentId: number,
  openedAt: string,
  updatedAt: string,
): Promise<void> {
  await db.runAsync(
    `UPDATE filaments
     SET status = 'in_use',
         opened_at = COALESCE(opened_at, ?),
         updated_at = ?
     WHERE id = ? AND status = 'unopened'`,
    [openedAt, updatedAt, filamentId],
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
