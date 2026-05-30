import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, runTransaction } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Storage, Habit, Member } from '../store';
import { mkid, secureCode, todayS, todayDow, isLogged, calcStreak } from '../utils';

export interface Room {
  id: string;
  name: string;
  type: 'normal' | 'love';
  habits: Habit[];
  logs: Record<string, boolean>;
  members: Member[];
}

export function useRoom(myId: string, myName: string) {
  const [room, setRoom] = useState<Room | null>(null);

  // ── Real-time подписка вместо setInterval-поллинга ──────────────────────
  // Firestore onSnapshot обновляет UI мгновенно при изменениях, не сжигает
  // квоту чтениями каждые 4с и не разряжает батарею.
  useEffect(() => {
    if (!room?.id) return;
    const sid = room.id;

    const unsubs = [
      Storage.subscribeHabits(sid, habits =>
        setRoom(p => (p && p.id === sid ? { ...p, habits } : p))),
      Storage.subscribeLogs(sid, logs =>
        setRoom(p => (p && p.id === sid ? { ...p, logs } : p))),
      Storage.subscribeMembers(sid, members =>
        setRoom(p => (p && p.id === sid ? { ...p, members } : p))),
      Storage.subscribeMeta(sid, meta =>
        setRoom(p => (p && p.id === sid
          ? { ...p, type: (meta?.type as any) || p.type, name: meta?.name || p.name }
          : p))),
    ];

    return () => { unsubs.forEach(u => u()); };
  }, [room?.id]);

  // ── Load (одноразовая загрузка для inits, без подписки) ────────────────
  const loadRoom = useCallback(async (sid: string) => {
    const [habits, logs, members, meta] = await Promise.all([
      Storage.getHabits(sid),
      Storage.getLogs(sid),
      Storage.getMembers(sid),
      Storage.getMeta(sid),
    ]);
    setRoom(prev => ({
      ...prev,
      id: sid,
      habits,
      logs,
      members,
      type: (meta?.type as any) || 'normal',
      name: meta?.name || prev?.name || '',
    }));
  }, []);

  const openRoom = (sp: { id: string; name: string; type: string }) => {
    setRoom({ id: sp.id, name: sp.name, type: sp.type as any, habits: [], logs: {}, members: [] });
  };

  const closeRoom = () => setRoom(null);

  // ── Создание комнаты ────────────────────────────────────────────────────
  const createRoom = async (name: string, type: 'normal' | 'love'): Promise<string> => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('createRoom: not authenticated');
    const sid = mkid();
    const code = await secureCode();
    const members: Member[] = [{ id: myId, name: myName, role: 'owner', joined: todayS() }];
    await Promise.all([
      Storage.setHabits(sid, []),
      Storage.setLogs(sid, {}),
      Storage.setMembers(sid, members),
      Storage.setMeta(sid, { type, name }),
      Storage.setInvite(code, { spaceId: sid, spaceName: name, type, creatorId: uid }),
    ]);
    return code;
  };

  // ── Вступление по инвайту ──────────────────────────────────────────────
  // Транзакция гарантирует, что одновременное вступление двух юзеров
  // не приведёт к lost-update (read-mutate-write antipattern был раньше).
  const joinRoom = async (
    code: string,
  ): Promise<{ spaceId: string; spaceName: string; type: string } | null> => {
    const inv = await Storage.getInvite(code);
    if (!inv) return null;

    const ref = doc(db, 'spaces', inv.spaceId, 'data', 'members');
    await runTransaction(db, async tx => {
      const snap = await tx.get(ref);
      const current: Member[] = snap.exists() ? (snap.data().v || []) : [];
      if (current.find(m => m.id === myId)) return;
      tx.set(ref, {
        v: [...current, { id: myId, name: myName, role: 'member' as const, joined: todayS() }],
      });
    });

    return { spaceId: inv.spaceId, spaceName: inv.spaceName, type: inv.type || 'normal' };
  };

  // ── Генерация ссылки для уже существующей комнаты ──────────────────────
  const generateInviteCode = async (): Promise<string> => {
    if (!room) return '';
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('generateInviteCode: not authenticated');
    const code = await secureCode();
    await Storage.setInvite(code, {
      spaceId: room.id,
      spaceName: room.name,
      type: room.type,
      creatorId: uid,
    });
    return code;
  };

  // ── Сохранение привычек ────────────────────────────────────────────────
  // Не делаем оптимистичное обновление local state — onSnapshot подтянет
  // изменение сам. Это убирает класс багов с расхождением UI и БД.
  const saveHabits = async (habits: Habit[]) => {
    if (!room) return;
    await Storage.setHabits(room.id, habits);
  };

  const saveLogs = async (logs: Record<string, boolean>) => {
    if (!room) return;
    await Storage.setLogs(room.id, logs);
  };

  // ── Добавить / обновить привычку ───────────────────────────────────────
  const upsertHabit = async (
    nh: Omit<Habit, 'id' | 'ownerId' | 'ownerName' | 'createdAt'>,
    editId?: string,
  ) => {
    if (!room) return;
    const id = editId || mkid();
    const existing = room.habits.find(h => h.id === editId);
    const habit: Habit = existing
      ? { ...existing, ...nh }
      : { ...nh, id, ownerId: myId, ownerName: myName, createdAt: todayS() };
    // Granular upsert вместо переписывания всей коллекции — race-friendly.
    await Storage.upsertHabit(room.id, habit);
  };

  // ── Удалить привычку ───────────────────────────────────────────────────
  const deleteHabit = async (id: string) => {
    if (!room) return;
    await Storage.deleteHabitDoc(room.id, id);
    // Чистим относящиеся к этой привычке логи
    const logs = { ...room.logs };
    Object.keys(logs).filter(k => k.startsWith(id + '_')).forEach(k => delete logs[k]);
    await saveLogs(logs);
  };

  // ── Отметить / снять привычку ──────────────────────────────────────────
  const toggleHabit = async (habitId: string) => {
    const key = `${habitId}_${todayS()}_${myId}`;
    const logs = { ...room?.logs };
    if (logs[key]) delete logs[key];
    else logs[key] = true;
    await saveLogs(logs);
  };

  // ── Helpers ────────────────────────────────────────────────────────────
  const logged = (habitId: string, uid: string = myId, date?: string) =>
    isLogged(habitId, uid, room?.logs || {}, date);

  const getStreak = (habitId: string, uid: string = myId) =>
    calcStreak(habitId, uid, room?.logs || {});

  const todayHabits = (room?.habits || []).filter(h => h.days?.includes(todayDow()));

  return {
    room, openRoom, closeRoom,
    createRoom, joinRoom, generateInviteCode,
    upsertHabit, deleteHabit, toggleHabit,
    logged, getStreak,
    todayHabits,
    loadRoom,
  };
}
