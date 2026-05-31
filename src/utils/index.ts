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

import { Platform, StatusBar } from 'react-native';

/**
 * Высота верхнего safe-area отступа.
 * Используется вместо дублирования этой константы в каждом экране.
 */
export const STATUS_BAR_TOP = Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 24) + 4;
