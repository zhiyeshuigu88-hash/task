import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { setFilamentStatus } from '@/db/repo/filaments';
import { createPrintLog } from '@/db/repo/printLogs';
import { materialCostYen } from '@/domain/calc';
import { RESULT_LABELS } from '@/domain/materials';
import type { PrintResult } from '@/domain/types';
import { useApp } from '@/state/AppProvider';
import { useTheme } from '@/state/useTheme';
import { Button, Card, EmptyState, InfoRow, Screen } from '@/ui/components';
import { ChipSelect, DateTimeField, Field, NumberField, TextField } from '@/ui/form';
import { nowISO } from '@/utils/date';
import { grams, parseNumberInput, yen } from '@/utils/format';

const RESULT_OPTIONS = (Object.keys(RESULT_LABELS) as PrintResult[]).map((value) => ({
  value,
  label: RESULT_LABELS[value],
}));

/**
 * S-05 印刷ログ登録（要件定義書 4.5）。
 *
 * 「ホームから3タップ + 数値入力で完了すること」という非機能要件に合わせ、
 * フィラメント・結果・日時はすべて既定値が入った状態で開き、必須入力は使用量だけにしている。
 */
export default function NewPrintLogScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { views, refresh } = useApp();
  const params = useLocalSearchParams<{ filamentId?: string }>();

  // 使い切ったものは選択肢から外す
  const selectable = useMemo(() => views.filter((view) => view.status !== 'used_up'), [views]);

  const initialId = useMemo(() => {
    const fromParams = Number(params.filamentId);
    if (Number.isFinite(fromParams) && selectable.some((view) => view.id === fromParams)) {
      return fromParams;
    }
    // 直近に使ったものが上に来るよう、残量の減っているものを既定にする
    return selectable[0]?.id ?? null;
  }, [params.filamentId, selectable]);

  const [filamentId, setFilamentId] = useState<number | null>(initialId);
  const [usedWeight, setUsedWeight] = useState('');
  const [modelName, setModelName] = useState('');
  const [printedAt, setPrintedAt] = useState(() => nowISO());
  const [durationMin, setDurationMin] = useState('');
  const [result, setResult] = useState<PrintResult>('success');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const selected = selectable.find((view) => view.id === filamentId) ?? null;
  const usedWeightValue = parseNumberInput(usedWeight);

  const usedWeightError =
    usedWeightValue === null
      ? '使用量を入力してください'
      : usedWeightValue <= 0
        ? '0より大きい値を入力してください'
        : null;
  const filamentError = filamentId === null ? 'フィラメントを選んでください' : null;

  const estimatedCost =
    selected && usedWeightValue !== null && usedWeightValue > 0
      ? materialCostYen(usedWeightValue, selected.unitPriceYen)
      : 0;
  const remainingAfter =
    selected && usedWeightValue !== null
      ? Math.max(0, selected.currentWeightG - usedWeightValue)
      : selected?.currentWeightG ?? 0;

  if (selectable.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="albums-outline"
          title="使用できるフィラメントがありません"
          description="先にフィラメントを登録してください"
        />
        <Button
          title="フィラメントを追加する"
          icon="add-circle-outline"
          onPress={() => router.replace('/filament/edit')}
        />
      </Screen>
    );
  }

  const handleSubmit = () => {
    if (filamentError || usedWeightError || filamentId === null || usedWeightValue === null) {
      setShowErrors(true);
      return;
    }

    setSubmitting(true);
    void (async () => {
      try {
        const created = await createPrintLog({
          filamentId,
          usedWeightG: usedWeightValue,
          modelName,
          printedAt,
          durationMin: parseNumberInput(durationMin),
          result,
          note,
        });
        await refresh();

        if (created.clamped) {
          Alert.alert(
            '残量が不足していました',
            '入力した使用量が残量を上回っていたため、残量を0gにしました。実測での更新をおすすめします。',
          );
        }

        // 残量0なら「使用済み」への変更を提案する（要件定義書 4.4 共通仕様）
        if (created.depleted) {
          Alert.alert('残量が0になりました', 'このフィラメントを「使用済み」にしますか？', [
            { text: 'そのまま', style: 'cancel', onPress: () => router.back() },
            {
              text: '使用済みにする',
              onPress: () => {
                void (async () => {
                  await setFilamentStatus(filamentId, 'used_up');
                  await refresh();
                  router.back();
                })();
              },
            },
          ]);
          return;
        }

        router.back();
      } catch (cause) {
        Alert.alert(
          '保存できませんでした',
          cause instanceof Error ? cause.message : '不明なエラーが発生しました',
        );
      } finally {
        setSubmitting(false);
      }
    })();
  };

  return (
    <Screen>
      <Field label="使用フィラメント" required error={showErrors ? filamentError : null}>
        <ChipSelect<number | null>
          options={selectable.map((view) => ({
            value: view.id,
            label: `${view.manufacturer} ${view.colorName}`,
          }))}
          value={filamentId}
          onChange={setFilamentId}
        />
      </Field>

      <Field
        label="使用量"
        required
        error={showErrors ? usedWeightError : null}
        hint="スライサーの予測使用量をそのまま入力できます"
      >
        <NumberField
          value={usedWeight}
          onChangeText={setUsedWeight}
          placeholder="0"
          suffix="g"
          invalid={showErrors && usedWeightError !== null}
        />
      </Field>

      {selected?.status === 'unopened' ? (
        <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: -theme.spacing(1) }}>
          未開封のフィラメントです。記録すると「使用中」になり、開封日に印刷日が入ります
        </Text>
      ) : null}

      {selected ? (
        <Card>
          <InfoRow label="1gあたり単価" value={`¥${selected.unitPriceYen.toFixed(2)}/g`} />
          <InfoRow label="材料費（自動計算）" value={yen(estimatedCost)} />
          <InfoRow
            label="登録後の残量"
            value={`${grams(remainingAfter)}（現在 ${grams(selected.currentWeightG)}）`}
            valueColor={remainingAfter <= 0 ? theme.colors.danger : undefined}
          />
        </Card>
      ) : null}

      <Field label="結果" required>
        <ChipSelect options={RESULT_OPTIONS} value={result} onChange={setResult} />
      </Field>
      {result !== 'success' ? (
        <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: -theme.spacing(1) }}>
          失敗・途中中止でも残量とコストに計上されます（ロスを可視化するため）
        </Text>
      ) : null}

      <Field label="モデル名 / 案件名">
        <TextField value={modelName} onChangeText={setModelName} placeholder="例：ケーブルホルダー" />
      </Field>

      <Field label="印刷日時" required>
        <DateTimeField value={printedAt} onChange={setPrintedAt} />
      </Field>

      <Field label="印刷時間">
        <NumberField
          value={durationMin}
          onChangeText={setDurationMin}
          placeholder="0"
          suffix="分"
          allowDecimal={false}
        />
      </Field>

      <Field label="メモ">
        <TextField value={note} onChangeText={setNote} multiline placeholder="気づいたことなど" />
      </Field>

      <View style={{ gap: theme.spacing(2), marginTop: theme.spacing(2) }}>
        <Button title="記録する" icon="checkmark" onPress={handleSubmit} loading={submitting} />
        <Button title="キャンセル" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
