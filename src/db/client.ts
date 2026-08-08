import * as SQLite from 'expo-sqlite';

export const DATABASE_NAME = 'filament-keeper.db';

/**
 * マイグレーション。
 * `PRAGMA user_version` を見て、未適用のものだけを順に流す。
 * 既存データを壊さないよう、配列の途中を書き換えず末尾に追加すること。
 */
const MIGRATIONS: string[] = [
  // v1: 初期スキーマ（要件定義書 6. データモデル）
  `
  CREATE TABLE IF NOT EXISTS storage_locations (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    name                   TEXT    NOT NULL,
    type                   TEXT    NOT NULL DEFAULT 'other',
    desiccant_replaced_at  TEXT,
    replace_interval_days  INTEGER NOT NULL DEFAULT 60
  );

  CREATE TABLE IF NOT EXISTS filaments (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    manufacturer         TEXT    NOT NULL,
    product_name         TEXT,
    material             TEXT    NOT NULL,
    color_name           TEXT    NOT NULL,
    color_hex            TEXT    NOT NULL,
    diameter             REAL    NOT NULL DEFAULT 1.75,
    initial_weight_g     REAL    NOT NULL,
    spool_weight_g       REAL    NOT NULL,
    current_weight_g     REAL    NOT NULL,
    price_yen            REAL    NOT NULL,
    purchased_at         TEXT,
    purchased_from       TEXT,
    opened_at            TEXT,
    storage_location_id  INTEGER REFERENCES storage_locations(id) ON DELETE SET NULL,
    status               TEXT    NOT NULL DEFAULT 'in_use',
    note                 TEXT,
    created_at           TEXT    NOT NULL,
    updated_at           TEXT    NOT NULL,
    deleted_at           TEXT
  );

  CREATE TABLE IF NOT EXISTS print_logs (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    filament_id    INTEGER NOT NULL REFERENCES filaments(id) ON DELETE CASCADE,
    used_weight_g  REAL    NOT NULL,
    model_name     TEXT,
    printed_at     TEXT    NOT NULL,
    duration_min   INTEGER,
    result         TEXT    NOT NULL DEFAULT 'success',
    cost_yen       REAL    NOT NULL DEFAULT 0,
    note           TEXT,
    created_at     TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS dry_logs (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    filament_id    INTEGER NOT NULL REFERENCES filaments(id) ON DELETE CASCADE,
    dried_at       TEXT    NOT NULL,
    temperature_c  REAL,
    duration_min   INTEGER,
    note           TEXT
  );

  CREATE TABLE IF NOT EXISTS weight_adjustments (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    filament_id        INTEGER NOT NULL REFERENCES filaments(id) ON DELETE CASCADE,
    method             TEXT    NOT NULL,
    value_g            REAL    NOT NULL,
    resulting_weight_g REAL    NOT NULL,
    adjusted_at        TEXT    NOT NULL,
    note               TEXT
  );

  CREATE TABLE IF NOT EXISTS print_settings (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    filament_id    INTEGER NOT NULL UNIQUE REFERENCES filaments(id) ON DELETE CASCADE,
    nozzle_temp_c  REAL,
    bed_temp_c     REAL,
    speed_mms      REAL,
    fan_percent    REAL,
    note           TEXT
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_print_logs_filament  ON print_logs(filament_id);
  CREATE INDEX IF NOT EXISTS idx_print_logs_printed   ON print_logs(printed_at);
  CREATE INDEX IF NOT EXISTS idx_dry_logs_filament    ON dry_logs(filament_id);
  CREATE INDEX IF NOT EXISTS idx_adjustments_filament ON weight_adjustments(filament_id);
  CREATE INDEX IF NOT EXISTS idx_filaments_status     ON filaments(status, deleted_at);
  `,
];

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/** DB を開き、必要ならマイグレーションを適用する（プロセス内で1回だけ実行される） */
export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openAndMigrate().catch((error) => {
      // 失敗を握りつぶすと次回以降ずっと壊れた Promise を返してしまうため、キャッシュを捨てる
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const applied = row?.user_version ?? 0;

  for (let version = applied; version < MIGRATIONS.length; version++) {
    const sql = MIGRATIONS[version];
    if (!sql) continue;
    await db.withTransactionAsync(async () => {
      await db.execAsync(sql);
    });
    // PRAGMA はプレースホルダを受け付けないため、数値を直接埋め込む（外部入力ではない）
    await db.execAsync(`PRAGMA user_version = ${version + 1}`);
  }

  return db;
}

/** テスト・インポート処理用。開いている DB を閉じてキャッシュを捨てる */
export async function closeDatabase(): Promise<void> {
  if (!dbPromise) return;
  const db = await dbPromise.catch(() => null);
  dbPromise = null;
  await db?.closeAsync();
}
