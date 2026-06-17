import React, { useState } from 'react';
import * as Haptics from 'expo-haptics';
import { View, Platform, StatusBar, Text, ScrollView, TouchableOpacity, Modal, Image, TextInput } from 'react-native';
import { Theme, MONTHS_RU, MONTHS_EN, WD_RU, WD_EN } from '../theme';
import { tr } from '../i18n';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { Habit, Member, Storage, CalEvent } from '../store';
import { scheduleEventReminder, cancelEventReminder } from '../notifications';
import { TimePicker } from '../components/TimePicker';
import { isLogged, dateToS } from '../utils';

// Локализация
// SVG-иконки для стартовых привычек (те же что в TodayScreen)
function HabitSvgIcon({ icon, color }: { icon: string; color: string }) {
  const s = { stroke: color, strokeWidth: '1.5', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  if (icon === 'exercise') return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" {...s}/>
    </Svg>
  );
  if (icon === 'read') return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M2 6s1.5-2 5-2 5 2 5 2v14s-1.5-1-5-1-5 1-5 1V6z" {...s}/>
      <Path d="M12 6s1.5-2 5-2 5 2 5 2v14s-1.5-1-5-1-5 1-5 1V6z" {...s}/>
    </Svg>
  );
  if (icon === 'water') return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2L6 10a6 6 0 1 0 12 0L12 2z" {...s}/>
    </Svg>
  );
  if (icon === 'meditate') return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="6" r="2.5" {...s}/>
      <Path d="M5 20c0-4 3-6 7-6s7 2 7 6" {...s}/>
      <Path d="M3 16c1-1 2.5-1.5 4-1M21 16c-1-1-2.5-1.5-4-1" {...s}/>
    </Svg>
  );
  if (icon === 'nosocial') return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Rect x="5" y="2" width="14" height="20" rx="2" {...s}/>
      <Line x1="4" y1="4" x2="20" y2="20" {...s}/>
    </Svg>
  );
  if (icon === 'walk') return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="4" r="1.5" {...s}/>
      <Path d="M9 9l3-2 3 2-1 4-2 1-2-1-1-4z" {...s}/>
      <Path d="M8 22l2-5 2 2 2-2 2 5" {...s}/>
      <Path d="M7 14l-2 1M17 14l2 1" {...s}/>
    </Svg>
  );
  return null;
}
const KNOWN_SVG_ICONS = ['exercise','read','water','meditate','nosocial','walk'];

interface Props {
  myId: string; lang: string; tk: Theme;
  habits: Habit[]; members: Member[]; logs: Record<string,boolean>;
  spaceId?: string;
  photos?: any[];
  initialDate?: Date | null;
  onToggleLog?: (hid: string, dateStr: string) => Promise<void>;
}

type ViewMode = 'month' | 'week';

