import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { costInMonth, evaluateDesiccant, monthKey, totalRemainingG } from '@/domain/calc';
import { RESULT_LABELS } from '@/domain/materials';
import { useApp } from '@/state/AppProvider';
import { useTheme } from '@/state/useTheme';
import {
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  Screen,
  SectionHeader,
  withAlpha,
} from '@/ui/components';
import { formatDateTime } from '@/utils/date';
import { grams, yen } from '@/utils/format';

/** S-01 ホームダッシュボード（要件定義書 4.6） */
export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { views, printLogs, storageLocations, today, filaments } = useApp();

  const needsDrying = useMemo(() => views.filter((view) => view.needsDrying), [views]);
  const lowStock = useMemo(
    () => views.filter((view) => view.isLowStock && view.status !== 'used_up'),
    [views],
  );
  const desiccantOverdue = useMemo(
    () =>
      storageLocations
        .map((location) => ({ location, status: evaluateDesiccant(location, today) }))
        .filter((item) => item.status.overdue),
    [storageLocations, today],
  );

  const inUseCount = filaments.filter((filament) => filament.status === 'in_use').length;
  const remaining = totalRemainingG(filaments);
  const thisMonthCost = costInMonth(printLogs, monthKey(today));
  const recentLogs = printLogs.slice(0, 5);
  const filamentName = useMemo(
    () => new Map(views.map((view) => [view.id, `${view.manufacturer} ${view.colorName}`])),
    [views],
  );

  const hasAlerts =
    needsDrying.length > 0 || lowStock.length > 0 || desiccantOverdue.length > 0;

  return (
    <Screen>
      {/* 1. アラート領域。該当がなければ丸ごと非表示 */}
      {hasAlerts ? (
        <View style={{ gap: theme.spacing(2) }}>
          {needsDrying.length > 0 ? (
            <AlertCard
              icon="water"
              tone={theme.colors.warning}
              title={`要乾燥 ${needsDrying.length}本`}
              lines={needsDrying.map(
                (view) =>
                  `${view.manufacturer} ${view.colorName}（${
                    view.dryDueInDays === null ? '—' : `${Math.abs(view.dryDueInDays)}日超過`
                  }）`,
              )}
              onPress={() => router.push('/(tabs)/filaments')}
            />
          ) : null}

          {lowStock.length > 0 ? (
            <AlertCard
              icon="alert-circle"
              tone={theme.colors.danger}
              title={`残りわずか ${lowStock.length}本`}
              lines={lowStock.map(
                (view) => `${view.manufacturer} ${view.colorName}（${grams(view.currentWeightG)}）`,
              )}
              onPress={() => router.push('/shopping-list')}
            />
          ) : null}

          {desiccantOverdue.length > 0 ? (
            <AlertCard
              icon="hourglass"
              tone={theme.colors.info}
              title={`乾燥剤の交換期限超過 ${desiccantOverdue.length}件`}
              lines={desiccantOverdue.map(
                (item) =>
                  `${item.location.name}（${
                    item.status.daysSince === null ? '—' : `${item.status.daysSince}日経過`
                  }）`,
              )}
              onPress={() => router.push('/storage-locations')}
            />
          ) : null}
        </View>
      ) : null}

      {/* 2. サマリー */}
      <View style={{ flexDirection: 'row', gap: theme.spacing(2) }}>
        <SummaryTile label="使用中" value={`${inUseCount}`} unit="本" />
        <SummaryTile label="総残量" value={grams(remaining)} />
        <SummaryTile label="今月の材料費" value={yen(thisMonthCost)} />
      </View>

      {/* 3. 最近の印刷ログ */}
      <SectionHeader
        title="最近の印刷"
        action={printLogs.length > 5 ? 'すべて見る' : undefined}
        onAction={() => router.push('/(tabs)/stats')}
      />
      <Card>
        {recentLogs.length === 0 ? (
          <EmptyState
            icon="print-outline"
            title="まだ印刷ログがありません"
            description="下の「印刷を記録する」から登録できます"
          />
        ) : (
          recentLogs.map((log, index) => (
            <View key={log.id}>
              {index > 0 ? <Divider /> : null}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing(2),
                  paddingVertical: theme.spacing(2.5),
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    style={{ color: theme.colors.text, fontSize: 14, fontWeight: '600' }}
                    numberOfLines={1}
                  >
                    {log.modelName ?? '（名称なし）'}
                  </Text>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 12 }} numberOfLines={1}>
                    {filamentName.get(log.filamentId) ?? '削除済みフィラメント'} ・{' '}
                    {formatDateTime(log.printedAt)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 3 }}>
                  <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '700' }}>
                    {grams(log.usedWeightG)}
                  </Text>
                  <Badge
                    label={RESULT_LABELS[log.result]}
                    tone={log.result === 'success' ? 'success' : 'danger'}
                  />
                </View>
              </View>
            </View>
          ))
        )}
      </Card>

      {/* 4. クイックアクション */}
      <SectionHeader title="クイックアクション" />
      <View style={{ gap: theme.spacing(2) }}>
        <Button
          title="印刷を記録する"
          icon="print"
          onPress={() => router.push('/print-log/new')}
        />
        <Button
          title="フィラメントを追加する"
          icon="add-circle-outline"
          variant="secondary"
          onPress={() => router.push('/filament/edit')}
        />
      </View>
    </Screen>
  );
}

function SummaryTile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  const theme = useTheme();
  return (
    <Card style={{ flex: 1, gap: theme.spacing(1), padding: theme.spacing(3) }}>
      <Text style={{ color: theme.colors.textMuted, fontSize: 11 }} numberOfLines={1}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
        <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800' }} numberOfLines={1}>
          {value}
        </Text>
        {unit ? (
          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{unit}</Text>
        ) : null}
      </View>
    </Card>
  );
}

function AlertCard({
  icon,
  tone,
  title,
  lines,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tone: string;
  title: string;
  lines: string[];
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        backgroundColor: withAlpha(tone, theme.dark ? 0.16 : 0.1),
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: withAlpha(tone, 0.4),
        padding: theme.spacing(3.5),
        gap: theme.spacing(1.5),
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) }}>
        <Ionicons name={icon} size={18} color={tone} />
        <Text style={{ color: tone, fontSize: 14, fontWeight: '800', flex: 1 }}>{title}</Text>
        <Ionicons name="chevron-forward" size={16} color={tone} />
      </View>
      {/* 多すぎると圧迫するので先頭3件だけ出す */}
      {lines.slice(0, 3).map((line) => (
        <Text key={line} style={{ color: theme.colors.text, fontSize: 13 }} numberOfLines={1}>
          ・{line}
        </Text>
      ))}
      {lines.length > 3 ? (
        <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
          ほか {lines.length - 3}件
        </Text>
      ) : null}
    </Pressable>
  );
}
