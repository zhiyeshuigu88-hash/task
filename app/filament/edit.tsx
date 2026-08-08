import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import {
  createFilament,
  listManufacturers,
  listPurchaseSources,
  updateFilament,
  type FilamentInput,
} from '@/db/repo/filaments';
import { isValidDateString, unitPriceYen } from '@/domain/calc';
import {
  DIAMETERS,
  MATERIALS,
  MATERIAL_LABELS,
  SPOOL_WEIGHT_PRESETS,
  STATUS_LABELS,
} from '@/domain/materials';
import type { Diameter, FilamentStatus, Material } from '@/domain/types';
import { useApp } from '@/state/AppProvider';
import { useTheme } from '@/state/useTheme';
import { Button, Card, Screen, SectionHeader } from '@/ui/components';
import {
  ChipSelect,
  ColorField,
  DateField,
  Field,
  NumberField,
  ReadonlyValue,
  SuggestChips,
  TextField,
} from '@/ui/form';
import { isValidHex, parseNumberInput, unitPrice as formatUnitPrice } from '@/utils/format';

const MATERIAL_OPTIONS = MATERIALS.map((value) => ({ value, label: MATERIAL_LABELS[value] }));
const DIAMETER_OPTIONS = DIAMETERS.map((value) => ({ value, label: `${value}mm` }));
const STATUS_OPTIONS = (Object.keys(STATUS_LABELS) as FilamentStatus[]).map((value) => ({
  value,
  label: STATUS_LABELS[value],
}));

/**
 * S-04 フィラメント登録 / 編集（要件定義書 4.2）。
 *
 * - `id` があれば編集、`copyFrom` があれば「同じ製品をもう1本登録」
 * - 1gあたり単価は読み取り専用で自動表示する
 */
