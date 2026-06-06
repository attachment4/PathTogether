import React, { useState, useEffect } from 'react';
import {
  View, Text, StatusBar, Platform, ScrollView, TouchableOpacity, TextInput, Modal, Alert, Share, Linking,
} from 'react-native';
import { updateProfile } from 'firebase/auth';
import { auth } from '../firebase';
import { Storage } from '../store';
import { Theme } from '../theme';
import { tr } from '../i18n';
import { Subscription, PLAN_LIMITS, getDaysLeft } from '../subscription';
import Svg, { Path, Circle } from 'react-native-svg';

// Локализация
//  Аватар — минималистичный, первая буква + градиентная рамка 
// 8 градиентов в стиле приложения (тёмная палитра)
export const GRADIENT_BORDERS = [
  // Нейтральные
  { id: 'default', colors: ['#888888', '#555555'], label: 'Серый',     emoji: '🩶' },
  { id: 'white',   colors: ['#cccccc', '#888888'], label: 'Серебро',   emoji: '🤍' },
  { id: 'dark',    colors: ['#444444', '#1a1a1a'], label: 'Антрацит',  emoji: '🖤' },
  // Тёплые
  { id: 'sunset',  colors: ['#f97316', '#ec4899'], label: 'Закат',     emoji: '🌅' },
  { id: 'rose',    colors: ['#fb7185', '#f43f5e'], label: 'Роза',      emoji: '🌹' },
  { id: 'amber',   colors: ['#f59e0b', '#ef4444'], label: 'Янтарь',    emoji: '🍊' },
  { id: 'peach',   colors: ['#fdba74', '#fb923c'], label: 'Персик',    emoji: '🍑' },
  // Холодные
  { id: 'ocean',   colors: ['#06b6d4', '#3b82f6'], label: 'Океан',     emoji: '🌊' },
  { id: 'sky',     colors: ['#7dd3fc', '#38bdf8'], label: 'Небо',      emoji: '☁️' },
  { id: 'mint',    colors: ['#34d399', '#059669'], label: 'Мята',      emoji: '🌿' },
  { id: 'forest',  colors: ['#4ade80', '#16a34a'], label: 'Лес',       emoji: '🌲' },
  // Фиолетовые
  { id: 'purple',  colors: ['#a78bfa', '#7c3aed'], label: 'Фиолет.',   emoji: '💜' },
  { id: 'violet',  colors: ['#e879f9', '#a21caf'], label: 'Лаванда',   emoji: '🪻' },
  { id: 'aurora',  colors: ['#818cf8', '#ec4899'], label: 'Аврора',    emoji: '🌌' },
  // Особые
  { id: 'gold',    colors: ['#fbbf24', '#d97706'], label: 'Золото',    emoji: '✨' },
  { id: 'rainbow', colors: ['#f97316', '#8b5cf6'], label: 'Радуга',    emoji: '🌈' },
  { id: 'cosmic',  colors: ['#0ea5e9', '#8b5cf6'], label: 'Космос',    emoji: '🚀' },
  { id: 'cherry',  colors: ['#f43f5e', '#7c3aed'], label: 'Вишня',     emoji: '🍒' },
];

export function getDefaultGradient(name: string) {
  return GRADIENT_BORDERS[(name?.charCodeAt(0) || 0) % GRADIENT_BORDERS.length];
}

// Аватарка: буква на тёмном фоне + цветная рамка-градиент (через 2 View)
export function InitialAvatar({ name, size = 80, gradientId, tk }:
  { name: string; size?: number; gradientId?: string; tk: Theme }) {
  const grad = GRADIENT_BORDERS.find(g => g.id === gradientId) || getDefaultGradient(name);
  const border = 3;
  const inner  = size - border * 2;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2,
      padding: border, backgroundColor: grad.colors[0] }}>
      {/* Симуляция градиента через overlay */}
      <View style={{ position: 'absolute', right: 0, bottom: 0,
        width: size / 2, height: size / 2, borderRadius: size / 2,
        backgroundColor: grad.colors[1], opacity: 0.85 }} />
      <View style={{ width: inner, height: inner, borderRadius: inner / 2,
        backgroundColor: tk.bg2,
        alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: inner * 0.42, fontWeight: '700',
          color: tk.text, letterSpacing: -0.5 }}>
          {name?.[0]?.toUpperCase() || '?'}
        </Text>
      </View>
    </View>
  );
}

