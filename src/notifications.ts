import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * F-13 ローカル通知。
 * 乾燥剤の交換期限と要乾燥判定を、設定した時刻に毎朝知らせる。
 * ネットワークを使わないローカル通知なので、オフライン要件を崩さない。
 */

const CHANNEL_ID = 'filament-alerts';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** 通知の許可を求める。拒否された場合は false */
export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export type ReminderSummary = {
  needsDryingCount: number;
  lowStockCount: number;
  desiccantOverdueCount: number;
};

/**
 * 毎日の通知を設定し直す。
 * 予約は 1 件だけに保ちたいので、いったん全部消してから登録する。
 *
 * @returns 予約したときは true、通知が無効・未許可・知らせる内容が無いときは false
 */
export async function syncDailyReminder(options: {
  enabled: boolean;
  hour: number;
  minute: number;
  summary: ReminderSummary;
}): Promise<boolean> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (!options.enabled) return false;

  const granted = await requestNotificationPermission();
  if (!granted) return false;

  const body = buildBody(options.summary);
  if (!body) return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'フィラメントのアラート',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Filament Keeper',
      body,
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: options.hour,
      minute: options.minute,
    },
  });

  return true;
}

/** 知らせることが無ければ null を返し、通知を予約しない */
function buildBody(summary: ReminderSummary): string | null {
  const parts: string[] = [];
  if (summary.needsDryingCount > 0) parts.push(`要乾燥 ${summary.needsDryingCount}本`);
  if (summary.lowStockCount > 0) parts.push(`残りわずか ${summary.lowStockCount}本`);
  if (summary.desiccantOverdueCount > 0) {
    parts.push(`乾燥剤の交換期限超過 ${summary.desiccantOverdueCount}件`);
  }
  return parts.length > 0 ? parts.join(' / ') : null;
}

/** 予約済みの通知をすべて取り消す */
export async function cancelReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
