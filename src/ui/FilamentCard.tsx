import React from 'react';
import { Text, View } from 'react-native';

import { MATERIAL_COLORS, materialLabel } from '@/domain/materials';
import type { FilamentView } from '@/domain/types';
import { useTheme } from '@/state/useTheme';
import { Badge, Card, ColorChip, MaterialBadge, ProgressBar } from '@/ui/components';
import { grams, percent } from '@/utils/format';

/**
 * 一覧の 1 カード（要件定義書 4.3）。
 * 色チップ / メーカー・色名 / 素材バッジ / 残量バー / 状態アイコン を 1 枚にまとめる。
 */
export function FilamentCard({
  filament,
  onPress,
  footer,
}: {
  filament: FilamentView;
  onPress?: () => void;
  footer?: React.ReactNode;
}) {
  const theme = useTheme();
  const barColor = remainingColor(filament, theme.colors.success, theme.colors.warning, theme.colors.danger);

  return (
    <Card onPress={onPress}>
      <View style={{ flexDirection: 'row', gap: theme.spacing(3), alignItems: 'center' }}>
        <ColorChip hex={filament.colorHex} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text
            style={{ color: theme.colors.text, fontSize: 15, fontWeight: '700' }}
            numberOfLines={1}
          >
            {filament.manufacturer} {filament.colorName}
          </Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }} numberOfLines={1}>
            {[filament.productName, filament.storageLocationName].filter(Boolean).join(' ・ ') ||
              '—'}
          </Text>
        </View>
        <MaterialBadge
          label={materialLabel(filament.material)}
          color={MATERIAL_COLORS[filament.material]}
        />
      </View>

      <View style={{ gap: theme.spacing(1.5), marginTop: theme.spacing(1) }}>
        <ProgressBar percent={filament.remainingPercent} color={barColor} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '600' }}>
            {grams(filament.currentWeightG)} / {grams(filament.initialWeightG)}
          </Text>
          <Text style={{ color: barColor, fontSize: 13, fontWeight: '700' }}>
            {percent(filament.remainingPercent)}
          </Text>
        </View>
      </View>

      <StatusBadges filament={filament} />
      {footer}
    </Card>
  );
}

/** 状態アイコン：要乾燥 / 残りわずか / 未開封 / 使用済み */
export function StatusBadges({ filament }: { filament: FilamentView }) {
  const theme = useTheme();
  const badges: React.ReactNode[] = [];

  if (filament.needsDrying) {
    badges.push(<Badge key="dry" label="要乾燥" tone="warning" icon="water-outline" />);
  }
  if (filament.isLowStock) {
    badges.push(<Badge key="low" label="残りわずか" tone="danger" icon="alert-circle-outline" />);
  }
  if (filament.status === 'unopened') {
    badges.push(<Badge key="unopened" label="未開封" tone="info" icon="cube-outline" />);
  }
  if (filament.status === 'used_up') {
    badges.push(<Badge key="used" label="使用済み" tone="neutral" icon="checkmark-done-outline" />);
  }

  if (badges.length === 0) return null;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(1.5) }}>{badges}</View>
  );
}

/** 残量に応じてバーの色を変える。危険域が一目で分かるように */
export function remainingColor(
  filament: FilamentView,
  success: string,
  warning: string,
  danger: string,
): string {
  if (filament.isLowStock) return danger;
  if (filament.remainingPercent <= 40) return warning;
  return success;
}
