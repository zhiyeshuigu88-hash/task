import React, { useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { deletePrintLog } from '@/db/repo/printLogs';
import {
  costInMonth,
  inventoryValueYen,
  lossSummary,
  materialUsage,
  monthKey,
  monthlyCosts,
  shiftMonthKey,
  totalCost,
} from '@/domain/calc';
import { MATERIAL_COLORS, RESULT_LABELS, materialLabel } from '@/domain/materials';
import { useApp } from '@/state/AppProvider';
import { useTheme } from '@/state/useTheme';
import { BarChart, PieChart } from '@/ui/charts';
import {
  Badge,
  Card,
  Divider,
  EmptyState,
  InfoRow,
  Screen,
  SectionHeader,
  TextButton,
} from '@/ui/components';
import { formatDateTime, formatMonth, formatMonthShort } from '@/utils/date';
import { grams, percent, yen } from '@/utils/format';

/** S-06 統計（要件定義書 4.10） */
export default function StatsScreen() {
  const theme = useTheme();
  const { printLogs, allFilaments, filaments, views, today, refresh } = useApp();
  const [showAllLogs, setShowAllLogs] = useState(false);

  const thisMonth = monthKey(today);
  const lastMonth = shiftMonthKey(today, -1);

  const stats = useMemo(
    () => ({
      thisMonthCost: costInMonth(printLogs, thisMonth),
      lastMonthCost: costInMonth(printLogs, lastMonth),
      allTimeCost: totalCost(printLogs),
      monthly: monthlyCosts(printLogs, today, 12),
      usage: materialUsage(printLogs, allFilaments),
      loss: lossSummary(printLogs),
      inventory: inventoryValueYen(filaments),
    }),
    [printLogs, allFilaments, filaments, today, thisMonth, lastMonth],
  );

  const filamentName = useMemo(
    () => new Map(views.map((view) => [view.id, `${view.manufacturer} ${view.colorName}`])),
    [views],
  );

  const visibleLogs = showAllLogs ? printLogs : printLogs.slice(0, 10);

  const handleDeleteLog = (id: number, label: string) => {
    Alert.alert('印刷ログを取り消しますか？', `${label}\n減算していた残量を元に戻します。`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '取り消す',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await deletePrintLog(id);
            await refresh();
          })();
        },
      },
    ]);
  };

  if (printLogs.length === 0 && filaments.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="stats-chart-outline"
          title="集計するデータがまだありません"
          description="フィラメントを登録し、印刷ログを付けると統計が表示されます"
        />
      </Screen>
    );
  }

  return (
    <Screen>
      {/* 材料費のサマリー */}
      <Card>
        <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>今月の材料費</Text>
        <Text style={{ color: theme.colors.text, fontSize: 32, fontWeight: '800' }}>
          {yen(stats.thisMonthCost)}
        </Text>
        <Divider />
        <InfoRow label={`先月（${lastMonth ? formatMonth(lastMonth) : '—'}）`} value={yen(stats.lastMonthCost)} />
        <InfoRow label="累計" value={yen(stats.allTimeCost)} />
        <InfoRow
          label="保有フィラメントの資産額"
          value={yen(stats.inventory)}
          valueColor={theme.colors.info}
        />
      </Card>

      {/* 月別材料費の推移 */}
      <SectionHeader title="月別材料費（直近12ヶ月）" />
      <Card>
        <BarChart
          data={stats.monthly.map((item) => ({
            label: formatMonthShort(item.month),
            value: item.costYen,
          }))}
          formatValue={(value) => yen(value)}
        />
      </Card>

      {/* 素材別の消費量割合 */}
      <SectionHeader title="素材別の消費量" />
      <Card>
        {stats.usage.length === 0 ? (
          <EmptyState icon="pie-chart-outline" title="まだ消費量の記録がありません" />
        ) : (
          <>
            <PieChart
              data={stats.usage.map((item) => ({
                label: `${materialLabel(item.material)} ${grams(item.usedWeightG)}`,
                value: item.usedWeightG,
                color: MATERIAL_COLORS[item.material],
              }))}
            />
            <Divider />
            <InfoRow
              label="消費量の合計"
              value={grams(stats.usage.reduce((sum, item) => sum + item.usedWeightG, 0))}
            />
          </>
        )}
      </Card>

      {/* 失敗によるロス */}
      <SectionHeader title="失敗印刷によるロス" />
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing(2) }}>
          <Text style={{ color: theme.colors.danger, fontSize: 28, fontWeight: '800' }}>
            {yen(stats.loss.lossYen)}
          </Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>
            全体の {percent(stats.loss.lossPercent, 1)}
          </Text>
        </View>
        <InfoRow label="失敗・途中中止の件数" value={`${stats.loss.lossCount}件`} />
        <InfoRow label="全印刷の材料費" value={yen(stats.loss.totalYen)} />
      </Card>

      {/* 印刷ログ一覧 */}
      <SectionHeader
        title="印刷ログ"
        action={printLogs.length > 10 ? (showAllLogs ? '折りたたむ' : 'すべて見る') : undefined}
        onAction={() => setShowAllLogs((open) => !open)}
      />
      <Card>
        {printLogs.length === 0 ? (
          <EmptyState icon="print-outline" title="まだ印刷ログがありません" />
        ) : (
          visibleLogs.map((log, index) => (
            <View key={log.id}>
              {index > 0 ? <Divider /> : null}
              <View style={{ paddingVertical: theme.spacing(2.5), gap: 4 }}>
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) }}
                >
                  <Text
                    style={{ color: theme.colors.text, fontSize: 14, fontWeight: '600', flex: 1 }}
                    numberOfLines={1}
                  >
                    {log.modelName ?? '（名称なし）'}
                  </Text>
                  <Badge
                    label={RESULT_LABELS[log.result]}
                    tone={log.result === 'success' ? 'success' : 'danger'}
                  />
                </View>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12 }} numberOfLines={1}>
                  {filamentName.get(log.filamentId) ?? '削除済みフィラメント'} ・{' '}
                  {formatDateTime(log.printedAt)}
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text style={{ color: theme.colors.text, fontSize: 13 }}>
                    {grams(log.usedWeightG)} ・ {yen(log.costYen)}
                  </Text>
                  <TextButton
                    title="取り消す"
                    color={theme.colors.danger}
                    onPress={() => handleDeleteLog(log.id, log.modelName ?? '（名称なし）')}
                  />
                </View>
              </View>
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}
