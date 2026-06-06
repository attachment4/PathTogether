import * as Crypto from 'expo-crypto';

/**
 * Внутренний ID (для документов Firestore: spaceId, habitId).
 * Math.random() здесь приемлем — это не секрет.
 */
export const mkid = () => Math.random().toString(36).slice(2,10) + Date.now().toString(36);

/**
 * Криптостойкий код для **invite-ссылок**.
 * Math.random не подходит — invite-код это секрет, по нему любой
 * становится участником комнаты. ~96 бит энтропии в base32-подобном
 * алфавите без двусмысленных символов (без 0/O, 1/I).
 *
 * ВАЖНО: после `npm install expo-crypto` (см. package.json).
 */
export async function secureCode(byteLen = 12): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(byteLen);
  // Используем безопасный base32-like алфавит без двусмысленных символов
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += ALPHA[bytes[i] % ALPHA.length];
  return out;
}

export const todayS = () => new Date().toISOString().split('T')[0];

export const todayDow = () => (new Date().getDay() + 6) % 7;

export const dateToS = (d: Date) => d.toISOString().split('T')[0];

export const getLast7Days = () => Array.from({length:7}, (_,i) => {
  const d = new Date(); d.setDate(d.getDate() - (6-i)); return dateToS(d);
});

export const getDow = (ds: string) => (new Date(ds+'T12:00:00').getDay() + 6) % 7;

export const isLogged = (hid: string, uid: string, logs: Record<string,boolean>, d?: string) =>
  !!(logs[`${hid}_${d||todayS()}_${uid}`]);

export const calcStreak = (hid: string, uid: string, logs: Record<string,boolean>, days?: number[]) => {
  let streak = 0;
  const MAX_SKIPS_PER_WEEK = 1;
  const d = new Date();
  // Отслеживаем пропуски по ISO-неделям (понедельник = начало недели)
  const weekSkips: Record<string, number> = {};

  const getISOWeek = (date: Date): string => {
    const tmp = new Date(date);
    tmp.setHours(12, 0, 0, 0);
    tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
    const week1 = new Date(tmp.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((tmp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
    return `${tmp.getFullYear()}-W${weekNum}`;
  };

  for (let i = 0; i < 365; i++) {
    const ds = dateToS(d);
    const dow = getDow(ds);
    if (days && !days.includes(dow)) { d.setDate(d.getDate()-1); continue; }
    if (logs[`${hid}_${ds}_${uid}`]) {
      streak++;
    } else if (i === 0) {
      // Сегодня ещё не выполнено — не прерываем серию
    } else {
      // Пропуск — проверяем лимит по КАЛЕНДАРНОЙ неделе
      const wk = getISOWeek(d);
      const usedThisWeek = weekSkips[wk] || 0;
      if (usedThisWeek < MAX_SKIPS_PER_WEEK) {
        weekSkips[wk] = usedThisWeek + 1;
      } else {
        break;
      }
    }
    d.setDate(d.getDate()-1);
  }
  return streak;
};

/**
 * Совместный стрик пары.
 * День считается "совместным" если ОБА участника выполнили хотя бы одну привычку.
 * Пропуск одного дня в неделю прощается (как в индивидуальном стрике).
 */
export const calcJointStreak = (
  memberIds: string[],
  habits: Array<{ id: string; days?: number[] }>,
  logs: Record<string, boolean>,
): number => {
  if (memberIds.length < 2) return 0;

  const getISOWeek = (date: Date): string => {
    const tmp = new Date(date);
    tmp.setHours(12, 0, 0, 0);
    tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
    const week1 = new Date(tmp.getFullYear(), 0, 4);
    const wn = 1 + Math.round(((tmp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
    return `${tmp.getFullYear()}-W${wn}`;
  };

  const activeHabits = habits;
  const bothDoneOnDay = (ds: string): boolean => {
    const dow = getDow(ds);
    // Привычки запланированные на этот день
    const dayHabits = activeHabits.filter(h => !h.days || h.days.includes(dow));
    if (dayHabits.length === 0) return true; // нет привычек — не прерываем
    return memberIds.every(uid =>
      dayHabits.some(h => !!logs[`${h.id}_${ds}_${uid}`])
    );
  };

  let streak = 0;
  const weekSkips: Record<string, number> = {};
  const d = new Date();

  for (let i = 0; i < 365; i++) {
    const ds = dateToS(d);
    if (bothDoneOnDay(ds)) {
      streak++;
    } else if (i === 0) {
      // Сегодня ещё может быть выполнено — не прерываем
    } else {
      const wk = getISOWeek(d);
      if ((weekSkips[wk] || 0) < 1) {
        weekSkips[wk] = (weekSkips[wk] || 0) + 1;
      } else {
        break;
      }
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
};

import { Platform, StatusBar } from 'react-native';

/**
 * Высота верхнего safe-area отступа.
 * Используется вместо дублирования этой константы в каждом экране.
 */
export const STATUS_BAR_TOP = Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 24) + 4;
