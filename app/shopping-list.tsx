import React, { useMemo } from 'react';
import { Linking, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { MATERIAL_COLORS, materialLabel } from '@/domain/materials';
import type { FilamentView } from '@/domain/types';
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
  Screen,
} from '@/ui/components';
import { formatDate } from '@/utils/date';
import { grams, yen } from '@/utils/format';

type Candidate = {
  key: string;
  latest: FilamentView;
  reason: '残りわずか' | '使用済み';
  count: number;
};

/**
 * F-10 買い直しリスト。
 * 残量アラート対象と使用済みフィラメントから購入候補を自動生成する。
 * 購入先が URL なら、そのまま開いてリピート購入できるようにする。
 */
export default function ShoppingListScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { views } = useApp();

  const candidates = useMemo(() => buildCandidates(views), [views]);

  if (candidates.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="cart-outline"
          title="買い直す候補はありません"
          description="残りわずか・使用済みのフィラメントがここに並びます"
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>
        残りわずか・使用済みのフィラメントから候補を作っています（{candidates.length}件）
      </Text>

      {candidates.map((candidate) => {
        const filament = candidate.latest;
        const url = toUrl(filament.purchasedFrom);
        return (
          <Card key={candidate.key}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3) }}>
              <ColorChip hex={filament.colorHex} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text
                  style={{ color: theme.colors.text, fontSize: 15, fontWeight: '700' }}
                  numberOfLines={1}
                >
                  {filament.manufacturer} {filament.colorName}
                </Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12 }} numberOfLines={1}>
                  {filament.productName ?? '—'}
                </Text>
              </View>
              <MaterialBadge
                label={materialLabel(filament.material)}
                color={MATERIAL_COLORS[filament.material]}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: theme.spacing(1.5) }}>
              <Badge
                label={candidate.reason}
                tone={candidate.reason === '使用済み' ? 'neutral' : 'danger'}
              />
              {candidate.count > 1 ? (
                <Badge label={`同じ製品 ${candidate.count}本`} tone="info" />
              ) : null}
            </View>

            <Divider />
            <InfoRow label="残量" value={grams(filament.currentWeightG)} />
            <InfoRow label="前回の購入価格" value={yen(filament.priceYen)} />
            <InfoRow label="前回の購入日" value={formatDate(filament.purchasedAt)} />
            <InfoRow label="購入先" value={filament.purchasedFrom ?? '—'} />

            <View style={{ gap: theme.spacing(2), marginTop: theme.spacing(1) }}>
              {url ? (
                <Button
                  title="購入先を開く"
                  variant="secondary"
                  icon="open-outline"
                  onPress={() => {
                    void Linking.openURL(url);
                  }}
                />
              ) : null}
              <Button
                title="同じ製品を登録する"
                icon="add-circle-outline"
                onPress={() =>
                  router.push({ pathname: '/filament/edit', params: { copyFrom: filament.id } })
                }
              />
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

/**
 * 同一製品（メーカー・製品名・素材・色名）でまとめ、代表として最後に買ったものを出す。
 * 同じスプールを何本も持っていても候補は1行で済む。
 */
function buildCandidates(views: FilamentView[]): Candidate[] {
  const groups = new Map<string, FilamentView[]>();

  for (const view of views) {
    const target = view.status === 'used_up' || view.isLowStock;
    if (!target) continue;
    const key = [view.manufacturer, view.productName ?? '', view.material, view.colorName]
      .join('|')
      .toLowerCase();
    const list = groups.get(key) ?? [];
    list.push(view);
    groups.set(key, list);
  }

  const candidates: Candidate[] = [];
  for (const [key, list] of groups) {
    // 在庫がまだ残っている同一製品があるなら、買い直しは急がない
    const hasStock = views.some(
      (view) =>
        [view.manufacturer, view.productName ?? '', view.material, view.colorName]
          .join('|')
          .toLowerCase() === key &&
        view.status !== 'used_up' &&
        !view.isLowStock,
    );
    if (hasStock) continue;

    const latest = [...list].sort((a, b) =>
      (b.purchasedAt ?? b.createdAt).localeCompare(a.purchasedAt ?? a.createdAt),
    )[0];
    if (!latest) continue;

    candidates.push({
      key,
      latest,
      reason: list.every((view) => view.status === 'used_up') ? '使用済み' : '残りわずか',
      count: list.length,
    });
  }

  // 残りわずか（まだ在庫がある）を先に出す
  return candidates.sort((a, b) => {
    if (a.reason !== b.reason) return a.reason === '残りわずか' ? -1 : 1;
    return a.latest.currentWeightG - b.latest.currentWeightG;
  });
}

/** 購入先が URL のときだけリンクとして扱う */
function toUrl(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}
