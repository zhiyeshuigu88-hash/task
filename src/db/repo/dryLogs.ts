import { getDatabase } from '@/db/client';
import { emptyToNull, toDryLog, type DryLogRow } from '@/db/rows';
import type { DryLog } from '@/domain/types';

const SELECT_COLUMNS = 'id, filament_id, dried_at, temperature_c, duration_min, note';

/** 全フィラメントの乾燥ログ。最終乾燥日の算出に使う */
export async function listDryLogs(): Promise<DryLog[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<DryLogRow>(
    `SELECT ${SELECT_COLUMNS} FROM dry_logs ORDER BY dried_at DESC, id DESC`,
  );
  return rows.map(toDryLog);
}

export async function listDryLogsByFilament(filamentId: number): Promise<DryLog[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<DryLogRow>(
    `SELECT ${SELECT_COLUMNS} FROM dry_logs WHERE filament_id = ? ORDER BY dried_at DESC, id DESC`,
    [filamentId],
  );
  return rows.map(toDryLog);
}

export type DryLogInput = {
  filamentId: number;
  /** 'YYYY-MM-DD' */
  driedAt: string;
  temperatureC: number | null;
  durationMin: number | null;
  note: string | null;
};

export async function createDryLog(input: DryLogInput): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO dry_logs (filament_id, dried_at, temperature_c, duration_min, note)
     VALUES (?, ?, ?, ?, ?)`,
    [
      input.filamentId,
      input.driedAt,
      input.temperatureC,
      input.durationMin,
      emptyToNull(input.note),
    ],
  );
  return result.lastInsertRowId;
}

export async function deleteDryLog(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM dry_logs WHERE id = ?', [id]);
}
