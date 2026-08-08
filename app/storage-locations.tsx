import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import {
  createStorageLocation,
  deleteStorageLocation,
  recordDesiccantReplacement,
  updateStorageLocation,
} from '@/db/repo/storageLocations';
import { evaluateDesiccant, isValidDateString } from '@/domain/calc';
import { STORAGE_TYPE_LABELS } from '@/domain/materials';
import type { StorageLocation, StorageType } from '@/domain/types';
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
  Screen,
  SectionHeader,
  TextButton,
} from '@/ui/components';
import { ChipSelect, DateField, Field, NumberField, TextField } from '@/ui/form';
import { formatDate, todayISO } from '@/utils/date';
import { grams, parseNumberInput } from '@/utils/format';

const TYPE_OPTIONS = (Object.keys(STORAGE_TYPE_LABELS) as StorageType[]).map((value) => ({
  value,
  label: STORAGE_TYPE_LABELS[value],
}));

const DEFAULT_INTERVAL_DAYS = 60;

/** S-07 保管場所管理（要件定義書 4.7） */
export default function StorageLocationsScreen() {
  const theme = useTheme();
  const { storageLocations, views, today, refresh } = useApp();
  const [editing, setEditing] = useState<StorageLocation | 'new' | null>(null);

  const filamentsByLocation = useMemo(() => {
    const map = new Map<number, typeof views>();
    for (const view of views) {
      if (view.storageLocationId === null || view.status === 'used_up') continue;
      const list = map.get(view.storageLocationId) ?? [];
      list.push(view);
      map.set(view.storageLocationId, list);
    }
    return map;
  }, [views]);

  const handleDelete = (location: StorageLocation) => {
    const count = filamentsByLocation.get(location.id)?.length ?? 0;
    Alert.alert(
      `「${location.name}」を削除しますか？`,
      count > 0
        ? `ここに置いている ${count}本のフィラメントは「保管場所なし」になります。`
        : 'この操作は元に戻せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await deleteStorageLocation(location.id);
              await refresh();
            })();
          },
        },
      ],
    );
  };

  return (
    <Screen>
      {editing !== null ? (
        <LocationForm
          initial={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      ) : (
        <Button title="保管場所を追加" icon="add" onPress={() => setEditing('new')} />
      )}

      {storageLocations.length === 0 ? (
        <EmptyState
          icon="cube-outline"
          title="保管場所が未登録です"
          description="防湿ボックスや乾燥機を登録すると、乾燥剤の交換時期を管理できます"
        />
      ) : (
        storageLocations.map((location) => {
          const status = evaluateDesiccant(location, today);
          const stored = filamentsByLocation.get(location.id) ?? [];
          return (
            <Card key={location.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) }}>
                <Ionicons name="cube-outline" size={20} color={theme.colors.textMuted} />
                <Text
                  style={{ color: theme.colors.text, fontSize: 16, fontWeight: '700', flex: 1 }}
                  numberOfLines={1}
                >
                  {location.name}
                </Text>
                <Badge label={STORAGE_TYPE_LABELS[location.type]} tone="neutral" />
                {status.overdue ? <Badge label="交換期限超過" tone="danger" icon="alert-circle-outline" /> : null}
              </View>

              <Divider />
              <InfoRow label="乾燥剤の最終交換日" value={formatDate(location.desiccantReplacedAt)} />
              <InfoRow label="交換間隔" value={`${location.replaceIntervalDays}日`} />
              <InfoRow
                label="次回交換まで"
                value={
                  status.dueInDays === null
                    ? '最終交換日が未設定です'
                    : status.dueInDays < 0
                      ? `${Math.abs(status.dueInDays)}日超過`
                      : `あと${status.dueInDays}日`
                }
                valueColor={status.overdue ? theme.colors.danger : undefined}
              />

              <View
                style={{
                  flexDirection: 'row',
                  gap: theme.spacing(4),
                  marginTop: theme.spacing(1),
                }}
              >
                <TextButton
                  title="今日交換した"
                  icon="refresh"
                  onPress={() => {
                    void (async () => {
                      await recordDesiccantReplacement(location.id, todayISO());
                      await refresh();
                    })();
                  }}
                />
                <TextButton
                  title="編集"
                  icon="create-outline"
                  onPress={() => setEditing(location)}
                />
                <TextButton
                  title="削除"
                  icon="trash-outline"
                  color={theme.colors.danger}
                  onPress={() => handleDelete(location)}
                />
              </View>

              {stored.length > 0 ? (
                <>
                  <Divider />
                  <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                    ここにあるフィラメント（{stored.length}本）
                  </Text>
                  {stored.map((view) => (
                    <View
                      key={view.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: theme.spacing(2),
                        paddingVertical: 3,
                      }}
                    >
                      <ColorChip hex={view.colorHex} size={14} />
                      <Text
                        style={{ color: theme.colors.text, fontSize: 13, flex: 1 }}
                        numberOfLines={1}
                      >
                        {view.manufacturer} {view.colorName}
                      </Text>
                      <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                        {grams(view.currentWeightG)}
                      </Text>
                    </View>
                  ))}
                </>
              ) : null}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

function LocationForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: StorageLocation | null;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<StorageType>(initial?.type ?? 'dry_box');
  const [replacedAt, setReplacedAt] = useState(initial?.desiccantReplacedAt ?? '');
  const [interval, setInterval] = useState(
    String(initial?.replaceIntervalDays ?? DEFAULT_INTERVAL_DAYS),
  );
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const intervalValue = parseNumberInput(interval);
  const errors = {
    name: name.trim() === '' ? '名称を入力してください' : null,
    interval: intervalValue === null || intervalValue <= 0 ? '1以上の日数を入力してください' : null,
    replacedAt:
      replacedAt !== '' && !isValidDateString(replacedAt) ? '日付の形式が正しくありません' : null,
  };
  const hasError = Object.values(errors).some((value) => value !== null);

  const handleSave = () => {
    if (hasError || intervalValue === null) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    void (async () => {
      try {
        const payload = {
          name,
          type,
          desiccantReplacedAt: replacedAt || null,
          replaceIntervalDays: Math.round(intervalValue),
        };
        if (initial) {
          await updateStorageLocation(initial.id, payload);
        } else {
          await createStorageLocation(payload);
        }
        await onSaved();
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <Card>
      <SectionHeader title={initial ? '保管場所を編集' : '保管場所を追加'} />
      <Field label="名称" required error={showErrors ? errors.name : null}>
        <TextField
          value={name}
          onChangeText={setName}
          placeholder="例：防湿ボックス（棚上）"
          invalid={showErrors && errors.name !== null}
        />
      </Field>
      <Field label="種別" required>
        <ChipSelect options={TYPE_OPTIONS} value={type} onChange={setType} />
      </Field>
      <Field label="乾燥剤の最終交換日" error={showErrors ? errors.replacedAt : null}>
        <DateField
          value={replacedAt}
          onChange={setReplacedAt}
          invalid={showErrors && errors.replacedAt !== null}
        />
      </Field>
      <Field
        label="交換間隔"
        required
        error={showErrors ? errors.interval : null}
        hint="この日数を超えるとアラートの対象になります"
      >
        <NumberField
          value={interval}
          onChangeText={setInterval}
          suffix="日"
          allowDecimal={false}
          invalid={showErrors && errors.interval !== null}
        />
      </Field>
      <Button title="保存する" icon="checkmark" onPress={handleSave} loading={saving} />
      <Button title="キャンセル" variant="ghost" onPress={onCancel} />
    </Card>
  );
}
