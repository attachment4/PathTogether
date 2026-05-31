/**
 * PathTogether — Push-уведомления через expo-notifications
 * Работает только в EAS Build (не в Expo Go).
 * В Expo Go все функции — no-op (silent stubs).
 */
let Notifications: any = null;
const getNotifications = () => {
  if (!Notifications) {
    try { Notifications = require('expo-notifications'); } catch { Notifications = null; }
  }
  return Notifications;
};

const isAvailable = () => {
  const N = getNotifications();
  return N && typeof N.scheduleNotificationAsync === 'function';
};

// Идентификаторы уведомлений для отмены
const IDS = {
  APP_REMINDER:  'app_reminder',
  MORNING:       'morning_motivation',
  EVENING:       'evening_reminder',
  STREAK:        'streak_reminder',
};

export async function setupNotificationChannel(): Promise<void> {
  const N = getNotifications();
  if (!isAvailable()) return;
  try {
    // Android: создаём канал
    if (require('react-native').Platform.OS === 'android') {
      await N.setNotificationChannelAsync('habits', {
        name: 'Привычки',
        importance: N.AndroidImportance.DEFAULT,
        sound: 'default',
      });
      await N.setNotificationChannelAsync('partner', {
        name: 'Партнёр',
        importance: N.AndroidImportance.HIGH,
        sound: 'default',
      });
      await N.setNotificationChannelAsync('reminders', {
        name: 'Напоминания',
        importance: N.AndroidImportance.DEFAULT,
      });
    }
  } catch (e) { console.warn('[notifications] setupChannel', e); }
}

export async function requestPermissions(): Promise<boolean> {
  const N = getNotifications();
  if (!isAvailable()) return false;
  try {
    const { status: existing } = await N.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await N.requestPermissionsAsync();
    return status === 'granted';
  } catch { return false; }
}

export async function scheduleHabitNotifications(
  habits: any[], hasPartner: boolean, enabled: boolean
): Promise<void> {
  const N = getNotifications();
  if (!isAvailable() || !enabled) return;
  try {
    // Отменяем старые habit-уведомления
    const scheduled = await N.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.identifier?.startsWith('habit_')) await N.cancelScheduledNotificationAsync(n.identifier);
    }
    for (const h of habits) {
      if (h.archived || !h.time || !h.days?.length) continue;
      const [hour, minute] = h.time.split(':').map(Number);
      for (const dow of h.days) {
        // dow: 0=пн ... 6=вс; expo weekday: 1=вс ... 7=сб → конвертируем
        const weekday = ((dow + 1) % 7) + 1;
        await N.scheduleNotificationAsync({
          identifier: `habit_${h.id}_${dow}`,
          content: {
            title: h.name,
            body: hasPartner ? 'Время выполнить вместе! 💪' : 'Не забудь о привычке',
            sound: true,
            data: { habitId: h.id },
          },
          trigger: { weekday, hour, minute, repeats: true },
        }).catch(() => {});
      }
    }
  } catch (e) { console.warn('[notifications] scheduleHabit', e); }
}

export async function scheduleHabitTimeNotifications(habits: any[]): Promise<void> {
  await scheduleHabitNotifications(habits, false, true);
}

export async function scheduleAppReminder(hasPartner: boolean, enabled: boolean): Promise<void> {
  const N = getNotifications();
  if (!isAvailable() || !enabled) return;
  try {
    await N.cancelScheduledNotificationAsync(IDS.APP_REMINDER).catch(() => {});
    await N.scheduleNotificationAsync({
      identifier: IDS.APP_REMINDER,
      content: {
        title: hasPartner ? 'Как дела с привычками? 🤝' : 'Пора заглянуть в PathTogether',
        body: hasPartner ? 'Твой партнёр ждёт тебя' : 'Отметь свои привычки за сегодня',
      },
      trigger: { hour: 20, minute: 0, repeats: true },
    });
  } catch (e) { console.warn('[notifications] scheduleAppReminder', e); }
}

