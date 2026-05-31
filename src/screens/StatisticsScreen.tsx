import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, BackHandler, Animated, Dimensions } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Theme } from '../theme';
import { tr } from '../i18n';
import { Habit, Member } from '../store';

// Локализация
const { width: SW } = Dimensions.get('window');

interface Props {
  myId: string; myName: string; lang: string; tk: Theme;
  habits: Habit[]; logs: Record<string, boolean>;
  members: Member[]; maxStreak: number; totalDone: number;
  plan: 'free' | 'duo' | 'team' | 'admin' | 'trial';
  statsTab?: 'me'|'partner';
  onStatsTabChange?: (tab: 'me'|'partner') => void;
  onBack: () => void;
}

//  Анимация появления 
function FadeIn({ delay, children }: { delay: number; children: React.ReactNode }) {
  const a = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(a, { toValue: 1, duration: 380, delay, useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: 320, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={{ opacity: a, transform: [{ translateY: y }] }}>{children}</Animated.View>;
}

//  Мини-карточка статы 
function StatCard({ value, label, sub, color, delay, tk }:
  { value: string; label: string; sub?: string; color: string; delay: number; tk: Theme }) {
  return (
    <FadeIn delay={delay}>
      <View style={{ backgroundColor: tk.bg2, borderRadius: 18, padding: 14,
        borderWidth: 1, borderColor: tk.border, flex: 1,
        shadowColor: tk.cardShadowColor, shadowOpacity: tk.cardShadowOpacity,
        shadowRadius: tk.cardShadowRadius, shadowOffset: { width: 0, height: 3 }, elevation: 0 }}>
        <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 26, fontWeight: '800', color, lineHeight: 30 }}>{value}</Text>
        <Text style={{ fontSize: 11, color: tk.text2, marginTop: 4, fontWeight: '600' }}>{label}</Text>
        {sub && <Text style={{ fontSize: 10, color: tk.text3, marginTop: 2 }}>{sub}</Text>}
      </View>
    </FadeIn>
  );
}

//  Горизонтальный бар-чарт выполнения по дням 
function WeekChart({ data, tk }: { data: { day: string; pct: number }[]; tk: Theme }) {
  const bars = data.map((d, i) => {
    const h = Math.round(d.pct * 80);
    return (
      <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
        <View style={{ height: 80, justifyContent: 'flex-end' }}>
          <View style={{ width: 20, height: Math.max(h, 3), borderRadius: 4,
            backgroundColor: d.pct === 1 ? tk.text
              : d.pct > 0.5 ? tk.text2
              : d.pct > 0 ? tk.bg3
              : tk.border }} />
        </View>
        <Text style={{ fontSize: 9, color: tk.text3, fontWeight: '600' }}>{d.day}</Text>
        {d.pct > 0 && (
          <Text style={{ fontSize: 8, color: d.pct === 1 ? tk.text : tk.text3 }}>
            {Math.round(d.pct * 100)}%
          </Text>
        )}
      </View>
    );
  });
  return (
    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'flex-end', paddingHorizontal: 4 }}>
      {bars}
    </View>
  );
}

