import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, RefreshControl,
  Animated, PanResponder, NativeScrollEvent, Dimensions,
  NativeSyntheticEvent,
} from 'react-native';

const { width: SCREEN_W } = Dimensions.get('window');
import { Theme, WD_RU, WD_EN, MON_GENITIVE_RU, MONTHS_EN } from '../theme';
import { tr } from '../i18n';
import { Habit, Member, Storage, CalEvent } from '../store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { todayS, todayDow, isLogged, dateToS, calcStreak, calcJointStreak } from '../utils';
import { GlassCard } from '../components/GlassCard';
import ReactionPicker, { REACTION_SET, ReactionKey } from '../components/ReactionPicker';
import { InitialAvatar as ProfileAvatar } from './ProfileScreen';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

function HabitSvgIcon({ icon, color }: { icon: string; color: string }) {
  const s = { stroke: color, strokeWidth: '1.6', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  if (icon === 'exercise') return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" {...s}/>
    </Svg>
  );
  if (icon === 'read') return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M2 6s1.5-2 5-2 5 2 5 2v14s-1.5-1-5-1-5 1-5 1V6z" {...s}/>
      <Path d="M12 6s1.5-2 5-2 5 2 5 2v14s-1.5-1-5-1-5 1-5 1V6z" {...s}/>
    </Svg>
  );
  if (icon === 'water') return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2L6 10a6 6 0 1 0 12 0L12 2z" {...s}/>
    </Svg>
  );
  if (icon === 'meditate') return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="6" r="2.5" {...s}/>
      <Path d="M5 20c0-4 3-6 7-6s7 2 7 6" {...s}/>
      <Path d="M3 16c1-1 2.5-1.5 4-1M21 16c-1-1-2.5-1.5-4-1" {...s}/>
    </Svg>
  );
  if (icon === 'nosocial') return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Rect x="5" y="2" width="14" height="20" rx="2" {...s}/>
      <Line x1="4" y1="4" x2="20" y2="20" {...s}/>
    </Svg>
  );
  if (icon === 'walk') return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="4" r="1.5" {...s}/>
      <Path d="M9 9l3-2 3 2-1 4-2 1-2-1-1-4z" {...s}/>
      <Path d="M8 22l2-5 2 2 2-2 2 5" {...s}/>
      <Path d="M7 14l-2 1M17 14l2 1" {...s}/>
    </Svg>
  );
  return null;
}

// Локализация
const KNOWN_SVG_ICONS = ['exercise','read','water','meditate','nosocial','walk'];

//  Утилиты 
//  Цвет текста по фону карточки 
function textColorForBg(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0,2),16);
  const g = parseInt(h.substring(2,4),16);
  const b = parseInt(h.substring(4,6),16);
  return (r*299+g*587+b*114)/1000 > 160 ? '#111' : '#fff';
}