//  SVG иконки 
function Icon({ name, color }: { name: string; color: string }) {
  const p = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none' } as const;
  if (name === 'person')   return <Svg {...p}><Circle cx="12" cy="8" r="4" stroke={color} strokeWidth="1.8"/><Path d="M4 20c0-4 3.582-7 8-7s8 3 8 7" stroke={color} strokeWidth="1.8" strokeLinecap="round"/></Svg>;
  if (name === 'lock')     return <Svg {...p}><Path d="M5 11V7a7 7 0 0 1 14 0v4" stroke={color} strokeWidth="1.8" strokeLinecap="round"/><Path d="M3 11h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke={color} strokeWidth="1.8"/><Circle cx="12" cy="16" r="1.5" fill={color}/></Svg>;
  if (name === 'globe')    return <Svg {...p}><Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8"/><Path d="M12 3c-2 3-3 5.5-3 9s1 6 3 9M12 3c2 3 3 5.5 3 9s-1 6-3 9" stroke={color} strokeWidth="1.5"/><Path d="M3 12h18" stroke={color} strokeWidth="1.5"/></Svg>;
  if (name === 'bell')     return <Svg {...p}><Path d="M6 10a6 6 0 0 1 12 0c0 3.5 1.5 5 2 6H4c.5-1 2-2.5 2-6z" stroke={color} strokeWidth="1.8" strokeLinejoin="round"/><Path d="M10 20a2 2 0 0 0 4 0" stroke={color} strokeWidth="1.8"/></Svg>;
  if (name === 'settings') return <Svg {...p}><Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.8"/><Path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke={color} strokeWidth="1.8" strokeLinecap="round"/></Svg>;
  if (name === 'trophy')   return <Svg {...p}><Path d="M8 21h8M12 17v4M5 3H3v4c0 2.2 1.8 4 4 4M19 3h2v4c0 2.2-1.8 4-4 4" stroke={color} strokeWidth="1.8" strokeLinecap="round"/><Path d="M7 3h10v6a5 5 0 0 1-10 0z" stroke={color} strokeWidth="1.8"/></Svg>;
  if (name === 'sun')      return <Svg {...p}><Circle cx="12" cy="12" r="4" stroke={color} strokeWidth="1.8"/><Path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke={color} strokeWidth="1.8" strokeLinecap="round"/></Svg>;
  if (name === 'moon')     return <Svg {...p}><Path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></Svg>;
  if (name === 'edit') return (
    <Svg {...p}>
      <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  );
  if (name === 'crown') return (
    <Svg {...p}>
      <Path d="M2 19h20M3 9l4.5 6 4.5-8 4.5 8L21 9l-1 10H4L3 9z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  );
  // logout
  return <Svg {...p}><Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke={color} strokeWidth="1.8" strokeLinecap="round"/><Path d="M16 17l5-5-5-5M21 12H9" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></Svg>;
}

//  Строка настроек 
function Row({ icon, label, value, isToggle, toggleVal, onToggle, onPress, tk, danger }: {
  icon: string; label: string; value?: string;
  isToggle?: boolean; toggleVal?: boolean; onToggle?: () => void;
  onPress?: () => void; tk: Theme; danger?: boolean;
}) {
  const iconColor = danger ? tk.text2
    : icon === 'sun' ? tk.text2
    : icon === 'moon' ? tk.text2
    : tk.text;
  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress && !isToggle}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14,
        paddingVertical: 15, paddingHorizontal: 16 }}>
      <Icon name={icon} color={iconColor} />
      <Text style={{ flex: 1, fontSize: 15, color: danger ? tk.text2 : tk.text }}>{label}</Text>
      {value !== undefined && (
        <Text style={{ fontSize: 13, color: tk.text3 }}>{value}</Text>
      )}
      {isToggle && (
        <TouchableOpacity onPress={onToggle}
          style={{ width: 46, height: 26, borderRadius: 13,
            backgroundColor: toggleVal ? tk.text : tk.bg3, justifyContent: 'center', padding: 3 }}>
          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: tk.bg,
            alignSelf: toggleVal ? 'flex-end' : 'flex-start' }} />
        </TouchableOpacity>
      )}
      {onPress && !isToggle && (
        <Text style={{ fontSize: 16, color: tk.text3 }}>›</Text>
      )}
    </TouchableOpacity>
  );
}

