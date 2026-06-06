/**
 * PathTogether — Push-уведомления через Expo Push Service.
 *
 * Полностью бесплатно, без Cloud Functions, без привязки карты.
 * Схема работы:
 *  1. registerDeviceToken(uid) — при входе получаем Expo Push Token,
 *     сохраняем в Firestore users/{uid}.expoPushToken
 *  2. sendPartnerNotification / sendReactionNotification — читаем токен
 *     партнёра из Firestore и отправляем напрямую через exp.host API
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EAS_PROJECT_ID = '9eb18cbf-9bd3-49e1-b098-b71b0f717b55';

let _Notifications: any = null;
function getN() {
  if (!_Notifications) {
    try { _Notifications = require('expo-notifications'); } catch {}
  }
  return _Notifications;
}

// ─── Регистрация токена ────────────────────────────────────────────────────────

/**
 * Получаем Expo Push Token и сохраняем в Firestore users/{uid}.
 * Вызывается один раз после успешной авторизации.
 */
export async function registerDeviceToken(uid: string): Promise<string | null> {
  if (!uid || uid === 'guest') return null;
  const N = getN();
  if (!N?.getExpoPushTokenAsync) return null;
  try {
    const { status } = await N.getPermissionsAsync();
    if (status !== 'granted') return null;

    const result = await N.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
    const token: string = result?.data ?? '';
    if (!token.startsWith('ExponentPushToken[')) return null;

    await setDoc(
      doc(db, 'users', uid),
      { expoPushToken: token, tokenUpdatedAt: new Date().toISOString() },
      { merge: true },
    );
    return token;
  } catch (e) {
    console.warn('[push] registerDeviceToken', e);
    return null;
  }
}

// ─── Вспомогательные ──────────────────────────────────────────────────────────

async function getPartnerToken(uid: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const token = snap.data()?.expoPushToken ?? null;
    return typeof token === 'string' && token.startsWith('ExponentPushToken[')
      ? token : null;
  } catch { return null; }
}

interface PushPayload {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  categoryIdentifier?: string;
}

async function deliverPush(p: PushPayload): Promise<void> {
  if (!p.to) return;
  try {
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: p.to,
        title: p.title,
        body: p.body,
        sound: 'default',
        channelId: 'partner',
        data: p.data ?? {},
        ...(p.categoryIdentifier ? { categoryIdentifier: p.categoryIdentifier } : {}),
      }),
    });
  } catch (e) { console.warn('[push] deliverPush', e); }
}

// ─── Публичные функции ────────────────────────────────────────────────────────

/**
 * Партнёр выполнил привычку — отправляем пуш с кнопками реакций 👍 ❤️ 🔥
 */
export async function sendPartnerNotification(params: {
  spaceId: string;
  toUid: string;
  fromName: string;
  habitName: string;
  habitId: string;
  lang?: string;
  customBody?: string;
  isConfirmRequest?: boolean;
}): Promise<void> {
  const token = await getPartnerToken(params.toUid);
  if (!token) return;

  const isEn = params.lang === 'en';
  await deliverPush({
    to: token,
    title: params.fromName || 'PathTogether',
    body: params.customBody ?? (isEn
      ? `${params.fromName} completed: ${params.habitName}`
      : `${params.fromName} выполнил: ${params.habitName}`),
    // Для запроса подтверждения — отдельная категория с кнопкой «Подтвердить»
    categoryIdentifier: params.isConfirmRequest ? 'confirm_request' : 'partner_done',
    data: {
      type: params.isConfirmRequest ? 'confirm_request' : 'habit_done',
      habitId: params.habitId,
      habitName: params.habitName,
      fromName: params.fromName,
    },
  });
}

/**
 * Реакция партнёра — уведомляем владельца привычки
 */
export async function sendReactionNotification(params: {
  spaceId: string;
  toUid: string;
  fromName: string;
  emoji: string;
  habitName: string;
  habitId: string;
  lang?: string;
}): Promise<void> {
  const token = await getPartnerToken(params.toUid);
  if (!token) return;

  const isEn = params.lang === 'en';
  await deliverPush({
    to: token,
    title: 'PathTogether',
    body: isEn
      ? `${params.fromName} reacted ${params.emoji} to: ${params.habitName}`
      : `${params.fromName} отреагировал ${params.emoji} на: ${params.habitName}`,
    data: {
      type: 'reaction',
      habitId: params.habitId,
      emoji: params.emoji,
      fromName: params.fromName,
    },
  });
}
