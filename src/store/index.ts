import {
  doc, getDoc, setDoc, deleteDoc, collection, getDocs, writeBatch, onSnapshot, deleteField,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Member { id:string; name:string; role:'owner'|'member'; joined:string; }
export type HabitCategory = 'health' | 'sport' | 'mind' | 'work' | 'social' | 'habit';
export interface Habit  { id:string; name:string; icon:string; color:string; days:number[]; time:string; desc?:string; ownerId:string; ownerName:string; createdAt:string; order?:number; target?:number; unit?:string; category?:HabitCategory; type?:'good'|'quit'; timerSeconds?:number; archived?:boolean; routine?:'morning'|'afternoon'|'evening'; noteEnabled?:boolean; }
export interface MoodEntry { date: string; mood: 1|2|3|4|5; note?: string; uid: string; }

export interface InviteData { spaceId:string; spaceName:string; creatorId:string; type?:'normal'|'love'; hostPlan?:string; hostMax?:number; }

const TAG = '[Storage]';

// ── AsyncStorage: только UI-настройки (тема, язык, кеш) ─────────────────────
const LS = {
  async get<T>(k:string): Promise<T|null> {
    try { const v = await AsyncStorage.getItem('pt_'+k); return v ? JSON.parse(v) : null; }
    catch (e) { console.warn(TAG, 'LS.get', k, e); return null; }
  },
  async set(k:string, v:any) {
    try { await AsyncStorage.setItem('pt_'+k, JSON.stringify(v)); }
    catch (e) { console.warn(TAG, 'LS.set', k, e); }
  },
};

// ── Firestore: профиль юзера — переживает переустановку ─────────────────────
// Документ users/{uid} содержит { onboarding: true, spaceId: "..." }
// Восстанавливается автоматически при повторном входе в аккаунт.
interface UserProfile { onboarding?: boolean; spaceId?: string; lang?: string; }

const FS = {
  async getProfile(uid: string): Promise<UserProfile | null> {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      return snap.exists() ? snap.data() as UserProfile : null;
    } catch (e) { console.warn(TAG, 'getProfile', e); return null; }
  },
  async setProfile(uid: string, data: Partial<UserProfile>) {
    try { await setDoc(doc(db, 'users', uid), data, { merge: true }); }
    catch (e) { console.warn(TAG, 'setProfile', e); }
  },
};

