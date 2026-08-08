import { getDatabase } from '@/db/client';
import { emptyToNull, toStorageLocation, type StorageLocationRow } from '@/db/rows';
import type { StorageLocation, StorageType } from '@/domain/types';

const SELECT_COLUMNS = 'id, name, type, desiccant_replaced_at, replace_interval_days';

export type StorageLocationInput = {
  name: string;
  type: StorageType;
  /** 'YYYY-MM-DD' */
  desiccantReplacedAt: string | null;
  replaceIntervalDays: number;
};

export async function listStorageLocations(): Promise<StorageLocation[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<StorageLocationRow>(
    `SELECT ${SELECT_COLUMNS} FROM storage_locations ORDER BY name`,
  );
  return rows.map(toStorageLocation);
}

export async function createStorageLocation(input: StorageLocationInput): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO storage_locations (name, type, desiccant_replaced_at, replace_interval_days)
     VALUES (?, ?, ?, ?)`,
    [
      input.name.trim(),
      input.type,
      emptyToNull(input.desiccantReplacedAt),
      input.replaceIntervalDays,
    ],
  );
  return result.lastInsertRowId;
}

export async function updateStorageLocation(
  id: number,
  input: StorageLocationInput,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE storage_locations
     SET name = ?, type = ?, desiccant_replaced_at = ?, replace_interval_days = ?
     WHERE id = ?`,
    [
      input.name.trim(),
      input.type,
      emptyToNull(input.desiccantReplacedAt),
      input.replaceIntervalDays,
      id,
    ],
  );
}

/** 乾燥剤を交換した日を記録する（ワンタップ操作から呼ぶ） */
export async function recordDesiccantReplacement(id: number, date: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE storage_locations SET desiccant_replaced_at = ? WHERE id = ?', [
    date,
    id,
  ]);
}

/**
 * 保管場所を削除する。
 * filaments.storage_location_id は ON DELETE SET NULL なので、
 * そこに置いていたフィラメントは「保管場所なし」になるだけで消えない。
 */
export async function deleteStorageLocation(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM storage_locations WHERE id = ?', [id]);
}
