/**
 * ドメイン計算ロジックのテスト。
 *
 * src/domain/calc.ts は実行時 import を持たない純粋関数だけで構成されているため、
 * React Native を起動せずに Node の test runner でそのまま検証できる。
 *
 *   npm test
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyMeasure,
  applySubtract,
  costInMonth,
  daysBetween,
  dryThresholdFor,
  evaluateDesiccant,
  evaluateDrying,
  inventoryValueYen,
  isLowStock,
  isValidDateString,
  lossSummary,
  materialCostYen,
  materialUsage,
  monthKey,
  monthlyCosts,
  parseDateOnly,
  recentMonthKeys,
  remainingPercent,
  shiftMonthKey,
  totalCost,
  totalRemainingG,
  unitPriceYen,
} from '../src/domain/calc.ts';
import { DEFAULT_DRY_THRESHOLDS } from '../src/domain/settings.ts';

/* ------------------------------------------------------------------ *
 * テスト用のデータ生成
 * ------------------------------------------------------------------ */

type PartialLog = {
  id?: number;
  filamentId?: number;
  usedWeightG?: number;
  printedAt?: string;
  result?: 'success' | 'failed' | 'aborted';
  costYen?: number;
};

function log(partial: PartialLog = {}) {
  return {
    id: partial.id ?? 1,
    filamentId: partial.filamentId ?? 1,
    usedWeightG: partial.usedWeightG ?? 10,
    modelName: null,
    printedAt: partial.printedAt ?? '2026-08-01T10:00',
    durationMin: null,
    result: partial.result ?? ('success' as const),
    costYen: partial.costYen ?? 30,
    note: null,
    createdAt: '2026-08-01T10:00',
  };
}

/* ------------------------------------------------------------------ *
 * 日付ユーティリティ
 * ------------------------------------------------------------------ */

test('parseDateOnly は存在しない日付を弾く', () => {
  assert.equal(parseDateOnly('2026-02-31'), null);
  assert.equal(parseDateOnly('2026-13-01'), null);
  assert.equal(parseDateOnly('2026-00-10'), null);
  assert.equal(parseDateOnly('not-a-date'), null);
  assert.equal(parseDateOnly(''), null);
  assert.equal(parseDateOnly(null), null);
  assert.notEqual(parseDateOnly('2024-02-29'), null); // うるう年は通す
});

test('isValidDateString は ISO8601 の日時も受け付ける', () => {
  assert.equal(isValidDateString('2026-08-08'), true);
  assert.equal(isValidDateString('2026-08-08T14:30'), true);
  assert.equal(isValidDateString('2026/08/08'), false);
});

test('daysBetween は月をまたいでも正しく数える', () => {
  assert.equal(daysBetween('2026-08-01', '2026-08-08'), 7);
  assert.equal(daysBetween('2026-07-31', '2026-08-01'), 1);
  assert.equal(daysBetween('2025-12-31', '2026-01-01'), 1);
  assert.equal(daysBetween('2026-08-08', '2026-08-08'), 0);
  assert.equal(daysBetween(null, '2026-08-08'), null);
});

test('recentMonthKeys は年をまたいで直近Nヶ月を古い順に返す', () => {
  assert.deepEqual(recentMonthKeys('2026-02-15', 4), ['2025-11', '2025-12', '2026-01', '2026-02']);
  assert.deepEqual(recentMonthKeys('2026-08-08', 1), ['2026-08']);
  assert.deepEqual(recentMonthKeys('2026-08-08', 0), []);
  assert.equal(recentMonthKeys('2026-08-08', 12).length, 12);
});

test('shiftMonthKey は1月から先月を引くと前年12月になる', () => {
  assert.equal(shiftMonthKey('2026-01-10', -1), '2025-12');
  assert.equal(shiftMonthKey('2026-08-08', -1), '2026-07');
  assert.equal(shiftMonthKey('2026-08-08', 0), '2026-08');
});

test('monthKey は日時からも年月を取り出せる', () => {
  assert.equal(monthKey('2026-08-08T14:30'), '2026-08');
  assert.equal(monthKey('壊れた値'), null);
  assert.equal(monthKey(null), null);
});