function Section({ title, children, tk }: { title?: string; children: React.ReactNode; tk: Theme }) {
  return (
    <View style={{ marginBottom: 4 }}>
      {title ? (
        <Text style={{ fontSize: 11, fontWeight: '600', color: tk.text3,
          textTransform: 'uppercase', letterSpacing: 1,
          marginTop: 28, marginBottom: 10, paddingHorizontal: 2 }}>
          {title}
        </Text>
      ) : <View style={{ marginTop: 12 }} />}
      <View style={{ backgroundColor: tk.bg2, borderRadius: 20, overflow: 'hidden' }}>
        {children}
      </View>
    </View>
  );
}

//  Props 
interface Props {
  myId: string; myName: string; lang: string; tk: Theme;
  theme: 'dark' | 'light';
  habitCount: number; friendCount: number; totalDone: number; maxStreak: number;
  partnerName?: string; partnerStreak?: number; partnerJoined?: string;
  subscription: Subscription;
  onToggleTheme: () => void;
  onLanguageChange: (l: string) => void;
  onNameChange: (n: string) => void;
  onLogout: () => void;
  onBack: () => void;
  onOpenAchievements: () => void;
  onOpenMood: () => void;
  onOpenSettings: () => void;
  onOpenPro: () => void;
  onOpenStats: () => void;
  onAvatarChange: (id: string) => void;
  selectedAvatar?: string;
}