export default function CalendarScreen({ myId, lang, tk, habits, members, logs, spaceId, photos = [], initialDate, onToggleLog }: Props) {
  const isEn = lang === 'en';
  const L = (ru: string, en: string, uk?: string, be?: string, kk?: string) =>
    lang==='en' ? en : lang==='uk' ? (uk||ru) : lang==='be' ? (be||ru) : lang==='kk' ? (kk||ru) : ru;
  const now = new Date();
  const init = initialDate instanceof Date && !isNaN(initialDate.getTime()) ? initialDate : now;
  const [month, setMonth] = useState(init.getMonth());
  const [year, setYear]   = useState(init.getFullYear());
  const [selDay, setSelDay] = useState<number | null>(init.getDate());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [editingLog, setEditingLog] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string|null>(null);
  // Локальный оптимистичный стейт логов — обновляется мгновенно, до Firestore
  const [localLogs, setLocalLogs] = useState<Record<string,boolean>>(logs);

  // Синхронизируем localLogs когда приходят новые данные из Firestore
  React.useEffect(() => { setLocalLogs(logs); }, [logs]);

  // ── События календаря (личные + общие с партнёром) ────────────────────────
  const [myEvents, setMyEvents] = useState<CalEvent[]>([]);
  const [spEvents, setSpEvents] = useState<CalEvent[]>([]);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showEvTimePicker, setShowEvTimePicker] = useState(false);
  const [habitsOpen, setHabitsOpen] = useState(false);
  const [evTitle, setEvTitle] = useState('');
  const [evTime, setEvTime] = useState('');
  const [evRemind, setEvRemind] = useState(true);
  const [evShared, setEvShared] = useState(false);
  const hasPartner = members.filter(m => m && m.id !== myId).length > 0;

  React.useEffect(() => { Storage.getEvents(myId).then(setMyEvents).catch(() => {}); }, [myId]);
  React.useEffect(() => {
    if (!spaceId) { setSpEvents([]); return; }
    Storage.getSpaceEvents(spaceId).then(setSpEvents).catch(() => {});
    const unsub = Storage.subscribeSpaceEvents(spaceId, setSpEvents);
    return () => { if (unsub) unsub(); };
  }, [spaceId]);

  const events: CalEvent[] = [
    ...myEvents.map(e => ({ ...e, shared: false })),
    ...spEvents.map(e => ({ ...e, shared: true })),
  ];
  const eventsForDay = (dateStr: string) =>
    events.filter(e => e.date === dateStr).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));

  const addEvent = async () => {
    if (selDay == null || !evTitle.trim()) return;
    const dateStr = ds(selDay);
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const time = /^\d{2}:\d{2}$/.test(evTime.trim()) ? evTime.trim() : undefined;
    const ev: CalEvent = { id, date: dateStr, title: evTitle.trim(), time, remind: evRemind, createdAt: Date.now() };
    if (evShared && spaceId && hasPartner) {
      ev.ownerId = myId;
      ev.ownerName = members.find(m => m && m.id === myId)?.name || '';
      const list = [...spEvents, ev];
      setSpEvents(list); await Storage.setSpaceEvents(spaceId, list);
    } else {
      const list = [...myEvents, ev];
      setMyEvents(list); await Storage.setEvents(myId, list);
    }
    if (evRemind && time) {
      const [hh, mm] = time.split(':').map(Number);
      scheduleEventReminder(id, ev.title, new Date(year, month, selDay, hh || 0, mm || 0, 0)).catch(() => {});
    }
    setEvTitle(''); setEvTime(''); setEvRemind(true); setEvShared(false); setShowAddEvent(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };
  const deleteEvent = async (ev: CalEvent) => {
    if (ev.shared && spaceId) {
      const list = spEvents.filter(e => e.id !== ev.id);
      setSpEvents(list); await Storage.setSpaceEvents(spaceId, list);
    } else {
      const list = myEvents.filter(e => e.id !== ev.id);
      setMyEvents(list); await Storage.setEvents(myId, list);
    }
    cancelEventReminder(ev.id).catch(() => {});
  };

  const handleToggleLog = async (hid: string, dateStr: string) => {
    if (!onToggleLog) return;
    const key = `${hid}_${dateStr}_${myId}`;
    // Оптимистичное обновление
    setLocalLogs(prev => {
      const next = { ...prev };
      if (next[key]) delete next[key]; else next[key] = true;
      return next;
    });
    try {
      await onToggleLog(hid, dateStr);
    } catch {
      setLocalLogs(logs);
      setErrorMsg(isEn ? 'Failed to save, check connection' : 'Не удалось сохранить, проверьте соединение');
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  const partner = members.find(m => m && m.id !== myId);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;

  const ds = (d: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const getDot = (d: number): null | { state: string; pct: number; colors: string[] } => {
    const s = ds(d);
    const dateObj = new Date(year, month, d);
    const today   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (dateObj > today) return null;
    const dw = (dateObj.getDay() + 6) % 7;
    const dh = habits.filter(h => h.days?.includes(dw) && (!h.createdAt || h.createdAt <= s));
    if (!dh.length) return null;
    const doneH = dh.filter(h => isLogged(h.id, myId, localLogs, s));
    const done = doneH.length;
    const pct = done / dh.length;
    const colors = doneH.slice(0, 3).map(h => h.color || tk.text);
    if (done === dh.length) return { state: 'full', pct: 1, colors };
    if (done > 0) return { state: 'part', pct, colors };
    return { state: 'none', pct: 0, colors: [] };
  };

  const isPast = (d: number) => {
    const date = new Date(year, month, d);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return date < today;
  };

  const isEditable = (d: number) => {
    const date = new Date(year, month, d);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7; // последние 7 дней включая сегодня
  };

  const selHabits = selDay ? (() => {
    const s = ds(selDay);
    const selDate = new Date(year, month, selDay);
    const today   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    // Будущие даты — не показываем список привычек
    if (selDate > today) return [];
    const dw = (selDate.getDay() + 6) % 7;
    // Показываем только привычки, созданные ДО выбранного дня (включительно)
    return habits.filter(h => h.days?.includes(dw) && (!h.createdAt || h.createdAt <= s)).map(h => ({
      ...h,
      myDone: isLogged(h.id, myId, localLogs, s),
      partDone: partner ? isLogged(h.id, partner.id, localLogs, s) : null,
    }));
  })() : [];

  const prevM = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    setSelDay(null);
  };
  const nextM = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    setSelDay(null);
  };

  // Неделя: 7 дней начиная с сегодня - 3 дня
  // Строим неделю с понедельника
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    const dow = now.getDay(); // 0=вс, 1=пн...
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    d.setDate(now.getDate() + mondayOffset + i);
    return d;
  });

  return (
    <View style={{ flex: 1, backgroundColor: tk.bg, paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 24) + 4 }}>
      <ScrollView showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        removeClippedSubviews={true} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>

        {/* Переключатель вид */}
        <View style={{ flexDirection: 'row', backgroundColor: tk.bg2, borderRadius: 10, padding: 3, marginBottom: 16, borderWidth: 1, borderColor: tk.border }}>
          {(['month', 'week'] as ViewMode[]).map(v => (
            <TouchableOpacity key={v} onPress={() => setViewMode(v)}
              style={{ flex: 1, padding: 7, borderRadius: 8, backgroundColor: viewMode === v ? tk.bg3 : 'transparent', alignItems: 'center' }}>
              <Text style={{ fontSize: 12, fontWeight: viewMode === v ? '700' : '500', color: viewMode === v ? tk.text : tk.text3 }}>
                {v === 'month' ? ((lang === 'en' ? 'Month' : lang==='uk' ? 'Місяць' : lang==='be' ? 'Месяц' : lang==='kk' ? 'Ай' : 'Месяц')) : ((lang === 'en' ? 'Week' : lang==='uk' ? 'Тиждень' : lang==='be' ? 'Тыдзень' : lang==='kk' ? 'Апта' : 'Неделя'))}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {viewMode === 'month' ? (
          <>
            {/* Навигация по месяцам */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, paddingHorizontal: 2 }}>
              <Text style={{ fontSize: 24, fontWeight: '800', color: tk.text, letterSpacing: -0.6 }}>
                {(isEn ? MONTHS_EN : MONTHS_RU)[month]} <Text style={{ color: tk.text3, fontWeight: '600' }}>{year}</Text>
              </Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity onPress={prevM} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: tk.bg2, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: tk.accent, fontSize: 20, lineHeight: 22, fontWeight: '600' }}>‹</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={nextM} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: tk.bg2, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: tk.accent, fontSize: 20, lineHeight: 22, fontWeight: '600' }}>›</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Дни недели */}
            <View style={{ flexDirection: 'row', marginBottom: 6 }}>
              {(isEn ? WD_EN : WD_RU).map(d => (
                <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', color: tk.text3 }}>{d}</Text>
              ))}
            </View>

            {/* Сетка дней */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 }}>
              {Array.from({ length: firstDow }, (_, i) => (
                <View key={`e${i}`} style={{ width: '14.28%', height: 54 }} />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                const isToday = d === now.getDate() && month === now.getMonth() && year === now.getFullYear();
                const isSel = d === selDay;
                const dotInfo = getDot(d);
                const dot = dotInfo?.state ?? null;
                const dotColors = dotInfo?.colors ?? [];
                const editable = isEditable(d);
                const dim = isPast(d) && !editable;
                const hasEvents = events.some(e => e.date === ds(d));
                return (
                  <TouchableOpacity key={d} onPress={() => setSelDay(d === selDay ? null : d)} activeOpacity={0.7}
                    style={{ width: '14.28%', height: 54, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 2 }}>
                    <View style={{
                      width: 38, height: 38, borderRadius: 19,
                      alignItems: 'center', justifyContent: 'center',
                      backgroundColor: isSel ? tk.accent : (isToday ? tk.accent + '22' : 'transparent'),
                    }}>
                      <Text style={{
                        fontSize: 16,
                        fontWeight: (isToday || isSel) ? '700' : '500',
                        color: isSel ? '#fff' : isToday ? tk.accent : tk.text,
                        opacity: dim ? 0.4 : 1,
                      }}>{d}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 3, marginTop: 4, height: 6, alignItems: 'center' }}>
                      {hasEvents && <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: tk.accent, borderWidth: isSel ? 0 : 0 }} />}
                      {dot === 'full' && <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: isSel ? '#fff' : tk.accent }} />}
                      {dot === 'part' && dotColors.slice(0, 3).map((c, i) => (
                        <View key={i} style={{ width: 5, height: 5, borderRadius: 2.5,
                          backgroundColor: c && c !== '#f5f5f5' ? c : tk.text3 }} />
                      ))}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : (
          // Недельный вид
          <>
            <Text style={{ fontSize: 13, fontWeight: '600', color: tk.text, marginBottom: 14 }}>
              {(lang === 'en' ? 'This week' : 'Эта неделя')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 20 }}>
              {weekDays.map((d, i) => {
                const isToday = d.toDateString() === now.toDateString();
                const s = dateToS(d);
                const dw = (d.getDay() + 6) % 7;
                const isFuture = d > now;
                const dh = isFuture ? [] : habits.filter(h => h.days?.includes(dw) && (!h.createdAt || h.createdAt <= s));
                const done = dh.filter(h => isLogged(h.id, myId, localLogs, s)).length;
                const pct = dh.length ? done / dh.length : 0;
                const wdLabels = isEn
                  ? ['Mo','Tu','We','Th','Fr','Sa','Su']
                  : ['пн','вт','ср','чт','пт','сб','вс'];

                return (
                  <TouchableOpacity key={i}
                    onPress={() => {
                      setMonth(d.getMonth());
                      setYear(d.getFullYear());
                      setSelDay(d.getDate());
                      // Остаёмся в week view, просто выделяем день
                    }}
                    style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontSize: 9, color: isToday ? tk.text : tk.text3 }}>{wdLabels[dw]}</Text>
                    <View style={{ width: '100%', height: 48, borderRadius: 8, backgroundColor: tk.bg2, borderWidth: 1, borderColor: isToday ? tk.text2 : tk.border, overflow: 'hidden', justifyContent: 'flex-end' }}>
                      {pct > 0 && <View style={{ width: '100%', height: `${pct * 100}%`, backgroundColor: pct === 1 ? tk.text : (tk.text2 + 'cc'), borderRadius: 6, minHeight: 6 }} />}
                    </View>
                    <Text style={{ fontSize: 11, color: isToday ? tk.text : tk.text2, fontWeight: isToday ? '700' : '400' }}>{d.getDate()}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          {/* Детали выбранного дня в недельном виде */}
          {viewMode === 'week' && selDay !== null && (() => {
            const selDate = weekDays.find(d => d.getDate() === selDay && d.getMonth() === month);
            if (!selDate) return null;
            const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            // Не показываем будущие даты
            if (selDate > todayMidnight) return null;
            const s = dateToS(selDate);
            const dw = (selDate.getDay() + 6) % 7;
            const dayHabits = habits
              .filter(h => h.days?.includes(dw) && (!h.createdAt || h.createdAt <= s))
              .map(h => ({
                ...h,
                myDone: isLogged(h.id, myId, localLogs, s),
                partDone: partner ? isLogged(h.id, partner.id, localLogs, s) : null,
              }));
            if (!dayHabits.length) return null;
            const monthNames = isEn
              ? ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
              : ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
            return (
              <View style={{ backgroundColor: tk.bg2, borderWidth: 1, borderColor: tk.border, borderRadius: 14, padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: tk.text }}>
                    {selDay} {monthNames[month]}
                  </Text>
                  {isEditable(selDay) && (
                    <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{}); setEditingLog(v => !v); }}
                      style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
                        backgroundColor: editingLog ? tk.bg3 : 'transparent',
                        borderWidth: 1, borderColor: tk.border }}>
                      <Text style={{ fontSize: 11, color: editingLog ? tk.text : tk.text2 }}>
                        {editingLog ? ((lang === 'en' ? 'Done' : 'Готово')) : ((lang === 'en' ? 'Edit' : 'Ред.'))}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                {dayHabits.map(h => (
                  <TouchableOpacity key={h.id}
                    onPress={() => editingLog && handleToggleLog(h.id, s)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10,
                      padding: 9, backgroundColor: tk.bg3, borderRadius: 10, marginBottom: 6 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5,
                      backgroundColor: h.color && h.color !== '#f5f5f5' ? h.color : tk.border,
                      marginLeft: 2 }}/>
                    <Text style={{ fontSize: 13, color: h.myDone ? tk.text2 : tk.text, flex: 1,
                      textDecorationLine: h.myDone ? 'line-through' : 'none' }}>{h.name}</Text>
                    <View style={{ width: 20, height: 20, borderRadius: 10,
                      backgroundColor: h.myDone ? tk.accent : 'transparent',
                      borderWidth: 1.5, borderColor: h.myDone ? tk.accent : tk.text2,
                      alignItems: 'center', justifyContent: 'center' }}>
                      {h.myDone && (
                      <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
                        <Path d="M5 13l4 4L19 7" stroke={tk.bg} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </Svg>
                    )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })()}
          </>
        )}

        {/* Детали выбранного дня (месячный вид) */}
        {selDay !== null && selHabits.length > 0 && (
          <View style={{ backgroundColor: tk.bg2, borderWidth: 1, borderColor: tk.border, borderRadius: 14, padding: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: habitsOpen ? 12 : 0 }}>
              <TouchableOpacity onPress={() => setHabitsOpen(v => !v)} activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, paddingVertical: 2 }}>
                <Text style={{ fontSize: 13, color: tk.text3, width: 12 }}>{habitsOpen ? '⌄' : '›'}</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: tk.text }}>
                  {L('Привычки дня', 'Day habits')} · {selHabits.filter(h => h.myDone).length}/{selHabits.length}
                </Text>
              </TouchableOpacity>
              {habitsOpen && isEditable(selDay) && (
                <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{}); setEditingLog(v => !v); }}
                  style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: editingLog ? tk.text : tk.bg3, borderWidth: 1, borderColor: tk.border }}>
                  <Text style={{ fontSize: 11, color: editingLog ? tk.bg : tk.text2 }}>
                    {editingLog ? ((lang === 'en' ? 'Done' : 'Готово')) : ((lang === 'en' ? 'Edit' : 'Редактировать'))}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            {habitsOpen && selHabits.map(h => {
              const dateStr = ds(selDay!);
              const dayPhotos = photos.filter(p => p.habitId === h.id && p.date === dateStr);
              return (
                <View key={h.id} style={{ marginBottom: 6 }}>
                  <TouchableOpacity
                    onPress={() => editingLog && handleToggleLog(h.id, dateStr)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, backgroundColor: tk.bg3, borderRadius: 10 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5,
                      backgroundColor: h.color && h.color !== '#f5f5f5' ? h.color : tk.border,
                      marginLeft: 2 }}/>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, color: h.myDone ? tk.text3 : tk.text, textDecorationLine: h.myDone ? 'line-through' : 'none' }}>{h.name}</Text>
                      {partner && h.partDone !== null && (
                        <Text style={{ fontSize: 10, color: tk.text3, marginTop: 2 }}>
                          {partner.name}: {h.partDone ? '✓' : '—'}
                        </Text>
                      )}
                    </View>
                    <View style={{
                      width: 22, height: 22, borderRadius: 11,
                      backgroundColor: h.myDone ? tk.accent : 'transparent',
                      borderWidth: 1.5, borderColor: h.myDone ? tk.accent : tk.text2,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      {h.myDone && (
                        <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                          <Path d="M5 13l4 4L19 7" stroke={tk.bg} strokeWidth="2.5"
                            strokeLinecap="round" strokeLinejoin="round"/>
                        </Svg>
                      )}
                    </View>
                  </TouchableOpacity>
                  {dayPhotos.length > 0 && (
                    <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingTop: 6, flexWrap: 'wrap' }}>
                      {dayPhotos.map((p: any) => (
                        <View key={p.uid} style={{ borderRadius: 8, overflow: 'hidden',
                          borderWidth: 1, borderColor: tk.border }}>
                          <Image source={{ uri: p.photoUri }}
                            style={{ width: 72, height: 54 }} resizeMode="cover"/>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
            {habitsOpen && !isEditable(selDay) && isPast(selDay) && (
              <Text style={{ fontSize: 11, color: tk.text3, textAlign: 'center', marginTop: 4 }}>
                {(lang === 'en' ? 'Cannot edit days older than 7 days' : 'Нельзя редактировать дни старше 7 дней')}
              </Text>
            )}
          </View>
        )}

        {/* События выбранного дня */}
        {selDay !== null && (
          <View style={{ backgroundColor: tk.bg2, borderWidth: 1, borderColor: tk.border, borderRadius: 14, padding: 14, marginTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: tk.text }}>{L('События', 'Events')}</Text>
              <TouchableOpacity onPress={() => setShowAddEvent(true)} activeOpacity={0.85}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 9, backgroundColor: tk.accent }}>
                <Text style={{ color: '#fff', fontSize: 16, lineHeight: 16, fontWeight: '500' }}>+</Text>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{L('Добавить', 'Add')}</Text>
              </TouchableOpacity>
            </View>
            {eventsForDay(ds(selDay)).length === 0 ? (
              <Text style={{ fontSize: 12.5, color: tk.text3, paddingVertical: 4 }}>{L('Событий нет — добавьте первое', 'No events — add one')}</Text>
            ) : eventsForDay(ds(selDay)).map(ev => (
              <View key={ev.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, backgroundColor: tk.bg3, borderRadius: 10, marginBottom: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tk.accent }} />
                {ev.time ? <Text style={{ fontSize: 12.5, fontWeight: '700', color: tk.text2, width: 44 }}>{ev.time}</Text> : null}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13.5, color: tk.text }}>{ev.title}</Text>
                  {ev.shared ? (
                    <Text style={{ fontSize: 10.5, color: tk.text3, marginTop: 1 }}>
                      👥 {ev.ownerName ? L('общее · ', 'shared · ') + ev.ownerName : L('общее', 'shared')}
                    </Text>
                  ) : null}
                </View>
                {ev.remind && ev.time ? <Text style={{ fontSize: 13 }}>🔔</Text> : null}
                <TouchableOpacity onPress={() => deleteEvent(ev)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ fontSize: 18, color: tk.text3, lineHeight: 18 }}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

      </ScrollView>
      {errorMsg && (
        <View style={{ position: 'absolute', bottom: 32, left: 20, right: 20,
          backgroundColor: '#e05555', borderRadius: 12, padding: 12, alignItems: 'center',
          shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, elevation: 8 }}>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{errorMsg}</Text>
        </View>
      )}

      {/* Модалка: новое событие */}
      <Modal visible={showAddEvent} transparent animationType="fade" onRequestClose={() => setShowAddEvent(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setShowAddEvent(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}
            style={{ width: '100%', maxWidth: 380, backgroundColor: tk.bg2, borderRadius: 18, borderWidth: 1, borderColor: tk.border, padding: 20 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: tk.text, marginBottom: 4 }}>{L('Новое событие', 'New event')}</Text>
            <Text style={{ fontSize: 12, color: tk.text3, marginBottom: 16 }}>
              {selDay} {(isEn ? MONTHS_EN : MONTHS_RU)[month]} {year}
            </Text>
            <Text style={{ fontSize: 11, color: tk.text3, marginBottom: 6, letterSpacing: 0.5 }}>{L('НАЗВАНИЕ', 'TITLE')}</Text>
            <TextInput value={evTitle} onChangeText={setEvTitle} autoFocus
              placeholder={L('Например: Созвон с командой', 'e.g. Team call')} placeholderTextColor={tk.text3}
              style={{ backgroundColor: tk.bg3, borderWidth: 1, borderColor: tk.border, borderRadius: 12, padding: 12, fontSize: 14, color: tk.text, marginBottom: 14 }} />
            <Text style={{ fontSize: 11, color: tk.text3, marginBottom: 6, letterSpacing: 0.5 }}>{L('ВРЕМЯ (необязательно)', 'TIME (optional)')}</Text>
            <TouchableOpacity onPress={() => setShowEvTimePicker(true)} activeOpacity={0.8}
              style={{ backgroundColor: tk.bg3, borderWidth: 1, borderColor: tk.border, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: 150 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: evTime ? tk.text : tk.text3 }}>{evTime || '— : —'}</Text>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Circle cx="12" cy="12" r="9" stroke={tk.text3} strokeWidth="1.6"/>
                <Path d="M12 7v5l3 2" stroke={tk.text3} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </Svg>
            </TouchableOpacity>

            {hasPartner && (
              <TouchableOpacity onPress={() => setEvShared(v => !v)} activeOpacity={0.8}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <View style={{ width: 46, height: 28, borderRadius: 14, padding: 2,
                  backgroundColor: evShared ? tk.accent : tk.bg3, borderWidth: 1, borderColor: evShared ? tk.accent : tk.border,
                  justifyContent: 'center', alignItems: evShared ? 'flex-end' : 'flex-start' }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: tk.text, fontWeight: '600' }}>{L('Общее с партнёром', 'Shared with partner')}</Text>
                  <Text style={{ fontSize: 11, color: tk.text3, marginTop: 1 }}>
                    {evShared ? L('Партнёр увидит это событие', 'Your partner will see it') : L('Личное — видите только вы', 'Private — only you')}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setEvRemind(v => !v)} activeOpacity={0.8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <View style={{ width: 46, height: 28, borderRadius: 14, padding: 2,
                backgroundColor: evRemind ? tk.accent : tk.bg3, borderWidth: 1, borderColor: evRemind ? tk.accent : tk.border,
                justifyContent: 'center', alignItems: evRemind ? 'flex-end' : 'flex-start' }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' }} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, color: tk.text, fontWeight: '600' }}>{L('Напоминание', 'Reminder')}</Text>
                <Text style={{ fontSize: 11, color: tk.text3, marginTop: 1 }}>
                  {evTime.length === 5 ? L('Уведомим в ' + evTime, 'Notify at ' + evTime) : L('Укажите время для напоминания', 'Set a time to be notified')}
                </Text>
              </View>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={() => setShowAddEvent(false)}
                style={{ flex: 1, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: tk.border, alignItems: 'center' }}>
                <Text style={{ color: tk.text2, fontSize: 14 }}>{L('Отмена', 'Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={addEvent} disabled={!evTitle.trim()} activeOpacity={0.85}
                style={{ flex: 2, padding: 13, borderRadius: 12, alignItems: 'center', backgroundColor: evTitle.trim() ? tk.accent : tk.bg3, opacity: evTitle.trim() ? 1 : 0.6 }}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{L('Сохранить', 'Save')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {showEvTimePicker && (
        <TimePicker value={evTime} onChange={setEvTime} onClose={() => setShowEvTimePicker(false)} tk={tk} />
      )}
    </View>
  );
}
