import { getDatabase } from '@/db/client';
import { settingsFromRecord, settingsToRecord } from '@/domain/settings';
import type { AppSettings } from '@/domain/types';

/** app_settings を読み、欠けている項目は既定値で埋めた AppSettings を返す */
export async function loadSettings(): Promise<AppSettings> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM app_settings',
  );
  const record: Record<string, string> = {};
  for (const row of rows) {
    record[row.key] = row.value;
  }
  return settingsFromRecord(record);
}

/** 変更のあった項目だけでなく全体を書き戻す（項目数が少なくコストが無視できるため） */
export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await getDatabase();
  const record = settingsToRecord(settings);
  await db.withTransactionAsync(async () => {
    for (const [key, value] of Object.entries(record)) {
      await db.runAsync(
        `INSERT INTO app_settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, value],
      );
    }
  });
}
