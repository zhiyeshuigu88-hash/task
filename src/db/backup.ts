import { getDatabase } from '@/db/client';

/**
 * F-12 エクスポート / インポート。
 * 行をそのままの形で JSON に落とすことで、往復しても情報が欠けないようにする。
 */

export const BACKUP_FORMAT_VERSION = 1;

/** 依存関係の順（親 → 子）。インポート時はこの順に挿入し、削除は逆順で行う */
const TABLES = [
  'storage_locations',
  'filaments',
  'print_logs',
  'dry_logs',
  'weight_adjustments',
  'print_settings',
  'app_settings',
] as const;

type TableName = (typeof TABLES)[number];

export type BackupFile = {
  format: 'filament-keeper';
  version: number;
  exportedAt: string;
  tables: Record<TableName, Record<string, unknown>[]>;
};

export async function exportBackup(): Promise<BackupFile> {
  const db = await getDatabase();
  const tables = {} as Record<TableName, Record<string, unknown>[]>;
  for (const table of TABLES) {
    tables[table] = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${table}`);
  }
  return {
    format: 'filament-keeper',
    version: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
  };
}

export type ImportSummary = Record<TableName, number>;

/**
 * バックアップを読み込み、既存データを置き換える。
 * 途中で失敗しても中途半端な状態が残らないよう、削除と挿入を 1 トランザクションで行う。
 */
export async function importBackup(raw: string): Promise<ImportSummary> {
  const parsed = parseBackup(raw);
  const db = await getDatabase();
  const summary = {} as ImportSummary;

  await db.withTransactionAsync(async () => {
    // 外部キー制約に引っかからないよう子テーブルから消す
    for (const table of [...TABLES].reverse()) {
      await db.runAsync(`DELETE FROM ${table}`);
    }

    for (const table of TABLES) {
      const rows = parsed.tables[table] ?? [];
      summary[table] = rows.length;
      for (const row of rows) {
        const columns = Object.keys(row);
        if (columns.length === 0) continue;
        const placeholders = columns.map(() => '?').join(', ');
        // 列名は下の parseBackup で識別子として妥当なものだけに絞り込んでいる
        await db.runAsync(
          `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
          columns.map((column) => normalizeValue(row[column])),
        );
      }
    }
  });

  return summary;
}

/** JSON をバックアップ形式として検証する。壊れたファイルは日本語のエラーで弾く */
export function parseBackup(raw: string): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('JSON として読み取れませんでした');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('バックアップの形式が正しくありません');
  }

  const file = parsed as Partial<BackupFile>;
  if (file.format !== 'filament-keeper') {
    throw new Error('このアプリのバックアップファイルではありません');
  }
  if (typeof file.version !== 'number' || file.version > BACKUP_FORMAT_VERSION) {
    throw new Error('より新しいバージョンのバックアップです。アプリを更新してください');
  }
  if (typeof file.tables !== 'object' || file.tables === null) {
    throw new Error('バックアップにデータが含まれていません');
  }

  const tables = {} as Record<TableName, Record<string, unknown>[]>;
  for (const table of TABLES) {
    const value = (file.tables as Record<string, unknown>)[table];
    if (value === undefined) {
      tables[table] = [];
      continue;
    }
    if (!Array.isArray(value)) {
      throw new Error(`${table} の形式が正しくありません`);
    }
    tables[table] = value.map((row) => sanitizeRow(row, table));
  }

  return {
    format: 'filament-keeper',
    version: file.version,
    exportedAt: typeof file.exportedAt === 'string' ? file.exportedAt : '',
    tables,
  };
}

/**
 * 列名は SQL に直接埋め込むため、識別子として妥当なものだけを通す。
 * 未知の列は無視する（将来のバージョンで増えた列を読み込んでも落ちないように）。
 */
function sanitizeRow(row: unknown, table: TableName): Record<string, unknown> {
  if (typeof row !== 'object' || row === null || Array.isArray(row)) {
    throw new Error(`${table} に不正な行が含まれています`);
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (!/^[a-z_][a-z0-9_]*$/i.test(key)) continue;
    result[key] = value;
  }
  return result;
}

/** SQLite にバインドできる型に落とす */
function normalizeValue(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return JSON.stringify(value);
}