/* ------------------------------------------------------------------ *
 * 単価・残量（要件定義書 4.2 / 4.4）
 * ------------------------------------------------------------------ */

test('1gあたり単価 = 購入価格 ÷ 初期フィラメント重量', () => {
  assert.equal(unitPriceYen(3000, 1000), 3);
  assert.equal(unitPriceYen(2480, 800), 3.1);
  // 0除算やありえない値でも落ちない
  assert.equal(unitPriceYen(3000, 0), 0);
  assert.equal(unitPriceYen(3000, -100), 0);
});

test('残量% は 0〜100 にクランプされる', () => {
  assert.equal(remainingPercent(250, 1000), 25);
  assert.equal(remainingPercent(1200, 1000), 100);
  assert.equal(remainingPercent(-50, 1000), 0);
  assert.equal(remainingPercent(500, 0), 0);
});

test('材料費 = 使用量 × 単価（小数2桁に丸める）', () => {
  assert.equal(materialCostYen(12.5, 3), 37.5);
  assert.equal(materialCostYen(33.333, 2.98), 99.33);
  assert.equal(materialCostYen(0, 3), 0);
});

test('方式A：使用量を引く。残量は0でクランプする', () => {
  assert.deepEqual(applySubtract(1000, 250), {
    resultingWeightG: 750,
    clamped: false,
    depleted: false,
  });
  // 残量ちょうど0は「使い切り」として扱う
  assert.deepEqual(applySubtract(100, 100), {
    resultingWeightG: 0,
    clamped: false,
    depleted: true,
  });
  // 残量を超える使用量はマイナスにせず、クランプしたことを伝える
  assert.deepEqual(applySubtract(100, 150), {
    resultingWeightG: 0,
    clamped: true,
    depleted: true,
  });
});

test('方式B：実測総重量 − スプール自重 が残量になる', () => {
  assert.deepEqual(applyMeasure(1200, 250), {
    resultingWeightG: 950,
    clamped: false,
    depleted: false,
  });
  // スプール自重を下回る実測値（測り間違い）でもマイナスにしない
  assert.deepEqual(applyMeasure(200, 250), {
    resultingWeightG: 0,
    clamped: true,
    depleted: true,
  });
});

/* ------------------------------------------------------------------ *
 * 乾燥推奨判定（要件定義書 4.8）
 * ------------------------------------------------------------------ */

test('素材別の閾値を引く。未知の値は OTHER にフォールバックする', () => {
  assert.equal(dryThresholdFor('PLA', DEFAULT_DRY_THRESHOLDS), 90);
  assert.equal(dryThresholdFor('TPU', DEFAULT_DRY_THRESHOLDS), 21);
  assert.equal(dryThresholdFor('PETG', DEFAULT_DRY_THRESHOLDS), 45);
  const broken = { ...DEFAULT_DRY_THRESHOLDS, PETG: 0 };
  assert.equal(dryThresholdFor('PETG', broken), 60); // OTHER の値
});

test('未開封のフィラメントは判定対象外', () => {
  const result = evaluateDrying(
    { material: 'PLA', status: 'unopened', openedAt: null, lastDriedAt: null },
    DEFAULT_DRY_THRESHOLDS,
    '2026-08-08',
  );
  assert.equal(result.needsDrying, false);
  assert.equal(result.daysSince, null);
});

test('使用済みのフィラメントも判定対象外', () => {
  const result = evaluateDrying(
    { material: 'TPU', status: 'used_up', openedAt: '2025-01-01', lastDriedAt: null },
    DEFAULT_DRY_THRESHOLDS,
    '2026-08-08',
  );
  assert.equal(result.needsDrying, false);
});

