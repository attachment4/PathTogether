import {
  doc, getDoc, setDoc, deleteDoc, collection, getDocs, writeBatch, onSnapshot, deleteField,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Member { id:string; name:string; role:'owner'|'member'; joined:string; }
export type HabitCategory = 'health' | 'sport' | 'mind' | 'work' | 'social' | 'habit';
export interface Habit  { id:string; name:string; icon:string; color:string; days:number[]; time:string; desc?:string; ownerId:string; ownerName:string; createdAt:string; order?:number; target?:number; unit?:string; category?:HabitCategory; type?:'good'|'quit'; timerSeconds?:number; routine?:'morning'|'afternoon'|'evening'; noteEnabled?:boolean; isShared?:boolean; reminderInterval?:number; reminderFrom?:string; reminderTo?:string; requirePartnerConfirm?:boolean; }

/** Подтверждение выполнения привычки партнёром */
export interface HabitConfirmation { habitId:string; date:string; fromId:string; confirmedBy:string; ts:number; }

/** Реакция партнёра на выполнение привычки */
export interface HabitReaction { emoji: string; fromId: string; fromName: string; habitId: string; date: string; ts: number; }
// emoji хранит ReactionKey ('heart' | 'fire' | ...) — не unicode эмодзи
export interface MoodEntry { date: string; mood: 1|2|3|4|5; note?: string; uid: string; }

/** Событие календаря (разовое, привязано к дате). shared — общее с партнёром (хранится в пространстве) */
export interface CalEvent { id: string; date: string /* YYYY-MM-DD */; title: string; time?: string /* HH:MM */; remind?: boolean; createdAt: number; shared?: boolean; ownerId?: string; ownerName?: string; }

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
  // ── События календаря ───────────────────────────────────────────────────
  async getEvents(uid: string): Promise<CalEvent[]> {
    try {
      const local = await LS.get<CalEvent[]>(`events_${uid}`);
      if (Array.isArray(local)) return local;
    } catch {}
    try {
      if (uid && uid !== 'guest') {
        const snap = await getDoc(doc(db, 'users', uid, 'meta', 'calEvents'));
        const list = snap.exists() ? (snap.data() as any).list : null;
        if (Array.isArray(list)) { await LS.set(`events_${uid}`, list); return list; }
      }
    } catch {}
    return [];
  },
  async setEvents(uid: string, events: CalEvent[]): Promise<void> {
    await LS.set(`events_${uid}`, events);
    try {
      if (uid && uid !== 'guest' && auth.currentUser?.uid === uid) {
        await setDoc(doc(db, 'users', uid, 'meta', 'calEvents'), { list: events });
      }
    } catch (e) { console.warn(TAG, 'setEvents', e); }
  },
  // Общие с партнёром события — в пространстве (читают/пишут все участники)
  async getSpaceEvents(spaceId: string): Promise<CalEvent[]> {
    if (!spaceId) return [];
    try {
      const snap = await getDoc(doc(db, 'spaces', spaceId, 'data', 'calEvents'));
      const list = snap.exists() ? (snap.data() as any).list : null;
      if (Array.isArray(list)) { await LS.set(`spevents_${spaceId}`, list); return list; }
    } catch {}
    try { const local = await LS.get<CalEvent[]>(`spevents_${spaceId}`); if (Array.isArray(local)) return local; } catch {}
    return [];
  },
  async setSpaceEvents(spaceId: string, events: CalEvent[]): Promise<void> {
    if (!spaceId) return;
    await LS.set(`spevents_${spaceId}`, events);
    try { await setDoc(doc(db, 'spaces', spaceId, 'data', 'calEvents'), { list: events }); }
    catch (e) { console.warn(TAG, 'setSpaceEvents', e); }
  },
  subscribeSpaceEvents(spaceId: string, cb: (events: CalEvent[]) => void): Unsubscribe | null {
    if (!spaceId) return null;
    try {
      return onSnapshot(doc(db, 'spaces', spaceId, 'data', 'calEvents'), snap => {
        const list = snap.exists() ? (snap.data() as any).list : [];
        cb(Array.isArray(list) ? list : []);
      }, () => {});
    } catch { return null; }
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
      // Если Firestore недоступен — используем кеш (не перезаписываем его null-ом)
      if (profile === null) {
        const [localOnb, localSpace] = await Promise.all([
          LS.get<boolean>(onbKey),
          LS.get<string>(cacheKey),
        ]);
        return { onbDone: !!localOnb, spaceId: localSpace };
      }
      // Обновляем per-user кеш только при успешном ответе Firestore
      await LS.set(onbKey, !!profile.onboarding);
      if (profile.spaceId) await LS.set(cacheKey, profile.spaceId);
      else await LS.set(cacheKey, null);
      return { onbDone: !!profile.onboarding, spaceId: profile.spaceId ?? null };
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

  async deleteInvite(code:string) {
    await deleteDoc(doc(db,'invites',code)).catch(()=>{});
  },
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

  // ── Подтверждения от партнёра ────────────────────────────────────────────
  async saveConfirmation(sid: string, c: HabitConfirmation): Promise<void> {
    const key = `${c.habitId}_${c.date}_confirm`;
    await setDoc(doc(db,'spaces',sid,'confirmations',key), c);
  },
  subscribeConfirmations(sid:string, cb:(c:HabitConfirmation[])=>void): Unsubscribe {
    return onSnapshot(collection(db,'spaces',sid,'confirmations'),
      snap => cb(snap.docs.map(d => d.data() as HabitConfirmation)),
      e => console.warn(TAG,'subscribeConfirmations',e));
  },

  // ── Настроение в пространстве (видно партнёру) ──────────────────────────
  async saveMoodToSpace(sid: string, entry: MoodEntry): Promise<void> {
    const key = `${entry.uid}_${entry.date}`;
    await setDoc(doc(db, 'spaces', sid, 'moods', key), { ...entry, ts: Date.now() }).catch(() => {});
  },
  subscribeSpaceMoods(sid: string, cb: (moods: MoodEntry[]) => void): Unsubscribe {
    return onSnapshot(collection(db, 'spaces', sid, 'moods'),
      snap => cb(snap.docs.map(d => d.data() as MoodEntry)),
      e => console.warn(TAG, 'subscribeSpaceMoods', e));
  },

  // ── Заметки в пространстве (видны партнёру) ─────────────────────────────
  async saveHabitNoteToSpace(sid: string, uid: string, habitId: string, date: string, note: string): Promise<void> {
    const key = `${habitId}_${date}_${uid}`;
    if (note.trim()) {
      await setDoc(doc(db, 'spaces', sid, 'habitNotes', key), { habitId, date, uid, note, ts: Date.now() });
    } else {
      await deleteDoc(doc(db, 'spaces', sid, 'habitNotes', key)).catch(() => {});
    }
  },
  subscribeSpaceNotes(sid: string, cb: (notes: {habitId:string;date:string;uid:string;note:string}[]) => void): Unsubscribe {
    return onSnapshot(collection(db, 'spaces', sid, 'habitNotes'),
      snap => cb(snap.docs.map(d => d.data() as {habitId:string;date:string;uid:string;note:string})),
      e => console.warn(TAG, 'subscribeSpaceNotes', e));
  },

  // ── Фото выполнения ──────────────────────────────────────────────────────
  async saveHabitPhoto(sid:string, habitId:string, date:string, uid:string, photoUri:string): Promise<void> {
    const key = `${habitId}_${date}_${uid}`;
    await setDoc(doc(db,'spaces',sid,'photos',key), { habitId, date, uid, photoUri, ts: Date.now() });
  },
  subscribePhotos(sid:string, cb:(photos:any[])=>void): Unsubscribe {
    return onSnapshot(collection(db,'spaces',sid,'photos'),
      snap => cb(snap.docs.map(d => d.data())),
      e => console.warn(TAG,'subscribePhotos',e));
  },

  // ── Реакции на привычки ──────────────────────────────────────────────────
  async saveReaction(sid: string, r: HabitReaction): Promise<void> {
    const key = `${r.habitId}_${r.date}_${r.fromId}`;
    await setDoc(doc(db,'spaces',sid,'reactions',key), r);
  },
  async deleteReaction(sid: string, habitId: string, date: string, fromId: string): Promise<void> {
    const key = `${habitId}_${date}_${fromId}`;
    await deleteDoc(doc(db,'spaces',sid,'reactions',key));
  },
  subscribeReactions(
    sid: string,
    cb: (reactions: HabitReaction[]) => void,
  ): Unsubscribe {
    return onSnapshot(
      collection(db,'spaces',sid,'reactions'),
      snap => cb(snap.docs.map(d => d.data() as HabitReaction)),
      e => console.warn(TAG, 'subscribeReactions', e),
    );
  },
};