//  Главный компонент 
export default function ProfileScreen({
  myId, myName, lang, tk, theme, habitCount, totalDone, maxStreak,
  partnerName, partnerStreak, partnerJoined, subscription,
  onToggleTheme, onLanguageChange, onNameChange, onLogout,
  onBack, onOpenAchievements, onOpenMood, onOpenSettings, onOpenPro, onOpenStats,
}: Props) {
  const isEn = lang === 'en';
  const L = (ru: string, en: string, uk?: string, be?: string, kk?: string) =>
    lang==='en' ? en : lang==='uk' ? (uk||ru) : lang==='be' ? (be||ru) : lang==='kk' ? (kk||ru) : ru;
  const user = auth.currentUser;
  const [showNameEdit,   setShowNameEdit]   = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [nameInput,      setNameInput]      = useState(myName);
  const [showGradPicker, setShowGradPicker] = useState(false);
  const [gradientId,     setGradientId]     = useState<string | undefined>(undefined);
  useEffect(() => {
    Storage.get<string>(`gradient_${myId}`).then(id => {
      if (id) setGradientId(id);
    }).catch(() => {});
  }, [myId]);
  const planColor = PLAN_LIMITS[subscription.plan].color;
  const daysLeft  = getDaysLeft(subscription);

  const submitName = async () => {
    if (!nameInput.trim()) return;
    try {
      if (user) await updateProfile(user, { displayName: nameInput.trim() });
      await Storage.saveName(nameInput.trim());
      onNameChange(nameInput.trim());
      setShowNameEdit(false);
    } catch {}
  };

  const TOP_H = Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight || 24) + 12;
  return (
    <View style={{ flex: 1, backgroundColor: tk.bg }}>
      {/* Sticky header с кнопкой назад */}
      <View style={{ flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: TOP_H, paddingBottom: 12,
        backgroundColor: tk.bg, zIndex: 10, gap: 12 }}>
        <TouchableOpacity onPress={onBack}
          style={{ width: 36, height: 36, borderRadius: 10,
            backgroundColor: tk.bg2, borderWidth: 1, borderColor: tk.border,
            alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M19 12H5M5 12l7 7M5 12l7-7"
              stroke={tk.text2} strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round"/>
          </Svg>
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: '600', color: tk.text }}>
          {(lang === 'en' ? 'Profile' : 'Профиль')}
        </Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        removeClippedSubviews={true}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}>

        {/* Аватар */}
        <View style={{ alignItems: 'center', marginTop: 20, marginBottom: 6 }}>
          <TouchableOpacity onPress={() => setShowGradPicker(true)} activeOpacity={0.85}>
            <InitialAvatar name={myName} size={88} gradientId={gradientId} tk={tk} />
            {/* Мини-метка "изменить" */}
            <View style={{ position: 'absolute', bottom: 0, right: 0,
              width: 24, height: 24, borderRadius: 12,
              backgroundColor: tk.bg, borderWidth: 1.5, borderColor: tk.border,
              alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke={tk.text2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <Path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" stroke={tk.text2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </Svg>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setNameInput(myName); setShowNameEdit(true); }}
            activeOpacity={0.7}
            style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 6,
              paddingHorizontal: 12, paddingVertical: 6,
              backgroundColor: tk.bg2, borderRadius: 12,
              borderWidth: 1, borderColor: tk.border }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: tk.text }}>{myName}</Text>
            <Icon name="edit" color={tk.text2} />
          </TouchableOpacity>
          <Text style={{ fontSize: 11, color: tk.text3, marginTop: 5 }}>
            {lang === 'en' ? 'Tap to change name' : 'Нажми чтобы изменить имя'}
          </Text>
          <Text style={{ fontSize: 12, color: tk.text3, marginTop: 1 }}>{user?.email}</Text>

          {/* Бейдж плана */}
          <TouchableOpacity onPress={onOpenPro}
            style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6,
              paddingHorizontal: 12, paddingVertical: 5,
              backgroundColor: planColor + '18', borderRadius: 20,
              borderWidth: 1, borderColor: planColor + '35' }}>
            <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
              {subscription.plan === 'duo'
                ? <Path d="M12 21C12 21 3 14.5 3 8.5a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-9 12.5-9 12.5z" stroke={planColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                : subscription.plan === 'team'
                  ? <Path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke={planColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  : <Circle cx="12" cy="12" r="9" stroke={planColor} strokeWidth="1.8" fill="none"/>}
            </Svg>
            <Text style={{ fontSize: 11, fontWeight: '600', color: planColor }}>
              {subscription.isAdmin
                ? ((lang === 'en' ? 'Admin' : 'Администратор'))
                : subscription.isEarlyBird
                  ? `Early Bird · ${isEn ? PLAN_LIMITS[subscription.plan].label_en : PLAN_LIMITS[subscription.plan].label_ru}`
                  : (isEn ? PLAN_LIMITS[subscription.plan].label_en : PLAN_LIMITS[subscription.plan].label_ru)}
            </Text>
            {daysLeft !== null && (
              <Text style={{ fontSize: 10, color: tk.text3 }}>· {daysLeft} {(lang === 'en' ? 'd' : 'дн.')}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Статистика */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 4 }}>
          {[
            { value: habitCount.toString(), label: (lang === 'en' ? 'habits' : 'привычек'), color: tk.text },
            { value: `${maxStreak}`, label: (lang === 'en' ? 'best streak' : lang==='uk' ? 'рекорд серії' : 'рекорд серии'), color: maxStreak >= 30 ? tk.accent : tk.text },
            { value: totalDone.toString(), label: (lang === 'en' ? 'done' : 'выполнено'), color: tk.text2 },
          ].map((s, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: tk.bg2, borderRadius: 14,
              padding: 12, alignItems: 'center', borderWidth: 1, borderColor: tk.border }}>
              <Text style={{ fontSize: 22, fontWeight: '500', color: s.color, letterSpacing: -0.5 }} numberOfLines={1} adjustsFontSizeToFit>{s.value}</Text>
              <Text style={{ fontSize: 10, color: tk.text3, textTransform: 'uppercase',
                fontWeight: '400', marginTop: 4, letterSpacing: 0.5, textAlign: 'center' }} numberOfLines={1}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Блок подписки */}
        {!subscription.isAdmin && (
          subscription.plan === 'free' ? (
            /* Не подписан — предлагаем */
            <TouchableOpacity onPress={onOpenPro}
              style={{ borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)',
                borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center',
                justifyContent: 'space-between', marginTop: 16, backgroundColor: 'rgba(212,175,55,0.04)' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20,
                  backgroundColor: 'rgba(212,175,55,0.1)', borderWidth: 1,
                  borderColor: 'rgba(212,175,55,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="crown" color={tk.text2} />
                </View>
                <View>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: tk.text2 }}>
                    {(lang === 'en' ? 'Get PRO' : 'Получить PRO')}
                  </Text>
                  <Text style={{ fontSize: 11, color: tk.text3, marginTop: 1 }}>
                    {(lang === 'en' ? 'Habits with partner · from 129 ₽/mo' : 'Привычки с партнёром · от 129 ₽/мес')}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 18, color: 'rgba(212,175,55,0.5)' }}>›</Text>
            </TouchableOpacity>
          ) : (
            /* Подписан — показываем управление */
            <View style={{ borderWidth: 1, borderColor: `${planColor}30`,
              borderRadius: 20, padding: 16, marginTop: 16,
              backgroundColor: `${planColor}08` }}>
              {/* Шапка с тарифом */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10,
                    backgroundColor: `${planColor}15`, alignItems: 'center', justifyContent: 'center' }}>
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                      {subscription.plan === 'duo'
                        ? <Path d="M12 21C12 21 3 14.5 3 8.5a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-9 12.5-9 12.5z" stroke={planColor} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                        : <Path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke={planColor} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>}
                    </Svg>
                  </View>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: planColor }}>
                      {isEn ? PLAN_LIMITS[subscription.plan].label_en : PLAN_LIMITS[subscription.plan].label_ru}
                    </Text>
                    {daysLeft !== null && (
                      <Text style={{ fontSize: 10, color: tk.text3 }}>
                        {isEn ? `${daysLeft} days left` : `Осталось ${daysLeft} дн.`}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={{ backgroundColor: `${planColor}20`, borderRadius: 8,
                  paddingHorizontal: 8, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: planColor }}>
                    {(lang === 'en' ? 'ACTIVE' : 'АКТИВНА')}
                  </Text>
                </View>
              </View>
              {/* Что включено */}
              <View style={{ gap: 6, marginBottom: 12 }}>
                {(subscription.plan === 'duo' ? [
                  (lang === 'en' ? 'Shared habits with 1 partner' : 'Общие привычки с 1 партнёром'),
                  (lang === 'en' ? 'Partner activity notifications' : 'Уведомления об активности партнёра'),
                  (lang === 'en' ? 'Joint streaks & achievements' : 'Совместные серии и достижения'),
                ] : [
                  (lang === 'en' ? 'Up to 5 team members' : 'До 5 участников команды'),
                  (lang === 'en' ? 'Team statistics & overview' : 'Командная статистика'),
                  (lang === 'en' ? 'Task tracking (Jira-style)' : 'Трекинг задач'),
                  (lang === 'en' ? 'All Couple features' : 'Все функции тарифа «Пара»'),
                ]).map((feat, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: planColor }} />
                    <Text style={{ fontSize: 12, color: tk.text2 }}>{feat}</Text>
                  </View>
                ))}
              </View>
              {/* Кнопки */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={onOpenPro}
                  style={{ flex: 1, backgroundColor: `${planColor}18`, borderWidth: 1,
                    borderColor: `${planColor}30`, borderRadius: 12, padding: 10,
                    alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: planColor }}>
                    {(lang === 'en' ? 'Change plan' : 'Сменить тариф')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => Linking.openURL('https://www.rustore.ru/account/subscriptions').catch(()=>{})}
                  style={{ flex: 1, backgroundColor: tk.border, borderWidth: 1,
                    borderColor: tk.border, borderRadius: 12, padding: 10,
                    alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: tk.text3 }}>
                    {(lang === 'en' ? 'Manage' : 'Управление')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        )}

        {/* Партнёр */}
        {partnerName && (
          <Section title={(lang === 'en' ? 'Partner' : 'Партнёр')} tk={tk}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12,
              padding: 16, justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <InitialAvatar name={partnerName} size={44} tk={tk} />
                <View>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: tk.text }}>{partnerName}</Text>
                  {partnerJoined && (
                    <Text style={{ fontSize: 11, color: tk.text3, marginTop: 2 }}>
                      {(lang === 'en' ? 'Since' : 'С')} {partnerJoined}
                    </Text>
                  )}
                </View>
              </View>
              {partnerStreak !== undefined && partnerStreak > 0 && (
                <View style={{ backgroundColor: 'rgba(249,115,22,0.1)',
                  borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)',
                  borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: tk.text2 }}>
                     {partnerStreak} {(lang === 'en' ? 'd' : 'дн.')}
                  </Text>
                </View>
              )}
            </View>
          </Section>
        )}

        {/* Профиль */}
        <TouchableOpacity
          onPress={() => {
            const msg = isEn
              ? `I completed ${totalDone} habits in PathTogether! Max streak: ${maxStreak} days.`
              : `Выполнил ${totalDone} привычек в PathTogether! Серия: ${maxStreak} дней.`;
            Share.share({ message: msg });
          }}
          style={{ backgroundColor: tk.bg2, borderWidth: 1, borderColor: tk.border,
            borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 20, marginBottom: 8,
            flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"
              stroke={tk.text2} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
          </Svg>
          <Text style={{ fontSize: 13, fontWeight: '600', color: tk.text2 }}>
            {(lang === 'en' ? 'Share my progress' : lang==='uk' ? 'Поділитися прогресом' : lang==='be' ? 'Падзяліцца прагрэсам' : lang==='kk' ? 'Прогреспен бөлісу' : 'Поделиться прогрессом')}
          </Text>
        </TouchableOpacity>

        <Section title={(lang === 'en' ? 'Profile' : 'Профиль')} tk={tk}>
          <Row icon="person" label={(lang === 'en' ? 'Name' : 'Имя')} value={myName}
            onPress={() => { setNameInput(myName); setShowNameEdit(true); }} tk={tk} />
          <Row icon="lock" label={(lang === 'en' ? 'Password' : 'Пароль')} value="••••••••"
            onPress={onOpenSettings} tk={tk} />
        </Section>

        {/* Настройки */}
        <Section title={(lang === 'en' ? 'Settings' : 'Настройки')} tk={tk}>
          <Row icon={theme === 'dark' ? 'moon' : 'sun'}
            label={(lang === 'en' ? 'Dark theme' : 'Тёмная тема')}
            isToggle toggleVal={theme === 'dark'} onToggle={onToggleTheme} tk={tk} />
          <Row icon="globe" label={(lang === 'en' ? 'Language' : lang==='uk' ? 'Мова' : lang==='be' ? 'Мова' : lang==='kk' ? 'Тіл' : 'Язык')}
            value={{ ru:'Русский', en:'English', uk:'Українська', be:'Беларуская', kk:'Қазақша' }[lang] || 'Русский'}
            onPress={() => setShowLangPicker(true)} tk={tk} />
          <Row icon="trophy" label={(lang === 'en' ? 'Achievements' : lang==='uk' ? 'Досягнення' : lang==='be' ? 'Дасягненні' : lang==='kk' ? 'Жетістіктер' : 'Достижения')}
            onPress={onOpenAchievements} tk={tk} />
          <Row icon="heart" label={(lang === 'en' ? 'Mood Tracker' : lang==='uk' ? 'Трекер настрою' : 'Трекер настроения')}
            onPress={onOpenMood} tk={tk} />
          <Row icon="settings" label={(lang === 'en' ? 'Statistics' : 'Статистика')}
            onPress={onOpenStats} tk={tk} />
          <Row icon="settings" label={(lang === 'en' ? 'Advanced settings' : lang==='uk' ? 'Розширені налаштування' : lang==='be' ? 'Пашыраныя налады' : lang==='kk' ? 'Кеңейтілген параметрлер' : 'Расширенные настройки')}
            onPress={onOpenSettings} tk={tk} />
        </Section>

        {/* Выход */}
        <Section tk={tk}>
          <Row icon="logout" label={(lang === 'en' ? 'Sign out' : 'Выйти из аккаунта')}
            onPress={onLogout} tk={tk} danger />
        </Section>

        <Text style={{ fontSize: 11, color: tk.text3, textAlign: 'center', marginTop: 20 }}>
          PathTogether v2.0
        </Text>

      </ScrollView>

      {/* Modal: Выбор градиента аватарки */}
      {/* Gradient Border Picker Modal */}
      <Modal visible={showGradPicker} transparent animationType="slide"
        onRequestClose={() => setShowGradPicker(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowGradPicker(false)} />
          <View style={{ backgroundColor: tk.bg, borderTopLeftRadius: 24,
            borderTopRightRadius: 24, paddingBottom: 44, paddingTop: 12,
            paddingHorizontal: 24 }}>
            <View style={{ width: 36, height: 4, backgroundColor: tk.border,
              borderRadius: 2, alignSelf: 'center', marginBottom: 20 }}/>
            <Text style={{ fontSize: 17, fontWeight: '700', color: tk.text, marginBottom: 4 }}>
              {(lang === 'en' ? 'Avatar style' : 'Стиль аватарки')}
            </Text>
            <Text style={{ fontSize: 12, color: tk.text3, marginBottom: 20 }}>
              {(lang === 'en' ? 'Pick a colour — your partner will see it too' : 'Партнёр тоже увидит твой цвет')}
            </Text>
            {/* Предпросмотр */}
            <View style={{ alignItems: 'center', marginBottom: 20, gap: 6 }}>
              <InitialAvatar name={myName} size={80} gradientId={gradientId} tk={tk} />
              <Text style={{ fontSize: 12, color: tk.text3 }}>
                {(() => {
                  const cur = GRADIENT_BORDERS.find(g => g.id === (gradientId || getDefaultGradient(myName).id));
                  return cur ? `${cur.emoji}  ${cur.label}` : '';
                })()}
              </Text>
            </View>
            {/* Сетка цветов */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 20 }}>
              {GRADIENT_BORDERS.map(g => {
                const isSelected = (gradientId || getDefaultGradient(myName).id) === g.id;
                return (
                  <TouchableOpacity key={g.id}
                    onPress={() => setGradientId(g.id)}
                    style={{ alignItems: 'center', gap: 5, width: 56 }}>
                    <View style={{
                      width: 48, height: 48, borderRadius: 24,
                      padding: 3, backgroundColor: g.colors[0],
                      borderWidth: isSelected ? 3 : 1.5,
                      borderColor: isSelected ? tk.text : 'transparent',
                      shadowColor: isSelected ? g.colors[0] : 'transparent',
                      shadowOpacity: isSelected ? 0.6 : 0,
                      shadowRadius: 6, elevation: isSelected ? 4 : 0,
                    }}>
                      <View style={{ position: 'absolute', right: 3, bottom: 3,
                        width: 18, height: 18, borderRadius: 9,
                        backgroundColor: g.colors[1], opacity: 0.9 }} />
                      <View style={{ flex: 1, borderRadius: 21,
                        backgroundColor: tk.bg2, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: tk.text }}>
                          {myName?.[0]?.toUpperCase() || '?'}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 8, color: isSelected ? tk.text : tk.text3,
                      fontWeight: isSelected ? '700' : '400', textAlign: 'center' }}>
                      {g.emoji}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              onPress={async () => {
                if (gradientId) {
                  await Storage.set(`gradient_${myId}`, gradientId);
                }
                setShowGradPicker(false);
              }}
              style={{ backgroundColor: tk.text, borderRadius: 14,
                padding: 15, alignItems: 'center' }}>
              <Text style={{ color: tk.bg, fontSize: 15, fontWeight: '700' }}>
                {(lang === 'en' ? 'Done' : 'Готово')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Language Picker Modal */}
      <Modal visible={showLangPicker} transparent animationType="slide"
        onRequestClose={() => setShowLangPicker(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowLangPicker(false)} />
          <View style={{ backgroundColor: tk.bg, borderTopLeftRadius: 24,
            borderTopRightRadius: 24, paddingBottom: 44, paddingTop: 12 }}>
            <View style={{ width: 36, height: 4, backgroundColor: tk.border,
              borderRadius: 2, alignSelf: 'center', marginBottom: 20 }}/>
            <Text style={{ fontSize: 11, fontWeight: '700', color: tk.text3,
              letterSpacing: 2, textTransform: 'uppercase',
              paddingHorizontal: 24, marginBottom: 8 }}>
              {(lang === 'en' ? 'Language' : lang==='uk' ? 'Мова' : lang==='be' ? 'Мова' : lang==='kk' ? 'Тіл' : 'Язык')}
            </Text>
            {[
              { code: 'ru', label: 'Русский',    sub: 'Russian' },
              { code: 'en', label: 'English',    sub: 'Английский' },
              { code: 'uk', label: 'Українська', sub: 'Украинский' },
              { code: 'be', label: 'Беларуская', sub: 'Белорусский' },
              { code: 'kk', label: 'Қазақша',    sub: 'Казахский' },
            ].map((l, i, arr) => (
              <TouchableOpacity key={l.code}
                onPress={() => { onLanguageChange(l.code); setShowLangPicker(false); }}
                style={{ flexDirection: 'row', alignItems: 'center',
                  justifyContent: 'space-between', paddingHorizontal: 24,
                  paddingVertical: 16, borderBottomWidth: i < arr.length-1 ? 0.5 : 0,
                  borderColor: tk.border }}>
                <View>
                  <Text style={{ fontSize: 16, color: lang === l.code ? tk.text : tk.text2,
                    fontWeight: lang === l.code ? '600' : '400' }}>{l.label}</Text>
                  <Text style={{ fontSize: 11, color: tk.text3, marginTop: 2 }}>{l.sub}</Text>
                </View>
                {lang === l.code && (
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                    <Path d="M5 13l4 4L19 7" stroke={tk.text} strokeWidth="2.5"
                      strokeLinecap="round" strokeLinejoin="round"/>
                  </Svg>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Modal: Изменить имя */}
      <Modal visible={showNameEdit} transparent animationType="slide"
        onRequestClose={() => setShowNameEdit(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
          activeOpacity={1} onPress={() => setShowNameEdit(false)}>
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
            <TouchableOpacity activeOpacity={1}>
              <View style={{ backgroundColor: tk.bg2, borderTopLeftRadius: 28,
                borderTopRightRadius: 28, padding: 24, paddingBottom: 48,
                borderTopWidth: 1, borderColor: tk.border }}>
                <View style={{ width: 36, height: 4, borderRadius: 2,
                  backgroundColor: tk.border, alignSelf: 'center', marginBottom: 20 }} />
                <Text style={{ fontSize: 17, fontWeight: '700', color: tk.text, marginBottom: 14 }}>
                  {(lang === 'en' ? 'Change name' : 'Изменить имя')}
                </Text>
                <TextInput value={nameInput} onChangeText={setNameInput} autoFocus
                  placeholder={(lang === 'en' ? 'Your name' : lang==='uk' ? "Ваше ім'я" : lang==='be' ? 'Ваша імя' : lang==='kk' ? 'Сіздің атыңыз' : 'Ваше имя')}
                  placeholderTextColor={tk.text3}
                  style={{ backgroundColor: tk.bg3, borderWidth: 1, borderColor: tk.border,
                    borderRadius: 14, padding: 14, fontSize: 16, color: tk.text,
                    marginBottom: 14 }} />
                <TouchableOpacity onPress={submitName}
                  style={{ backgroundColor: tk.text, borderRadius: 14,
                    padding: 15, alignItems: 'center' }}>
                  <Text style={{ color: tk.bg, fontSize: 15, fontWeight: '700' }}>
                    {(lang === 'en' ? 'Save' : 'Сохранить')}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