test('基準日 = 最終乾燥日 ?? 開封日', () => {
  const withDryLog = evaluateDrying(
    { material: 'PETG', status: 'in_use', openedAt: '2026-01-01', lastDriedAt: '2026-08-01' },
    DEFAULT_DRY_THRESHOLDS,
    '2026-08-08',
  );
  assert.equal(withDryLog.baseDate, '2026-08-01');
  assert.equal(withDryLog.daysSince, 7);
  assert.equal(withDryLog.needsDrying, false);

  const withoutDryLog = evaluateDrying(
    { material: 'PETG', status: 'in_use', openedAt: '2026-01-01', lastDriedAt: null },
    DEFAULT_DRY_THRESHOLDS,
    '2026-08-08',
  );
  assert.equal(withoutDryLog.baseDate, '2026-01-01');
  assert.equal(withoutDryLog.needsDrying, true);
});

test('閾値ちょうどでは要乾燥にせず、超えた翌日に立てる', () => {
  const base = {
    material: 'TPU' as const,
    status: 'in_use' as const,
    openedAt: '2026-07-18',
    lastDriedAt: null,
  };
  // TPU の閾値は21日
  const exactly = evaluateDrying(base, DEFAULT_DRY_THRESHOLDS, '2026-08-08');
  assert.equal(exactly.daysSince, 21);
  assert.equal(exactly.dueInDays, 0);
  assert.equal(exactly.needsDrying, false);

  const oneDayOver = evaluateDrying(base, DEFAULT_DRY_THRESHOLDS, '2026-08-09');
  assert.equal(oneDayOver.daysSince, 22);
  assert.equal(oneDayOver.dueInDays, -1);
  assert.equal(oneDayOver.needsDrying, true);
});

test('開封日も乾燥ログも無いときは判定不能として要乾燥にしない', () => {
  const result = evaluateDrying(
    { material: 'ABS', status: 'in_use', openedAt: null, lastDriedAt: null },
    DEFAULT_DRY_THRESHOLDS,
    '2026-08-08',
  );
  assert.equal(result.baseDate, null);
  assert.equal(result.dueInDays, null);
  assert.equal(result.needsDrying, false);
});

/* ------------------------------------------------------------------ *
 * 残量アラート（要件定義書 4.9）
 * ------------------------------------------------------------------ */

test('残量%モード：閾値ちょうども「残りわずか」に含む', () => {
  const settings = { lowStockMode: 'percent' as const, lowStockPercent: 20, lowStockGram: 200 };
  assert.equal(
    isLowStock({ currentWeightG: 200, initialWeightG: 1000, status: 'in_use' }, settings),
    true,
  );
  assert.equal(
    isLowStock({ currentWeightG: 201, initialWeightG: 1000, status: 'in_use' }, settings),
    false,
  );
});

test('残量gモード：初期重量に関係なく重量で判定する', () => {
  const settings = { lowStockMode: 'gram' as const, lowStockPercent: 20, lowStockGram: 150 };
  assert.equal(
    isLowStock({ currentWeightG: 150, initialWeightG: 5000, status: 'in_use' }, settings),
    true,
  );
  assert.equal(
    isLowStock({ currentWeightG: 160, initialWeightG: 250, status: 'in_use' }, settings),
    false,
  );
});

test('使用済みは残量アラートの対象外', () => {
  const settings = { lowStockMode: 'percent' as const, lowStockPercent: 20, lowStockGram: 200 };
  assert.equal(
    isLowStock({ currentWeightG: 0, initialWeightG: 1000, status: 'used_up' }, settings),
    false,
  );
});

/* ------------------------------------------------------------------ *
 * 乾燥剤の交換期限（要件定義書 4.7）
 * ------------------------------------------------------------------ */

test('乾燥剤は交換間隔を超えた時点で期限超過になる', () => {
  const location = {
    id: 1,
    name: '防湿ボックス',
    type: 'dry_box' as const,
    desiccantReplacedAt: '2026-06-01',
    replaceIntervalDays: 60,
  };
  const within = evaluateDesiccant(location, '2026-07-31');
  assert.equal(within.daysSince, 60);
  assert.equal(within.dueInDays, 0);
  assert.equal(within.overdue, false);

  const over = evaluateDesiccant(location, '2026-08-08');
  assert.equal(over.daysSince, 68);
  assert.equal(over.dueInDays, -8);
  assert.equal(over.overdue, true);
});

