import React, { useState } from 'react';
import { View, Platform, StatusBar, Text, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { Theme, MONTHS_RU, MONTHS_EN, WD_RU, WD_EN } from '../theme';
import { tr } from '../i18n';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { Habit, Member, Storage } from '../store';
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
  onToggleLog?: (hid: string, dateStr: string) => Promise<void>;
}

type ViewMode = 'month' | 'week';

export default function CalendarScreen({ myId, lang, tk, habits, members, logs, spaceId, onToggleLog }: Props) {
  const isEn = lang === 'en';
  const L = (ru: string, en: string, uk?: string, be?: string, kk?: string) =>
    lang==='en' ? en : lang==='uk' ? (uk||ru) : lang==='be' ? (be||ru) : lang==='kk' ? (kk||ru) : ru;
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear]   = useState(now.getFullYear());
  const [selDay, setSelDay] = useState<number | null>(now.getDate());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [editingLog, setEditingLog] = useState(false);

  const partner = members.find(m => m.id !== myId);

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
    const doneH = dh.filter(h => isLogged(h.id, myId, logs, s));
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
      myDone: isLogged(h.id, myId, logs, s),
      partDone: partner ? isLogged(h.id, partner.id, logs, s) : null,
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
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <TouchableOpacity onPress={prevM} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: tk.bg2, borderWidth: 1, borderColor: tk.border, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: tk.text, fontSize: 18, lineHeight: 22 }}>‹</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 16, fontWeight: '700', color: tk.text }}>
                {(isEn ? MONTHS_EN : MONTHS_RU)[month]} {year}
              </Text>
              <TouchableOpacity onPress={nextM} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: tk.bg2, borderWidth: 1, borderColor: tk.border, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: tk.text, fontSize: 18, lineHeight: 22 }}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Дни недели */}
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              {(isEn ? WD_EN : WD_RU).map(d => (
                <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: tk.text3 }}>{d}</Text>
              ))}
            </View>

            {/* Сетка дней */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 }}>
              {Array.from({ length: firstDow }, (_, i) => (
                <View key={`e${i}`} style={{ width: '14.28%', aspectRatio: 1 }} />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                const isToday = d === now.getDate() && month === now.getMonth() && year === now.getFullYear();
                const isSel = d === selDay;
                const dotInfo = getDot(d);
                const dot = dotInfo?.state ?? null;
                const dotColors = dotInfo?.colors ?? [];
                const editable = isEditable(d);
                return (
                  <TouchableOpacity key={d} onPress={() => setSelDay(d === selDay ? null : d)}
                    style={{ width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                    <View style={{
                      width: 30, height: 30, borderRadius: 10,
                      backgroundColor:
                        isSel ? tk.text :
                        dot === 'full' ? tk.text :
                        'transparent',
                      borderWidth: (isToday && !isSel) ? 1.5 : 0,
                      borderColor: tk.text2,
                      alignItems: 'center', justifyContent: 'center',
                      opacity: isPast(d) && !editable ? 0.45 : 1,
                    }}>
                      <Text style={{
                        fontSize: 13,
                        fontWeight: (isToday || dot === 'full') ? '700' : '400',
                        color: (isSel || dot === 'full') ? tk.bg : tk.text,
                      }}>{d}</Text>
                    </View>
                    {dot === 'part' && (
                      <View style={{ flexDirection: 'row', gap: 1.5, alignItems: 'center' }}>
                        {dotColors.slice(0,3).map((c, i) => (
                          <View key={i} style={{ width: 4, height: 4, borderRadius: 2,
                            backgroundColor: c && c !== '#f5f5f5' ? c : tk.text3 }} />
                        ))}
                      </View>
                    )}
                    {(!dot || dot === 'none') && <View style={{ width: 5, height: 5 }} />}
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
                const done = dh.filter(h => isLogged(h.id, myId, logs, s)).length;
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
                myDone: isLogged(h.id, myId, logs, s),
                partDone: partner ? isLogged(h.id, partner.id, logs, s) : null,
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
                    <TouchableOpacity onPress={() => setEditingLog(v => !v)}
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
                    onPress={() => editingLog && onToggleLog && onToggleLog(h.id, s)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10,
                      padding: 9, backgroundColor: tk.bg3, borderRadius: 10, marginBottom: 6 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5,
                      backgroundColor: h.color && h.color !== '#f5f5f5' ? h.color : tk.border,
                      marginLeft: 2 }}/>
                    <Text style={{ fontSize: 13, color: h.myDone ? tk.text3 : tk.text, flex: 1,
                      textDecorationLine: h.myDone ? 'line-through' : 'none' }}>{h.name}</Text>
                    <View style={{ width: 20, height: 20, borderRadius: 10,
                      backgroundColor: h.myDone ? '#7c3aed' : 'transparent',
                      borderWidth: 1.5, borderColor: h.myDone ? '#7c3aed' : tk.text2,
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
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: tk.text }}>
                {selDay} {(isEn ? ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] : ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'])[month]}
              </Text>
              {isEditable(selDay) && (
                <TouchableOpacity onPress={() => setEditingLog(v => !v)}
                  style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: editingLog ? tk.text : tk.bg3, borderWidth: 1, borderColor: tk.border }}>
                  <Text style={{ fontSize: 11, color: editingLog ? tk.bg : tk.text2 }}>
                    {editingLog ? ((lang === 'en' ? 'Done' : 'Готово')) : ((lang === 'en' ? 'Edit' : 'Редактировать'))}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            {selHabits.length === 0 && (
              <View style={{ alignItems: 'center', padding: 24, gap: 8 }}>
                <Text style={{ fontSize: 14, color: tk.text3 }}>
                  {(lang === 'en' ? 'No habits scheduled' : 'Нет запланированных привычек')}
                </Text>
                <Text style={{ fontSize: 11, color: tk.text3, opacity: 0.6 }}>
                  {(lang === 'en' ? 'Time to rest' : 'Время отдохнуть')}
                </Text>
              </View>
            )}
            {selHabits.map(h => (
              <TouchableOpacity key={h.id}
                onPress={() => editingLog && onToggleLog && onToggleLog(h.id, ds(selDay!))}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, backgroundColor: tk.bg3, borderRadius: 10, marginBottom: 6 }}>
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
                  backgroundColor: h.myDone ? '#7c3aed' : 'transparent',
                  borderWidth: 1.5, borderColor: h.myDone ? '#7c3aed' : tk.text2,
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
            ))}
            {!isEditable(selDay) && isPast(selDay) && (
              <Text style={{ fontSize: 11, color: tk.text3, textAlign: 'center', marginTop: 4 }}>
                {(lang === 'en' ? 'Cannot edit days older than 7 days' : 'Нельзя редактировать дни старше 7 дней')}
              </Text>
            )}
          </View>
        )}

      </ScrollView>
    </View>
  );
}