//  Прогресс-кольцо 
function Ring({ pct, color, size = 80, stroke = 8, label, tk }:
  { pct: number; color: string; size?: number; stroke?: number; label: string; tk: Theme }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle cx={size/2} cy={size/2} r={r}
            stroke={tk.border} strokeWidth={stroke} fill="none" />
          <Circle cx={size/2} cy={size/2} r={r}
            stroke={color} strokeWidth={stroke} fill="none"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={circ / 4}
            strokeLinecap="round"
            transform={`rotate(-90 ${size/2} ${size/2})`} />
        </Svg>
        <View style={{ position: 'absolute', width: size, height: size,
          alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: tk.text }}>
            {Math.round(pct * 100)}%
          </Text>
        </View>
      </View>
      <Text style={{ fontSize: 10, color: tk.text2, fontWeight: '600',
        letterSpacing: 0.5, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

//  Главный компонент 
export default function StatisticsScreen({
  myId, myName, lang, tk, habits, logs, members, maxStreak, totalDone, plan, onBack,
  statsTab: statsTabProp, onStatsTabChange,
}: Props) {
  const isEn = lang === 'en';

  // Android hardware back button
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true; });
    return () => sub.remove();
  }, [onBack]);

  const L = (ru: string, en: string, uk?: string, be?: string, kk?: string) =>
    lang==='en' ? en : lang==='uk' ? (uk||ru) : lang==='be' ? (be||ru) : lang==='kk' ? (kk||ru) : ru;
  const isTeam = plan === 'team' || plan === 'admin';
  const hasPair = members.length > 1;
  const [statsTab, setStatsTab] = useState<'me'|'partner'>(statsTabProp ?? 'me');
  const handleTabChange = (t: 'me'|'partner') => { setStatsTab(t); onStatsTabChange?.(t); };
  const statsUserId = statsTab === 'partner' && hasPair ? (members.find((m:any)=>m.id!==myId)?.id||myId) : myId;
  const partner = members.find(m => m.id !== myId);

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  //  Вычисляем статистику 
  // Привычки на сегодня
  const todayDow = (now.getDay() + 6) % 7;
  const todayHabits = habits.filter(h => h.days?.includes(todayDow));
  const todayDone   = todayHabits.filter(h => logs[`${h.id}_${todayStr}_${statsUserId}`]).length;
  const todayPct    = todayHabits.length ? todayDone / todayHabits.length : 0;

  // Последние 30 дней
  const last30: { date: string; pct: number }[] = [];
  let completedDays = 0;
  let skippedDays   = 0;

  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    const dow = (d.getDay() + 6) % 7;
    const dh = habits.filter(h => h.days?.includes(dow) && (!h.createdAt || h.createdAt <= ds));
    if (!dh.length) { last30.push({ date: ds, pct: 0 }); continue; }
    const done = dh.filter(h => logs[`${h.id}_${ds}_${statsUserId}`]).length;
    const pct = done / dh.length;
    last30.push({ date: ds, pct });
    if (pct === 1) completedDays++;
    else if (done === 0 && d < now) skippedDays++;
  }

  const overall30Pct = last30.filter(d => d.pct > 0).length > 0
    ? last30.reduce((s, d) => s + d.pct, 0) / last30.filter((_, i) => {
        const d = new Date(now); d.setDate(d.getDate() - (29 - i));
        return d <= now;
      }).length
    : 0;

  // Топ привычек (по количеству выполнений)
  const habitStats = habits.map(h => {
    const count = last30.reduce((s, { date }) => {
      if (h.createdAt && date < h.createdAt) return s;
      return s + (logs[`${h.id}_${date}_${statsUserId}`] ? 1 : 0);
    }, 0);
    return { ...h, count };
  }).sort((a, b) => b.count - a.count);

  // Что чаще пропускаешь
  const skippedHabits = habits.map(h => {
    const scheduled = last30.filter(({ date }) => {
      const d = new Date(date + 'T12:00:00');
      return h.days?.includes((d.getDay() + 6) % 7) && d <= now
        && (!h.createdAt || date >= h.createdAt);
    }).length;
    const done = last30.filter(({ date }) => logs[`${h.id}_${date}_${statsUserId}`]).length;
    return { ...h, scheduled, done, missed: scheduled - done,
      pct: scheduled ? done / scheduled : 0 };
  }).filter(h => h.scheduled > 0).sort((a, b) => b.missed - a.missed);

  // Последние 7 дней для графика
  const WD_SHORT = isEn
    ? ['Mo','Tu','We','Th','Fr','Sa','Su']
    : ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  const week7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now); d.setDate(d.getDate() - 6 + i);
    const ds = d.toISOString().split('T')[0];
    const dow = (d.getDay() + 6) % 7;
    const dh = habits.filter(h => h.days?.includes(dow));
    const done = dh.filter(h => logs[`${h.id}_${ds}_${statsUserId}`]).length;
    return { day: WD_SHORT[dow], pct: dh.length ? done / dh.length : 0 };
  });

  // Командная статистика
  const teamStats = members.map(m => {
    const mDone = last30.reduce((s, { date }) => {
      return s + habits.filter(h => logs[`${h.id}_${date}_${m.id}`]).length;
    }, 0);
    return { ...m, done: mDone };
  }).sort((a, b) => b.done - a.done);

  return (
    <View style={{ flex: 1, backgroundColor: tk.bg }}>
      {habits.length === 0 && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
          <Svg width={56} height={56} viewBox="0 0 24 24" fill="none">
            <Path d="M18 20V10M12 20V4M6 20v-6" stroke={tk.text3} strokeWidth="1.5" strokeLinecap="round"/>
          </Svg>
          <Text style={{ fontSize: 17, fontWeight: '700', color: tk.text2, textAlign: 'center' }}>
            {(lang === 'en' ? 'No data yet' : 'Пока нет данных')}
          </Text>
          <Text style={{ fontSize: 13, color: tk.text3, textAlign: 'center', lineHeight: 20 }}>
            {(lang === 'en' ? 'Create habits and start tracking to see statistics' : 'Создайте привычки и начните отслеживать, чтобы увидеть статистику')}
          </Text>
        </View>
      )}
      {hasPair && habits.length > 0 && (
        <View style={{ flexDirection: 'row', marginHorizontal: 20, marginBottom: 16,
          backgroundColor: tk.bg2, borderRadius: 12, padding: 4,
          borderWidth: 1, borderColor: tk.border }}>
          {([
            ['me',      isEn ? 'My stats'                              : 'Мои'],
            ['partner', members.find((m:any)=>m.id!==myId)?.name || (isEn?'Partner':'Партнёр')],
          ] as [string,string][]).map(([tab, label]) => (
            <TouchableOpacity key={tab} onPress={() => handleTabChange(tab as 'me'|'partner')}
              style={{ flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center',
                backgroundColor: statsTab===tab ? tk.bg3 : 'transparent' }}>
              <Text style={{ fontSize: 13, fontWeight: statsTab===tab ? '700' : '400',
                color: statsTab===tab ? tk.text : tk.text3 }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {habits.length > 0 && <ScrollView showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        removeClippedSubviews={true}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 100 }}>

        {/* Хедер */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12,
          paddingTop: 16, paddingBottom: 4 }}>
          <TouchableOpacity onPress={onBack}
            style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: tk.bg2,
              borderWidth: 1, borderColor: tk.border, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M19 12H5M5 12l7 7M5 12l7-7"
                stroke={tk.text2} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </Svg>
          </TouchableOpacity>
          <View>
            <Text style={{ fontSize: 17, fontWeight: '700', color: tk.text }}>
              {(lang === 'en' ? 'Statistics' : 'Статистика')}
            </Text>
            <Text style={{ fontSize: 11, color: tk.text3 }}>
              {(lang === 'en' ? 'Last 30 days' : 'Последние 30 дней')}
            </Text>
          </View>
        </View>

        {/*  Блок 1: Сегодня  */}
        <FadeIn delay={0}>
          <View style={{ backgroundColor: tk.bg2, borderRadius: 22, padding: 18, marginTop: 14,
            borderWidth: 1, borderColor: tk.border }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: tk.text3,
              letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 14 }}>
              {(lang === 'en' ? 'Today' : lang==='uk' ? 'Сьогодні' : lang==='be' ? 'Сёння' : lang==='kk' ? 'Бүгін' : 'Сегодня')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
              <Ring pct={todayPct} color={tk.text}
                label={(lang === 'en' ? 'Today' : lang==='uk' ? 'Сьогодні' : lang==='be' ? 'Сёння' : lang==='kk' ? 'Бүгін' : 'Сегодня')} tk={tk} />
              <View style={{ flex: 1, gap: 10 }}>
                <View>
                  <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 28, fontWeight: '800', color: tk.text }}>
                    {todayDone}/{todayHabits.length}
                  </Text>
                  <Text style={{ fontSize: 12, color: tk.text2 }}>
                    {(lang === 'en' ? 'habits completed' : 'привычек выполнено')}
                  </Text>
                </View>
                {/* Прогресс-бар */}
                <View style={{ backgroundColor: tk.border, borderRadius: 4, height: 5 }}>
                  <View style={{ width: `${Math.round(todayPct*100)}%`, height: 5,
                    borderRadius: 4, backgroundColor: todayPct === 1 ? tk.text : tk.text }} />
                </View>
              </View>
            </View>
          </View>
        </FadeIn>

        {/*  Блок 2: Ключевые числа  */}
        <FadeIn delay={80}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: tk.text3,
            letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 22, marginBottom: 10 }}>
            {(lang === 'en' ? 'Overview' : 'Обзор')}
          </Text>
        </FadeIn>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <StatCard value={` ${maxStreak}`}
            label={(lang === 'en' ? 'Best streak' : 'Лучшая серия')}
            sub={(lang === 'en' ? 'days in a row' : 'дней подряд')}
            color={tk.text2} delay={100} tk={tk} />
          <StatCard value={totalDone.toString()}
            label={(lang === 'en' ? 'All time done' : 'Всего выполнено')}
            sub={(lang === 'en' ? 'completions' : 'выполнений')}
            color={tk.text} delay={140} tk={tk} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <StatCard value={completedDays.toString()}
            label={(lang === 'en' ? 'Perfect days' : 'Идеальных дней')}
            sub={(lang === 'en' ? 'last 30d' : 'за 30 дней')}
            color={tk.text} delay={180} tk={tk} />
          <StatCard value={skippedDays.toString()}
            label={(lang === 'en' ? 'Missed days' : 'Пропущено дней')}
            sub={(lang === 'en' ? 'last 30d' : 'за 30 дней')}
            color={tk.text2} delay={220} tk={tk} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <StatCard value={habits.length.toString()}
            label={(lang === 'en' ? 'Active habits' : 'Активных привычек')}
            sub={(lang === 'en' ? 'right now' : 'сейчас')}
            color={tk.text} delay={260} tk={tk} />
          <StatCard
            value={(()=>{
              if (!habits.length) return '0';
              const earliest = habits.reduce((min, h) => h.createdAt < min ? h.createdAt : min, habits[0].createdAt);
              const days = Math.floor((Date.now() - new Date(earliest).getTime()) / 86400000);
              return days.toString();
            })()}
            label={(lang === 'en' ? 'Days tracking' : 'Дней отслеживания')}
            sub={(lang === 'en' ? 'since first habit' : 'с первой привычки')}
            color={tk.text2} delay={300} tk={tk} />
        </View>

        {/*  Блок 3: График недели  */}
        <FadeIn delay={260}>
          <View style={{ backgroundColor: tk.bg2, borderRadius: 22, padding: 18, marginTop: 20,
            borderWidth: 1, borderColor: tk.border }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: tk.text3,
              letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 }}>
              {(lang === 'en' ? 'This week' : 'Эта неделя')}
            </Text>
            <WeekChart data={week7} tk={tk} />
          </View>
        </FadeIn>

        {/*  Блок 4: Кольца выполнения  */}
        <FadeIn delay={320}>
          <View style={{ backgroundColor: tk.bg2, borderRadius: 22, padding: 18, marginTop: 12,
            borderWidth: 1, borderColor: tk.border }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: tk.text3,
              letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 }}>
              {(lang === 'en' ? 'Completion rate' : 'Процент выполнения')}
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              <Ring pct={overall30Pct} color={tk.text}
                size={76} stroke={7}
                label={(lang === 'en' ? '30 days' : '30 дней')} tk={tk} />
              <Ring pct={completedDays / 30} color={tk.text}
                size={76} stroke={7}
                label={(lang === 'en' ? 'Perfect' : 'Идеальных')} tk={tk} />
              <Ring pct={habits.length ? Math.min(habitStats[0]?.count / 30, 1) : 0}
                color={tk.text2} size={76} stroke={7}
                label={(lang === 'en' ? 'Best habit' : 'Топ привычка')} tk={tk} />
            </View>
          </View>
        </FadeIn>

        {/*  Блок 5: Топ привычек  */}
        <FadeIn delay={380}>
          <View style={{ marginTop: 20 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: tk.text3,
              letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
              {(lang === 'en' ? 'Top habits (30d)' : 'Топ привычек (30 дней)')}
            </Text>
            <View style={{ gap: 6 }}>
              {habitStats.slice(0, 5).map((h, i) => {
                const pct = 30 > 0 ? h.count / 30 : 0;
                return (
                  <View key={h.id} style={{ backgroundColor: tk.bg2, borderRadius: 14, padding: 12,
                    flexDirection: 'row', alignItems: 'center', gap: 10,
                    borderWidth: 1, borderColor: tk.border }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: tk.text3,
                      width: 16 }}>#{i+1}</Text>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: tk.text }}>{h.name}</Text>
                      <View style={{ backgroundColor: tk.border, borderRadius: 3, height: 3 }}>
                        <View style={{ width: `${Math.round(pct*100)}%`, height: 3,
                          borderRadius: 3,
                          backgroundColor: h.color && h.color !== '#f5f5f5' ? h.color : tk.text }} />
                      </View>
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: i === 0 ? tk.text : tk.text2 }}>
                      {h.count}/30
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </FadeIn>

        {/*  Блок 6: Что пропускаешь  */}
        {skippedHabits.filter(h => h.missed > 0 && h.scheduled >= 3 && h.pct < 0.7).length > 0 && (
          <FadeIn delay={440}>
            <View style={{ marginTop: 20 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: tk.text3,
                letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
                {(lang === 'en' ? 'Needs attention' : 'Требует внимания')}
              </Text>
              <View style={{ gap: 6 }}>
                {skippedHabits.filter(h => h.missed > 0 && h.scheduled >= 3 && h.pct < 0.7).sort((a,b) => a.pct - b.pct).slice(0, 4).map(h => (
                  <View key={h.id} style={{ backgroundColor: 'rgba(239,68,68,0.06)',
                    borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center',
                    gap: 10, borderWidth: 1, borderColor: 'rgba(239,68,68,0.12)' }}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: tk.text }}>{h.name}</Text>
                      {h.scheduled > 0 && (
                        <View style={{ backgroundColor: tk.border, borderRadius: 3, height: 3, marginBottom: 1 }}>
                          <View style={{ width: `${Math.round((h.done/h.scheduled)*100)}%`, height: 3,
                            borderRadius: 3, backgroundColor: 'rgba(239,68,68,0.5)' }} />
                        </View>
                      )}
                      <Text style={{ fontSize: 10, color: tk.text3 }}>
                        {isEn ? `${h.missed} missed of ${h.scheduled} scheduled` : `Пропущено ${h.missed} из ${h.scheduled}`}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '700',
                      color: h.pct < 0.5 ? tk.text2 : tk.text2 }}>
                      {Math.round(h.pct * 100)}%
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </FadeIn>
        )}

        {/*  Блок 7: Командная / Парная статистика  */}
        {hasPair && (
          <FadeIn delay={500}>
            <View style={{ marginTop: 20 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: tk.text3,
                letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
                {isTeam ? (lang === 'en' ? 'Team stats' : 'Статистика команды') : (lang === 'en' ? 'Pair stats' : 'Статистика пары')}
              </Text>
              <View style={{ gap: 6 }}>
                {teamStats.map((m, i) => {
                  const maxDone = teamStats[0]?.done || 1;
                  const pct = m.done / maxDone;
                  return (
                    <View key={m.id} style={{ backgroundColor: tk.bg2, borderRadius: 14, padding: 12,
                      flexDirection: 'row', alignItems: 'center', gap: 10,
                      borderWidth: 1, borderColor: tk.border }}>
                      <View style={{ width: 32, height: 32, borderRadius: 16,
                        backgroundColor: i === 0 ? 'rgba(129,140,248,0.2)' : tk.border,
                        alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: tk.text }}>
                          {m.name?.[0]?.toUpperCase() || '?'}
                        </Text>
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: tk.text }}>
                            {m.name}{m.id === myId ? ((lang === 'en' ? ' (you)' : ' (вы)')) : ''}
                          </Text>
                          <Text style={{ fontSize: 11, fontWeight: '700',
                            color: i === 0 ? tk.text : tk.text2 }}>
                            {m.done} {(lang === 'en' ? 'done' : 'вып.')}
                          </Text>
                        </View>
                        <View style={{ backgroundColor: tk.border, borderRadius: 3, height: 3 }}>
                          <View style={{ width: `${Math.round(pct*100)}%`, height: 3,
                            borderRadius: 3, backgroundColor: i === 0 ? tk.text : tk.text3 }} />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Team — дополнительный блок задач */}
              {isTeam && (
                <View style={{ backgroundColor: 'rgba(56,189,248,0.06)', borderRadius: 18, padding: 16,
                  marginTop: 10, borderWidth: 1, borderColor: 'rgba(56,189,248,0.15)' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: tk.text2, marginBottom: 8 }}>
                    {(lang === 'en' ? ' Team productivity' : ' Продуктивность команды')}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ fontSize: 22, fontWeight: '800', color: tk.text }}>
                        {teamStats.reduce((s, m) => s + m.done, 0)}
                      </Text>
                      <Text style={{ fontSize: 10, color: tk.text2 }}>
                        {(lang === 'en' ? 'total done' : 'итого выполнено')}
                      </Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ fontSize: 22, fontWeight: '800', color: tk.text }}>
                        {members.length}
                      </Text>
                      <Text style={{ fontSize: 10, color: tk.text2 }}>
                        {(lang === 'en' ? 'members' : 'участников')}
                      </Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ fontSize: 22, fontWeight: '800', color: tk.text }}>
                        {members.length > 0 ? Math.round(teamStats.reduce((s,m) => s+m.done, 0) / members.length) : 0}
                      </Text>
                      <Text style={{ fontSize: 10, color: tk.text2 }}>
                        {(lang === 'en' ? 'avg/member' : 'среднее/чел')}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </FadeIn>
        )}

      {/* День недели */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 20 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: tk.text3,
            textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, marginTop: 20 }}>
            {(lang === 'en' ? 'By day of week' : 'По дням недели')}
          </Text>
          <View style={{ backgroundColor: tk.bg2, borderRadius: 16, padding: 16,
            borderWidth: 1, borderColor: tk.cardBorder }}>
            {(isEn ? ['Mo','Tu','We','Th','Fr','Sa','Su'] : ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']).map((dayLabel, di) => {
              const dayLogs = last30.filter(({ date }) => {
                const d = new Date(date);
                return ((d.getDay() + 6) % 7) === di;
              });
              const possible = habits.filter(h => h.days?.includes(di)).length * Math.max(dayLogs.length, 1);
              const done = dayLogs.reduce((s, { date }) =>
                s + habits.filter(h => h.days?.includes(di) && logs[`${h.id}_${date}_${statsUserId}`]).length, 0);
              const pct2 = possible > 0 ? done / possible : 0;
              const pctNum = Math.round(pct2 * 100);
              return (
                <View key={di} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <Text style={{ fontSize: 11, color: tk.text3, width: 24 }}>{dayLabel}</Text>
                  <View style={{ flex: 1, height: 6, backgroundColor: tk.border, borderRadius: 3 }}>
                    <View style={{ height: 6, width: `${pctNum}%` as any,
                      backgroundColor: pct2 > 0.8 ? tk.text : pct2 > 0.4 ? tk.text2 : tk.text3,
                      borderRadius: 3 }} />
                  </View>
                  <Text style={{ fontSize: 10, color: tk.text3, width: 32, textAlign: 'right' }}>
                    {`${pctNum}%`}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

      {/* Тепловая карта — последние 12 недель */}
        {habits.length > 0 && (() => {
          const weeks = 15;
          const today = new Date();
          const cells: { date: string; pct: number }[] = [];
          for (let i = weeks * 7 - 1; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const ds = d.toISOString().split('T')[0];
            const dw = (d.getDay() + 6) % 7;
            const dh = habits.filter(h => h.days?.includes(dw) && (!h.createdAt || h.createdAt <= ds));
            const done = dh.length > 0
              ? dh.filter(h => logs[`${h.id}_${ds}_${statsUserId}`]).length / dh.length
              : -1; // нет привычек в этот день
            cells.push({ date: ds, pct: done });
          }
          const rows: typeof cells[] = [];
          for (let w = 0; w < weeks; w++) rows.push(cells.slice(w * 7, w * 7 + 7));
          return (
            <View style={{ marginHorizontal: 16, marginBottom: 24 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: tk.text3,
                textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
                {isEn ? 'Activity' : lang==='uk' ? 'Активність' : 'Активность'}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
              <View style={{ flexDirection: 'row', gap: 3 }}>
                {rows.map((week, wi) => (
                  <View key={wi} style={{ width: 14, gap: 3 }}>
                    {week.map((cell, di) => {
                      const future = cell.date > today.toISOString().split('T')[0];
                      const bg = future || cell.pct < 0
                        ? tk.border
                        : cell.pct === 0
                          ? `${tk.text}18`
                          : cell.pct < 0.5
                            ? `${tk.text}55`
                            : cell.pct < 1
                              ? `${tk.text}99`
                              : tk.text;
                      return (
                        <View key={di} style={{
                          aspectRatio: 1,
                          borderRadius: 2,
                          backgroundColor: bg,
                          opacity: future ? 0.3 : 1,
                        }} />
                      );
                    })}
                  </View>
                ))}
              </View>
              </ScrollView>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end',
                alignItems: 'center', gap: 4, marginTop: 8 }}>
                <Text style={{ fontSize: 9, color: tk.text3 }}>{isEn ? 'Less' : 'Меньше'}</Text>
                {[0.15, 0.35, 0.6, 0.85, 1].map((op, i) => (
                  <View key={i} style={{ width: 10, height: 10, borderRadius: 2,
                    backgroundColor: op < 0.2 ? `${tk.text}18` : tk.text,
                    opacity: op }} />
                ))}
                <Text style={{ fontSize: 9, color: tk.text3 }}>{isEn ? 'More' : 'Больше'}</Text>
              </View>
            </View>
          );
        })()}

      </ScrollView>}
    </View>
  );
}
