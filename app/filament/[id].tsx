import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { adjustWeight, listAdjustments } from '@/db/repo/adjustments';
import { createDryLog, deleteDryLog } from '@/db/repo/dryLogs';
import { markOpened, setFilamentStatus, setStorageLocation, softDeleteFilament } from '@/db/repo/filaments';
import { upsertPrintSettings } from '@/db/repo/printSettings';
import { isValidDateString } from '@/domain/calc';
import { MATERIAL_COLORS, STATUS_LABELS, materialLabel } from '@/domain/materials';
import type { AdjustMethod, FilamentStatus, WeightAdjustment } from '@/domain/types';
import { useApp } from '@/state/AppProvider';
import { useTheme } from '@/state/useTheme';
import {
  Badge,
  Button,
  Card,
  ColorChip,
  Divider,
  EmptyState,
  InfoRow,
  MaterialBadge,
  ProgressBar,
  Screen,
  SectionHeader,
  TextButton,
} from '@/ui/components';
import { StatusBadges, remainingColor } from '@/ui/FilamentCard';
import { ChipSelect, DateField, Field, NumberField, SegmentedControl, TextField } from '@/ui/form';
import { formatDate, formatDateTime, todayISO } from '@/utils/date';
import { duration, grams, parseNumberInput, percent, unitPrice, yen } from '@/utils/format';

const STATUS_OPTIONS = (Object.keys(STATUS_LABELS) as FilamentStatus[]).map((value) => ({
  value,
  label: STATUS_LABELS[value],
}));