export default function FilamentEditScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; copyFrom?: string }>();
  const { views, storageLocations, settings, refresh } = useApp();

  const editingId = toId(params.id);
  const copyFromId = toId(params.copyFrom);
  const source = useMemo(
    () => views.find((view) => view.id === (editingId ?? copyFromId)) ?? null,
    [views, editingId, copyFromId],
  );

  const [manufacturer, setManufacturer] = useState('');
  const [productName, setProductName] = useState('');
  const [material, setMaterial] = useState<Material>('PLA');
  const [colorName, setColorName] = useState('');
  const [colorHex, setColorHex] = useState('#1971C2');
  const [diameter, setDiameter] = useState<Diameter>(1.75);
  const [initialWeight, setInitialWeight] = useState(String(settings.defaultInitialWeightG));
  const [spoolWeight, setSpoolWeight] = useState(String(settings.defaultSpoolWeightG));
  const [price, setPrice] = useState('');
  const [purchasedAt, setPurchasedAt] = useState('');
  const [purchasedFrom, setPurchasedFrom] = useState('');
  const [openedAt, setOpenedAt] = useState('');
  const [storageLocationId, setStorageLocationId] = useState<number | null>(null);
  const [status, setStatus] = useState<FilamentStatus>('unopened');
  const [note, setNote] = useState('');

  const [manufacturerSuggestions, setManufacturerSuggestions] = useState<string[]>([]);
  const [sourceSuggestions, setSourceSuggestions] = useState<string[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // 編集 / 複製の初期値を1度だけ流し込む
  useEffect(() => {
    if (loaded || !source) return;
    setManufacturer(source.manufacturer);
    setProductName(source.productName ?? '');
    setMaterial(source.material);
    setColorName(source.colorName);
    setColorHex(source.colorHex);
    setDiameter(source.diameter);
    setInitialWeight(String(source.initialWeightG));
    setSpoolWeight(String(source.spoolWeightG));
    setPrice(String(source.priceYen));
    setPurchasedFrom(source.purchasedFrom ?? '');
    setStorageLocationId(source.storageLocationId);
    setNote(source.note ?? '');

    if (editingId !== null) {
      // 編集時は日付とステータスもそのまま引き継ぐ
      setPurchasedAt(source.purchasedAt ?? '');
      setOpenedAt(source.openedAt ?? '');
      setStatus(source.status);
    } else {
      // 複製時は「新品をもう1本」なので、開封日とステータスはリセットする
      setStatus('unopened');
    }
    setLoaded(true);
  }, [loaded, source, editingId]);

  useEffect(() => {
    void (async () => {
      const [manufacturers, sources] = await Promise.all([
        listManufacturers(),
        listPurchaseSources(),
      ]);
      setManufacturerSuggestions(manufacturers);
      setSourceSuggestions(sources);
    })();
  }, []);

  const initialWeightValue = parseNumberInput(initialWeight);
  const spoolWeightValue = parseNumberInput(spoolWeight);
  const priceValue = parseNumberInput(price);

  const errors = {
    manufacturer: manufacturer.trim() === '' ? 'メーカーを入力してください' : null,
    colorName: colorName.trim() === '' ? '色名を入力してください' : null,
    colorHex: isValidHex(colorHex) ? null : '#RRGGBB の形式で入力してください',
    initialWeight:
      initialWeightValue === null || initialWeightValue <= 0
        ? '0より大きい値を入力してください'
        : null,
    spoolWeight:
      spoolWeightValue === null || spoolWeightValue < 0 ? '0以上の値を入力してください' : null,
    price: priceValue === null || priceValue < 0 ? '0以上の値を入力してください' : null,
    purchasedAt:
      purchasedAt !== '' && !isValidDateString(purchasedAt) ? '日付の形式が正しくありません' : null,
    openedAt:
      openedAt !== '' && !isValidDateString(openedAt) ? '日付の形式が正しくありません' : null,
  };
  const hasError = Object.values(errors).some((value) => value !== null);

  const computedUnitPrice =
    priceValue !== null && initialWeightValue !== null && initialWeightValue > 0
      ? unitPriceYen(priceValue, initialWeightValue)
      : 0;

  /** 開封日を入れたら未開封のままにはしない（乾燥判定の対象に入れるため） */
  const handleOpenedAtChange = (value: string) => {
    setOpenedAt(value);
    if (value !== '' && status === 'unopened') setStatus('in_use');
  };

  const handleSubmit = () => {
    if (
      hasError ||
      initialWeightValue === null ||
      spoolWeightValue === null ||
      priceValue === null
    ) {
      setShowErrors(true);
      return;
    }

    setSubmitting(true);
    void (async () => {
      try {
        const input: FilamentInput = {
          manufacturer,
          productName,
          material,
          colorName,
          colorHex: colorHex.toUpperCase(),
          diameter,
          initialWeightG: initialWeightValue,
          spoolWeightG: spoolWeightValue,
          // 編集時は現在の残量を維持する。残量の更新は詳細画面から行う
          currentWeightG: editingId !== null && source ? source.currentWeightG : initialWeightValue,
          priceYen: priceValue,
          purchasedAt: purchasedAt || null,
          purchasedFrom,
          openedAt: openedAt || null,
          storageLocationId,
          status,
          note,
        };

        if (editingId !== null) {
          await updateFilament(editingId, input);
        } else {
          await createFilament(input);
        }
        await refresh();
        router.back();
      } catch (cause) {
        Alert.alert(
          '保存できませんでした',
          cause instanceof Error ? cause.message : '不明なエラーが発生しました',
        );
      } finally {
        setSubmitting(false);
      }
    })();
  };

  const title =
    editingId !== null ? 'フィラメントを編集' : copyFromId !== null ? 'もう1本登録' : '新規登録';

  return (
    <Screen>
      <Stack.Screen options={{ title }} />

      <Field label="メーカー" required error={showErrors ? errors.manufacturer : null}>
        <TextField
          value={manufacturer}
          onChangeText={setManufacturer}
          placeholder="例：Bambu Lab"
          invalid={showErrors && errors.manufacturer !== null}
        />
        <SuggestChips values={manufacturerSuggestions} onSelect={setManufacturer} />
      </Field>

      <Field label="製品名">
        <TextField value={productName} onChangeText={setProductName} placeholder="例：PLA Basic" />
      </Field>

      <Field label="素材" required>
        <ChipSelect options={MATERIAL_OPTIONS} value={material} onChange={setMaterial} />
      </Field>

      <Field label="色名" required error={showErrors ? errors.colorName : null}>
        <TextField
          value={colorName}
          onChangeText={setColorName}
          placeholder="例：マットブラック"
          invalid={showErrors && errors.colorName !== null}
        />
      </Field>

      <Field
        label="カラーコード"
        required
        error={showErrors ? errors.colorHex : null}
        hint="一覧で色チップとして表示されます"
      >
        <ColorField
          value={colorHex}
          onChange={setColorHex}
          onPickPresetName={(name) => {
            // 色名が空のときだけプリセット名で補う（入力済みの名前は上書きしない）
            if (colorName.trim() === '') setColorName(name);
          }}
        />
      </Field>

      <Field label="直径" required>
        <ChipSelect options={DIAMETER_OPTIONS} value={diameter} onChange={setDiameter} />
      </Field>

      <SectionHeader title="重量と価格" />

      <Field
        label="初期フィラメント重量"
        required
        error={showErrors ? errors.initialWeight : null}
        hint="スプールを含まない正味の重量"
      >
        <NumberField
          value={initialWeight}
          onChangeText={setInitialWeight}
          suffix="g"
          invalid={showErrors && errors.initialWeight !== null}
        />
      </Field>

      <Field
        label="スプール自重"
        required
        error={showErrors ? errors.spoolWeight : null}
        hint="実測総重量から残量を算出するときに使います。プリセットは目安です"
      >
        <NumberField
          value={spoolWeight}
          onChangeText={setSpoolWeight}
          suffix="g"
          invalid={showErrors && errors.spoolWeight !== null}
        />
        <SuggestChips
          values={SPOOL_WEIGHT_PRESETS.map((preset) => `${preset.label} ${preset.weightG}g`)}
          onSelect={(label) => {
            const preset = SPOOL_WEIGHT_PRESETS.find(
              (item) => `${item.label} ${item.weightG}g` === label,
            );
            if (preset) setSpoolWeight(String(preset.weightG));
          }}
        />
      </Field>

      <Field label="購入価格（税込）" required error={showErrors ? errors.price : null}>
        <NumberField
          value={price}
          onChangeText={setPrice}
          suffix="円"
          invalid={showErrors && errors.price !== null}
        />
      </Field>

      <Field label="1gあたり単価（自動計算）">
        <ReadonlyValue value={formatUnitPrice(computedUnitPrice)} />
      </Field>

      <SectionHeader title="購入・保管" />

      <Field label="購入日" error={showErrors ? errors.purchasedAt : null}>
        <DateField
          value={purchasedAt}
          onChange={setPurchasedAt}
          invalid={showErrors && errors.purchasedAt !== null}
        />
      </Field>

      <Field label="購入先" hint="次回のリピート判断に使います">
        <TextField
          value={purchasedFrom}
          onChangeText={setPurchasedFrom}
          placeholder="例：Amazon"
        />
      </Field>

      <Field label="開封日" error={showErrors ? errors.openedAt : null} hint="未開封なら空のまま">
        <DateField
          value={openedAt}
          onChange={handleOpenedAtChange}
          invalid={showErrors && errors.openedAt !== null}
        />
      </Field>

      <Field label="ステータス" required>
        <ChipSelect options={STATUS_OPTIONS} value={status} onChange={setStatus} />
      </Field>
      {status === 'unopened' ? (
        <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: -theme.spacing(1) }}>
          未開封のフィラメントは乾燥推奨判定の対象外です
        </Text>
      ) : null}

      <Field label="保管場所">
        {storageLocations.length === 0 ? (
          <Card>
            <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>
              保管場所がまだ登録されていません
            </Text>
            <Button
              title="保管場所を登録する"
              variant="secondary"
              icon="cube-outline"
              onPress={() => router.push('/storage-locations')}
            />
          </Card>
        ) : (
          <ChipSelect<number | null>
            options={[
              { value: null, label: '未設定' },
              ...storageLocations.map((location) => ({
                value: location.id,
                label: location.name,
              })),
            ]}
            value={storageLocationId}
            onChange={setStorageLocationId}
          />
        )}
      </Field>

      <Field label="メモ">
        <TextField value={note} onChangeText={setNote} multiline />
      </Field>

      <View style={{ gap: theme.spacing(2), marginTop: theme.spacing(2) }}>
        <Button
          title={editingId !== null ? '保存する' : '登録する'}
          icon="checkmark"
          onPress={handleSubmit}
          loading={submitting}
        />
        <Button title="キャンセル" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

function toId(value: string | undefined): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
