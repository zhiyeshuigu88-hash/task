import { getDatabase } from '@/db/client';
import { emptyToNull, toPrintSettings, type PrintSettingsRow } from '@/db/rows';
import type { PrintSettings } from '@/domain/types';

const SELECT_COLUMNS =
  'id, filament_id, nozzle_temp_c, bed_temp_c, speed_mms, fan_percent, note';

export type PrintSettingsInput = {
  filamentId: number;
  nozzleTempC: number | null;
  bedTempC: number | null;
  speedMms: number | null;
  fanPercent: number | null;
  note: string | null;
};

/** フィラメント 1 — 1 印刷設定メモ（F-11） */
export async function listPrintSettings(): Promise<PrintSettings[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<PrintSettingsRow>(`SELECT ${SELECT_COLUMNS} FROM print_settings`);
  return rows.map(toPrintSettings);
}

export async function upsertPrintSettings(input: PrintSettingsInput): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO print_settings (filament_id, nozzle_temp_c, bed_temp_c, speed_mms, fan_percent, note)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(filament_id) DO UPDATE SET
       nozzle_temp_c = excluded.nozzle_temp_c,
       bed_temp_c    = excluded.bed_temp_c,
       speed_mms     = excluded.speed_mms,
       fan_percent   = excluded.fan_percent,
       note          = excluded.note`,
    [
      input.filamentId,
      input.nozzleTempC,
      input.bedTempC,
      input.speedMms,
      input.fanPercent,
      emptyToNull(input.note),
    ],
  );
}
