import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { MATERIALS, MATERIAL_LABELS } from '@/domain/materials';
import type { FilamentView, Material } from '@/domain/types';
import { useApp } from '@/state/AppProvider';
import { useTheme } from '@/state/useTheme';
import { EmptyState } from '@/ui/components';
import { FilamentCard } from '@/ui/FilamentCard';
import { ChipSelect, Field } from '@/ui/form';

type StatusFilter = 'active' | 'in_use' | 'unopened' | 'used_up' | 'all';
type SortKey = 'remaining' | 'purchased' | 'opened';

const STATUS_OPTIONS = [
  { value: 'active' as const, label: '使用中・未開封' },
  { value: 'in_use' as const, label: '使用中' },
  { value: 'unopened' as const, label: '未開封' },
  { value: 'used_up' as const, label: '使用済み' },
  { value: 'all' as const, label: 'すべて' },
];

const SORT_OPTIONS = [
  { value: 'remaining' as const, label: '残量が少ない順' },
  { value: 'purchased' as const, label: '購入日順' },
  { value: 'opened' as const, label: '開封日が古い順' },
];

/** S-02 フィラメント一覧（要件定義書 4.3） */
export default function FilamentsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { views, storageLocations } = useApp();

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [material, setMaterial] = useState<Material | 'ALL'>('ALL');
  const [locationId, setLocationId] = useState<number | 'ALL' | 'NONE'>('ALL');
  const [sort, setSort] = useState<SortKey>('remaining');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    const result = views.filter((view) => {
      if (!matchesStatus(view, status)) return false;
      if (material !== 'ALL' && view.material !== material) return false;
      if (locationId === 'NONE' && view.storageLocationId !== null) return false;
      if (typeof locationId === 'number' && view.storageLocationId !== locationId) return false;
      if (keyword !== '') {
        const haystack = [view.manufacturer, view.colorName, view.productName ?? '']
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      return true;
    });

    return result.sort(comparators[sort]);
  }, [views, query, status, material, locationId, sort]);

  const materialOptions = useMemo(
    () => [
      { value: 'ALL' as const, label: 'すべて' },
      ...MATERIALS.map((item) => ({ value: item, label: MATERIAL_LABELS[item] })),
    ],
    [],
  );

  const locationOptions = useMemo(
    () => [
      { value: 'ALL' as const, label: 'すべて' },
      ...storageLocations.map((location) => ({ value: location.id, label: location.name })),
      { value: 'NONE' as const, label: '未設定' },
    ],
    [storageLocations],
  );

  const activeFilterCount =
    (status === 'active' ? 0 : 1) + (material === 'ALL' ? 0 : 1) + (locationId === 'ALL' ? 0 : 1);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{
          padding: theme.spacing(4),
          paddingBottom: theme.spacing(24),
          gap: theme.spacing(3),
        }}
        keyboardShouldPersistTaps="handled"
        // 100件でも一覧描画が引っかからないよう、画面外の描画を抑える
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        removeClippedSubviews
        ListHeaderComponent={
          <View style={{ gap: theme.spacing(3), marginBottom: theme.spacing(1) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) }}>
              <View
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing(2),
                  backgroundColor: theme.colors.surface,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.md,
                  paddingHorizontal: theme.spacing(3),
                }}
              >
                <Ionicons name="search" size={16} color={theme.colors.textMuted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="メーカー・色名・製品名で検索"
                  placeholderTextColor={theme.colors.textMuted}
                  style={{
                    flex: 1,
                    paddingVertical: theme.spacing(3),
                    color: theme.colors.text,
                    fontSize: 15,
                  }}
                />
                {query !== '' ? (
                  <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityRole="button">
                    <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>

              <Pressable
                onPress={() => setFiltersOpen((open) => !open)}
                accessibilityRole="button"
                accessibilityLabel="絞り込み"
                style={{
                  padding: theme.spacing(3),
                  borderRadius: theme.radius.md,
                  backgroundColor:
                    activeFilterCount > 0 ? theme.colors.primary : theme.colors.surface,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: activeFilterCount > 0 ? theme.colors.primary : theme.colors.border,
                }}
              >
                <Ionicons
                  name="options-outline"
                  size={18}
                  color={activeFilterCount > 0 ? theme.colors.onPrimary : theme.colors.text}
                />
              </Pressable>
            </View>

            {filtersOpen ? (
              <View
                style={{
                  gap: theme.spacing(3),
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.radius.lg,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: theme.colors.border,
                  padding: theme.spacing(3.5),
                }}
              >
                <Field label="ステータス">
                  <ChipSelect options={STATUS_OPTIONS} value={status} onChange={setStatus} />
                </Field>
                <Field label="素材">
                  <ChipSelect options={materialOptions} value={material} onChange={setMaterial} />
                </Field>
                <Field label="保管場所">
                  <ChipSelect
                    options={locationOptions}
                    value={locationId}
                    onChange={setLocationId}
                  />
                </Field>
                <Field label="並び順">
                  <ChipSelect options={SORT_OPTIONS} value={sort} onChange={setSort} />
                </Field>
              </View>
            ) : null}

            <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
              {filtered.length}本
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <FilamentCard
            filament={item}
            onPress={() => router.push({ pathname: '/filament/[id]', params: { id: item.id } })}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="albums-outline"
            title={views.length === 0 ? 'フィラメントが未登録です' : '条件に合うものがありません'}
            description={
              views.length === 0
                ? '右下の＋、またはホームの「フィラメントを追加する」から登録できます'
                : '検索条件や絞り込みを変えてみてください'
            }
          />
        }
      />
    </View>
  );
}

function matchesStatus(view: FilamentView, filter: StatusFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    // 既定表示。使い切ったものは一覧から外す（要件定義書 4.2）
    case 'active':
      return view.status !== 'used_up';
    default:
      return view.status === filter;
  }
}

const comparators: Record<SortKey, (a: FilamentView, b: FilamentView) => number> = {
  remaining: (a, b) => a.currentWeightG - b.currentWeightG,
  // 新しく買ったものを上に。日付未設定は末尾へ
  purchased: (a, b) => compareDatesDesc(a.purchasedAt, b.purchasedAt),
  // 開封から時間が経ったものを上に。未開封は末尾へ
  opened: (a, b) => compareDatesAsc(a.openedAt, b.openedAt),
};

function compareDatesDesc(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? 1 : -1;
}

function compareDatesAsc(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}
