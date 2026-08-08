import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/state/useTheme';
import type { ThemeColors } from '@/ui/theme';
import { contrastText } from '@/utils/format';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/* ------------------------------------------------------------------ *
 * レイアウト
 * ------------------------------------------------------------------ */

export function Screen({
  children,
  scroll = true,
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const padding = {
    padding: theme.spacing(4),
    paddingBottom: theme.spacing(24), // タブバーと FAB に隠れないよう下に余白を取る
    gap: theme.spacing(3),
  };

  if (!scroll) {
    return (
      <View style={[{ flex: 1, backgroundColor: theme.colors.background }, padding, contentStyle]}>
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={[padding, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {children}
    </ScrollView>
  );
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const cardStyle: ViewStyle = {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    padding: theme.spacing(4),
    gap: theme.spacing(2),
  };

  if (!onPress) return <View style={[cardStyle, style]}>{children}</View>;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [cardStyle, pressed && { opacity: 0.7 }, style]}
      accessibilityRole="button"
    >
      {children}
    </Pressable>
  );
}

export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: theme.spacing(2),
      }}
    >
      <Text style={{ color: theme.colors.text, fontSize: 17, fontWeight: '700' }}>{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8}>
          <Text style={{ color: theme.colors.primary, fontSize: 14, fontWeight: '600' }}>
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Divider() {
  const theme = useTheme();
  return (
    <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border }} />
  );
}

/** ラベルと値を左右に並べる行 */
export function InfoRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: theme.spacing(3),
        paddingVertical: theme.spacing(1),
      }}
    >
      <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>{label}</Text>
      <Text
        style={{
          color: valueColor ?? theme.colors.text,
          fontSize: 14,
          fontWeight: '600',
          flexShrink: 1,
          textAlign: 'right',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * 表示部品
 * ------------------------------------------------------------------ */

export type BadgeTone = 'neutral' | 'primary' | 'warning' | 'danger' | 'success' | 'info';

export function Badge({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: BadgeTone;
  icon?: IconName;
}) {
  const theme = useTheme();
  const color = toneColor(tone, theme.colors);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: withAlpha(color, theme.dark ? 0.22 : 0.13),
        paddingHorizontal: theme.spacing(2),
        paddingVertical: 3,
        borderRadius: theme.radius.pill,
      }}
    >
      {icon ? <Ionicons name={icon} size={12} color={color} /> : null}
      <Text style={{ color, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function ProgressBar({ percent, color }: { percent: number; color?: string }) {
  const theme = useTheme();
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <View
      style={{
        height: 8,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.colors.track,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${clamped}%`,
          height: '100%',
          borderRadius: theme.radius.pill,
          backgroundColor: color ?? theme.colors.primary,
        }}
      />
    </View>
  );
}

/** 一覧で色を見分けるための色チップ */
export function ColorChip({ hex, size = 36 }: { hex: string; size?: number }) {
  const theme = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: hex,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
      }}
    />
  );
}

/** 素材バッジ。色チップと区別できるよう素材色で塗る */
export function MaterialBadge({ label, color }: { label: string; color: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        backgroundColor: color,
        paddingHorizontal: theme.spacing(2),
        paddingVertical: 2,
        borderRadius: theme.radius.sm,
      }}
    >
      <Text style={{ color: contrastText(color), fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  icon = 'file-tray-outline',
  title,
  description,
}: {
  icon?: IconName;
  title: string;
  description?: string;
}) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: theme.spacing(2), paddingVertical: theme.spacing(10) }}>
      <Ionicons name={icon} size={40} color={theme.colors.textMuted} />
      <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: '600' }}>{title}</Text>
      {description ? (
        <Text style={{ color: theme.colors.textMuted, fontSize: 13, textAlign: 'center' }}>
          {description}
        </Text>
      ) : null}
    </View>
  );
}

export function Loading({ label = '読み込み中…' }: { label?: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing(3),
        backgroundColor: theme.colors.background,
      }}
    >
      <ActivityIndicator color={theme.colors.primary} />
      <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>{label}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * ボタン
 * ------------------------------------------------------------------ */

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const palette: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
    primary: { bg: theme.colors.primary, fg: theme.colors.onPrimary, border: 'transparent' },
    secondary: { bg: theme.colors.surfaceAlt, fg: theme.colors.text, border: theme.colors.border },
    danger: { bg: theme.colors.danger, fg: '#FFFFFF', border: 'transparent' },
    ghost: { bg: 'transparent', fg: theme.colors.primary, border: 'transparent' },
  };
  const { bg, fg, border } = palette[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing(2),
          backgroundColor: bg,
          borderColor: border,
          borderWidth: border === 'transparent' ? 0 : StyleSheet.hairlineWidth,
          borderRadius: theme.radius.md,
          paddingVertical: theme.spacing(3.5),
          paddingHorizontal: theme.spacing(4),
          opacity: isDisabled ? 0.5 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : icon ? (
        <Ionicons name={icon} size={18} color={fg} />
      ) : null}
      <Text style={{ color: fg, fontSize: 15, fontWeight: '700' }}>{title}</Text>
    </Pressable>
  );
}

/** カード内の小さな操作（「今日に設定」など） */
export function TextButton({
  title,
  onPress,
  color,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  color?: string;
  icon?: IconName;
  style?: StyleProp<TextStyle>;
}) {
  const theme = useTheme();
  const tint = color ?? theme.colors.primary;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {icon ? <Ionicons name={icon} size={14} color={tint} /> : null}
      <Text style={[{ color: tint, fontSize: 14, fontWeight: '600' }, style]}>{title}</Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ *
 * 色ユーティリティ
 * ------------------------------------------------------------------ */

export function toneColor(tone: BadgeTone, colors: ThemeColors): string {
  switch (tone) {
    case 'primary':
      return colors.primary;
    case 'warning':
      return colors.warning;
    case 'danger':
      return colors.danger;
    case 'success':
      return colors.success;
    case 'info':
      return colors.info;
    default:
      return colors.textMuted;
  }
}

/** '#RRGGBB' に不透明度を付けた 'rgba(...)' を返す */
export function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized;
  if (full.length !== 6) return hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return hex;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