test('最終交換日が未設定なら期限超過にはしない', () => {
  const result = evaluateDesiccant(
    {
      id: 1,
      name: '棚',
      type: 'shelf' as const,
      desiccantReplacedAt: null,
      replaceIntervalDays: 60,
    },
    '2026-08-08',
  );
  assert.equal(result.daysSince, null);
  assert.equal(result.overdue, false);
});

/* ------------------------------------------------------------------ *
 * 統計（要件定義書 4.10）
 * ------------------------------------------------------------------ */

test('月別材料費はデータの無い月も0で埋めて直近Nヶ月ぶん返す', () => {
  const logs = [
    log({ id: 1, printedAt: '2026-08-01T10:00', costYen: 100 }),
    log({ id: 2, printedAt: '2026-08-20T10:00', costYen: 50.5 }),
    log({ id: 3, printedAt: '2026-06-10T10:00', costYen: 200 }),
    // 集計期間より前のログは無視される
    log({ id: 4, printedAt: '2020-01-01T10:00', costYen: 9999 }),
  ];
  const result = monthlyCosts(logs, '2026-08-08', 3);
  assert.deepEqual(result, [
    { month: '2026-06', costYen: 200 },
    { month: '2026-07', costYen: 0 },
    { month: '2026-08', costYen: 150.5 },
  ]);
});

test('今月・先月・累計の材料費', () => {
  const logs = [
    log({ id: 1, printedAt: '2026-08-01T10:00', costYen: 120 }),
    log({ id: 2, printedAt: '2026-07-15T10:00', costYen: 80 }),
    log({ id: 3, printedAt: '2026-07-20T10:00', costYen: 20 }),
  ];
  assert.equal(costInMonth(logs, '2026-08'), 120);
  assert.equal(costInMonth(logs, '2026-07'), 100);
  assert.equal(costInMonth(logs, null), 0);
  assert.equal(totalCost(logs), 220);
});

test('失敗と途中中止をロスとして集計する', () => {
  const logs = [
    log({ id: 1, result: 'success', costYen: 300 }),
    log({ id: 2, result: 'failed', costYen: 80 }),
    log({ id: 3, result: 'aborted', costYen: 20 }),
  ];
  const result = lossSummary(logs);
  assert.equal(result.lossYen, 100);
  assert.equal(result.totalYen, 400);
  assert.equal(result.lossPercent, 25);
  assert.equal(result.lossCount, 2);
});

test('ログが1件も無ければロス率は0（0除算しない）', () => {
  const result = lossSummary([]);
  assert.equal(result.lossPercent, 0);
  assert.equal(result.totalYen, 0);
});

test('素材別の消費量は多い順に並び、割合の合計は100になる', () => {
  const filaments = [
    { id: 1, material: 'PLA' as const },
    { id: 2, material: 'PETG' as const },
    { id: 3, material: 'PLA' as const },
  ];
  const logs = [
    log({ id: 1, filamentId: 1, usedWeightG: 100 }),
    log({ id: 2, filamentId: 3, usedWeightG: 50 }),
    log({ id: 3, filamentId: 2, usedWeightG: 50 }),
    // 削除済みなどで対応するフィラメントが無いログは無視する
    log({ id: 4, filamentId: 999, usedWeightG: 999 }),
  ];
  const result = materialUsage(logs, filaments);
  assert.deepEqual(result, [
    { material: 'PLA', usedWeightG: 150, percent: 75 },
    { material: 'PETG', usedWeightG: 50, percent: 25 },
  ]);
});

test('資産額と総残量は使用済みを除いて合計する', () => {
  const filaments = [
    { currentWeightG: 500, initialWeightG: 1000, priceYen: 3000, status: 'in_use' as const },
    { currentWeightG: 1000, initialWeightG: 1000, priceYen: 2000, status: 'unopened' as const },
    { currentWeightG: 0, initialWeightG: 1000, priceYen: 3000, status: 'used_up' as const },
  ];
  // 500g × ¥3/g + 1000g × ¥2/g
  assert.equal(inventoryValueYen(filaments), 3500);
  assert.equal(totalRemainingG(filaments), 1500);
});