const AVATAR_COLORS = [
  ['#888888','#555555'], ['#777777','#444444'], ['#999999','#666666'],
  ['#aaaaaa','#777777'], ['#666666','#333333'], ['#bbbbbb','#888888'],
  ['#555555','#333333'], ['#cccccc','#999999'],
];
//  Snackbar
function Snackbar({ message, onUndo, tk, lang = 'ru' }: {
  message: string; onUndo: () => void; tk: Theme; lang?: string;
}) {
  const undoLabel = lang === 'en' ? 'Undo' : lang === 'uk' ? 'Скасувати' : lang === 'be' ? 'Адмяніць' : lang === 'kk' ? 'Болдырмау' : 'Отменить';
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start();
  }, []);
  return (
    <Animated.View style={{
      position: 'absolute', bottom: 110, left: 16, right: 16,
      backgroundColor: tk.bg3, borderRadius: 16,
      borderWidth: 1, borderColor: tk.border,
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 14, paddingHorizontal: 16,
      shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 16, elevation: 10,
      transform: [{ scale: anim }, { translateY: anim.interpolate({ inputRange: [0,1], outputRange: [20, 0] }) }],
      opacity: anim,
    }}>
      <Text style={{ flex: 1, fontSize: 13, color: tk.text }}>🗑 {message}</Text>
      <TouchableOpacity onPress={onUndo}
        style={{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: 9,
          backgroundColor: '#e07a5f' }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>{undoLabel}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

//  Свайпаемая карточка привычки
interface SwipeCardProps {
  habit: Habit; myDone: boolean; partDone: boolean | null;
  hasPartner: boolean; tk: Theme; isEn: boolean;
  streak?: number; isFlashing?: boolean;
  count?: number;
  partnerReactions?: ReactionKey[]; // реакции партнёра на эту привычку
  partnerNeedsConfirm?: boolean;  // партнёр выполнил, ждёт подтверждения от меня
  onConfirmPartner?: () => void;  // я подтверждаю выполнение партнёра
  myPendingConfirm?: boolean;     // я отметил, жду подтверждения от партнёра
  onReact?: (key: ReactionKey) => void; // реакция на shared-привычку
  reactionGroups?: import('../components/ReactionPicker').ReactionGroup[]; // для shared
  onToggle: () => void; onPress: () => void; onDelete: () => void;
  onLongPress?: () => void; onCountChange?: (n: number) => void;
  isDragging?: boolean; lang?: string;
}

function SwipeCard({ habit: h, myDone, partDone, hasPartner, tk, isEn,
  streak = 0, isFlashing, count, partnerReactions, onReact, reactionGroups,
  partnerNeedsConfirm, onConfirmPartner, myPendingConfirm,
  onToggle, onPress, onDelete, onLongPress, onCountChange, isDragging, lang = 'ru' }: SwipeCardProps) {

  const translateX = useRef(new Animated.Value(0)).current;
  const doneScale  = useRef(new Animated.Value(1)).current;
  const flashAnim  = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    if (isFlashing) {
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start();
    }
  }, [isFlashing]);
  const opacity    = useRef(new Animated.Value(1)).current;
  const isSwiping  = useRef(new Animated.Value(0)).current;
  const THRESHOLD  = 55;

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder: (_, gs) =>
      !isDragging &&
      Math.abs(gs.dx) > 14 && Math.abs(gs.dx) > Math.abs(gs.dy) * 2.5,
    onPanResponderGrant: () => {
      translateX.setOffset((translateX as any)._value);
      translateX.setValue(0);
      Animated.timing(isSwiping, { toValue: 1, duration: 80, useNativeDriver: true }).start();
    },
    onPanResponderMove: (_, gs) => {
      const max = myDone ? 0 : 70;
      translateX.setValue(Math.min(Math.max(gs.dx, -300), max));
    },
    onPanResponderRelease: (_, gs) => {
      translateX.flattenOffset();
      Animated.timing(isSwiping, { toValue: 0, duration: 150, useNativeDriver: true }).start();
      if (gs.dx > THRESHOLD && !myDone) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Animated.sequence([
          Animated.timing(translateX, { toValue: 16, duration: 80, useNativeDriver: true }),
          Animated.spring(translateX, { toValue: 0, friction: 5, tension: 80, useNativeDriver: true }),
        ]).start();
        onToggle();
      } else if (gs.dx < -THRESHOLD * 1.4) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Animated.parallel([
          Animated.timing(translateX, { toValue: -400, duration: 200, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start(() => { translateX.setValue(0); opacity.setValue(1); isSwiping.setValue(0); onDelete(); });
      } else {
        Animated.spring(translateX, { toValue: 0, friction: 7, useNativeDriver: true }).start();
      }
    },
    onPanResponderTerminate: () => {
      translateX.flattenOffset();
      Animated.spring(translateX, { toValue: 0, friction: 7, useNativeDriver: true }).start();
      Animated.timing(isSwiping, { toValue: 0, duration: 100, useNativeDriver: true }).start();
    },
  })).current;

  const isQuit = h.type === 'quit';
  const hasColor = h.color && h.color !== '#ffffff' && h.color !== '#f5f5f5' && h.color !== '#e8e8e8';
  const isDarkTheme = tk.bg === '#0c0c0c' || tk.bg === '#0a0a0a';
  const quitColor = myDone
    ? (isDarkTheme ? '#3d2020' : '#c8a0a0')
    : (isDarkTheme ? '#1e3328' : '#a0c8b0');
  const cardBg = isQuit ? quitColor : (hasColor ? h.color : tk.bg2);
  const txtColor = textColorForBg(cardBg);

  // Анимация при выполнении
  const prevDoneRef = useRef(myDone);
  useEffect(() => {
    if (myDone && !prevDoneRef.current) {
      Animated.sequence([
        Animated.spring(doneScale, { toValue: 1.04, friction: 4, tension: 120, useNativeDriver: true }),
        Animated.spring(doneScale, { toValue: 1,    friction: 4, tension: 120, useNativeDriver: true }),
      ]).start();
    }
    prevDoneRef.current = myDone;
  }, [myDone]);

  const deleteProgress = translateX.interpolate({ inputRange: [-THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' });
  const checkProgress  = translateX.interpolate({ inputRange: [0, THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' });
  const deleteScale = translateX.interpolate({ inputRange: [-THRESHOLD*2, -THRESHOLD, 0], outputRange: [1.2, 1, 0.5], extrapolate: 'clamp' });
  const checkScale  = translateX.interpolate({ inputRange: [0, THRESHOLD, THRESHOLD*2], outputRange: [0.5, 1, 1.2], extrapolate: 'clamp' });

  return (
    <View style={{ marginBottom: 8 }}>
      {/* Фон удаления */}
      <Animated.View style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: 18, backgroundColor: 'rgba(180,30,30,0.15)',
        opacity: Animated.multiply(isSwiping, deleteProgress),
        alignItems: 'flex-end', justifyContent: 'center', paddingRight: 20,
      }}>
        <Animated.View style={{ transform: [{ scale: deleteScale }],
          width: 36, height: 36, borderRadius: 18,
          backgroundColor: 'rgba(220,50,50,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"><Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="rgba(220,50,50,0.8)" strokeWidth="1.5" strokeLinecap="round"/></Svg>
        </Animated.View>
      </Animated.View>
      {/* Фон чека */}
      {!myDone && (
        <Animated.View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          borderRadius: 18, backgroundColor: 'rgba(30,180,80,0.15)',
          opacity: Animated.multiply(isSwiping, checkProgress),
          alignItems: 'flex-start', justifyContent: 'center', paddingLeft: 20,
        }}>
          <Animated.View style={{ transform: [{ scale: checkScale }],
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: 'rgba(50,200,100,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 18 }}></Text>
          </Animated.View>
        </Animated.View>
      )}

      <Animated.View style={{ transform: [{ translateX }, { scale: doneScale }],
        opacity: isDragging ? 0.3 : opacity }}
        {...pan.panHandlers}>
        <TouchableOpacity onPress={onPress} onLongPress={onLongPress} delayLongPress={300} activeOpacity={0.75}>
          <View style={{ position: 'relative' }}>
          {isFlashing && (
            <Animated.View style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              borderRadius: 18, backgroundColor: tk.text,
              opacity: flashAnim, zIndex: 10, pointerEvents: 'none'
            }}/>
          )}
          <View style={{
            backgroundColor: tk.bg2,
            borderRadius: 14,
            borderWidth: myDone ? 1 : 1,
            borderColor: myDone ? tk.border : (hasColor ? h.color + '55' : tk.border),
            paddingHorizontal: 14, paddingVertical: 14,
            overflow: 'hidden',
          }}>
            {/* Верхняя строка: точка + название + чекбокс */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'nowrap' }}>
            {/* Цветная точка */}
            <View style={{
              width: 8, height: 8, borderRadius: 4, flexShrink: 0,
              backgroundColor: hasColor ? h.color : (isQuit ? '#e87a7a' : tk.border),
              opacity: myDone ? 0.55 : 1,
            }}/>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={{
                  fontSize: 15,
                  fontWeight: '500', letterSpacing: -0.3,
                  color: tk.text, opacity: (myDone && !myPendingConfirm) ? 0.55 : 1,
                  textDecorationLine: (myDone && !myPendingConfirm) ? 'line-through' : 'none',
                  lineHeight: 22,
                }} numberOfLines={2}>{h.name}</Text>
                {myPendingConfirm && (
                  <Text style={{ fontSize: 10, color: tk.text2, fontWeight: '600' }}>⏳</Text>
                )}
              </View>
              {myPendingConfirm && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <Text style={{ fontSize: 10, color: tk.text3 }}>
                    {lang === 'en' ? 'Pending partner confirmation' : 'Ожидает подтверждения партнёра'}
                  </Text>
                  <TouchableOpacity onPress={onToggle}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Text style={{ fontSize: 9, color: tk.text3, textDecorationLine: 'underline' }}>
                      {lang === 'en' ? 'cancel' : 'отменить'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              {h.time && !myPendingConfirm && <Text style={{ fontSize: 12, color: tk.text3, marginTop: 3 }}>{h.time}</Text>}

              {/* Таймер */}
              {!!h.timerSeconds && h.timerSeconds > 0 && !myDone && (() => {
                const mins = Math.floor(h.timerSeconds / 60);
                return (
                  <TouchableOpacity
                    onStartShouldSetResponder={() => true}
                    onPress={onPress}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                      <Path d="M12 6v6l4 2M12 2a10 10 0 100 20A10 10 0 0012 2z"
                        stroke={txtColor} strokeWidth="1.8" strokeLinecap="round" opacity={0.85}/>
                    </Svg>
                    <Text style={{ fontSize: 10, color: txtColor, opacity: 0.85 }}>
                      {mins} {lang === 'en' ? 'min · tap to start' : 'мин · открой для запуска'}
                    </Text>
                  </TouchableOpacity>
                );
              })()}

              {!!h.target && h.target > 0 && (
                <View
                  onStartShouldSetResponder={() => true}
                  onResponderGrant={() => {}}
                  style={{ marginTop: 10 }}>
                  {/* Progress bar */}
                  <View style={{ height: 2, backgroundColor: tk.border,
                    borderRadius: 1, marginBottom: 8 }}>
                    <View style={{ height: 2, borderRadius: 1,
                      width: `${Math.min(100, Math.round(((count||0)/h.target!)*100))}%` as any,
                      backgroundColor: tk.accent }} />
                  </View>
                  {/* Controls row */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 0 }}>
                    <TouchableOpacity
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={(e) => { e.stopPropagation(); onCountChange?.(Math.max(0, (count||0) - 1)); }}
                      style={{ width: 32, height: 32, borderRadius: 16,
                        borderWidth: 1.5,
                        borderColor: txtColor === '#fff' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)',
                        backgroundColor: txtColor === '#fff' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                        alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 18, color: txtColor, lineHeight: 20 }}>−</Text>
                    </TouchableOpacity>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ fontSize: 17, fontWeight: '500', color: tk.text, letterSpacing: -0.3 }}>
                        {count||0}<Text style={{ fontSize: 13, fontWeight: '400', color: tk.text3 }}>/{h.target}{h.unit ? ` ${h.unit}` : ''}</Text>
                      </Text>
                    </View>
                    <TouchableOpacity
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={(e) => { e.stopPropagation(); onCountChange?.(Math.min(h.target!, (count||0) + 1)); }}
                      style={{ width: 32, height: 32, borderRadius: 16,
                        borderWidth: 1.5,
                        borderColor: (count||0) >= h.target!
                          ? (txtColor === '#fff' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)')
                          : (txtColor === '#fff' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)'),
                        backgroundColor: (count||0) >= h.target!
                          ? 'transparent'
                          : (txtColor === '#fff' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                        opacity: (count||0) >= h.target! ? 0.4 : 1,
                        alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 18, color: txtColor, lineHeight: 20 }}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}


              {/* Бейдж «Совместная цель» */}
              {h.isShared && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 }}>
                  <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                    <Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
                      stroke={tk.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </Svg>
                  <Text style={{ fontSize: 10, color: tk.accent, fontWeight: '600' }}>
                    {lang === 'en' ? 'shared' : 'совместная'}
                  </Text>
                </View>
              )}
              {!!h.desc && (
                <Text style={{ fontSize: 10, color: txtColor, opacity: 0.85, marginTop: 2,
                  lineHeight: 14 }} numberOfLines={1}>
                  {h.desc}
                </Text>
              )}
              {isQuit && streak > 0 && (
                <Text style={{ fontSize: 11, color: tk.text3, marginTop: 2 }}>
                  {lang === 'en' ? `${streak}d` : `${streak}д`}
                </Text>
              )}
              {!isQuit && streak >= 1 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }}>
                  <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                    <Path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke={txtColor} strokeWidth="1.8"
                      strokeLinecap="round" strokeLinejoin="round"
                      opacity={1}/>
                  </Svg>
                  <Text style={{ fontSize: 10, color: txtColor, fontWeight: '600' }}>
                    {streak >= 365 ? '365+' : streak >= 100 ? `${streak}` : streak}
                  </Text>
                  {streak >= 7 && (
                    <Text style={{ fontSize: 8, color: txtColor, opacity: 0.9, fontWeight: '700' }}>
                      {streak >= 365 ? 'год' : streak >= 30 ? 'мес' : 'дн'}
                    </Text>
                  )}
                </View>
              )}
              {isQuit && <View/>}
              {/* Реакции: для shared — интерактивный пикер, иначе — значки */}
              {onReact && reactionGroups ? (
                <View style={{ marginTop: 6 }}>
                  <ReactionPicker groups={reactionGroups} onReact={onReact} theme={tk} />
                </View>
              ) : partnerReactions && partnerReactions.length > 0 ? (
                <View style={{ flexDirection: 'row', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                  {partnerReactions.map(key => {
                    const emojiMap: Record<string, string> = {
                      heart: '❤️', lightning: '⚡', star: '⭐', crown: '👑', fire: '🔥',
                    };
                    return (
                      <View key={key} style={{
                        backgroundColor: tk.bg3, borderRadius: 10,
                        borderWidth: 1, borderColor: tk.border,
                        paddingHorizontal: 6, paddingVertical: 2,
                      }}>
                        <Text style={{ fontSize: 11 }}>{emojiMap[key] ?? key}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>

            {/* Правая часть: чекбоксы */}
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexShrink: 0 }}>
            {/* Чекбоксы */}
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexShrink: 0 }}>
              {hasPartner && h.isShared && (
                <View style={{ width: 20, height: 20, borderRadius: 10,
                  borderWidth: 1.5,
                  borderColor: partDone ? tk.text2 : tk.border,
                  backgroundColor: 'transparent',
                  alignItems: 'center', justifyContent: 'center' }}>
                  {!!partDone && (
                    <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                      <Path d="M5 13l4 4L19 7" stroke={txtColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </Svg>
                  )}
                </View>
              )}
              <TouchableOpacity
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onToggle(); }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: myDone }}
                accessibilityLabel={myDone
                  ? (lang === 'en' ? `Mark ${h.name} as not done` : `Отметить «${h.name}» как невыполненное`)
                  : (lang === 'en' ? `Mark ${h.name} as done` : `Отметить «${h.name}» как выполненное`)
                }>
                <View style={{
                  width: 26, height: 26, borderRadius: 13,
                  borderWidth: 1.5,
                  borderColor: myDone ? tk.accent : tk.text2,
                  backgroundColor: myDone ? tk.accent : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {myDone && (
                    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                      <Path d="M5 12l5 5L19 7" stroke={tk.bg} strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round"/>
                    </Svg>
                  )}
                </View>
              </TouchableOpacity>
            </View>
            </View>{/* end reactions+checkboxes wrapper */}
            </View>{/* end top row */}

          </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

//  Drag-and-Drop список привычек 
const ITEM_HEIGHT = 82;

function DraggableList({ habits, myId, partnerId, logs, hasPartner, tk, isEn, lang,
  sortDone, flashId, counts, reactions, confirmations, onToggle, onDelete, onOpenDetail, onReorder,
  onDragStart, onDragEnd, onCountChange, onReact, onConfirmPartner }: {
  habits: Habit[]; myId: string; partnerId?: string; logs: Record<string,boolean>;
  hasPartner: boolean; tk: Theme; isEn: boolean; lang?: string; sortDone?: boolean; flashId?: string|null;
  counts?: Record<string, number>;
  reactions?: import('../store').HabitReaction[];
  confirmations?: import('../store').HabitConfirmation[];
  onToggle: (id: string) => void; onDelete: (h: Habit) => void;
  onOpenDetail: (h: Habit) => void; onReorder: (habits: Habit[]) => void;
  onDragStart?: () => void; onDragEnd?: () => void;
  onCountChange?: (habitId: string, n: number) => void;
  onReact?: (habitId: string, key: ReactionKey) => void;
  onConfirmPartner?: (habitId: string) => void;
}) {
  const [order, setOrder]         = useState(habits.map(h => h.id));
  
  // Sync order when habits list changes from parent
  useEffect(() => {
    setOrder(prev => {
      const newIds = habits.map(h => h.id);
      // Keep existing order, add new, remove deleted
      const filtered = prev.filter(id => newIds.includes(id));
      const added = newIds.filter(id => !prev.includes(id));
      return [...filtered, ...added];
    });
  }, [habits.length]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0); // смещение относительно начала карточки

  // Синхронизируем order при изменении списка снаружи
  useEffect(() => { setOrder(habits.map(h => h.id)); }, [habits.length]);

  const getHabit = (id: string) => habits.find(h => h.id === id);

  // Все данные — через рефы, чтобы PanResponder не захватывал stale closure
  const habitsRef     = useRef<Habit[]>(habits);
  useEffect(() => { habitsRef.current = habits; }, [habits]);
  const orderRef      = useRef(order);
  const draggingRef   = useRef<string | null>(null);
  const dragIdxRef    = useRef(-1);
  const startIdxRef   = useRef(-1);
  useEffect(() => { orderRef.current = order; }, [order]);

  // Единый PanResponder — определяем какую карточку тащат по стартовой Y-координате
  const listTopY = useRef(0); // Y верхнего края списка на экране

  const pan = useRef(PanResponder.create({
    // Жест захватывается при зажатии (долгом нажатии) на любую часть карточки
    onStartShouldSetPanResponder: () => !!draggingRef.current,
    onStartShouldSetPanResponderCapture: () => !!draggingRef.current,
    onMoveShouldSetPanResponder: (_, gs) =>
      !!draggingRef.current && Math.abs(gs.dy) > 4,
    onMoveShouldSetPanResponderCapture: (_, gs) =>
      !!draggingRef.current && Math.abs(gs.dy) > 4,
    onPanResponderTerminationRequest: () => false,


    onPanResponderGrant: (e) => {
      const pageY  = e.nativeEvent.pageY;
      const relY   = pageY - listTopY.current;
      const idx    = Math.floor(relY / ITEM_HEIGHT);
      const safeIdx = Math.max(0, Math.min(orderRef.current.length - 1, idx));
      const habitId = orderRef.current[safeIdx];
      if (!habitId) return;
      draggingRef.current = habitId;
      dragIdxRef.current  = safeIdx;
      startIdxRef.current = safeIdx;
      setDraggingId(habitId);
      setDragOffsetY(safeIdx * ITEM_HEIGHT);
    },

    onPanResponderMove: (_, gs) => {
      if (!draggingRef.current) return;
      const newAbsY  = startIdxRef.current * ITEM_HEIGHT + gs.dy;
      const newIdx   = Math.max(0, Math.min(
        orderRef.current.length - 1,
        Math.round(newAbsY / ITEM_HEIGHT),
      ));
      setDragOffsetY(newAbsY);
      if (newIdx !== dragIdxRef.current) {
        dragIdxRef.current = newIdx;
        const id = draggingRef.current;
        setOrder(prev => {
          const next = [...prev];
          const from = next.indexOf(id);
          if (from === -1) return prev;
          next.splice(from, 1);
          next.splice(newIdx, 0, id);
          return next;
        });
      }
    },

    onPanResponderRelease: () => {
      draggingRef.current = null;
      dragIdxRef.current  = -1;
      setDraggingId(null);
      const reordered = orderRef.current
        .map(id => habitsRef.current.find(h => h.id === id)).filter(Boolean) as Habit[];
      onReorder(reordered.map((h, i) => ({ ...h, order: i })));
    },

    onPanResponderTerminate: () => {
      draggingRef.current = null;
      dragIdxRef.current  = -1;
      setDraggingId(null);
    },
  })).current;

  const dow = todayDow();
  const ds  = todayS();

  const listAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(listAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View
      style={{ opacity: listAnim }}
      {...pan.panHandlers}
      ref={(ref: any) => {
        if (ref) {
          ref.measure((_x: number, _y: number, _w: number, _h: number, _px: number, py: number) => {
            listTopY.current = py;
          });
        }
      }}
    >
      {(() => {
        const routineOrder: (string|undefined)[] = ['morning','afternoon','evening',undefined];
        const routineLabels: Record<string, string> = {
          morning:   lang==='en'?'Morning':'Утро',
          afternoon: lang==='en'?'Afternoon':'День',
          evening:   lang==='en'?'Evening':'Вечер',
        };
        const sortedIds = sortDone
          ? [...order].sort((a, b) => {
              const aDone = isLogged(a, myId, logs);
              const bDone = isLogged(b, myId, logs);
              return aDone === bDone ? 0 : aDone ? 1 : -1;
            })
          : order;

        // Check if any habit has a routine set
        const hasRoutines = sortedIds.some(id => {
          const h = getHabit(id);
          return h?.routine;
        });

        if (!hasRoutines) {
          // No routines - render flat list as before
          return sortedIds.map((id) => {
            const h = getHabit(id);
            if (!h) return null;
        const isDragging = draggingId === id;
        const myDone  = isLogged(h.id, myId, logs, ds);
        const partDone = partnerId ? isLogged(h.id, partnerId, logs, ds) : null;

        return (
          <View key={id} style={{ position: 'relative' }}>
            <View style={{
              opacity: isDragging ? 0.35 : 1,
              transform: isDragging ? [{ scale: 1.03 }] : [],
            }}>
              <SwipeCard
                habit={h} myDone={myDone}
                partDone={partDone} hasPartner={hasPartner}
                tk={tk} isEn={isEn}
                isFlashing={flashId === h.id}
                streak={calcStreak(h.id, myId, logs, h.days)}
                count={counts?.[h.id]}
                partnerReactions={!h.isShared ? reactions?.filter(r => r.habitId===h.id && r.fromId!==myId && r.date===require('../utils').todayS()).map(r => r.emoji as ReactionKey) : undefined}
                onReact={h.isShared && onReact ? (key) => onReact(h.id, key) : undefined}
                reactionGroups={h.isShared && reactions ? (() => {
                  const today = require('../utils').todayS();
                  const habitReactions = reactions.filter(r => r.habitId===h.id && r.date===today);
                  const grouped: Record<string,{count:number;isMine:boolean}> = {};
                  habitReactions.forEach(r => {
                    const k = r.emoji as import('../components/ReactionPicker').ReactionKey;
                    if(!grouped[k]) grouped[k]={count:0,isMine:false};
                    grouped[k].count++;
                    if(r.fromId===myId) grouped[k].isMine=true;
                  });
                  return Object.entries(grouped).map(([key,v])=>({key:key as import('../components/ReactionPicker').ReactionKey,count:v.count,isMine:v.isMine}));
                })() : undefined}
                partnerNeedsConfirm={!!(h.requirePartnerConfirm && partnerId && confirmations?.some(c => c.habitId===h.id && c.date===require('../utils').todayS() && c.fromId===partnerId && !c.confirmedBy))}
                onConfirmPartner={onConfirmPartner ? () => onConfirmPartner(h.id) : undefined}
                myPendingConfirm={!!(h.requirePartnerConfirm && confirmations?.some(c => c.habitId===h.id && c.date===require('../utils').todayS() && c.fromId===myId && !c.confirmedBy))}
                onToggle={() => onToggle(h.id)}
                onCountChange={(n) => onCountChange?.(h.id, n)}
                onPress={() => onOpenDetail(h)}
                onLongPress={() => {
                  const idx = orderRef.current.indexOf(id);
                  const safeIdx = Math.max(0, Math.min(orderRef.current.length - 1, idx));
                  draggingRef.current = id;
                  dragIdxRef.current  = safeIdx;
                  startIdxRef.current = safeIdx;
                  setDraggingId(id);
                  setDragOffsetY(safeIdx * ITEM_HEIGHT);
                  onDragStart?.();
                }}
                onDelete={() => onDelete(h)}
                isDragging={isDragging}
              />
            </View>
          </View>
        );
        }); // end sortedIds.map
        } // end if !hasRoutines

        // Has routines - render grouped in FIXED order
        const result: React.ReactNode[] = [];
        // Группируем привычки по рутине
        const routineGroups: Record<string, string[]> = {
          morning: [], afternoon: [], evening: [], __none__: []
        };
        sortedIds.forEach(id => {
          const h = getHabit(id);
          if (!h) return;
          const key = (h.routine as string) || '__none__';
          if (!routineGroups[key]) routineGroups[key] = [];
          routineGroups[key].push(id);
        });

        // Рендерим в фиксированном порядке
        (['__none__', 'morning', 'afternoon', 'evening'] as string[]).forEach(routineKey => {
          const ids = routineGroups[routineKey] || [];
          if (ids.length === 0) return;
          const routine = routineKey === '__none__' ? undefined : routineKey;

          if (routine) {
            result.push(
              <View key={`hdr_${routineKey}`}
                style={{ paddingHorizontal: 4, paddingTop: 16, paddingBottom: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: tk.text3,
                  letterSpacing: 1.5, textTransform: 'uppercase' }}>
                  {routineLabels[routine] || routine}
                </Text>
              </View>
            );
          }

          ids.forEach((id) => {
          const h = getHabit(id);
          if (!h) return;
          const isDragging = draggingId === id;
          const myDone  = isLogged(h.id, myId, logs, ds);
          const partDone = partnerId ? isLogged(h.id, partnerId, logs, ds) : null;
          result.push(
            <View key={id} style={{ position: 'relative' }}>
              <View style={{ opacity: isDragging ? 0.35 : 1,
                transform: isDragging ? [{ scale: 1.03 }] : [] }}>
                <SwipeCard habit={h} myDone={myDone}
                  partDone={partDone||false} hasPartner={hasPartner}
                  tk={tk} isEn={isEn} lang={lang||'ru'}
                  isFlashing={flashId === h.id}
                  streak={calcStreak(h.id, myId, logs, h.days)}
                  count={counts?.[h.id]}
                  partnerReactions={!h.isShared ? reactions?.filter(r => r.habitId===h.id && r.fromId!==myId && r.date===require('../utils').todayS()).map(r => r.emoji as ReactionKey) : undefined}
                  onReact={h.isShared && onReact ? (key) => onReact(h.id, key) : undefined}
                  reactionGroups={h.isShared && reactions ? (() => {
                    const today = require('../utils').todayS();
                    const habitReactions = reactions.filter(r => r.habitId===h.id && r.date===today);
                    const grouped: Record<string,{count:number;isMine:boolean}> = {};
                    habitReactions.forEach(r => {
                      const k = r.emoji as import('../components/ReactionPicker').ReactionKey;
                      if(!grouped[k]) grouped[k]={count:0,isMine:false};
                      grouped[k].count++;
                      if(r.fromId===myId) grouped[k].isMine=true;
                    });
                    return Object.entries(grouped).map(([key,v])=>({key:key as import('../components/ReactionPicker').ReactionKey,count:v.count,isMine:v.isMine}));
                  })() : undefined}
                  partnerNeedsConfirm={!!(h.requirePartnerConfirm && partnerId && confirmations?.some(c => c.habitId===h.id && c.date===require('../utils').todayS() && c.fromId===partnerId && !c.confirmedBy))}
                  onConfirmPartner={onConfirmPartner ? () => onConfirmPartner(h.id) : undefined}
                  myPendingConfirm={!!(h.requirePartnerConfirm && confirmations?.some(c => c.habitId===h.id && c.date===require('../utils').todayS() && c.fromId===myId && !c.confirmedBy))}
                  onToggle={() => onToggle(h.id)}
                  onCountChange={(n) => onCountChange?.(h.id, n)}
                  onPress={() => onOpenDetail(h)}
                  onDelete={() => onDelete(h)}
                  onLongPress={() => {
                    const idx = orderRef.current.indexOf(id);
                    draggingRef.current = id;
                    dragIdxRef.current = idx;
                    startIdxRef.current = idx;
                    setDraggingId(id);
                    setDragOffsetY(idx * ITEM_HEIGHT);
                    onDragStart?.();
                  }}
                  isDragging={isDragging}
                />
              </View>
            </View>
          );
          }); // end ids.forEach
        }); // end routineGroups.forEach

        return result;
      })()}
    </Animated.View>
  );
}

//  Props 
// ── Блок «Партнёр выполнил» с Notion-style реакциями ─────────────────────────
function PartnerDoneBlock({
  partner, habits, reactions, myId, ds, onReact, tk, isEn, lang, spaceNotes,
  showReactionHint, onDismissReactionHint,
}: {
  partner: Member;
  habits: import('../store').Habit[];
  reactions: import('../store').HabitReaction[];
  myId: string; ds: string;
  onReact: (habitId: string, key: ReactionKey) => void;
  tk: Theme; isEn: boolean; lang?: string;
  spaceNotes?: {habitId:string;date:string;uid:string;note:string}[];
  showReactionHint?: boolean;
  onDismissReactionHint?: () => void;
}) {
  return (
    <View style={{ marginBottom: 12, backgroundColor: tk.bg2,
      borderRadius: 16, borderWidth: 1, borderColor: tk.border, padding: 12 }}>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
        <Text style={{ fontSize: 10, color: tk.text3, letterSpacing: 1,
          textTransform: 'uppercase', fontWeight: '600', flex: 1 }} numberOfLines={1}>
          {isEn ? `${partner.name} completed today` : `${partner.name} выполнил сегодня`}
        </Text>
        {showReactionHint && onDismissReactionHint && (
          <TouchableOpacity onPress={onDismissReactionHint}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4,
            backgroundColor: tk.bg3, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
            borderWidth: 1, borderColor: tk.border, flexShrink: 1 }}>
            <Text style={{ fontSize: 10, color: tk.text2 }} numberOfLines={1}>
              {isEn ? '❤️ tap to react' : '❤️ нажми'}
            </Text>
            <Text style={{ fontSize: 11, color: tk.text3 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {habits.map((h, idx) => {
        const habitReactions = reactions.filter(r => r.habitId === h.id && r.date === ds);

        // Группируем по ключу — все участники
        const grouped: Record<string, { count: number; isMine: boolean }> = {};
        habitReactions.forEach(r => {
          const k = r.emoji as ReactionKey;
          if (!grouped[k]) grouped[k] = { count: 0, isMine: false };
          grouped[k].count++;
          if (r.fromId === myId) grouped[k].isMine = true;
        });
        const groups = Object.entries(grouped).map(([key, v]) => ({
          key: key as ReactionKey, count: v.count, isMine: v.isMine,
        }));

        const isLast = idx === habits.length - 1;

        const partnerNote = spaceNotes?.find(n => n.habitId === h.id && n.date === ds && n.uid === partner.id);

        return (
          <View key={h.id} style={{
            paddingVertical: 10,
            borderBottomWidth: isLast ? 0 : 1,
            borderBottomColor: tk.border + '55',
          }}>
            <Text style={{ fontSize: 13, color: tk.text, fontWeight: '500',
              marginBottom: partnerNote ? 4 : 8 }} numberOfLines={1}>
              {h.name}
            </Text>
            {partnerNote && (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6,
                marginBottom: 8, backgroundColor: tk.bg3, borderRadius: 8,
                paddingHorizontal: 8, paddingVertical: 5 }}>
                <Text style={{ fontSize: 11, color: tk.text3 }}>✏️</Text>
                <Text style={{ fontSize: 12, color: tk.text2, flex: 1, lineHeight: 16 }}>
                  {partnerNote.note}
                </Text>
              </View>
            )}
            {/* реакции — тап = toggle */}
            <ReactionPicker
              groups={groups}
              onReact={(key) => onReact(h.id, key)}
              theme={tk}
              showHint={idx === 0}
              lang={lang ?? 'ru'}
            />
          </View>
        );
      })}
    </View>
  );
}

interface Props {
  myId: string; myName: string; lang: string; tk: Theme;
  theme?: 'dark' | 'light';
  selectedAvatar?: string;
  spaceId?: string;
  onOpenCalendar?: () => void;
  habits: Habit[]; members: Member[]; logs: Record<string,boolean>;
  reactions?: import('../store').HabitReaction[];
  spaceNotes?: {habitId:string;date:string;uid:string;note:string}[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenDetail: (h: Habit) => void;
  onAddHabit: (isShared?: boolean) => void;
  onOpenProfile: () => void;
  onReorder: (habits: Habit[]) => void;
  onRefresh?: () => Promise<void>;
  onWeekPlan?: () => void;
  onReact?: (habitId: string, key: ReactionKey) => void;
  onOpenAchievements?: () => void;
  onOpenMood?: () => void;
  todayMood?: 1|2|3|4|5|null;
  onOpenStats?: () => void;
  confirmations?: import('../store').HabitConfirmation[];
  onConfirmPartner?: (habitId: string) => void;
  onboardingGoal?: string;
}

//  Главный экран 
export default function TodayScreen({
  myId, myName, lang, tk, theme = 'dark', habits, members, logs,
  spaceId, onOpenCalendar,
  reactions = [], spaceNotes = [],
  onToggle, onDelete, onOpenDetail, onAddHabit, onOpenProfile, onReorder, onRefresh,
  onWeekPlan, onReact, onOpenAchievements, onOpenMood, todayMood, onOpenStats,
  confirmations, onConfirmPartner, onboardingGoal,
}: Props) {
  const isEn = lang === 'en';
  const L = (ru: string, en: string, uk?: string, be?: string, kk?: string) =>
    lang==='en' ? en : lang==='uk' ? (uk||ru) : lang==='be' ? (be||ru) : lang==='kk' ? (kk||ru) : ru;
  const [searchQ, setSearchQ] = useState('');
  // Ближайшие события календаря (личные + общие)
  const [calEvents, setCalEvents] = useState<CalEvent[]>([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      const personal = await Storage.getEvents(myId).catch(() => [] as CalEvent[]);
      let shared: CalEvent[] = [];
      if (spaceId) shared = await Storage.getSpaceEvents(spaceId).catch(() => [] as CalEvent[]);
      if (alive) setCalEvents([
        ...personal.map(e => ({ ...e, shared: false })),
        ...shared.map(e => ({ ...e, shared: true })),
      ]);
    })();
    return () => { alive = false; };
  }, [myId, spaceId]);
  const upcomingEvents = (() => {
    const now = new Date();
    const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const monNames = isEn ? ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                          : ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
    return calEvents
      .filter(e => e.date >= todayStr)
      .sort((a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99')))
      .slice(0, 4)
      .map(e => {
        const [y, m, d] = e.date.split('-').map(Number);
        const diff = Math.round((new Date(y, m-1, d).getTime() - todayMid.getTime()) / 86400000);
        const when = diff === 0 ? L('Сегодня','Today') : diff === 1 ? L('Завтра','Tomorrow') : `${d} ${monNames[m-1]}`;
        return { ...e, _day: String(d), _mon: monNames[m-1], _when: when };
      });
  })();
  const [sortDone,   setSortDone]   = useState(false);
  const [habitTab,   setHabitTab]   = useState<'my'|'shared'>('my');
  const [refreshing, setRefreshing] = useState(false);
  const [flashId, setFlashId] = useState<string|null>(null);
  const [habitCounts, setHabitCounts] = useState<Record<string,number>>({});
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const [showReactionHint, setShowReactionHint] = useState(false);

  // Анимация реакций — несколько частиц разлетаются
  const [floatingReaction, setFloatingReaction] = useState<{emoji: string; key: number} | null>(null);
  const [reactionToast, setReactionToast] = useState<{emoji: string; from: string; habit: string; key: number} | null>(null);
  const reactionToastAnim = useRef(new Animated.Value(0)).current;
  // Инициализируем актуальным значением — чтобы при возврате на экран анимация не повторялась
  const prevReactionCount = useRef(
    reactions.filter(r => r.date === todayS() && r.fromId !== myId).length
  );
  // Три частицы для каждой анимации
  const particles = Array.from({ length: 3 }, () => ({
    y:   useRef(new Animated.Value(0)).current,
    x:   useRef(new Animated.Value(0)).current,
    op:  useRef(new Animated.Value(0)).current,
    sc:  useRef(new Animated.Value(0.5)).current,
  }));

  // Загрузить счётчики из Storage при монтировании + cleanup старых записей
  useEffect(() => {
    const today = todayS();
    AsyncStorage.getItem(`habit_counts_${today}`).then(val => {
      if (val) { try { setHabitCounts(JSON.parse(val)); } catch {} }
    });
    // Чистим записи старше 7 дней
    AsyncStorage.getAllKeys().then(keys => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      const cutoffStr = cutoff.toISOString().split('T')[0];
      const old = (keys || []).filter(k =>
        k.startsWith('habit_counts_') && k.replace('habit_counts_', '') < cutoffStr
      );
      if (old.length) AsyncStorage.multiRemove(old).catch(() => {});
    }).catch(() => {});
  }, []);

  // Показать подсказку по свайпу/drag при первом появлении привычек
  useEffect(() => {
    if (habits.length === 0) return;
    AsyncStorage.getItem('pt_swipe_hint_shown').then(val => {
      if (!val) setShowSwipeHint(true);
    });
  }, [habits.length > 0]);

  // Показать подсказку к реакциям при первом появлении блока партнёра
  const partner = members.find(m => m && m.id !== myId);
  const hasPartner = !!partner;
  useEffect(() => {
    if (!hasPartner) return;
    AsyncStorage.getItem('pt_reaction_hint_shown').then(val => {
      if (!val) setShowReactionHint(true);
    });
  }, [hasPartner]);
  // Запускаем floating particles и тост когда приходит новая реакция от партнёра
  useEffect(() => {
    const todayReactions = reactions.filter(r => r.date === todayS() && r.fromId !== myId);
    if (todayReactions.length > prevReactionCount.current) {
      const newest = todayReactions[todayReactions.length - 1];
      if (newest) {
        const emojiMap: Record<string, string> = {
          heart: '❤️', lightning: '⚡', star: '⭐', crown: '👑', fire: '🔥',
        };
        const displayEmoji = emojiMap[newest.emoji] ?? newest.emoji;
        setFloatingReaction({ emoji: displayEmoji, key: Date.now() });
        // Тост с именем партнёра и названием привычки
        const fromMember = members.find(m => m && m.id === newest.fromId);
        const habit = habits.find(h => h.id === newest.habitId);
        if (fromMember && habit) {
          setReactionToast({ emoji: displayEmoji, from: fromMember.name, habit: habit.name, key: Date.now() });
          reactionToastAnim.setValue(0);
          Animated.sequence([
            Animated.timing(reactionToastAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
            Animated.delay(2200),
            Animated.timing(reactionToastAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
          ]).start(() => setReactionToast(null));
        }
        // Три частицы разлетаются в разные стороны
        const offsets = [-40, 0, 40];
        particles.forEach((p, i) => {
          p.y.setValue(0);
          p.x.setValue(0);
          p.op.setValue(0);
          p.sc.setValue(0.5);
          Animated.sequence([
            Animated.parallel([
              Animated.spring(p.sc, { toValue: 1.2, speed: 40, bounciness: 15, useNativeDriver: true }),
              Animated.timing(p.op, { toValue: 1, duration: 180, useNativeDriver: true }),
              Animated.timing(p.x, { toValue: offsets[i], duration: 700, useNativeDriver: true }),
              Animated.timing(p.y, { toValue: -90 - i * 15, duration: 800, useNativeDriver: true }),
            ]),
            Animated.timing(p.op, { toValue: 0, duration: 350, useNativeDriver: true }),
          ]).start(() => { if (i === 1) setFloatingReaction(null); });
        });
      }
    }
    prevReactionCount.current = todayReactions.length;
  }, [reactions]);

  // Cleanup particles анимаций при размонтировании
  useEffect(() => {
    return () => {
      particles.forEach(p => {
        p.y.stopAnimation();
        p.x.stopAnimation();
        p.op.stopAnimation();
        p.sc.stopAnimation();
      });
      reactionToastAnim.stopAnimation();
    };
  }, []);

  const [isDragging, setIsDragging] = useState(false); // выполненные в конец
  const today = new Date();
  const dow = todayDow();
  const ds  = todayS();

  const [snack, setSnack] = useState<{ habit: Habit; index: number } | null>(null);
  const snackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pull-up: отслеживаем позицию скролла
  const scrollY    = useRef(0);
  const maxScrollY = useRef(0);
  const pullAnim   = useRef(new Animated.Value(0)).current; // 0→1 при pull-up
  const [pullHint, setPullHint] = useState(false); // показываем подсказку

  const dateStr = isEn
    ? `${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][today.getDay()]}, ${MONTHS_EN[today.getMonth()]} ${today.getDate()}`
    : `${['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'][today.getDay()]}, ${today.getDate()} ${MON_GENITIVE_RU[today.getMonth()]}`;

  const todayH = habits.filter(h => h.days?.includes(dow));
  const myDoneCount = todayH.filter(h => isLogged(h.id, myId, logs, ds)).length;
  const allDoneToday = todayH.length > 0 && myDoneCount === todayH.length;
  const partDoneCount = partner ? todayH.filter(h => isLogged(h.id, partner.id, logs, ds)).length : 0;

  const days7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() + i); return d;
  });

  // Совместный стрик — только по общим привычкам (isShared)
  // Личные привычки не считаются в joint streak, т.к. недоступны партнёру
  const sharedHabits = habits.filter(h => h.isShared);
  const jointStreak = hasPartner && partner && sharedHabits.length > 0
    ? calcJointStreak(members.map(m => m.id), sharedHabits, logs)
    : 0;

  const getDot = (d: Date) => {
    const s = dateToS(d); const dw = (d.getDay() + 6) % 7;
    const dh = habits.filter(h => h.days?.includes(dw) && (!h.createdAt || h.createdAt <= s));
    if (!dh.length) return null;
    const done = dh.filter(h => isLogged(h.id, myId, logs, s)).length;
    return done === dh.length ? 'full' : done > 0 ? 'part' : 'none';
  };

  const handleDelete = useCallback((h: Habit) => {
    const idx = habits.findIndex(x => x.id === h.id);
    onDelete(h.id);
    if (snackTimer.current) clearTimeout(snackTimer.current);
    setSnack({ habit: h, index: idx });
    snackTimer.current = setTimeout(() => setSnack(null), 4000);
  }, [habits, onDelete]);

  const handleUndo = useCallback(() => {
    if (!snack) return;
    if (snackTimer.current) clearTimeout(snackTimer.current);
    const newH = [...habits]; newH.splice(snack.index, 0, snack.habit);
    onReorder(newH);
    setSnack(null);
  }, [snack, habits, onReorder]);

  return (
    <View style={{ flex: 1, backgroundColor: tk.bg }}>
      {/* Sticky header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8, backgroundColor: tk.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Дата dd/mm/yyyy */}
          <Text style={{ fontSize: 12, color: tk.text3, fontWeight: '500', minWidth: 72 }}>
            {`${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}/${today.getFullYear()}`}
          </Text>
          {/* Pill с иконками по центру */}
          <View style={{ flexDirection: 'row', backgroundColor: tk.bg2,
            borderWidth: 1, borderColor: tk.border, borderRadius: 10, overflow: 'hidden' }}>
            {onOpenAchievements && (
              <TouchableOpacity onPress={onOpenAchievements} activeOpacity={0.7}
                style={{ width: 36, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 14 }}>🏆</Text>
              </TouchableOpacity>
            )}
            {onOpenStats && (
              <TouchableOpacity onPress={onOpenStats} activeOpacity={0.7}
                style={{ width: 36, height: 32, alignItems: 'center', justifyContent: 'center',
                  borderLeftWidth: onOpenAchievements ? 1 : 0, borderLeftColor: tk.border }}>
                <Text style={{ fontSize: 14 }}>📊</Text>
              </TouchableOpacity>
            )}
            {onOpenMood && (
              <TouchableOpacity onPress={onOpenMood} activeOpacity={0.7}
                style={{ width: 36, height: 32, alignItems: 'center', justifyContent: 'center',
                  borderLeftWidth: (onOpenAchievements || onOpenStats) ? 1 : 0, borderLeftColor: tk.border }}>
                <Text style={{ fontSize: 14 }}>
                  {todayMood === 1 ? '😞' : todayMood === 2 ? '😐' : todayMood === 3 ? '🙂' : todayMood === 4 ? '😊' : todayMood === 5 ? '😄' : '🫥'}
                </Text>
              </TouchableOpacity>
            )}
            {onWeekPlan && (
              <TouchableOpacity onPress={onWeekPlan} activeOpacity={0.7}
                style={{ width: 36, height: 32, alignItems: 'center', justifyContent: 'center',
                  borderLeftWidth: (onOpenAchievements || onOpenStats || onOpenMood) ? 1 : 0, borderLeftColor: tk.border }}>
                <Text style={{ fontSize: 14 }}>📅</Text>
              </TouchableOpacity>
            )}
          </View>
          {/* Аватар(ы) */}
          <TouchableOpacity onPress={onOpenProfile} style={{ minWidth: 72, alignItems: 'flex-end' }}>
            {hasPartner ? (
              <View style={{ flexDirection: 'row' }}>
                <ProfileAvatar name={partner!.name} size={32} tk={tk} />
                <View style={{ marginLeft: -10 }}>
                  <ProfileAvatar name={myName} size={32} tk={tk} />
                </View>
              </View>
            ) : (
              <ProfileAvatar name={myName} size={32} tk={tk} />
            )}
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        scrollEnabled={!isDragging}
        nestedScrollEnabled={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              if (isDragging || !onRefresh) return;
              setRefreshing(true);
              await onRefresh();
              setRefreshing(false);
            }}
            tintColor={tk.text3}
            colors={[tk.text]}
          />
        }
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140, paddingTop: 4 }}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          const y = e.nativeEvent.contentOffset.y;
          const layoutH = e.nativeEvent.layoutMeasurement.height;
          const contentH = e.nativeEvent.contentSize.height;
          scrollY.current = y;
          maxScrollY.current = Math.max(0, contentH - layoutH);
          const distFromBottom = maxScrollY.current - y;
          // Работает и с пустым списком (maxScrollY === 0)
          const ZONE = 80;
          const canTrigger = maxScrollY.current > 0 || y === 0; // пустой список: y всегда 0
          const overscroll = maxScrollY.current > 0
            ? distFromBottom   // есть контент — дистанция до дна
            : -y;              // пустой список — оверскролл вверх (y отрицательный на iOS)
          setPullHint(canTrigger && overscroll < ZONE);
          const progress = Math.min(1, Math.max(0, (ZONE - Math.max(overscroll, 0)) / ZONE));
          pullAnim.setValue(progress);
        }}
        onScrollEndDrag={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          const y = e.nativeEvent.contentOffset.y;
          const velocity = e.nativeEvent.velocity?.y ?? 0;
          const distFromBottom = maxScrollY.current - y;
          // Требуем: быть у самого дна И сильный бросок вверх
          // velocity < -1.2 = быстрый свайп вверх (случайный медленный не сработает)
          const strongFlick = velocity < -1.2;
          // Пустой список: atBottom = true когда y≈0 (уже на дне)
          const atBottom = maxScrollY.current > 0 ? distFromBottom < 10 : true;
          if (atBottom && strongFlick) {
                  Animated.timing(pullAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
            setPullHint(false);
            onAddHabit();
          } else {
            // Не сработало — сбрасываем индикатор
            Animated.timing(pullAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
            setPullHint(false);
          }
        }}>

        {/* Progress */}
        <View style={{ marginVertical: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: hasPartner ? 8 : 0 }}>
            <ProfileAvatar name={myName} size={24} tk={tk} />
            <View style={{ flex: 1, height: 2, backgroundColor: tk.border, borderRadius: 1 }}>
              <View style={{ width: `${todayH.length ? (myDoneCount/todayH.length)*100 : 0}%` as any,
                height: '100%', backgroundColor: tk.accent, borderRadius: 1 }} />
            </View>
            <Text style={{ fontSize: 12, fontWeight: '500', color: myDoneCount === todayH.length && todayH.length > 0 ? tk.accent : tk.text2, minWidth: 30, textAlign: 'right' }}>
              {myDoneCount}/{todayH.length}
            </Text>
          </View>
          {hasPartner && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ProfileAvatar name={partner!.name} size={24} tk={tk} />
              <View style={{ flex: 1, height: 2, backgroundColor: tk.border, borderRadius: 1 }}>
                <View style={{ width: `${todayH.length ? (partDoneCount/todayH.length)*100 : 0}%` as any,
                  height: '100%', backgroundColor: tk.text2, borderRadius: 1 }} />
              </View>
              <Text style={{ fontSize: 12, fontWeight: '500', color: partDoneCount === todayH.length && todayH.length > 0 ? tk.accent : tk.text2, minWidth: 30, textAlign: 'right' }}>
                {partDoneCount}/{todayH.length}
              </Text>
            </View>
          )}
        </View>

        {/* Week strip */}
        <View style={{ flexDirection: 'row', gap: 4, marginBottom: 20 }}>
          {days7.map((d, i) => {
            const isToday = d.toDateString() === today.toDateString();
            const dw = (d.getDay() + 6) % 7;
            const dot = getDot(d);
            const WD = isEn ? WD_EN : WD_RU;
            return (
              <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 10, color: tk.text3 }}>{WD[dw]}</Text>
                <View style={{ width: 32, height: 32, borderRadius: 10,
                  backgroundColor: isToday ? tk.text : 'transparent',
                  borderWidth: isToday ? 0 : 1, borderColor: tk.border,
                  alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: isToday ? '700' : '400',
                    color: isToday ? tk.bg : tk.text2 }}>{d.getDate()}</Text>
                </View>
                <View style={{ width: 5, height: 5, borderRadius: 2.5,
                  backgroundColor:
                    dot === 'full' ? tk.text :
                    dot === 'part' ? tk.text2 :
                    'transparent' }} />
              </View>
            );
          })}
        </View>

        {/* Совместный стрик */}
        {jointStreak >= 1 && (() => {
          const _isDark = tk.bg === '#0c0c0c' || tk.bg === '#0a0a0a';
          const milestoneColor = jointStreak >= 365 ? '#c8a030' : jointStreak >= 100 ? '#e8a030' : jointStreak >= 30 ? '#d4882a' : jointStreak >= 7 ? (_isDark ? '#a0a0ff' : '#5555cc') : tk.border;
          const milestoneEmoji = jointStreak >= 365 ? '🏆' : jointStreak >= 100 ? '💎' : jointStreak >= 30 ? '⭐' : jointStreak >= 7 ? '🔥' : '🔥';
          const nextMilestone = jointStreak >= 365 ? null : jointStreak >= 100 ? 365 : jointStreak >= 30 ? 100 : jointStreak >= 7 ? 30 : 7;
          return (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10,
              backgroundColor: tk.bg2, borderRadius: 16, borderWidth: 1.5,
              borderColor: milestoneColor, paddingHorizontal: 14, paddingVertical: 12,
              marginBottom: 10 }}>
              <Text style={{ fontSize: 24 }}>{milestoneEmoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: tk.text }}>
                  {isEn
                    ? `${jointStreak} day${jointStreak !== 1 ? 's' : ''} together`
                    : `${jointStreak} ${jointStreak === 1 ? 'день' : jointStreak < 5 ? 'дня' : 'дней'} вместе`}
                </Text>
                <Text style={{ fontSize: 10, color: tk.text3, marginTop: 2 }}>
                  {nextMilestone
                    ? (isEn ? `${nextMilestone - jointStreak} days to next milestone` : `${nextMilestone - jointStreak} дн. до следующей отметки`)
                    : (isEn ? 'Legendary streak!' : 'Легендарная серия!')}
                </Text>
              </View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: milestoneColor }}>{jointStreak}</Text>
            </View>
          );
        })()}


        {/* ── Блок подтверждений — видный баннер для партнёра ── */}
        {hasPartner && partner && onConfirmPartner && (() => {
          // Привычки, которые ПАРТНЁР отметил и ждёт МОЁ подтверждение
          const needConfirm = todayH.filter(h =>
            h.requirePartnerConfirm &&
            confirmations?.some(c =>
              c.habitId === h.id &&
              c.date === ds &&
              c.fromId === partner.id &&
              !c.confirmedBy
            )
          );
          if (!needConfirm.length) return null;
          return (
            <View style={{ marginBottom: 12, borderRadius: 16, borderWidth: 1.5,
              borderColor: tk.accent + '60', backgroundColor: tk.accent + '08', padding: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <View style={{ width: 28, height: 28, borderRadius: 14,
                  backgroundColor: tk.accent + '20', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 14 }}>✋</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: tk.text, flex: 1 }}>
                  {isEn
                    ? `${partner.name} is waiting for your confirmation`
                    : `${partner.name} ждёт вашего подтверждения`}
                </Text>
              </View>
              {needConfirm.map((h, idx) => (
                <TouchableOpacity key={h.id}
                  onPress={() => onConfirmPartner(h.id)}
                  activeOpacity={0.75}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10,
                    backgroundColor: tk.accent, borderRadius: 12,
                    paddingHorizontal: 14, paddingVertical: 11,
                    marginTop: idx > 0 ? 6 : 0 }}>
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: '#fff' }}
                    numberOfLines={1}>{h.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontSize: 13, color: '#fff', fontWeight: '700' }}>
                      {isEn ? 'Confirm ✓' : 'Подтвердить ✓'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          );
        })()}

        {/* Выполнено партнёром сегодня + Notion-style реакции */}
        {hasPartner && partner && (() => {
          const partnerDoneHabits = todayH.filter(h => isLogged(h.id, partner.id, logs, ds));
          if (!partnerDoneHabits.length) return null;

          return (
            <PartnerDoneBlock
              partner={partner}
              habits={partnerDoneHabits}
              reactions={reactions}
              myId={myId}
              ds={ds}
              onReact={onReact ?? ((_habitId: string, _key: ReactionKey) => {})}
              tk={tk}
              isEn={isEn}
              lang={lang}
              spaceNotes={spaceNotes}
              showReactionHint={showReactionHint}
              onDismissReactionHint={() => {
                setShowReactionHint(false);
                AsyncStorage.setItem('pt_reaction_hint_shown', '1').catch(() => {});
              }}
            />
          );
        })()}

        {/* Прогресс партнёра */}
        {hasPartner && partner && (() => {
          const partDoneCount = todayH.filter(h => isLogged(h.id, partner.id, logs, ds)).length;
          const partTotal = todayH.length;
          if (partTotal === 0) return null;
          const pct = partDoneCount / partTotal;
          return (
            <View style={{ marginBottom: 10, paddingHorizontal: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: 5 }}>
                <Text style={{ fontSize: 11, color: tk.text3 }}>
                  {partner.name} — {partDoneCount}/{partTotal}
                </Text>
                <Text style={{ fontSize: 11, color: tk.text3 }}>
                  {Math.round(pct * 100)}%
                </Text>
              </View>
              <View style={{ height: 3, backgroundColor: tk.bg2, borderRadius: 2 }}>
                <View style={{ height: 3, borderRadius: 2,
                  width: `${Math.round(pct * 100)}%` as any,
                  backgroundColor: pct === 1 ? tk.text : tk.text2 }} />
              </View>
            </View>
          );
        })()}

        {/* Все выполнено! */}
        {allDoneToday && (
          <View style={{ backgroundColor: tk.bg2, borderRadius: 16, borderWidth: 1,
            borderColor: tk.border, padding: 16, marginBottom: 12,
            flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 28 }}></Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: tk.text }}>
                {(lang === 'en' ? 'All done today!' : lang==='uk' ? 'Всі звички виконані!' : lang==='be' ? 'Усе звычкі выкананы!' : lang==='kk' ? 'Барлық әдеттер орындалды!' : 'Все привычки выполнены!')}
              </Text>
              <Text style={{ fontSize: 11, color: tk.text3, marginTop: 2 }}>
                {(lang === 'en' ? 'Great job keeping the streak going' : lang==='uk' ? 'Чудова робота, так тримати!' : lang==='be' ? 'Выдатная праца, так трымаць!' : lang==='kk' ? 'Тамаша жұмыс, осылай жалғастыр!' : 'Отличная работа, так держать!')}
              </Text>
            </View>
          </View>
        )}

        {/* ── Переключатель Мои / Совместные (только в паре) ── */}
        {hasPartner && (() => {
          const myCount     = todayH.filter(h => !h.isShared).length;
          const sharedCount = todayH.filter(h =>  h.isShared).length;
          return (
            <View style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', backgroundColor: tk.bg2,
                borderRadius: 14, borderWidth: 1, borderColor: tk.border, padding: 3 }}>
                {([
                  { key: 'my',     labelRu: 'Мои',       labelEn: 'Mine',   count: myCount     },
                  { key: 'shared', labelRu: 'Совместные', labelEn: 'Together', count: sharedCount },
                ] as { key:'my'|'shared'; labelRu:string; labelEn:string; count:number }[]).map(tab => {
                  const active = habitTab === tab.key;
                  return (
                    <TouchableOpacity key={tab.key}
                      onPress={() => setHabitTab(tab.key)}
                      activeOpacity={0.7}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center',
                        justifyContent: 'center', gap: 6,
                        paddingVertical: 9, borderRadius: 11,
                        backgroundColor: active ? tk.bg3 : 'transparent' }}>
                      <Text style={{ fontSize: 13, fontWeight: active ? '600' : '400',
                        color: active ? tk.text : tk.text3 }}>
                        {isEn ? tab.labelEn : tab.labelRu}
                      </Text>
                      {tab.count > 0 && (
                        <View style={{ minWidth: 18, height: 18, borderRadius: 9,
                          backgroundColor: active ? tk.text : tk.border,
                          alignItems: 'center', justifyContent: 'center',
                          paddingHorizontal: 5 }}>
                          <Text style={{ fontSize: 10, fontWeight: '700',
                            color: active ? tk.bg : tk.text3 }}>
                            {tab.count}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })()}

        {/* Ближайшие события */}
        {upcomingEvents.length > 0 && (
          <View style={{ marginBottom: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={{ fontSize: 10, color: tk.text3, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                {isEn ? 'Upcoming events' : 'Ближайшие события'}
              </Text>
              {onOpenCalendar && (
                <TouchableOpacity onPress={onOpenCalendar} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ fontSize: 12, color: tk.accent, fontWeight: '600' }}>{isEn ? 'Calendar' : 'Календарь'}</Text>
                </TouchableOpacity>
              )}
            </View>
            {upcomingEvents.map((ev: any) => (
              <TouchableOpacity key={ev.id} onPress={onOpenCalendar} activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12,
                  backgroundColor: tk.bg2, borderWidth: 1, borderColor: tk.border, borderRadius: 12, marginBottom: 8 }}>
                <View style={{ alignItems: 'center', width: 40 }}>
                  <Text style={{ fontSize: 17, fontWeight: '800', color: tk.text }}>{ev._day}</Text>
                  <Text style={{ fontSize: 9.5, color: tk.text3, textTransform: 'uppercase' }}>{ev._mon}</Text>
                </View>
                <View style={{ width: 1, height: 30, backgroundColor: tk.border }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: tk.text, fontWeight: '600' }} numberOfLines={1}>{ev.title}</Text>
                  <Text style={{ fontSize: 11, color: tk.text3, marginTop: 1 }}>
                    {ev._when}{ev.time ? ' · ' + ev.time : ''}{ev.shared ? ' · 👥' : ''}
                  </Text>
                </View>
                {ev.remind && ev.time ? <Text style={{ fontSize: 13 }}>🔔</Text> : null}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Habits header */}
        <View style={{ flexDirection: 'row', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ fontSize: 10, color: tk.text3, letterSpacing: 1.5, textTransform: 'uppercase' }}>
            {habitTab === 'shared'
              ? (isEn ? 'Together' : 'Совместные')
              : (lang === 'en' ? 'My habits' : 'Мои привычки')
            }
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {todayH.length > 1 && (
              <TouchableOpacity onPress={() => setSortDone(s => !s)}
                style={{ paddingHorizontal: 8, paddingVertical: 3,
                  backgroundColor: sortDone ? tk.bg3 : 'transparent',
                  borderRadius: 6, borderWidth: 1,
                  borderColor: sortDone ? tk.border : 'transparent' }}>
                <Text style={{ fontSize: 9, color: sortDone ? tk.text2 : tk.text3, letterSpacing: 0.5 }}>
                  {isEn ? 'DONE LAST' : 'СДЕЛАННЫЕ ВНИЗ'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Поиск — только когда > 3 привычек */}
        {todayH.length > 3 ? (
          <View style={{ backgroundColor: tk.bg2, borderRadius: 12, borderWidth: 1,
            borderColor: tk.border, paddingHorizontal: 12, flexDirection: 'row',
            alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Circle cx="11" cy="11" r="8" stroke={tk.text3} strokeWidth="1.5"/>
              <Path d="M21 21l-4.35-4.35" stroke={tk.text3} strokeWidth="1.5" strokeLinecap="round"/>
            </Svg>
            <TextInput
              value={searchQ} onChangeText={setSearchQ}
              placeholder={(lang === 'en' ? 'Search...' : lang==='uk' ? 'Пошук...' : lang==='be' ? 'Пошук...' : lang==='kk' ? 'Іздеу...' : 'Поиск...')}
              placeholderTextColor={tk.text3}
              style={{ flex: 1, fontSize: 13, color: tk.text, paddingVertical: 9 }}/>
            {!!searchQ && (
              <TouchableOpacity onPress={() => setSearchQ('')}>
                <Text style={{ fontSize: 18, color: tk.text3 }}>×</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {/* Фильтруем по вкладке — только если есть партнёр */}
        {(()=>{
          const filteredH = hasPartner
            ? (habitTab === 'shared'
                ? todayH.filter(h =>  h.isShared)
                : todayH.filter(h => !h.isShared))
            : todayH;

          // Пустое состояние для вкладки «Совместные»
          if (filteredH.length === 0 && hasPartner && habitTab === 'shared') {
            return (
              <TouchableOpacity onPress={() => onAddHabit(true)} activeOpacity={0.7}
                style={{ paddingVertical: 36, alignItems: 'center', gap: 10 }}>
                <View style={{ width: 56, height: 56, borderRadius: 16,
                  backgroundColor: tk.bg2, borderWidth: 1, borderColor: tk.border,
                  alignItems: 'center', justifyContent: 'center' }}>
                  <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                    <Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"
                      stroke={tk.text3} strokeWidth="1.6" strokeLinecap="round"/>
                    <Circle cx="9" cy="7" r="4" stroke={tk.text3} strokeWidth="1.6"/>
                    <Path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
                      stroke={tk.text3} strokeWidth="1.6" strokeLinecap="round"/>
                  </Svg>
                </View>
                <Text style={{ fontSize: 15, fontWeight: '600', color: tk.text }}>
                  {isEn ? 'No shared habits yet' : 'Нет совместных привычек'}
                </Text>
                <Text style={{ fontSize: 13, color: tk.text3, textAlign: 'center', paddingHorizontal: 32 }}>
                  {isEn
                    ? 'Create a habit and choose "Together" — both of you will track it'
                    : 'Создай привычку и выбери «Вместе» — вы оба будете её отслеживать'}
                </Text>
                <View style={{ backgroundColor: tk.text, borderRadius: 12,
                  paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 }}>
                  <Text style={{ color: tk.bg, fontSize: 13, fontWeight: '600' }}>
                    {isEn ? '+ Create shared habit' : '+ Создать совместную'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }

          // Пустое состояние вкладки «Мои»
          if (filteredH.length === 0 && hasPartner && habitTab === 'my') {
            return (
              <TouchableOpacity onPress={() => onAddHabit()} activeOpacity={0.7}
                style={{ paddingVertical: 36, alignItems: 'center', gap: 10 }}>
                <View style={{ width: 56, height: 56, borderRadius: 16,
                  backgroundColor: tk.bg2, borderWidth: 1, borderColor: tk.border,
                  alignItems: 'center', justifyContent: 'center' }}>
                  <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                    <Circle cx="12" cy="8" r="4" stroke={tk.text3} strokeWidth="1.6"/>
                    <Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"
                      stroke={tk.text3} strokeWidth="1.6" strokeLinecap="round"/>
                  </Svg>
                </View>
                <Text style={{ fontSize: 15, fontWeight: '600', color: tk.text }}>
                  {isEn ? 'No personal habits' : 'Нет личных привычек'}
                </Text>
                <Text style={{ fontSize: 13, color: tk.text3, textAlign: 'center', paddingHorizontal: 32 }}>
                  {isEn ? 'Add a habit only for yourself' : 'Добавь привычку только для себя'}
                </Text>
                <View style={{ backgroundColor: tk.text, borderRadius: 12,
                  paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 }}>
                  <Text style={{ color: tk.bg, fontSize: 13, fontWeight: '600' }}>
                    {isEn ? '+ Add habit' : '+ Добавить привычку'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }

          return filteredH.length === 0 ? (
            null
          ) : (
            <>
              <DraggableList
                habits={searchQ
                  ? filteredH.filter(h => (h.name||'').toLowerCase().includes(searchQ.toLowerCase()))
                  : filteredH
                }
                lang={lang}
                sortDone={sortDone}
                flashId={flashId}
                counts={habitCounts}
                onCountChange={(hid, n) => {
                  const next = {...habitCounts, [hid]: n};
                  setHabitCounts(next);
                  AsyncStorage.setItem(`habit_counts_${todayS()}`, JSON.stringify(next)).catch(()=>{});
                }}
                onDragStart={() => setIsDragging(true)}
                onDragEnd={() => setIsDragging(false)}
                myId={myId}
                partnerId={partner?.id}
                logs={logs}
                hasPartner={hasPartner}
                tk={tk}
                isEn={isEn}
                onToggle={onToggle}
                onDelete={handleDelete}
                onOpenDetail={onOpenDetail}
                onReorder={onReorder}
                reactions={reactions}
                onReact={onReact}
                confirmations={confirmations}
                onConfirmPartner={onConfirmPartner}
              />
              <TouchableOpacity
                onPress={() => onAddHabit(habitTab === 'shared')}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 8, marginTop: 8, marginBottom: 4,
                  borderWidth: 1, borderColor: tk.border, borderStyle: 'dashed',
                  borderRadius: 14, paddingVertical: 13, backgroundColor: 'transparent' }}>
                <View style={{ width: 22, height: 22, borderRadius: 11,
                  backgroundColor: tk.text, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 16, color: tk.bg, lineHeight: 20, fontWeight: '300' }}>+</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: tk.text2 }}>
                  {habitTab === 'shared'
                    ? (isEn ? 'Add shared habit' : 'Добавить совместную')
                    : (isEn ? 'Add habit' : 'Добавить привычку')}
                </Text>
              </TouchableOpacity>
            </>
          );
        })()}

        {/* Подсказка свайп/drag — только при первом появлении привычек */}
        {showSwipeHint && habits.length > 0 && (
          <TouchableOpacity activeOpacity={0.8} onPress={() => {
            AsyncStorage.setItem('pt_swipe_hint_shown', '1').catch(()=>{});
            setShowSwipeHint(false);
          }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10,
            backgroundColor: tk.bg2, borderRadius: 12, borderWidth: 1,
            borderColor: tk.border, paddingHorizontal: 14, paddingVertical: 10,
            marginBottom: 10, opacity: 0.85 }}>
            <Text style={{ fontSize: 16 }}>💡</Text>
            <Text style={{ flex: 1, fontSize: 11, color: tk.text2, lineHeight: 16 }}>
              {isEn
                ? 'Swipe left to delete · Hold & drag to reorder · Flick up to add'
                : 'Свайп влево — удалить · Зажми и перетащи — порядок · Флик вверх — добавить'}
            </Text>
            <Text style={{ fontSize: 14, color: tk.text3 }}>✕</Text>
          </TouchableOpacity>
        )}

        {todayH.length === 0 ? (
          <TouchableOpacity onPress={() => onAddHabit()} activeOpacity={0.7}
            style={{ paddingVertical: 48, alignItems: 'center', gap: 14 }}>
            <View style={{ alignItems: 'center', gap: 24 }}>
              {/* Иллюстрация — 3 карточки-плейсхолдера */}
              <View style={{ width: '100%', gap: 8, opacity: 0.4 }}>
                {[['#c8b8e8','80%'],['#b8e0c8','60%'],['#b8d4e8','40%']].map(([color,w],i)=>(
                  <View key={i} style={{ height: 52, borderRadius: 14,
                    backgroundColor: color, flexDirection: 'row',
                    alignItems: 'center', paddingHorizontal: 16, gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ height: 10, width: w as any, borderRadius: 5,
                        backgroundColor: tk.border }}/>
                    </View>
                    <View style={{ width: 24, height: 24, borderRadius: 12,
                      borderWidth: 2, borderColor: tk.border }}/>
                  </View>
                ))}
              </View>
              <View style={{ alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: tk.text, letterSpacing: -0.3 }}>
                  {(lang === 'en' ? 'No habits yet' : lang==='uk' ? 'Звичок поки немає' : lang==='be' ? 'Звычак пакуль няма' : lang==='kk' ? 'Әзірше әдеттер жоқ' : 'Привычек пока нет')}
                </Text>
                <Text style={{ fontSize: 13, color: tk.text3, textAlign: 'center', lineHeight: 19 }}>
                  {onboardingGoal
                    ? (() => {
                        const goalLabels: Record<string, {ru:string;en:string}> = {
                          health:       { ru:'Здоровье',       en:'Health' },
                          productivity: { ru:'Продуктивность', en:'Productivity' },
                          mindfulness:  { ru:'Спокойствие',    en:'Mindfulness' },
                          social:       { ru:'Общение',        en:'Social' },
                          quit:         { ru:'Бросить плохое', en:'Quit habits' },
                          together:     { ru:'С партнёром',    en:'Together' },
                        };
                        const label = goalLabels[onboardingGoal]?.[isEn ? 'en' : 'ru'] || onboardingGoal;
                        return isEn
                          ? `Add your first habit towards your goal — ${label}`
                          : `Добавь первую привычку для цели — ${label}`;
                      })()
                    : (lang === 'en' ? 'Add your first habit\nand start tracking' : lang==='uk' ? 'Додай першу звичку\nта починай відстежувати' : lang==='be' ? 'Дадай першую звычку\nі пачні адсочваць' : lang==='kk' ? 'Бірінші әдетіңді қос\nжәне бақылауды бастa' : 'Добавь первую привычку\nи начни отслеживать')}
                </Text>
              </View>
              <View style={{ backgroundColor: tk.text, borderRadius: 14,
                paddingVertical: 12, paddingHorizontal: 28 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: tk.bg }}>
                  {(lang === 'en' ? 'Add habit' : lang==='uk' ? 'Додати звичку' : lang==='be' ? 'Дадаць звычку' : lang==='kk' ? 'Әдет қосу' : 'Добавить привычку')}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ) : null}

        {/* Серии вместе */}
        {!!hasPartner && (() => {
          const withStreak = habits.map(h => {
            let s = 0; const d = new Date();
            for (let i = 0; i < 365; i++) {
              const s2 = dateToS(d); const dw = (d.getDay()+6)%7;
              if (!h.days?.includes(dw)) { d.setDate(d.getDate()-1); continue; }
              if (isLogged(h.id,myId,logs,s2) && isLogged(h.id,partner!.id,logs,s2)) s++;
              else if (i > 0) break;
              d.setDate(d.getDate()-1);
            }
            return { h, s };
          }).filter(x => x.s > 0);
          if (!withStreak.length) return null;
          return (
            <>
              <Text style={{ fontSize: 10, color: tk.text3, letterSpacing: 1.5,
                textTransform: 'uppercase', marginBottom: 10, marginTop: 20 }}>
                {(lang === 'en' ? 'Streaks together' : lang==='uk' ? 'Серії разом' : lang==='be' ? 'Серыі разам' : lang==='kk' ? 'Бірге серия' : 'Серии вместе')}
              </Text>
              {withStreak.map(({ h, s }) => (
                <View key={h.id} style={{ backgroundColor: tk.bg2, borderWidth: 1,
                  borderColor: tk.border, borderRadius: 14, padding: 12,
                  flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 8,
                    backgroundColor: h.color || tk.bg3, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 12, fontWeight: '700' }}>{h.name?.[0] || '?'}</Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 13, color: tk.text2 }}>{h.name}</Text>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: tk.text }}>{s}</Text>
                </View>
              ))}
            </>
          );
        })()}
        {/* Pull-up индикатор — появляется когда скролл у дна */}
        <Animated.View style={{
          alignItems: 'center', paddingVertical: 16,
          opacity: pullAnim,
          transform: [{ translateY: pullAnim.interpolate({
            inputRange: [0, 1], outputRange: [12, 0]
          })}],
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 28, height: 28, borderRadius: 14,
              borderWidth: 1.5,
              borderColor: tk.border,
              alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 16, color: tk.text2, lineHeight: 20 }}>+</Text>
            </View>
            <Text style={{ fontSize: 12, color: tk.text3 }}>
              {(lang === 'en' ? 'Release to add habit' : 'Отпусти чтобы добавить')}
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      {snack && <Snackbar message={`«${snack.habit.name}» ${(lang === 'en' ? 'deleted' : lang==='uk' ? 'видалено' : lang==='be' ? 'выдалена' : lang==='kk' ? 'жойылды' : 'удалено')}`} onUndo={handleUndo} tk={tk} lang={lang} />}

      {/* Floating particles — вне ScrollView, позиция фиксирована на экране */}
      {floatingReaction && particles.map((p, i) => (
        <Animated.Text key={i} style={{
          position: 'absolute',
          top: 180, left: SCREEN_W / 2 - 20,
          fontSize: 32, zIndex: 999,
          pointerEvents: 'none',
          opacity: p.op,
          transform: [{ translateX: p.x }, { translateY: p.y }, { scale: p.sc }],
        }}>
          {floatingReaction.emoji}
        </Animated.Text>
      ))}

      {/* Тост с именем партнёра при новой реакции — вне ScrollView */}
      {reactionToast && (
        <Animated.View style={{
          position: 'absolute', bottom: 24, left: 20, right: 20,
          zIndex: 1000, pointerEvents: 'none',
          opacity: reactionToastAnim,
          transform: [{ translateY: reactionToastAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        }}>
          <View style={{
            backgroundColor: tk.bg2, borderRadius: 14,
            borderWidth: 1, borderColor: tk.border,
            paddingHorizontal: 16, paddingVertical: 12,
            flexDirection: 'row', alignItems: 'center', gap: 10,
            shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
          }}>
            <Text style={{ fontSize: 24 }}>{reactionToast.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: tk.text3 }}>{reactionToast.from}</Text>
              <Text style={{ fontSize: 13, color: tk.text, fontWeight: '500' }} numberOfLines={1}>
                {reactionToast.habit}
              </Text>
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
}
