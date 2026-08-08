import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { listAllFilaments, listFilaments } from '@/db/repo/filaments';
import { listDryLogs } from '@/db/repo/dryLogs';
import { listPrintLogs } from '@/db/repo/printLogs';
import { listPrintSettings } from '@/db/repo/printSettings';
import { listStorageLocations } from '@/db/repo/storageLocations';
import { loadSettings, saveSettings } from '@/db/repo/appSettings';
import {
  evaluateDesiccant,
  evaluateDrying,
  isLowStock,
  remainingPercent,
  unitPriceYen,
} from '@/domain/calc';
import { DEFAULT_SETTINGS } from '@/domain/settings';
import { syncDailyReminder } from '@/notifications';
import type {
  AppSettings,
  DryLog,
  Filament,
  FilamentView,
  PrintLog,
  PrintSettings,
  StorageLocation,
} from '@/domain/types';
import { todayISO } from '@/utils/date';

type AppData = {
  /** 論理削除されていないフィラメント */
  filaments: Filament[];
  /** 削除済みも含む。統計で素材を引くために使う */
  allFilaments: Filament[];
  printLogs: PrintLog[];
  dryLogs: DryLog[];
  storageLocations: StorageLocation[];
  printSettings: PrintSettings[];
  settings: AppSettings;
};

const EMPTY_DATA: AppData = {
  filaments: [],
  allFilaments: [],
  printLogs: [],
  dryLogs: [],
  storageLocations: [],
  printSettings: [],
  settings: DEFAULT_SETTINGS,
};

type AppContextValue = AppData & {
  ready: boolean;
  error: string | null;
  /** 算出値を付けたフィラメント（要件定義書 6. 算出値はDBに持たない） */
  views: FilamentView[];
  /** 'YYYY-MM-DD'。日付判定の基準。日付が変わったら更新される */
  today: string;
  /** DB から全件読み直す。書き込み後に呼ぶ */
  refresh: () => Promise<void>;
  /** 設定の一部を更新して保存する */
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState(() => todayISO());

  const refresh = useCallback(async () => {
    try {
      const [filaments, allFilaments, printLogs, dryLogs, storageLocations, printSettings, settings] =
        await Promise.all([
          listFilaments(),
          listAllFilaments(),
          listPrintLogs(),
          listDryLogs(),
          listStorageLocations(),
          listPrintSettings(),
          loadSettings(),
        ]);
      setData({
        filaments,
        allFilaments,
        printLogs,
        dryLogs,
        storageLocations,
        printSettings,
        settings,
      });
      setToday(todayISO());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'データの読み込みに失敗しました');
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // 日付をまたいでも乾燥判定がずれないよう、1分ごとに「今日」を見直す
  useEffect(() => {
    const timer = setInterval(() => {
      setToday((current) => {
        const next = todayISO();
        return next === current ? current : next;
      });
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  const updateSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      const next = { ...data.settings, ...patch };
      setData((current) => ({ ...current, settings: next })); // 設定画面の操作感を優先して先に反映する
      await saveSettings(next);
    },
    [data.settings],
  );

  const views = useMemo(
    () =>
      buildViews({
        filaments: data.filaments,
        dryLogs: data.dryLogs,
        storageLocations: data.storageLocations,
        settings: data.settings,
        today,
      }),
    [data.filaments, data.dryLogs, data.storageLocations, data.settings, today],
  );

  // 通知（F-13）。件数と設定が変わったときだけ予約を組み直す
  const reminderSignature = useMemo(() => {
    const needsDryingCount = views.filter((view) => view.needsDrying).length;
    const lowStockCount = views.filter(
      (view) => view.isLowStock && view.status !== 'used_up',
    ).length;
    const desiccantOverdueCount = data.storageLocations.filter(
      (location) => evaluateDesiccant(location, today).overdue,
    ).length;
    return { needsDryingCount, lowStockCount, desiccantOverdueCount };
  }, [views, data.storageLocations, today]);

  const { notifyEnabled, notifyHour, notifyMinute } = data.settings;
  const signatureKey = `${reminderSignature.needsDryingCount}/${reminderSignature.lowStockCount}/${reminderSignature.desiccantOverdueCount}`;

  useEffect(() => {
    if (!ready) return;
    // 通知が組めなくてもアプリの利用は続けられるべきなので、失敗は握りつぶす
    void syncDailyReminder({
      enabled: notifyEnabled,
      hour: notifyHour,
      minute: notifyMinute,
      summary: reminderSignature,
    }).catch(() => undefined);
    // reminderSignature は signatureKey が同じなら中身も同じ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, notifyEnabled, notifyHour, notifyMinute, signatureKey]);

  const value = useMemo<AppContextValue>(
    () => ({ ...data, ready, error, views, today, refresh, updateSettings }),
    [data, ready, error, views, today, refresh, updateSettings],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) {
    throw new Error('useApp は AppProvider の内側で使ってください');
  }
  return value;
}

/** id からフィラメントの表示用データを引く */
export function useFilamentView(id: number | null): FilamentView | null {
  const { views } = useApp();
  return useMemo(() => views.find((view) => view.id === id) ?? null, [views, id]);
}

/**
 * フィラメントに算出値を付ける。
 * 単価・残量%・要乾燥・残りわずかはすべてここで計算し、DB には持たない。
 */
export function buildViews(input: {
  filaments: Filament[];
  dryLogs: DryLog[];
  storageLocations: StorageLocation[];
  settings: AppSettings;
  today: string;
}): FilamentView[] {
  const { filaments, dryLogs, storageLocations, settings, today } = input;

  // フィラメントごとの最終乾燥日
  const lastDried = new Map<number, string>();
  for (const log of dryLogs) {
    const current = lastDried.get(log.filamentId);
    if (!current || log.driedAt > current) {
      lastDried.set(log.filamentId, log.driedAt);
    }
  }

  const locationNames = new Map(storageLocations.map((location) => [location.id, location.name]));

  return filaments.map((filament) => {
    const unitPrice = unitPriceYen(filament.priceYen, filament.initialWeightG);
    const lastDriedAt = lastDried.get(filament.id) ?? null;
    const drying = evaluateDrying(
      {
        material: filament.material,
        status: filament.status,
        openedAt: filament.openedAt,
        lastDriedAt,
      },
      settings.dryThresholds,
      today,
    );

    return {
      ...filament,
      unitPriceYen: unitPrice,
      remainingPercent: remainingPercent(filament.currentWeightG, filament.initialWeightG),
      remainingValueYen: Math.round(filament.currentWeightG * unitPrice * 100) / 100,
      lastDriedAt,
      dryBaseDate: drying.baseDate,
      daysSinceDryBase: drying.daysSince,
      dryDueInDays: drying.dueInDays,
      needsDrying: drying.needsDrying,
      isLowStock: isLowStock(filament, settings),
      storageLocationName:
        filament.storageLocationId === null
          ? null
          : locationNames.get(filament.storageLocationId) ?? null,
    };
  });
}