/** S-03 フィラメント詳細 */
export default function FilamentDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = Number(params.id);

  const { views, printLogs, dryLogs, printSettings, storageLocations, refresh } = useApp();
  const filament = views.find((view) => view.id === id) ?? null;

  const [adjustments, setAdjustments] = useState<WeightAdjustment[]>([]);

  const reloadAdjustments = useCallback(async () => {
    if (!Number.isFinite(id)) return;
    setAdjustments(await listAdjustments(id));
  }, [id]);

  useEffect(() => {
    void reloadAdjustments();
  }, [reloadAdjustments]);

  const myPrintLogs = useMemo(
    () => printLogs.filter((log) => log.filamentId === id),
    [printLogs, id],
  );
  const myDryLogs = useMemo(() => dryLogs.filter((log) => log.filamentId === id), [dryLogs, id]);
  const mySettings = useMemo(
    () => printSettings.find((item) => item.filamentId === id) ?? null,
    [printSettings, id],
  );

  if (!filament) {
    return (
      <Screen>
        <EmptyState
          icon="help-circle-outline"
          title="フィラメントが見つかりません"
          description="削除されたか、リンクが正しくない可能性があります"
        />
      </Screen>
    );
  }

  const barColor = remainingColor(
    filament,
    theme.colors.success,
    theme.colors.warning,
    theme.colors.danger,
  );

  const handleDelete = () => {
    Alert.alert(
      '削除しますか？',
      'このフィラメントを一覧から削除します。過去の印刷ログとコスト集計は残ります。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await softDeleteFilament(filament.id);
              await refresh();
              router.back();
            })();
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <Stack.Screen
        options={{ title: `${filament.manufacturer} ${filament.colorName}` }}
      />

      {/* 概要 */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3) }}>
          <ColorChip hex={filament.colorHex} size={48} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: theme.colors.text, fontSize: 17, fontWeight: '800' }}>
              {filament.manufacturer} {filament.colorName}
            </Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>
              {filament.productName ?? '—'} ・ {filament.diameter}mm
            </Text>
          </View>
          <MaterialBadge
            label={materialLabel(filament.material)}
            color={MATERIAL_COLORS[filament.material]}
          />
        </View>

        <View style={{ gap: theme.spacing(1.5), marginTop: theme.spacing(2) }}>
          <ProgressBar percent={filament.remainingPercent} color={barColor} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '700' }}>
              {grams(filament.currentWeightG)} / {grams(filament.initialWeightG)}
            </Text>
            <Text style={{ color: barColor, fontSize: 14, fontWeight: '800' }}>
              {percent(filament.remainingPercent)}
            </Text>
          </View>
        </View>

        <StatusBadges filament={filament} />
      </Card>

      {/* 残量の更新 */}
      <SectionHeader title="残量を更新" />
      <WeightUpdateCard
        filamentId={filament.id}
        currentWeightG={filament.currentWeightG}
        spoolWeightG={filament.spoolWeightG}
        onUpdated={async () => {
          await refresh();
          await reloadAdjustments();
        }}
      />

      {/* 基本情報 */}
      <SectionHeader title="基本情報" />
      <Card>
        <InfoRow label="ステータス" value={STATUS_LABELS[filament.status]} />
        <InfoRow label="1gあたり単価" value={unitPrice(filament.unitPriceYen)} />
        <InfoRow label="購入価格" value={yen(filament.priceYen)} />
        <InfoRow label="残量の資産価値" value={yen(filament.remainingValueYen)} />
        <InfoRow label="スプール自重" value={grams(filament.spoolWeightG)} />
        <Divider />
        <InfoRow label="購入日" value={formatDate(filament.purchasedAt)} />
        <InfoRow label="購入先" value={filament.purchasedFrom ?? '—'} />
        <InfoRow label="開封日" value={formatDate(filament.openedAt)} />
        <InfoRow label="保管場所" value={filament.storageLocationName ?? '未設定'} />
        {filament.note ? (
          <>
            <Divider />
            <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>メモ</Text>
            <Text style={{ color: theme.colors.text, fontSize: 14 }}>{filament.note}</Text>
          </>
        ) : null}
      </Card>

      {/* ステータスと保管場所の変更 */}
      <Card>
        <Field label="ステータスを変更">
          <ChipSelect
            options={STATUS_OPTIONS}
            value={filament.status}
            onChange={(next) => {
              void (async () => {
                await setFilamentStatus(filament.id, next);
                await refresh();
              })();
            }}
          />
        </Field>
        {filament.status === 'unopened' ? (
          <Button
            title="今日開封した"
            variant="secondary"
            icon="cube-outline"
            onPress={() => {
              void (async () => {
                await markOpened(filament.id, todayISO());
                await refresh();
              })();
            }}
          />
        ) : null}
        <Field label="保管場所を変更">
          {storageLocations.length === 0 ? (
            <TextButton
              title="保管場所を登録する"
              icon="add"
              onPress={() => router.push('/storage-locations')}
            />
          ) : (
            <ChipSelect<number | null>
              options={[
                { value: null, label: '未設定' },
                ...storageLocations.map((location) => ({
                  value: location.id,
                  label: location.name,
                })),
              ]}
              value={filament.storageLocationId}
              onChange={(next) => {
                void (async () => {
                  await setStorageLocation(filament.id, next);
                  await refresh();
                })();
              }}
            />
          )}
        </Field>
      </Card>

      {/* 乾燥 */}
      <SectionHeader title="乾燥" />
      <Card>
        <InfoRow label="最終乾燥日" value={formatDate(filament.lastDriedAt)} />
        <InfoRow label="判定の基準日" value={formatDate(filament.dryBaseDate)} />
        <InfoRow
          label="再乾燥の目安"
          value={dryDueLabel(filament.dryDueInDays, filament.status)}
          valueColor={filament.needsDrying ? theme.colors.warning : undefined}
        />
      </Card>
      <DryLogCard
        filamentId={filament.id}
        onSaved={async () => {
          await refresh();
        }}
      />

      {myDryLogs.length > 0 ? (
        <Card>
          {myDryLogs.map((log, index) => (
            <View key={log.id}>
              {index > 0 ? <Divider /> : null}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: theme.spacing(2),
                  gap: theme.spacing(2),
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '600' }}>
                    {formatDate(log.driedAt)}
                  </Text>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                    {log.temperatureC !== null ? `${log.temperatureC}℃` : '—'} ・{' '}
                    {duration(log.durationMin)}
                    {log.note ? ` ・ ${log.note}` : ''}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="乾燥ログを削除"
                  hitSlop={8}
                  onPress={() => {
                    void (async () => {
                      await deleteDryLog(log.id);
                      await refresh();
                    })();
                  }}
                >
                  <Ionicons name="trash-outline" size={18} color={theme.colors.textMuted} />
                </Pressable>
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      {/* 印刷設定メモ（F-11） */}
      <SectionHeader title="印刷設定メモ" />
      <PrintSettingsCard
        filamentId={filament.id}
        initial={mySettings}
        onSaved={async () => {
          await refresh();
        }}
      />

      {/* 印刷履歴 */}
      <SectionHeader title={`印刷履歴（${myPrintLogs.length}件）`} />
      <Card>
        {myPrintLogs.length === 0 ? (
          <EmptyState icon="print-outline" title="まだ印刷ログがありません" />
        ) : (
          myPrintLogs.slice(0, 20).map((log, index) => (
            <View key={log.id}>
              {index > 0 ? <Divider /> : null}
              <View style={{ paddingVertical: theme.spacing(2), gap: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) }}>
                  <Text
                    style={{ color: theme.colors.text, fontSize: 14, fontWeight: '600', flex: 1 }}
                    numberOfLines={1}
                  >
                    {log.modelName ?? '（名称なし）'}
                  </Text>
                  <Badge
                    label={log.result === 'success' ? '成功' : log.result === 'failed' ? '失敗' : '途中中止'}
                    tone={log.result === 'success' ? 'success' : 'danger'}
                  />
                </View>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                  {formatDateTime(log.printedAt)} ・ {grams(log.usedWeightG)} ・ {yen(log.costYen)}
                  {log.durationMin !== null ? ` ・ ${duration(log.durationMin)}` : ''}
                </Text>
              </View>
            </View>
          ))
        )}
      </Card>

      {/* 残量の更新履歴 */}
      <SectionHeader title="残量の更新履歴" />
      <Card>
        {adjustments.length === 0 ? (
          <EmptyState icon="time-outline" title="まだ更新履歴がありません" />
        ) : (
          adjustments.slice(0, 20).map((item, index) => (
            <View key={item.id}>
              {index > 0 ? <Divider /> : null}
              <View style={{ paddingVertical: theme.spacing(2), gap: 2 }}>
                <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '600' }}>
                  {item.method === 'measure'
                    ? `実測 ${grams(item.valueG)} → 残量 ${grams(item.resultingWeightG)}`
                    : `${item.valueG >= 0 ? '−' : '+'}${grams(Math.abs(item.valueG))} → 残量 ${grams(item.resultingWeightG)}`}
                </Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                  {formatDateTime(item.adjustedAt)}
                  {item.note ? ` ・ ${item.note}` : ''}
                </Text>
              </View>
            </View>
          ))
        )}
      </Card>

      {/* 操作 */}
      <SectionHeader title="操作" />
      <View style={{ gap: theme.spacing(2) }}>
        <Button
          title="このフィラメントで印刷を記録"
          icon="print"
          onPress={() =>
            router.push({ pathname: '/print-log/new', params: { filamentId: filament.id } })
          }
        />
        <Button
          title="編集する"
          variant="secondary"
          icon="create-outline"
          onPress={() => router.push({ pathname: '/filament/edit', params: { id: filament.id } })}
        />
        <Button
          title="同じ製品をもう1本登録"
          variant="secondary"
          icon="copy-outline"
          onPress={() =>
            router.push({ pathname: '/filament/edit', params: { copyFrom: filament.id } })
          }
        />
        <Button title="削除する" variant="danger" icon="trash-outline" onPress={handleDelete} />
      </View>
    </Screen>
  );
}