export const Storage = {
  async get<T>(k:string): Promise<T|null> { return LS.get<T>(k); },
  async set(k:string, v:any) { await LS.set(k, v); },

  // UI prefs — AsyncStorage достаточно, при переустановке сбросятся к дефолту
  async loadName():        Promise<string|null>         { return LS.get('name'); },
  async loadAvatar():      Promise<string|null>         { return LS.get('avatar'); },
  async saveAvatar(uri:string)                          { await LS.set('avatar', uri); },
  async saveName(n:string)                              { await LS.set('name', n); },
  async loadTheme():       Promise<'dark'|'light'|null> { return LS.get('theme'); },
  async saveTheme(t:string)                             { await LS.set('theme', t); },
  async loadLanguage():    Promise<string|null>         { return LS.get('lang'); },
  async saveLanguage(l:string) {
    await LS.set('lang', l);
    const uid = auth.currentUser?.uid;
    if (uid) await FS.setProfile(uid, { lang: l }).catch(() => {});
  },
  async saveNotifTimeMorning(t:string)                  { await LS.set('notif_morning', t); },
  async saveNotifTimeEvening(t:string)                  { await LS.set('notif_evening', t); },
  async loadNotifTimeMorning():Promise<string>           { return (await LS.get<string>('notif_morning')) || '12:00'; },
  async loadNotifTimeEvening():Promise<string>           { return (await LS.get<string>('notif_evening')) || '18:00'; },

  // ── Онбординг: Firestore + локальный кеш ────────────────────────────────
  async loadOnboarding(uid?: string): Promise<boolean> {
    // 1. Быстрый локальный кеш (не идём в сеть если уже есть)
    const local = await LS.get<boolean>('onboarding_done');
    if (local) return true;
    // 2. После переустановки — достаём из Firestore
    const id = uid || auth.currentUser?.uid;
    if (!id) return false;
    const profile = await FS.getProfile(id);
    if (profile?.onboarding) {
      await LS.set('onboarding_done', true); // кешируем чтобы больше не ходить в сеть
      return true;
    }
    return false;
  },
  // ── Заметки к привычкам: AsyncStorage (кеш) + Firestore (backup) ────────
  async getNote(uid: string, habitId: string, date: string): Promise<string> {
    try {
      const local = await AsyncStorage.getItem(`pt_note_${habitId}_${date}_${uid}`);
      if (local !== null) return local;
      // Fallback: Firestore (после переустановки)
      const snap = await getDoc(doc(db, 'users', uid, 'notes', `${habitId}_${date}`));
      const value = snap.exists() ? (snap.data().text || '') : '';
      if (value) await AsyncStorage.setItem(`pt_note_${habitId}_${date}_${uid}`, value);
      return value;
    } catch { return ''; }
  },
  async setNote(uid: string, habitId: string, date: string, note: string): Promise<void> {
    try {
      await AsyncStorage.setItem(`pt_note_${habitId}_${date}_${uid}`, note);
      // Сохраняем в Firestore — переживёт переустановку
      await setDoc(doc(db, 'users', uid, 'notes', `${habitId}_${date}`), { text: note, updatedAt: Date.now() });
    } catch {}
  },
  async getNotesForHabit(uid: string, habitId: string, dates: string[]): Promise<Record<string, string>> {
    try {
      const results = await Promise.all(dates.map(async d => ({
        date: d, note: await AsyncStorage.getItem(`pt_note_${habitId}_${d}_${uid}`) || ''
      })));
      return Object.fromEntries(results.filter(r => r.note).map(r => [r.date, r.note]));
    } catch { return {}; }
  },

  // ── Настроение: AsyncStorage (кеш) + Firestore (backup) ─────────────────
  async getMood(uid: string, date: string): Promise<MoodEntry|null> {
    try {
      const local = await AsyncStorage.getItem(`pt_mood_${uid}_${date}`);
      if (local !== null) return JSON.parse(local);
      // Fallback: Firestore (после переустановки)
      const snap = await getDoc(doc(db, 'users', uid, 'mood', date));
      if (!snap.exists()) return null;
      const entry = snap.data() as MoodEntry;
      await AsyncStorage.setItem(`pt_mood_${uid}_${date}`, JSON.stringify(entry));
      return entry;
    } catch { return null; }
  },
  async setMood(entry: MoodEntry): Promise<void> {
    await AsyncStorage.setItem(`pt_mood_${entry.uid}_${entry.date}`, JSON.stringify(entry));
    // Сохраняем в Firestore — переживёт переустановку
    await setDoc(doc(db, 'users', entry.uid, 'mood', entry.date), entry).catch(() => {});
  },
  async getMoodRange(uid: string, dates: string[]): Promise<MoodEntry[]> {
    try {
      const results = await Promise.all(dates.map(d => AsyncStorage.getItem(`pt_mood_${uid}_${d}`)));
      return results.filter(Boolean).map(v => JSON.parse(v!));
    } catch { return []; }
  },
  async saveOnboarding() {
    const uid = auth.currentUser?.uid;
    if (uid) await LS.set(`onboarding_${uid}`, true);
    // legacy key for offline fallback compatibility
    await LS.set('onboarding_done', true);
    if (uid) await FS.setProfile(uid, { onboarding: true });
  },

  // ── spaceId: Firestore + локальный кеш ──────────────────────────────────
  async loadCurrentSpace(uid?: string): Promise<string|null> {
    const id = uid || auth.currentUser?.uid;
    if (!id) return null;
    // Ключ всегда per-user — исключает утечку space_id между аккаунтами на одном устройстве
    const cacheKey = `space_id_${id}`;
    const local = await LS.get<string>(cacheKey);
    if (local) return local;
    // После переустановки — из Firestore (источник истины)
    const profile = await FS.getProfile(id);
    if (profile?.spaceId) {
      await LS.set(cacheKey, profile.spaceId);
      return profile.spaceId;
    }
    return null;
  },
  async saveCurrentSpace(id: string, explicitUid?: string) {
    const uid = explicitUid || auth.currentUser?.uid;
    if (uid) {
      await LS.set(`space_id_${uid}`, id); // per-user ключ
      await FS.setProfile(uid, { spaceId: id });
    } else {
      console.warn('[Storage] saveCurrentSpace: no uid available, space_id not persisted to Firestore');
    }
  },

  /** Полностью очищает привязку к пространству (AsyncStorage + Firestore профиль) */
  async clearSpaceId(uid?: string) {
    const id = uid || auth.currentUser?.uid;
    if (id) {
      await LS.set(`space_id_${id}`, null);
      await FS.setProfile(id, { spaceId: deleteField() as any }).catch(() => {});
    }
    // Также чистим устаревший глобальный ключ (legacy migration)
    await LS.set('space_id', null);
  },

  // ── Firestore reads ──────────────────────────────────────────────────────
  // ── Комбинированная загрузка сессии (onboarding + spaceId за один вызов) ─
  async loadUserSession(uid: string): Promise<{ onbDone: boolean; spaceId: string | null }> {
    const cacheKey = `space_id_${uid}`;
    const onbKey   = `onboarding_${uid}`;
    try {
      // Всегда читаем из Firestore — это источник истины для конкретного uid
      // Таймаут 5 сек — если Firestore недоступен, используем кеш
      const profile = await Promise.race([
        FS.getProfile(uid),
        new Promise<null>((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
      ]).catch(() => null);
      // Обновляем per-user кеш
      if (profile?.onboarding) await LS.set(onbKey, true);
      else await LS.set(onbKey, false);
      if (profile?.spaceId) await LS.set(cacheKey, profile.spaceId);
      else await LS.set(cacheKey, null);
      return { onbDone: !!profile?.onboarding, spaceId: profile?.spaceId ?? null };
    } catch (e) {
      console.warn('[Storage]', 'loadUserSession', e);
      // При ошибке сети — per-user кеш (НЕ глобальный space_id)
      const [localOnb, localSpace] = await Promise.all([
        LS.get<boolean>(onbKey),
        LS.get<string>(cacheKey),
      ]);
      return { onbDone: !!localOnb, spaceId: localSpace };
    }
  },

  async getHabits(sid:string): Promise<Habit[]> {
    try {
      const snap = await getDocs(collection(db,'spaces',sid,'habits'));
      return snap.docs.map(d => ({ id:d.id, ...d.data() } as Habit));
    } catch (e) { console.warn(TAG, 'getHabits', e); return []; }
  },
  async getLogs(sid:string): Promise<Record<string,boolean>> {
    try {
      const snap = await getDoc(doc(db,'spaces',sid,'data','logs'));
      return snap.exists() ? (snap.data().v || {}) : {};
    } catch (e) { console.warn(TAG, 'getLogs', e); return {}; }
  },
  async getMembers(sid:string): Promise<Member[]> {
    try {
      const snap = await getDoc(doc(db,'spaces',sid,'data','members'));
      return snap.exists() ? (snap.data().v || []) : [];
    } catch (e) { console.warn(TAG, 'getMembers', e); return []; }
  },
  async getMeta(sid:string): Promise<{name:string; type?:'normal'|'love'}|null> {
    try {
      const snap = await getDoc(doc(db,'spaces',sid,'data','meta'));
      return snap.exists() ? snap.data() as any : null;
    } catch (e) { console.warn(TAG, 'getMeta', e); return null; }
  },
  async getInvite(code:string): Promise<InviteData|null> {
    try {
      const snap = await getDoc(doc(db,'invites',code));
      return snap.exists() ? snap.data() as InviteData : null;
    } catch (e) { console.warn(TAG, 'getInvite', e); return null; }
  },

  // ── Firestore writes ─────────────────────────────────────────────────────
  async setHabits(sid:string, habits:Habit[]) {
    const batch = writeBatch(db);
    const snap = await getDocs(collection(db,'spaces',sid,'habits'));
    const newIds = new Set(habits.map(h => h.id));
    snap.docs.forEach(d => { if (!newIds.has(d.id)) batch.delete(d.ref); });
    habits.forEach(h => batch.set(doc(db,'spaces',sid,'habits',h.id), h));
    await batch.commit();
  },
  async upsertHabit(sid:string, h:Habit) { await setDoc(doc(db,'spaces',sid,'habits',h.id), h); },
  async deleteHabitDoc(sid:string, hid:string) { await deleteDoc(doc(db,'spaces',sid,'habits',hid)); },
  async setLogs(sid:string, logs:Record<string,boolean>) { await setDoc(doc(db,'spaces',sid,'data','logs'), { v: logs }); },
  async setMembers(sid:string, members:Member[]) {
    await setDoc(doc(db,'spaces',sid,'data','members'), {
      v: members,
      memberIds: members.map(m => m.id),
      ownerIds:  members.filter(m => m.role === 'owner').map(m => m.id),
    });
  },
  async setMeta(sid:string, meta:{name:string; type?:'normal'|'love'}) { await setDoc(doc(db,'spaces',sid,'data','meta'), meta); },

  async setInvite(code:string, data:InviteData) {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('setInvite: not authenticated');
    if (data.creatorId !== uid) throw new Error('setInvite: creatorId must match current user');
    await setDoc(doc(db,'invites',code), {
      ...data,
      createdAt: Date.now(),
      // Инвайт действителен 7 дней
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
  },

  // ── Firestore subscriptions (realtime) ───────────────────────────────────
  subscribeHabits(sid:string, cb:(h:Habit[])=>void): Unsubscribe {
    return onSnapshot(collection(db,'spaces',sid,'habits'),
      snap => cb(snap.docs.map(d => ({ id:d.id, ...d.data() } as Habit))),
      e => console.warn(TAG, 'subscribeHabits', e));
  },
  subscribeLogs(sid:string, cb:(logs:Record<string,boolean>)=>void): Unsubscribe {
    return onSnapshot(doc(db,'spaces',sid,'data','logs'),
      snap => cb(snap.exists() ? (snap.data().v || {}) : {}),
      e => console.warn(TAG, 'subscribeLogs', e));
  },
  subscribeMembers(sid:string, cb:(m:Member[])=>void): Unsubscribe {
    return onSnapshot(doc(db,'spaces',sid,'data','members'),
      snap => cb(snap.exists() ? (snap.data().v || []) : []),
      e => console.warn(TAG, 'subscribeMembers', e));
  },
  subscribeMeta(sid:string, cb:(m:{name:string;type?:'normal'|'love'}|null)=>void): Unsubscribe {
    return onSnapshot(doc(db,'spaces',sid,'data','meta'),
      snap => cb(snap.exists() ? snap.data() as any : null),
      e => console.warn(TAG, 'subscribeMeta', e));
  },
};