export async function scheduleStreakReminder(
  streak: number, hasPartner: boolean, enabled: boolean
): Promise<void> {
  const N = getNotifications();
  if (!isAvailable() || !enabled || streak < 2) return;
  try {
    await N.cancelScheduledNotificationAsync(IDS.STREAK).catch(() => {});
    const body = hasPartner
      ? `Вы с партнёром держите серию ${streak} дней! Не прерывайте 🔥`
      : `${streak} дней подряд — не останавливайся! 🔥`;
    await N.scheduleNotificationAsync({
      identifier: IDS.STREAK,
      content: { title: 'Серия продолжается!', body, sound: true },
      trigger: { seconds: 5 },
    });
  } catch (e) { console.warn('[notifications] scheduleStreak', e); }
}

export async function scheduleMorningMotivation(hasPartner: boolean, enabled: boolean): Promise<void> {
  const N = getNotifications();
  if (!isAvailable() || !enabled) return;
  try {
    await N.cancelScheduledNotificationAsync(IDS.MORNING).catch(() => {});
    await N.scheduleNotificationAsync({
      identifier: IDS.MORNING,
      content: {
        title: hasPartner ? 'Доброе утро! 🌅' : 'Начни день с привычки',
        body: hasPartner ? 'Начните новый день вместе' : 'Маленькие шаги ведут к большим результатам',
      },
      trigger: { hour: 9, minute: 0, repeats: true },
    });
  } catch (e) { console.warn('[notifications] scheduleMorning', e); }
}

export async function scheduleEveningReminder(pendingCount: number, enabled: boolean): Promise<void> {
  const N = getNotifications();
  if (!isAvailable() || !enabled || pendingCount === 0) {
    if (isAvailable()) N.cancelScheduledNotificationAsync(IDS.EVENING).catch(() => {});
    return;
  }
  try {
    await N.cancelScheduledNotificationAsync(IDS.EVENING).catch(() => {});
    await N.scheduleNotificationAsync({
      identifier: IDS.EVENING,
      content: {
        title: 'Ещё не поздно! 🌙',
        body: `Осталось ${pendingCount} ${pendingCount === 1 ? 'привычка' : 'привычки'} на сегодня`,
      },
      trigger: { hour: 21, minute: 30, repeats: false },
    });
  } catch (e) { console.warn('[notifications] scheduleEvening', e); }
}

export async function cancelAllNotifications(): Promise<void> {
  const N = getNotifications();
  if (!isAvailable()) return;
  try { await N.cancelAllScheduledNotificationsAsync(); } catch {}
}

export async function cancelHabitNotifications(habitId: string): Promise<void> {
  const N = getNotifications();
  if (!isAvailable()) return;
  try {
    const all = await N.getAllScheduledNotificationsAsync();
    for (const n of all) {
      if (n.identifier?.startsWith(`habit_${habitId}`)) {
        await N.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
      }
    }
  } catch {}
}

export async function notifyPartnerDone(partnerName: string, habitName: string): Promise<void> {
  const N = getNotifications();
  if (!isAvailable()) return;
  try {
    await N.scheduleNotificationAsync({
      content: {
        title: `${partnerName} выполнил привычку! 🎉`,
        body: habitName,
        sound: true,
        data: { type: 'partner_done' },
      },
      trigger: null,
    });
  } catch (e) { console.warn('[notifications] notifyPartnerDone', e); }
}

export async function notifyAchievement(name: string, lang?: string): Promise<void> {
  const N = getNotifications();
  if (!isAvailable()) return;
  try {
    const title = lang === 'en' ? '🏆 Achievement unlocked!' : '🏆 Достижение разблокировано!';
    await N.scheduleNotificationAsync({
      content: { title, body: name, sound: true },
      trigger: null,
    });
  } catch (e) { console.warn('[notifications] notifyAchievement', e); }
}

export async function setBadgeCount(count: number): Promise<void> {
  const N = getNotifications();
  if (!isAvailable()) return;
  try { await N.setBadgeCountAsync(count); } catch {}
}
