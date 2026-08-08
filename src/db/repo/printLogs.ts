import { getDatabase } from '@/db/client';
import { markOpenedIfUnopened } from '@/db/repo/filaments';
import { emptyToNull, toPrintLog, type PrintLogRow } from '@/db/rows';
import { applySubtract, materialCostYen, unitPriceYen, type WeightUpdate } from '@/domain/calc';
import type { PrintLog, PrintResult } from '@/domain/types';
import { nowISO, toDateOnly } from '@/utils/date';

export type PrintLogInput = {
  filamentId: number;
  usedWeightG: number;
  modelName: string | null;
  /** 'YYYY-MM-DDTHH:mm' */
  printedAt: string;
  durationMin: number | null;
  result: PrintResult;
  note: string | null;
};

const SELECT_COLUMNS = `
  id, filament_id, used_weight_g, model_name, printed_at,
  duration_min, result, cost_yen, note, created_at
`;

/** 全期間の印刷ログ。削除済みフィラメントのログもコスト集計のために残す */
export async function listPrintLogs(): Promise<PrintLog[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<PrintLogRow>(
    `SELECT ${SELECT_COLUMNS} FROM print_logs ORDER BY printed_at DESC, id DESC`,
  );
  return rows.map(toPrintLog);
}

export async function listPrintLogsByFilament(filamentId: number): Promise<PrintLog[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<PrintLogRow>(
    `SELECT ${SELECT_COLUMNS} FROM print_logs WHERE filament_id = ? ORDER BY printed_at DESC, id DESC`,
    [filamentId],
  );
  return rows.map(toPrintLog);
}

export type CreatePrintLogResult = WeightUpdate & {
  printLogId: number;
  costYen: number;
};

/**
 * 印刷ログを登録し、同時に残量を減算する（要件定義書 4.5）。
 *
 * - 材料費 = 使用量 × 1gあたり単価 を自動算出して保存する
 * - 「失敗」でも残量とコストに計上する（ロスを可視化するため）
 * - 残量更新は weight_adjustments にも履歴として残す（要件定義書 4.4 共通仕様）
 *
 * ログ・残量・履歴が食い違わないよう、すべて 1 トランザクションで書き込む。
 */
export async function createPrintLog(input: PrintLogInput): Promise<CreatePrintLogResult> {
  const db = await getDatabase();
  const filament = await db.getFirstAsync<{
    current_weight_g: number;
    initial_weight_g: number;
    price_yen: number;
  }>('SELECT current_weight_g, initial_weight_g, price_yen FROM filaments WHERE id = ?', [
    input.filamentId,
  ]);

  if (!filament) {
    throw new Error('対象のフィラメントが見つかりませんでした');
  }

  const unitPrice = unitPriceYen(filament.price_yen, filament.initial_weight_g);
  const costYen = materialCostYen(input.usedWeightG, unitPrice);
  const update = applySubtract(filament.current_weight_g, input.usedWeightG);
  const timestamp = nowISO();

  let printLogId = 0;
  await db.withTransactionAsync(async () => {
    const inserted = await db.runAsync(
      `INSERT INTO print_logs (
         filament_id, used_weight_g, model_name, printed_at,
         duration_min, result, cost_yen, note, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.filamentId,
        input.usedWeightG,
        emptyToNull(input.modelName),
        input.printedAt,
        input.durationMin,
        input.result,
        costYen,
        emptyToNull(input.note),
        timestamp,
      ],
    );
    printLogId = inserted.lastInsertRowId;

    await db.runAsync('UPDATE filaments SET current_weight_g = ?, updated_at = ? WHERE id = ?', [
      update.resultingWeightG,
      timestamp,
      input.filamentId,
    ]);

    await db.runAsync(
      `INSERT INTO weight_adjustments (
         filament_id, method, value_g, resulting_weight_g, adjusted_at, note
       ) VALUES (?, 'subtract', ?, ?, ?, ?)`,
      [
        input.filamentId,
        input.usedWeightG,
        update.resultingWeightG,
        input.printedAt,
        `印刷ログ #${printLogId}`,
      ],
    );

    // 印刷したということは開封済みなので、未開封のままにはしない。
    // 開封日は印刷日とする（その日には開いていたはずなので）
    await markOpenedIfUnopened(
      db,
      input.filamentId,
      toDateOnly(input.printedAt),
      timestamp,
    );
  });

  return { ...update, printLogId, costYen };
}

/**
 * 印刷ログを取り消し、減算していた残量を戻す。
 * 誤入力の訂正手段であり、戻した分も履歴として残す。
 */
export async function deletePrintLog(printLogId: number): Promise<void> {
  const db = await getDatabase();
  const log = await db.getFirstAsync<{ filament_id: number; used_weight_g: number }>(
    'SELECT filament_id, used_weight_g FROM print_logs WHERE id = ?',
    [printLogId],
  );
  if (!log) return;

  const filament = await db.getFirstAsync<{ current_weight_g: number; initial_weight_g: number }>(
    'SELECT current_weight_g, initial_weight_g FROM filaments WHERE id = ?',
    [log.filament_id],
  );
  const timestamp = nowISO();

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM print_logs WHERE id = ?', [printLogId]);

    if (filament) {
      // 初期重量を超えて戻らないようにする
      const restored = Math.min(
        filament.initial_weight_g,
        Math.round((filament.current_weight_g + log.used_weight_g) * 100) / 100,
      );
      await db.runAsync('UPDATE filaments SET current_weight_g = ?, updated_at = ? WHERE id = ?', [
        restored,
        timestamp,
        log.filament_id,
      ]);
      await db.runAsync(
        `INSERT INTO weight_adjustments (
           filament_id, method, value_g, resulting_weight_g, adjusted_at, note
         ) VALUES (?, 'subtract', ?, ?, ?, ?)`,
        [log.filament_id, -log.used_weight_g, restored, timestamp, '印刷ログの取り消し'],
      );
    }
  });
}
