import { getDatabase } from '@/db/client';
import { emptyToNull, toWeightAdjustment, type WeightAdjustmentRow } from '@/db/rows';
import { applyMeasure, applySubtract, type WeightUpdate } from '@/domain/calc';
import type { AdjustMethod, WeightAdjustment } from '@/domain/types';
import { nowISO } from '@/utils/date';

const SELECT_COLUMNS = `
  id, filament_id, method, value_g, resulting_weight_g, adjusted_at, note
`;

export async function listAdjustments(filamentId: number): Promise<WeightAdjustment[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<WeightAdjustmentRow>(
    `SELECT ${SELECT_COLUMNS} FROM weight_adjustments
     WHERE filament_id = ? ORDER BY adjusted_at DESC, id DESC`,
    [filamentId],
  );
  return rows.map(toWeightAdjustment);
}

/**
 * 残量を手動で更新する（要件定義書 4.4）。
 *
 * - method 'subtract': 使用量(g)を引く
 * - method 'measure':  実測総重量(g) − スプール自重 で置き換える
 *
 * どちらも 0 でクランプし、更新履歴を残す。
 */
export async function adjustWeight(input: {
  filamentId: number;
  method: AdjustMethod;
  valueG: number;
  note?: string | null;
}): Promise<WeightUpdate> {
  const db = await getDatabase();
  const filament = await db.getFirstAsync<{ current_weight_g: number; spool_weight_g: number }>(
    'SELECT current_weight_g, spool_weight_g FROM filaments WHERE id = ?',
    [input.filamentId],
  );
  if (!filament) {
    throw new Error('対象のフィラメントが見つかりませんでした');
  }

  const update =
    input.method === 'measure'
      ? applyMeasure(input.valueG, filament.spool_weight_g)
      : applySubtract(filament.current_weight_g, input.valueG);

  const timestamp = nowISO();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE filaments SET current_weight_g = ?, updated_at = ? WHERE id = ?', [
      update.resultingWeightG,
      timestamp,
      input.filamentId,
    ]);
    await db.runAsync(
      `INSERT INTO weight_adjustments (
         filament_id, method, value_g, resulting_weight_g, adjusted_at, note
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        input.filamentId,
        input.method,
        input.valueG,
        update.resultingWeightG,
        timestamp,
        emptyToNull(input.note),
      ],
    );
  });

  return update;
}
