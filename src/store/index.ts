import {
  doc, getDoc, setDoc, deleteDoc, collection, getDocs, writeBatch, onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Member { id:string; name:string; role:'owner'|'member'; joined:string; }
export type HabitCategory = 'health' | 'sport' | 'mind' | 'work' | 'social' | 'habit';
export interface Habit  { id:string; name:string; icon:string; color:string; days:number[]; time:string; desc?:string; ownerId:string; ownerName:string; createdAt:string; order?:number; target?:number; unit?:string; category?:HabitCategory; type?:'good'|'quit'; timerSeconds?:number; archived?:boolean; routine?:'morning'|'afternoon'|'evening'; noteEnabled?:boolean; }
export interface MoodEntry { date: string; mood: 1|2|3|4|5; note?: string; uid: string; }

export interface InviteData { spaceId:string; spaceName:string; creatorId:string; type?:'normal'|'love'; }

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
interface UserProfile { onboarding?: boolean; spaceId?: string; }

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
  async saveLanguage(l:string)                          { await LS.set('lang', l); },
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
  async getNote(uid: string, habitId: string, date: string): Promise<string> {
    try { const v = await AsyncStorage.getItem(`note_${habitId}_${date}_${uid}`); return v || ''; } catch { return ''; }
  },
  async setNote(uid: string, habitId: string, date: string, note: string): Promise<void> {
    try { await AsyncStorage.setItem(`note_${habitId}_${date}_${uid}`, note); } catch {}
  },
  async getNotesForHabit(uid: string, habitId: string, dates: string[]): Promise<Record<string, string>> {
    try {
      const results = await Promise.all(dates.map(async d => ({
        date: d, note: await AsyncStorage.getItem(`note_${habitId}_${d}_${uid}`) || ''
      })));
      return Object.fromEntries(results.filter(r => r.note).map(r => [r.date, r.note]));
    } catch { return {}; }
  },
  async getMood(uid: string, date: string): Promise<MoodEntry|null> {
    try { const v = await AsyncStorage.getItem(`mood_${uid}_${date}`); return v ? JSON.parse(v) : null; } catch { return null; }
  },
  async setMood(entry: MoodEntry): Promise<void> {
    await AsyncStorage.setItem(`mood_${entry.uid}_${entry.date}`, JSON.stringify(entry));
  },
  async getMoodRange(uid: string, dates: string[]): Promise<MoodEntry[]> {
    try {
      const results = await Promise.all(dates.map(d => AsyncStorage.getItem(`mood_${uid}_${d}`)));
      return results.filter(Boolean).map(v => JSON.parse(v!));
    } catch { return []; }
  },
  async saveOnboarding() {
    await LS.set('onboarding_done', true);
    const uid = auth.currentUser?.uid;
    if (uid) await FS.setProfile(uid, { onboarding: true });
  },

  // ── spaceId: Firestore + локальный кеш ──────────────────────────────────
  async loadCurrentSpace(uid?: string): Promise<string|null> {
    // 1. Локальный кеш
    const local = await LS.get<string>('space_id');
    if (local) return local;
    // 2. После переустановки — из Firestore
    const id = uid || auth.currentUser?.uid;
    if (!id) return null;
    const profile = await FS.getProfile(id);
    if (profile?.spaceId) {
      await LS.set('space_id', profile.spaceId); // кешируем
      return profile.spaceId;
    }
    return null;
  },
  async saveCurrentSpace(id: string) {
    await LS.set('space_id', id);
    const uid = auth.currentUser?.uid;
    if (uid) await FS.setProfile(uid, { spaceId: id });
  },

  // ── Firestore reads ──────────────────────────────────────────────────────
  // ── Комбинированная загрузка сессии (onboarding + spaceId за один вызов) ─
  async loadUserSession(uid: string): Promise<{ onbDone: boolean; spaceId: string | null }> {
    try {
      // Всегда читаем из Firestore — это источник истины для конкретного uid
      // AsyncStorage может содержать данные другого аккаунта с этого устройства
      // Таймаут 5 сек — если Firestore недоступен, используем кеш
      const profile = await Promise.race([
        FS.getProfile(uid),
        new Promise<null>((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
      ]).catch(() => null);
      // Обновляем локальный кеш под этот uid
      if (profile?.onboarding) await LS.set('onboarding_done', true);
      else await LS.set('onboarding_done', false);
      if (profile?.spaceId) await LS.set('space_id', profile.spaceId);
      else await LS.set('space_id', null);
      return { onbDone: !!profile?.onboarding, spaceId: profile?.spaceId ?? null };
    } catch (e) {
      console.warn('[Storage]', 'loadUserSession', e);
      // При ошибке сети — пробуем локальный кеш как fallback
      const [localOnb, localSpace] = await Promise.all([
        LS.get<boolean>('onboarding_done'),
        LS.get<string>('space_id'),
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
  async setMembers(sid:string, members:Member[]) { await setDoc(doc(db,'spaces',sid,'data','members'), { v: members }); },
  async setMeta(sid:string, meta:{name:string; type?:'normal'|'love'}) { await setDoc(doc(db,'spaces',sid,'data','meta'), meta); },

  async setInvite(code:string, data:InviteData) {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('setInvite: not authenticated');
    if (data.creatorId !== uid) throw new Error('setInvite: creatorId must match current user');
    await setDoc(doc(db,'invites',code), data);
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
