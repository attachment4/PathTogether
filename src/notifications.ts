/**
 * PathTogether — Push-уведомления через expo-notifications
 * Работает только в EAS Build (не в Expo Go).
 * В Expo Go все функции — no-op (silent stubs).
 *
 * Триггеры используют expo-notifications 0.32.x API — обязательное поле type:
 *   'calendar'     — повтор по дню недели/времени
 *   'daily'        — ежедневно в заданное время
 *   'timeInterval' — через N секунд
 *   null           — немедленно
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
    // Android: создаём каналы
    if (require('react-native').Platform.OS === 'android') {
      await N.setNotificationChannelAsync('habits', {
        name: 'Привычки',
        importance: N.AndroidImportance.HIGH,
        sound: 'default',
      });
      await N.setNotificationChannelAsync('partner', {
        name: 'Партнёр',
        importance: N.AndroidImportance.HIGH,
        sound: 'default',
      });
      await N.setNotificationChannelAsync('reminders', {
        name: 'Напоминания',
        importance: N.AndroidImportance.HIGH,
        sound: 'default',
      });
      await N.setNotificationChannelAsync('nudge', {
        name: 'Напоминание партнёру',
        importance: N.AndroidImportance.HIGH,
        sound: 'default',
      });
      await N.setNotificationChannelAsync('achievements', {
        name: 'Достижения',
        importance: N.AndroidImportance.HIGH,
        sound: 'default',
      });
      await N.setNotificationChannelAsync('timer', {
        name: 'Таймер',
        importance: N.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
      });
    }
    // iOS + Android: регистрируем категории
    if (typeof N.setNotificationCategoryAsync === 'function') {
      // Реакции на выполнение привычки
      await N.setNotificationCategoryAsync('partner_done', [
        { identifier: 'react_thumbs', buttonTitle: '👍', options: { opensAppToForeground: false } },
        { identifier: 'react_heart',  buttonTitle: '❤️', options: { opensAppToForeground: false } },
        { identifier: 'react_fire',   buttonTitle: '🔥', options: { opensAppToForeground: false } },
      ]);
      // Запрос подтверждения выполнения
      await N.setNotificationCategoryAsync('confirm_request', [
        { identifier: 'confirm_yes', buttonTitle: '✓ Подтвердить', options: { opensAppToForeground: true } },
      ]);
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
  habits: any[], hasPartner: boolean, enabled: boolean, lang = 'ru'
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
      if (!h.days?.length) continue;

      // ── Интервальные напоминания ──────────────────────────────────────────
      if (h.reminderInterval && h.reminderInterval > 0) {
        const fromH = h.reminderFrom ? parseInt(h.reminderFrom.split(':')[0]) : 8;
        const fromM = h.reminderFrom ? parseInt(h.reminderFrom.split(':')[1] ?? '0') : 0;
        const toH   = h.reminderTo   ? parseInt(h.reminderTo.split(':')[0])   : 22;

        const hours: number[] = [];
        for (let hr = fromH; hr <= toH; hr += h.reminderInterval) {
          hours.push(hr);
        }

        for (const dow of h.days) {
          // expo weekday: 1=вс, 2=пн ... 7=сб; наш dow: 0=пн..6=вс
          const weekday = ((dow + 1) % 7) + 1;
          for (const hr of hours) {
            const notifId = `habit_${h.id}_${dow}_i${hr}`;
            await N.scheduleNotificationAsync({
              identifier: notifId,
              content: {
                title: h.name,
                body: hasPartner ? (lang === 'en' ? '⏰ Time to do it together!' : '⏰ Время выполнить вместе!') : (lang === 'en' ? '⏰ Don\'t forget!' : '⏰ Не забудь!'),
                sound: 'default',
                data: { habitId: h.id },
                ...(require('react-native').Platform.OS === 'android' ? { channelId: 'habits' } : {}),
              },
              trigger: { type: 'calendar', weekday, hour: hr, minute: fromM, repeats: true },
            }).catch(() => {});
          }
        }
        continue;
      }

      // ── Одиночное напоминание по времени ──────────────────────────────────
      if (!h.time) continue;
      const [hour, minute] = h.time.split(':').map(Number);
      for (const dow of h.days) {
        const weekday = ((dow + 1) % 7) + 1;
        await N.scheduleNotificationAsync({
          identifier: `habit_${h.id}_${dow}`,
          content: {
            title: h.name,
            body: hasPartner ? (lang === 'en' ? 'Time to do it together! 💪' : 'Время выполнить вместе! 💪') : (lang === 'en' ? 'Don\'t forget your habit' : 'Не забудь о привычке'),
            sound: 'default',
            data: { habitId: h.id },
            ...(require('react-native').Platform.OS === 'android' ? { channelId: 'habits' } : {}),
          },
          trigger: { type: 'calendar', weekday, hour, minute, repeats: true },
        }).catch(() => {});
      }
    }
  } catch (e) { console.warn('[notifications] scheduleHabit', e); }
}

// Вызывается после сохранения привычки
export async function scheduleHabitTimeNotifications(
  habits: any[],
  hasPartner = false,
  enabled = true,
  lang = 'ru',
): Promise<void> {
  await scheduleHabitNotifications(habits, hasPartner, enabled, lang);
}

export async function scheduleAppReminder(
  hasPartner: boolean, enabled: boolean, timeStr?: string,
): Promise<void> {
  const N = getNotifications();
  if (!isAvailable() || !enabled) {
    if (isAvailable()) N.cancelScheduledNotificationAsync(IDS.APP_REMINDER).catch(() => {});
    return;
  }
  try {
    const [h, m] = (timeStr || '20:00').split(':').map(Number);
    await N.cancelScheduledNotificationAsync(IDS.APP_REMINDER).catch(() => {});
    await N.scheduleNotificationAsync({
      identifier: IDS.APP_REMINDER,
      content: {
        title: hasPartner ? 'Как дела с привычками? 🤝' : 'Пора заглянуть в PathTogether',
        body: hasPartner ? 'Твой партнёр ждёт тебя' : 'Отметь свои привычки за сегодня',
        sound: 'default',
        ...(require('react-native').Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
      },
      trigger: { type: 'daily', hour: h, minute: m || 0 },
    });
  } catch (e) { console.warn('[notifications] scheduleAppReminder', e); }
}

// Разовое напоминание о событии календаря в конкретную дату/время.
// Возвращает id уведомления (для отмены) или null. На web/без EAS — no-op.
export async function scheduleEventReminder(id: string, title: string, when: Date): Promise<string | null> {
  const N = getNotifications();
  if (!isAvailable()) return null;
  if (!(when instanceof Date) || isNaN(when.getTime()) || when.getTime() <= Date.now()) return null;
  try {
    const notifId = 'event_' + id;
    await N.cancelScheduledNotificationAsync(notifId).catch(() => {});
    await N.scheduleNotificationAsync({
      identifier: notifId,
      content: {
        title: '📅 ' + title,
        body: 'Напоминание о событии',
        sound: 'default',
        ...(require('react-native').Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
      },
      trigger: { type: 'date', date: when },
    });
    return notifId;
  } catch (e) { console.warn('[notifications] scheduleEventReminder', e); return null; }
}

export async function cancelEventReminder(id: string): Promise<void> {
  const N = getNotifications();
  if (!isAvailable()) return;
  try { await N.cancelScheduledNotificationAsync('event_' + id).catch(() => {}); } catch {}
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
      content: {
        title: 'Серия продолжается!', body, sound: 'default',
        ...(require('react-native').Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
      },
      trigger: { type: 'timeInterval', seconds: 5, repeats: false },
    });
  } catch (e) { console.warn('[notifications] scheduleStreak', e); }
}

export async function scheduleMorningMotivation(
  hasPartner: boolean, enabled: boolean, timeStr?: string,
): Promise<void> {
  const N = getNotifications();
  if (!isAvailable() || !enabled) {
    if (isAvailable()) N.cancelScheduledNotificationAsync(IDS.MORNING).catch(() => {});
    return;
  }
  try {
    const [h, m] = (timeStr || '09:00').split(':').map(Number);
    await N.cancelScheduledNotificationAsync(IDS.MORNING).catch(() => {});
    await N.scheduleNotificationAsync({
      identifier: IDS.MORNING,
      content: {
        title: hasPartner ? 'Доброе утро! 🌅' : 'Начни день с привычки',
        body: hasPartner ? 'Начните новый день вместе' : 'Маленькие шаги ведут к большим результатам',
        sound: 'default',
        ...(require('react-native').Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
      },
      trigger: { type: 'daily', hour: h, minute: m || 0 },
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
    // Не ставим если уже позже 21:30
    const now = new Date();
    const isAfterTime = now.getHours() > 21 || (now.getHours() === 21 && now.getMinutes() >= 30);
    if (isAfterTime) return;

    await N.cancelScheduledNotificationAsync(IDS.EVENING).catch(() => {});
    await N.scheduleNotificationAsync({
      identifier: IDS.EVENING,
      content: {
        title: 'Ещё не поздно! 🌙',
        body: `Осталось ${pendingCount} ${pendingCount === 1 ? 'привычка' : pendingCount < 5 ? 'привычки' : 'привычек'} на сегодня`,
        sound: 'default',
        ...(require('react-native').Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
      },
      trigger: { type: 'daily', hour: 21, minute: 30 },
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

export async function notifyPartnerDone(
  partnerName: string,
  habitName: string,
  habitId?: string,
): Promise<void> {
  const N = getNotifications();
  if (!isAvailable()) return;
  try {
    await N.scheduleNotificationAsync({
      content: {
        title: `${partnerName} выполнил привычку! 🎉`,
        body: habitName,
        sound: 'default',
        categoryIdentifier: 'partner_done',
        data: { type: 'partner_done', habitId: habitId ?? '', partnerName },
        ...(require('react-native').Platform.OS === 'android' ? { channelId: 'partner' } : {}),
      },
      trigger: null,
    });
  } catch (e) { console.warn('[notifications] notifyPartnerDone', e); }
}

/** Nudge-уведомление: партнёр ещё не отметил привычки */
export async function scheduleNudgeNotification(
  partnerName: string,
  enabled: boolean,
): Promise<void> {
  const N = getNotifications();
  if (!isAvailable() || !enabled) {
    if (isAvailable()) N.cancelScheduledNotificationAsync('nudge_partner').catch(() => {});
    return;
  }
  try {
    await N.cancelScheduledNotificationAsync('nudge_partner').catch(() => {});
    await N.scheduleNotificationAsync({
      identifier: 'nudge_partner',
      content: {
        title: `${partnerName} ещё не отметил сегодня 💬`,
        body: 'Подбодри — небольшой знак внимания творит чудеса',
        sound: 'default',
        data: { type: 'nudge' },
        ...(require('react-native').Platform.OS === 'android' ? { channelId: 'nudge' } : {}),
      },
      trigger: { type: 'daily', hour: 20, minute: 30 },
    });
  } catch (e) { console.warn('[notifications] scheduleNudge', e); }
}

export async function notifyAchievement(name: string, lang?: string): Promise<void> {
  const N = getNotifications();
  if (!isAvailable()) return;
  try {
    const title = lang === 'en' ? '🏆 Achievement unlocked!' : '🏆 Достижение разблокировано!';
    await N.scheduleNotificationAsync({
      content: {
        title, body: name, sound: 'default',
        ...(require('react-native').Platform.OS === 'android' ? { channelId: 'achievements' } : {}),
      },
      trigger: null,
    });
  } catch (e) { console.warn('[notifications] notifyAchievement', e); }
}

export async function setBadgeCount(count: number): Promise<void> {
  const N = getNotifications();
  if (!isAvailable()) return;
  try { await N.setBadgeCountAsync(count); } catch {}
}