/* ------------------------------------------------------------------ *
 * 残量の更新（要件定義書 4.4）
 * ------------------------------------------------------------------ */

function WeightUpdateCard({
  filamentId,
  currentWeightG,
  spoolWeightG,
  onUpdated,
}: {
  filamentId: number;
  currentWeightG: number;
  spoolWeightG: number;
  onUpdated: () => Promise<void>;
}) {
  const theme = useTheme();
  const [method, setMethod] = useState<AdjustMethod>('subtract');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const parsed = parseNumberInput(value);
  const preview =
    parsed === null
      ? null
      : method === 'subtract'
        ? Math.max(0, currentWeightG - parsed)
        : Math.max(0, parsed - spoolWeightG);

  const handleSave = () => {
    if (parsed === null) return;
    setSaving(true);
    void (async () => {
      try {
        const update = await adjustWeight({ filamentId, method, valueG: parsed });
        setValue('');
        await onUpdated();

        if (update.clamped) {
          Alert.alert('残量を0gにしました', '入力値が残量を上回っていたため、0gでとめています。');
        }
        if (update.depleted) {
          Alert.alert('残量が0になりました', 'このフィラメントを「使用済み」にしますか？', [
            { text: 'そのまま', style: 'cancel' },
            {
              text: '使用済みにする',
              onPress: () => {
                void (async () => {
                  await setFilamentStatus(filamentId, 'used_up');
                  await onUpdated();
                })();
              },
            },
          ]);
        }
      } catch (cause) {
        Alert.alert(
          '更新できませんでした',
          cause instanceof Error ? cause.message : '不明なエラーが発生しました',
        );
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <Card>
      <SegmentedControl
        options={[
          { value: 'subtract' as const, label: '使用量を引く' },
          { value: 'measure' as const, label: '実測総重量' },
        ]}
        value={method}
        onChange={setMethod}
      />
      <Field
        label={method === 'subtract' ? '使用量' : 'スプール込みの総重量'}
        hint={
          method === 'subtract'
            ? '現在の残量から引きます'
            : `スプール自重 ${grams(spoolWeightG)} を引いた値が残量になります`
        }
      >
        <NumberField value={value} onChangeText={setValue} suffix="g" placeholder="0" />
      </Field>
      {preview !== null ? (
        <InfoRow
          label="更新後の残量"
          value={grams(preview)}
          valueColor={preview <= 0 ? theme.colors.danger : undefined}
        />
      ) : null}
      <Button
        title="残量を更新する"
        icon="refresh"
        onPress={handleSave}
        disabled={parsed === null}
        loading={saving}
      />
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * 乾燥ログ（要件定義書 4.8）
 * ------------------------------------------------------------------ */

function DryLogCard({
  filamentId,
  onSaved,
}: {
  filamentId: number;
  onSaved: () => Promise<void>;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [driedAt, setDriedAt] = useState(() => todayISO());
  const [temperature, setTemperature] = useState('');
  const [minutes, setMinutes] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const dateError = isValidDateString(driedAt) ? null : '日付の形式が正しくありません';

  if (!open) {
    return (
      <Button
        title="乾燥を記録する"
        variant="secondary"
        icon="water-outline"
        onPress={() => setOpen(true)}
      />
    );
  }

  const handleSave = () => {
    if (dateError) return;
    setSaving(true);
    void (async () => {
      try {
        await createDryLog({
          filamentId,
          driedAt,
          temperatureC: parseNumberInput(temperature),
          durationMin: parseNumberInput(minutes),
          note,
        });
        setTemperature('');
        setMinutes('');
        setNote('');
        setDriedAt(todayISO());
        setOpen(false);
        await onSaved();
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <Card>
      <Field label="実施日" required error={dateError}>
        <DateField value={driedAt} onChange={setDriedAt} clearable={false} invalid={!!dateError} />
      </Field>
      <View style={{ flexDirection: 'row', gap: theme.spacing(2) }}>
        <Field label="温度" style={{ flex: 1 }}>
          <NumberField value={temperature} onChangeText={setTemperature} suffix="℃" placeholder="55" />
        </Field>
        <Field label="時間" style={{ flex: 1 }}>
          <NumberField
            value={minutes}
            onChangeText={setMinutes}
            suffix="分"
            placeholder="360"
            allowDecimal={false}
          />
        </Field>
      </View>
      <Field label="メモ">
        <TextField value={note} onChangeText={setNote} />
      </Field>
      <Button title="記録する" icon="checkmark" onPress={handleSave} loading={saving} />
      <Button title="キャンセル" variant="ghost" onPress={() => setOpen(false)} />
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * 印刷設定メモ（F-11）
 * ------------------------------------------------------------------ */

function PrintSettingsCard({
  filamentId,
  initial,
  onSaved,
}: {
  filamentId: number;
  initial: { nozzleTempC: number | null; bedTempC: number | null; speedMms: number | null; fanPercent: number | null; note: string | null } | null;
  onSaved: () => Promise<void>;
}) {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [nozzle, setNozzle] = useState(numberToInput(initial?.nozzleTempC));
  const [bed, setBed] = useState(numberToInput(initial?.bedTempC));
  const [speed, setSpeed] = useState(numberToInput(initial?.speedMms));
  const [fan, setFan] = useState(numberToInput(initial?.fanPercent));
  const [note, setNote] = useState(initial?.note ?? '');
  const [saving, setSaving] = useState(false);

  // 保存後や別のフィラメントを開いたときに、表示中の値を DB の内容へ合わせる
  useEffect(() => {
    if (editing) return;
    setNozzle(numberToInput(initial?.nozzleTempC));
    setBed(numberToInput(initial?.bedTempC));
    setSpeed(numberToInput(initial?.speedMms));
    setFan(numberToInput(initial?.fanPercent));
    setNote(initial?.note ?? '');
  }, [initial, editing]);

  const handleSave = () => {
    setSaving(true);
    void (async () => {
      try {
        await upsertPrintSettings({
          filamentId,
          nozzleTempC: parseNumberInput(nozzle),
          bedTempC: parseNumberInput(bed),
          speedMms: parseNumberInput(speed),
          fanPercent: parseNumberInput(fan),
          note,
        });
        setEditing(false);
        await onSaved();
      } finally {
        setSaving(false);
      }
    })();
  };

  if (!editing) {
    const empty =
      !initial ||
      (initial.nozzleTempC === null &&
        initial.bedTempC === null &&
        initial.speedMms === null &&
        initial.fanPercent === null &&
        !initial.note);

    return (
      <Card>
        {empty ? (
          <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>
            このフィラメント用の設定はまだ登録されていません
          </Text>
        ) : (
          <>
            <InfoRow
              label="ノズル温度"
              value={initial.nozzleTempC !== null ? `${initial.nozzleTempC}℃` : '—'}
            />
            <InfoRow
              label="ベッド温度"
              value={initial.bedTempC !== null ? `${initial.bedTempC}℃` : '—'}
            />
            <InfoRow
              label="速度"
              value={initial.speedMms !== null ? `${initial.speedMms}mm/s` : '—'}
            />
            <InfoRow
              label="ファン"
              value={initial.fanPercent !== null ? `${initial.fanPercent}%` : '—'}
            />
            {initial.note ? <InfoRow label="メモ" value={initial.note} /> : null}
          </>
        )}
        <TextButton title="編集する" icon="create-outline" onPress={() => setEditing(true)} />
      </Card>
    );
  }

  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: theme.spacing(2) }}>
        <Field label="ノズル温度" style={{ flex: 1 }}>
          <NumberField value={nozzle} onChangeText={setNozzle} suffix="℃" placeholder="220" />
        </Field>
        <Field label="ベッド温度" style={{ flex: 1 }}>
          <NumberField value={bed} onChangeText={setBed} suffix="℃" placeholder="60" />
        </Field>
      </View>
      <View style={{ flexDirection: 'row', gap: theme.spacing(2) }}>
        <Field label="速度" style={{ flex: 1 }}>
          <NumberField value={speed} onChangeText={setSpeed} suffix="mm/s" placeholder="200" />
        </Field>
        <Field label="ファン" style={{ flex: 1 }}>
          <NumberField value={fan} onChangeText={setFan} suffix="%" placeholder="100" />
        </Field>
      </View>
      <Field label="メモ">
        <TextField value={note} onChangeText={setNote} multiline />
      </Field>
      <Button title="保存する" icon="checkmark" onPress={handleSave} loading={saving} />
      <Button title="キャンセル" variant="ghost" onPress={() => setEditing(false)} />
    </Card>
  );
}

function numberToInput(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function dryDueLabel(dueInDays: number | null, status: FilamentStatus): string {
  if (status === 'unopened') return '未開封のため判定対象外';
  if (dueInDays === null) return '開封日または乾燥ログが必要です';
  if (dueInDays < 0) return `${Math.abs(dueInDays)}日超過`;
  return `あと${dueInDays}日`;
}
