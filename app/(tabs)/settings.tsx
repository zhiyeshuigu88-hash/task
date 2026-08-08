import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';

import { exportBackup, importBackup } from '@/db/backup';
import { MATERIALS, MATERIAL_LABELS } from '@/domain/materials';
import { DEFAULT_DRY_THRESHOLDS } from '@/domain/settings';
import type { Material } from '@/domain/types';
import { useApp } from '@/state/AppProvider';
import { useTheme } from '@/state/useTheme';
import { Button, Card, Divider, InfoRow, Screen, SectionHeader } from '@/ui/components';
import { ChipSelect, Field, NumberField, SegmentedControl } from '@/ui/form';
import { todayISO } from '@/utils/date';
import { parseNumberInput } from '@/utils/format';

/** S-08 設定 */
export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { settings, updateSettings, refresh, filaments, printLogs } = useApp();
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);

  const handleExport = () => {
    setBusy('export');
    void (async () => {
      try {
        const backup = await exportBackup();
        const fileName = `filament-keeper-${todayISO()}.json`;
        const path = `${FileSystem.cacheDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(path, JSON.stringify(backup, null, 2));

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(path, {
            mimeType: 'application/json',
            UTI: 'public.json',
            dialogTitle: 'バックアップを保存',
          });
        } else {
          Alert.alert('書き出しました', `保存先: ${path}`);
        }
      } catch (cause) {
        Alert.alert(
          '書き出せませんでした',
          cause instanceof Error ? cause.message : '不明なエラーが発生しました',
        );
      } finally {
        setBusy(null);
      }
    })();
  };

  const handleImport = () => {
    Alert.alert(
      'データを読み込みますか？',
      '現在のデータはすべて置き換えられます。先にバックアップを取っておくことをおすすめします。',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '選んで読み込む', style: 'destructive', onPress: pickAndImport },
      ],
    );
  };

  const pickAndImport = () => {
    setBusy('import');
    void (async () => {
      try {
        const picked = await DocumentPicker.getDocumentAsync({
          type: ['application/json', 'public.json', '*/*'],
          copyToCacheDirectory: true,
        });
        if (picked.canceled) return;

        const asset = picked.assets[0];
        if (!asset) return;

        const raw = await FileSystem.readAsStringAsync(asset.uri);
        const summary = await importBackup(raw);
        await refresh();

        Alert.alert(
          '読み込みました',
          `フィラメント ${summary.filaments}件 / 印刷ログ ${summary.print_logs}件 / 乾燥ログ ${summary.dry_logs}件`,
        );
      } catch (cause) {
        Alert.alert(
          '読み込めませんでした',
          cause instanceof Error ? cause.message : '不明なエラーが発生しました',
        );
      } finally {
        setBusy(null);
      }
    })();
  };

  return (
    <Screen>
      {/* 残量アラート（F-08） */}
      <SectionHeader title="残量アラート" />
      <Card>
        <Field label="判定方法">
          <SegmentedControl
            options={[
              { value: 'percent' as const, label: '残量%で判定' },
              { value: 'gram' as const, label: '残量gで判定' },
            ]}
            value={settings.lowStockMode}
            onChange={(value) => void updateSettings({ lowStockMode: value })}
          />
        </Field>
        {settings.lowStockMode === 'percent' ? (
          <NumberSetting
            label="この割合以下で「残りわずか」"
            suffix="%"
            value={settings.lowStockPercent}
            min={0}
            max={100}
            onCommit={(value) => void updateSettings({ lowStockPercent: value })}
          />
        ) : (
          <NumberSetting
            label="この重量以下で「残りわずか」"
            suffix="g"
            value={settings.lowStockGram}
            min={0}
            onCommit={(value) => void updateSettings({ lowStockGram: value })}
          />
        )}
      </Card>

      {/* 乾燥推奨判定（F-07） */}
      <SectionHeader title="再乾燥までの日数" />
      <Card>
        <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
          最終乾燥日（なければ開封日）からこの日数を超えると「要乾燥」になります。既定値は目安なので、
          環境の湿度に合わせて調整してください。
        </Text>
        <Divider />
        {MATERIALS.map((material) => (
          <NumberSetting
            key={material}
            label={MATERIAL_LABELS[material]}
            suffix="日"
            value={settings.dryThresholds[material]}
            min={1}
            onCommit={(value) =>
              void updateSettings({
                dryThresholds: { ...settings.dryThresholds, [material]: value } as Record<
                  Material,
                  number
                >,
              })
            }
          />
        ))}
        <Button
          title="既定値に戻す"
          variant="ghost"
          onPress={() => void updateSettings({ dryThresholds: { ...DEFAULT_DRY_THRESHOLDS } })}
        />
      </Card>

      {/* 登録時の既定値 */}
      <SectionHeader title="登録時の既定値" />
      <Card>
        <NumberSetting
          label="初期フィラメント重量"
          suffix="g"
          value={settings.defaultInitialWeightG}
          min={1}
          onCommit={(value) => void updateSettings({ defaultInitialWeightG: value })}
        />
        <NumberSetting
          label="スプール自重"
          suffix="g"
          value={settings.defaultSpoolWeightG}
          min={0}
          onCommit={(value) => void updateSettings({ defaultSpoolWeightG: value })}
        />
      </Card>

      {/* 表示 */}
      <SectionHeader title="表示" />
      <Card>
        <Field label="テーマ">
          <ChipSelect
            options={[
              { value: 'system' as const, label: '端末に合わせる' },
              { value: 'light' as const, label: 'ライト' },
              { value: 'dark' as const, label: 'ダーク' },
            ]}
            value={settings.themeMode}
            onChange={(value) => void updateSettings({ themeMode: value })}
          />
        </Field>
      </Card>

      {/* 通知（F-13） */}
      <SectionHeader title="通知" />
      <Card>
        <Field
          label="毎日のお知らせ"
          hint="要乾燥・残りわずか・乾燥剤の交換期限をまとめて通知します"
        >
          <SegmentedControl
            options={[
              { value: 'off' as const, label: 'オフ' },
              { value: 'on' as const, label: 'オン' },
            ]}
            value={settings.notifyEnabled ? 'on' : 'off'}
            onChange={(value) => void updateSettings({ notifyEnabled: value === 'on' })}
          />
        </Field>
        {settings.notifyEnabled ? (
          <View style={{ flexDirection: 'row', gap: theme.spacing(3) }}>
            <View style={{ flex: 1 }}>
              <NumberSetting
                label="通知する時（0〜23）"
                suffix="時"
                value={settings.notifyHour}
                min={0}
                max={23}
                onCommit={(value) => void updateSettings({ notifyHour: Math.round(value) })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <NumberSetting
                label="分（0〜59）"
                suffix="分"
                value={settings.notifyMinute}
                min={0}
                max={59}
                onCommit={(value) => void updateSettings({ notifyMinute: Math.round(value) })}
              />
            </View>
          </View>
        ) : null}
      </Card>

      {/* 管理画面への導線 */}
      <SectionHeader title="管理" />
      <View style={{ gap: theme.spacing(2) }}>
        <Button
          title="保管場所"
          variant="secondary"
          icon="cube-outline"
          onPress={() => router.push('/storage-locations')}
        />
        <Button
          title="買い直しリスト"
          variant="secondary"
          icon="cart-outline"
          onPress={() => router.push('/shopping-list')}
        />
      </View>

      {/* バックアップ（F-12） */}
      <SectionHeader title="バックアップ" />
      <Card>
        <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
          データは端末内の SQLite にだけ保存されます。機種変更や万一の削除に備えて、
          ときどき書き出しておいてください。
        </Text>
        <Button
          title="JSONに書き出す"
          variant="secondary"
          icon="download-outline"
          onPress={handleExport}
          loading={busy === 'export'}
        />
        <Button
          title="JSONから読み込む"
          variant="secondary"
          icon="cloud-upload-outline"
          onPress={handleImport}
          loading={busy === 'import'}
        />
      </Card>

      {/* アプリ情報 */}
      <SectionHeader title="このアプリについて" />
      <Card>
        <InfoRow label="アプリ名" value="Filament Keeper" />
        <InfoRow label="バージョン" value="1.0.0" />
        <InfoRow label="プラットフォーム" value={Platform.OS} />
        <Divider />
        <InfoRow label="登録フィラメント" value={`${filaments.length}本`} />
        <InfoRow label="印刷ログ" value={`${printLogs.length}件`} />
      </Card>
    </Screen>
  );
}

/**
 * 数値設定の1行。
 * 入力中の途中経過（空文字や '2' だけの状態）で設定を書き換えないよう、
 * 編集が終わったタイミングでだけ確定する。
 */
function NumberSetting({
  label,
  suffix,
  value,
  min,
  max,
  onCommit,
}: {
  label: string;
  suffix: string;
  value: number;
  min?: number;
  max?: number;
  onCommit: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));
  const [editing, setEditing] = useState(false);

  // 外部から値が変わった場合（「既定値に戻す」など）は表示を追従させる
  if (!editing && text !== String(value)) {
    setText(String(value));
  }

  const commit = () => {
    setEditing(false);
    const parsed = parseNumberInput(text);
    if (
      parsed === null ||
      (min !== undefined && parsed < min) ||
      (max !== undefined && parsed > max)
    ) {
      setText(String(value)); // 不正な入力は元に戻す
      return;
    }
    onCommit(parsed);
  };

  return (
    <Field label={label}>
      <NumberField
        value={text}
        onChangeText={(next) => {
          setEditing(true);
          setText(next);
        }}
        onBlur={commit}
        suffix={suffix}
      />
    </Field>
  );
}
