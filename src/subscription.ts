/**
 * PathTogether — система подписок
 *
 * FREE    — бесплатно навсегда
 *   • Безлимитные личные привычки
 *   • Календарь и статистика
 *   • Достижения
 *   • Только соло (без партнёров)
 *
 * DUO     — 129 ₽/мес
 *   • Всё из FREE + общие привычки с 1 партнёром
 *
 * TEAM    — 299 ₽/мес
 *   • Всё из DUO + до 5 участников
 *
 * ADMIN   — бессрочно, все функции
 * EARLY   — первые 10 юзеров, Team на 14 дней бесплатно
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc, runTransaction } from 'firebase/firestore';
import { db } from './firebase';

export type Plan = 'free' | 'duo' | 'team' | 'admin';

export interface Subscription {
  plan: Plan;
  expiresAt: number | null;   // ms timestamp, null = бессрочно
  purchasedAt: number | null;
  isActive: boolean;
  isAdmin: boolean;
  isEarlyBird: boolean;       // первые 10 юзеров
}

// ── UID администраторов (захардкожены + Firestore) ────────────────────────────
// Добавь сюда свои UID из Firebase Console → Authentication
const HARDCODED_ADMINS: string[] = [
  // 'UID_ТВОЕГО_АККАУНТА_1',
  // 'UID_ТВОЕГО_АККАУНТА_2',
];

const EARLY_BIRD_LIMIT = 10;
const EARLY_BIRD_DAYS  = 14;
const LOCAL_KEY        = 'pt_subscription';

// ── Лимиты по планам ─────────────────────────────────────────────────────────
export const PLAN_LIMITS: Record<Plan, {
  maxMembers: number;
  canInvite: boolean;
  canSeePartnerProgress: boolean;
  canJointAchievements: boolean;
  label_ru: string;
  label_en: string;
  price_ru: string;
  price_en: string;
  color: string;
}> = {
  free: {
    maxMembers: 1, canInvite: false,
    canSeePartnerProgress: false, canJointAchievements: false,
    label_ru: 'Бесплатно', label_en: 'Free',
    price_ru: '0 ₽', price_en: 'Free', color: '#888888',
  },
  duo: {
    maxMembers: 2, canInvite: true,
    canSeePartnerProgress: true, canJointAchievements: true,
    label_ru: 'Пара', label_en: 'Couple',
    price_ru: '129 ₽/мес', price_en: '129 ₽/mo', color: '#E879F9',
  },
  team: {
    maxMembers: 5, canInvite: true,
    canSeePartnerProgress: true, canJointAchievements: true,
    label_ru: 'Команда', label_en: 'Team',
    price_ru: '299 ₽/мес', price_en: '299 ₽/mo', color: '#F59E0B',
  },
  admin: {
    maxMembers: 99, canInvite: true,
    canSeePartnerProgress: true, canJointAchievements: true,
    label_ru: 'Admin', label_en: 'Admin',
    price_ru: '∞', price_en: '∞', color: '#444444',
  },
};

// ── Проверка: является ли юзер админом ───────────────────────────────────────
async function checkIsAdmin(uid: string): Promise<boolean> {
  if (HARDCODED_ADMINS.includes(uid)) return true;
  try {
    const snap = await getDoc(doc(db, 'config', 'admins'));
    if (snap.exists()) {
      const uids: string[] = snap.data().uids || [];
      return uids.includes(uid);
    }
  } catch {}
  return false;
}

// ── Early Bird: регистрируем нового юзера, возвращает true если попал ─────────
async function tryRegisterEarlyBird(uid: string): Promise<void> {
  // Early bird check — только чтение, запись через Firebase Admin на сервере
  try {
    const snap = await getDoc(doc(db, 'config', 'early_birds'));
    if (!snap.exists()) return;
    const uids: string[] = snap.data()?.uids || [];
    // Если uid уже в списке — ничего не делаем
    // Запись делается через Cloud Function на сервере
    if (uids.includes(uid)) return;
  } catch { return; }
}

// ── Проверяем статус early bird из Firestore ──────────────────────────────────
async function checkIsEarlyBird(uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'config', 'early_birds'));
    if (snap.exists()) {
      const uids: string[] = snap.data().uids || [];
      return uids.includes(uid);
    }
  } catch {}
  return false;
}

// ── Загрузка подписки ─────────────────────────────────────────────────────────
export async function loadSubscription(uid: string): Promise<Subscription> {
  // 1. Проверяем admin
  const isAdmin = await checkIsAdmin(uid);
  if (isAdmin) {
    const sub: Subscription = {
      plan: 'admin', expiresAt: null, purchasedAt: null,
      isActive: true, isAdmin: true, isEarlyBird: false,
    };
    await _saveLocal(uid, sub);
    return sub;
  }

  // 2. Загружаем сохранённую подписку из Firestore
  let cloudSub: Partial<Subscription> = {};
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const d = snap.data();
      if (d.plan) cloudSub = {
        plan: d.plan, expiresAt: d.planExpiresAt || null,
        purchasedAt: d.planPurchasedAt || null,
      };
    }
  } catch {}

  // 3. Проверяем early bird (новый юзер)
  const isEarlyBird = await checkIsEarlyBird(uid);

  // 4. Строим итоговый объект
  let plan: Plan = (cloudSub.plan as Plan) || 'free';
  let expiresAt = cloudSub.expiresAt || null;
  let purchasedAt = cloudSub.purchasedAt || null;

  // Early bird — автоматически Team на 14 дней при первой регистрации
  if (!isEarlyBird && !cloudSub.plan) {
    const gotEarlyBird = await tryRegisterEarlyBird(uid);
    if (gotEarlyBird) {
      const now = Date.now();
      plan = 'team';
      expiresAt = now + EARLY_BIRD_DAYS * 24 * 60 * 60 * 1000;
      purchasedAt = now;
      // Сохраняем в Firestore
      try {
        await setDoc(doc(db, 'users', uid), {
          plan, planExpiresAt: expiresAt, planPurchasedAt: purchasedAt,
          isEarlyBird: true,
        }, { merge: true });
      } catch {}
    }
  }

  // 5. Проверяем не истекла ли
  const isActive = !expiresAt || expiresAt > Date.now();
  const effectivePlan = isActive ? plan : 'free';

  const sub: Subscription = {
    plan: effectivePlan,
    expiresAt,
    purchasedAt,
    isActive,
    isAdmin: false,
    isEarlyBird: isEarlyBird || (plan === 'team' && !cloudSub.plan),
  };

  await _saveLocal(uid, sub);
  return sub;
}

// ── Активация платного плана ──────────────────────────────────────────────────
export async function activatePlan(uid: string, plan: 'duo' | 'team'): Promise<Subscription> {
  const now = Date.now();
  const expiresAt = now + 30 * 24 * 60 * 60 * 1000;
  try {
    await setDoc(doc(db, 'users', uid), {
      plan, planExpiresAt: expiresAt, planPurchasedAt: now,
    }, { merge: true });
  } catch {}
  const sub: Subscription = {
    plan, expiresAt, purchasedAt: now, isActive: true,
    isAdmin: false, isEarlyBird: false,
  };
  await _saveLocal(uid, sub);
  return sub;
}

// ── Отмена подписки ───────────────────────────────────────────────────────────
export async function cancelPlan(uid: string): Promise<Subscription> {
  try {
    await setDoc(doc(db, 'users', uid), {
      plan: 'free', planExpiresAt: null, planPurchasedAt: null,
    }, { merge: true });
  } catch {}
  const sub = _defaultSub();
  await _saveLocal(uid, sub);
  return sub;
}

// ── Добавить/убрать админа (вызывается из девтулс или скрипта) ────────────────
export async function addAdmin(uid: string): Promise<void> {
  try {
    const ref = doc(db, 'config', 'admins');
    const snap = await getDoc(ref);
    const uids: string[] = snap.exists() ? (snap.data().uids || []) : [];
    if (!uids.includes(uid)) {
      await setDoc(ref, { uids: [...uids, uid] }, { merge: true });
    }
  } catch (e) {
    console.warn('addAdmin error', e);
  }
}

// ── Хелперы ───────────────────────────────────────────────────────────────────
export function canInvite(sub: Subscription): boolean {
  return sub.isActive && PLAN_LIMITS[sub.plan].canInvite;
}

export function canAddMember(sub: Subscription, currentCount: number): boolean {
  return sub.isActive && currentCount < PLAN_LIMITS[sub.plan].maxMembers;
}

export function getDaysLeft(sub: Subscription): number | null {
  if (!sub.expiresAt) return null;
  return Math.max(0, Math.ceil((sub.expiresAt - Date.now()) / (1000 * 60 * 60 * 24)));
}

// ── Приватные ─────────────────────────────────────────────────────────────────
async function _saveLocal(uid: string, sub: Subscription): Promise<void> {
  try {
    await AsyncStorage.setItem(`${LOCAL_KEY}_${uid}`, JSON.stringify(sub));
  } catch {}
}

function _defaultSub(): Subscription {
  return { plan: 'free', expiresAt: null, purchasedAt: null,
    isActive: true, isAdmin: false, isEarlyBird: false };
}
