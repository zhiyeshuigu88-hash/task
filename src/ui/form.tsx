import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/state/useTheme';
import { COLOR_PRESETS } from '@/domain/materials';
import { nowISO, todayISO } from '@/utils/date';
import { contrastText, isValidHex } from '@/utils/format';

/* ------------------------------------------------------------------ *
 * ラベル付きの枠
 * ------------------------------------------------------------------ */

export function Field({
  label,
  required = false,
  hint,
  error,
  children,
  style,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View style={[{ gap: theme.spacing(1.5) }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1) }}>
        <Text style={{ color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' }}>
          {label}
        </Text>
        {required ? (
          <Text style={{ color: theme.colors.danger, fontSize: 12, fontWeight: '700' }}>必須</Text>
        ) : null}
      </View>
      {children}
      {error ? (
        <Text style={{ color: theme.colors.danger, fontSize: 12 }}>{error}</Text>
      ) : hint ? (
        <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{hint}</Text>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * テキスト / 数値入力
 * ------------------------------------------------------------------ */

function useInputStyle(invalid: boolean) {
  const theme = useTheme();
  return {
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: invalid ? theme.colors.danger : theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(3),
    color: theme.colors.text,
    fontSize: 16,
  } as const;
}

export function TextField({
  value,
  onChangeText,
  placeholder,
  multiline = false,
  autoFocus = false,
  invalid = false,
  keyboardType,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  autoFocus?: boolean;
  invalid?: boolean;
  keyboardType?: KeyboardTypeOptions;
}) {
  const theme = useTheme();
  const style = useInputStyle(invalid);
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.textMuted}
      autoFocus={autoFocus}
      keyboardType={keyboardType}
      multiline={multiline}
      style={[style, multiline && { minHeight: 88, textAlignVertical: 'top' }]}
    />
  );
}

/** 数値入力。値は文字列のまま保持し、確定時に parseNumberInput で数値化する */
export function NumberField({
  value,
  onChangeText,
  onBlur,
  placeholder,
  suffix,
  invalid = false,
  allowDecimal = true,
}: {
  value: string;
  onChangeText: (value: string) => void;
  /** 入力確定時に呼ばれる。設定画面のように「編集が終わったら保存」したいときに使う */
  onBlur?: () => void;
  placeholder?: string;
  suffix?: string;
  invalid?: boolean;
  allowDecimal?: boolean;
}) {
  const theme = useTheme();
  const style = useInputStyle(invalid);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        keyboardType={allowDecimal ? 'decimal-pad' : 'number-pad'}
        returnKeyType="done"
        style={[style, { flex: 1 }, suffix ? { paddingRight: theme.spacing(12) } : null]}
      />
      {suffix ? (
        <Text
          style={{
            position: 'absolute',
            right: theme.spacing(3),
            color: theme.colors.textMuted,
            fontSize: 14,
            fontWeight: '600',
          }}
        >
          {suffix}
        </Text>
      ) : null}
    </View>
  );
}

/** 読み取り専用の表示（自動算出された単価など） */
export function ReadonlyValue({ value }: { value: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.colors.surfaceAlt,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.md,
        paddingHorizontal: theme.spacing(3),
        paddingVertical: theme.spacing(3),
      }}
    >
      <Text style={{ color: theme.colors.textMuted, fontSize: 16, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * 選択
 * ------------------------------------------------------------------ */

export type Option<T> = { value: T; label: string };

/**
 * 選択肢をチップで並べる。
 * ネイティブのピッカーを開かずに 1 タップで選べるため、
 * 「記録が3タップ以内で終わること」という設計原則に沿う。
 */
export function ChipSelect<T extends string | number | null>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) }}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={({ pressed }) => ({
              backgroundColor: selected ? theme.colors.primary : theme.colors.surfaceAlt,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: selected ? theme.colors.primary : theme.colors.border,
              borderRadius: theme.radius.pill,
              paddingHorizontal: theme.spacing(3.5),
              paddingVertical: theme.spacing(2),
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Text
              style={{
                color: selected ? theme.colors.onPrimary : theme.colors.text,
                fontSize: 14,
                fontWeight: selected ? '700' : '500',
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 2〜3択の切り替え（フィルタのモード切替など） */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: theme.colors.surfaceAlt,
        borderRadius: theme.radius.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
        padding: 3,
        gap: 3,
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: theme.spacing(2),
              borderRadius: theme.radius.sm,
              backgroundColor: selected ? theme.colors.surface : 'transparent',
            }}
          >
            <Text
              style={{
                color: selected ? theme.colors.text : theme.colors.textMuted,
                fontSize: 13,
                fontWeight: selected ? '700' : '500',
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 過去の入力からのサジェスト（メーカー名・購入先） */
export function SuggestChips({
  values,
  onSelect,
}: {
  values: string[];
  onSelect: (value: string) => void;
}) {
  const theme = useTheme();
  if (values.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(1.5) }}>
      {values.map((item) => (
        <Pressable
          key={item}
          onPress={() => onSelect(item)}
          accessibilityRole="button"
          style={({ pressed }) => ({
            backgroundColor: theme.colors.surfaceAlt,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.pill,
            paddingHorizontal: theme.spacing(2.5),
            paddingVertical: theme.spacing(1),
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{item}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * 日付
 * ------------------------------------------------------------------ */

/**
 * 'YYYY-MM-DD' のテキスト入力 + 「今日」ボタン。
 * ネイティブの DatePicker を足さずに済ませるため、入力は文字列で受けて呼び出し側が検証する。
 */
export function DateField({
  value,
  onChange,
  invalid = false,
  clearable = true,
}: {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  clearable?: boolean;
}) {
  const theme = useTheme();
  const style = useInputStyle(invalid);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) }}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={theme.colors.textMuted}
        keyboardType="numbers-and-punctuation"
        autoCapitalize="none"
        autoCorrect={false}
        style={[style, { flex: 1 }]}
      />
      <Pressable
        onPress={() => onChange(todayISO())}
        accessibilityRole="button"
        style={({ pressed }) => ({
          paddingHorizontal: theme.spacing(3),
          paddingVertical: theme.spacing(3),
          borderRadius: theme.radius.md,
          backgroundColor: theme.colors.surfaceAlt,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text style={{ color: theme.colors.primary, fontSize: 14, fontWeight: '600' }}>今日</Text>
      </Pressable>
      {clearable && value !== '' ? (
        <Pressable onPress={() => onChange('')} accessibilityRole="button" hitSlop={8}>
          <Ionicons name="close-circle" size={22} color={theme.colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** 'YYYY-MM-DDTHH:mm' のテキスト入力 + 「今」ボタン */
export function DateTimeField({
  value,
  onChange,
  invalid = false,
}: {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}) {
  const theme = useTheme();
  const style = useInputStyle(invalid);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) }}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DDTHH:mm"
        placeholderTextColor={theme.colors.textMuted}
        keyboardType="numbers-and-punctuation"
        autoCapitalize="none"
        autoCorrect={false}
        style={[style, { flex: 1 }]}
      />
      <Pressable
        onPress={() => onChange(nowISO())}
        accessibilityRole="button"
        style={({ pressed }) => ({
          paddingHorizontal: theme.spacing(3),
          paddingVertical: theme.spacing(3),
          borderRadius: theme.radius.md,
          backgroundColor: theme.colors.surfaceAlt,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text style={{ color: theme.colors.primary, fontSize: 14, fontWeight: '600' }}>今</Text>
      </Pressable>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * 色
 * ------------------------------------------------------------------ */

/** プリセットから選ぶか、カラーコードを直接入力する */
export function ColorField({
  value,
  onChange,
  onPickPresetName,
}: {
  value: string;
  onChange: (hex: string) => void;
  /** プリセットを選んだときに色名も一緒に埋めたい場合に使う */
  onPickPresetName?: (name: string) => void;
}) {
  const theme = useTheme();
  const valid = isValidHex(value);
  const style = useInputStyle(!valid);

  return (
    <View style={{ gap: theme.spacing(2) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: theme.radius.md,
            backgroundColor: valid ? value : theme.colors.surfaceAlt,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: theme.colors.border,
          }}
        />
        <TextInput
          value={value}
          onChangeText={(next) => onChange(next.startsWith('#') ? next : `#${next}`)}
          placeholder="#RRGGBB"
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          style={[style, { flex: 1 }]}
        />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) }}>
        {COLOR_PRESETS.map((preset) => {
          const selected = preset.hex.toLowerCase() === value.toLowerCase();
          return (
            <Pressable
              key={preset.hex}
              accessibilityRole="button"
              accessibilityLabel={preset.name}
              accessibilityState={{ selected }}
              onPress={() => {
                onChange(preset.hex);
                onPickPresetName?.(preset.name);
              }}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: preset.hex,
                borderWidth: selected ? 3 : StyleSheet.hairlineWidth,
                borderColor: selected ? theme.colors.primary : theme.colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {selected ? (
                <Ionicons name="checkmark" size={16} color={contrastText(preset.hex)} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
