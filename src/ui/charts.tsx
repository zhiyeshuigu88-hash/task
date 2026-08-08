import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { useTheme } from '@/state/useTheme';

/* ------------------------------------------------------------------ *
 * 棒グラフ（月別材料費）
 * ------------------------------------------------------------------ */

export type BarDatum = { label: string; value: number };

export function BarChart({
  data,
  color,
  formatValue,
  height = 140,
}: {
  data: BarDatum[];
  color?: string;
  formatValue: (value: number) => string;
  height?: number;
}) {
  const theme = useTheme();
  const barColor = color ?? theme.colors.primary;
  const max = data.reduce((peak, item) => Math.max(peak, item.value), 0);

  if (data.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', gap: theme.spacing(2), alignItems: 'flex-end' }}>
        {data.map((item) => {
          // 値が 0 の月も棒の位置が分かるよう、最低 2px は描く
          const barHeight = max > 0 ? Math.max(2, (item.value / max) * height) : 2;
          return (
            <View key={item.label} style={{ alignItems: 'center', gap: 4, width: 44 }}>
              <Text style={{ color: theme.colors.textMuted, fontSize: 9 }} numberOfLines={1}>
                {item.value > 0 ? formatValue(item.value) : ''}
              </Text>
              <View
                style={{
                  width: 22,
                  height: barHeight,
                  borderRadius: 4,
                  backgroundColor: item.value > 0 ? barColor : theme.colors.track,
                }}
              />
              <Text style={{ color: theme.colors.textMuted, fontSize: 10 }} numberOfLines={1}>
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ *
 * 円グラフ（素材別消費量割合）
 * ------------------------------------------------------------------ */

export type PieDatum = { label: string; value: number; color: string };

export function PieChart({ data, size = 160 }: { data: PieDatum[]; size?: number }) {
  const theme = useTheme();
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) return null;

  const radius = size / 2;
  const center = radius;
  const innerRadius = radius * 0.55;

  // 12時の方向から時計回りに描く
  let angle = -Math.PI / 2;
  const slices = data.map((item) => {
    const sweep = (item.value / total) * Math.PI * 2;
    const slice = { ...item, start: angle, end: angle + sweep };
    angle += sweep;
    return slice;
  });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(4) }}>
      <Svg width={size} height={size}>
        <G>
          {slices.length === 1 ? (
            // 1種類しかない場合、円弧では始点と終点が重なって描画できないため円で塗る
            <Circle cx={center} cy={center} r={radius} fill={slices[0]?.color ?? theme.colors.primary} />
          ) : (
            slices.map((slice) => (
              <Path
                key={slice.label}
                d={arcPath(center, center, radius, slice.start, slice.end)}
                fill={slice.color}
              />
            ))
          )}
          {/* ドーナツ状にして中央を背景色で抜く */}
          <Circle cx={center} cy={center} r={innerRadius} fill={theme.colors.surface} />
        </G>
      </Svg>

      <View style={{ flex: 1, gap: theme.spacing(1.5) }}>
        {data.map((item) => (
          <View
            key={item.label}
            style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) }}
          >
            <View
              style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color }}
            />
            <Text style={{ color: theme.colors.text, fontSize: 13, flex: 1 }} numberOfLines={1}>
              {item.label}
            </Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' }}>
              {Math.round((item.value / total) * 100)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}
