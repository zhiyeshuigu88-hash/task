/**
 * 日付ユーティリティのテスト。
 * src/utils/date.ts は実行時 import を持たないため、calc.ts と同様にそのまま実行できる。
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { formatDate, formatDateTime, formatMonth, nowISO, toDateOnly, todayISO } from '../src/utils/date.ts';

test('todayISO / nowISO はローカル時刻から組み立てる（UTC に寄って日付がずれない）', () => {
  // 2026-01-01 の 00:30（ローカル）。UTC 換算だと前日になり得る時刻を使う
  const date = new Date(2026, 0, 1, 0, 30);
  assert.equal(todayISO(date), '2026-01-01');
  assert.equal(nowISO(date), '2026-01-01T00:30');
});

test('todayISO は月日を 2 桁にそろえる', () => {
  assert.equal(todayISO(new Date(2026, 7, 8)), '2026-08-08');
});

test('toDateOnly は日時から日付部分を取り出す', () => {
  assert.equal(toDateOnly('2026-08-08T14:30'), '2026-08-08');
  assert.equal(toDateOnly('2026-08-08'), '2026-08-08');
  assert.equal(toDateOnly('2026-08-08T14:30:00.000Z'), '2026-08-08');
});

test('toDateOnly は取り出せない値なら今日を返す', () => {
  // 印刷日時が壊れていても、開封日に空文字が入らないことを保証する
  assert.equal(toDateOnly(''), todayISO());
  assert.equal(toDateOnly('壊れた値'), todayISO());
  assert.equal(toDateOnly('08/08/2026'), todayISO());
});

test('表示用のフォーマット', () => {
  assert.equal(formatDate('2026-08-08'), '2026/08/08');
  assert.equal(formatDate('2026-08-08T14:30'), '2026/08/08');
  assert.equal(formatDate(null), '—');
  assert.equal(formatDateTime('2026-08-08T14:30'), '2026/08/08 14:30');
  // 時刻が無ければ日付だけにフォールバックする
  assert.equal(formatDateTime('2026-08-08'), '2026/08/08');
  assert.equal(formatMonth('2026-08'), '2026年8月');
});
