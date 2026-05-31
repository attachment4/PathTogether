import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, RefreshControl,
  Animated, PanResponder, NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { Theme, WD_RU, WD_EN, MON_GENITIVE_RU, MONTHS_EN } from '../theme';
import { tr } from '../i18n';
import { Habit, Member } from '../store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { todayS, todayDow, isLogged, dateToS, calcStreak } from '../utils';
import { GlassCard } from '../components/GlassCard';
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
  return (
    <View style={{
      position: 'absolute', bottom: 110, left: 16, right: 16,
      backgroundColor: tk.bg3, borderRadius: 16,
      borderWidth: 1, borderColor: tk.border,
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 14, paddingHorizontal: 16,
      shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, elevation: 8,
    }}>
      <Text style={{ flex: 1, fontSize: 13, color: tk.text }}>{message}</Text>
      <TouchableOpacity onPress={onUndo}
        style={{ paddingVertical: 5, paddingHorizontal: 12, borderRadius: 9,
          backgroundColor: tk.text }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: tk.bg }}>{undoLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

//  Свайпаемая карточка привычки 
interface SwipeCardProps {
  habit: Habit; myDone: boolean; partDone: boolean | null;
  hasPartner: boolean; tk: Theme; isEn: boolean;
  streak?: number; isFlashing?: boolean;
  count?: number;
  onToggle: () => void; onPress: () => void; onDelete: () => void;
  onLongPress?: () => void; onCountChange?: (n: number) => void;
  isDragging?: boolean; lang?: string;
}

function SwipeCard({ habit: h, myDone, partDone, hasPartner, tk, isEn,
  streak = 0, isFlashing, count, onToggle, onPress, onDelete, onLongPress, onCountChange, isDragging, lang = 'ru' }: SwipeCardProps) {

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
  const quitColor = myDone ? '#c8a0a0' : '#a0c8b0';
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

      <Animated.View style={{ transform: [{ translateX }, { scale: doneScale }], opacity,
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
              opacity: myDone ? 0.3 : 1,
            }}/>
            <View style={{ flex: 1 }}>
              <Text style={{
                fontSize: 15,
                fontWeight: '500', letterSpacing: -0.3,
                color: tk.text, opacity: myDone ? 0.35 : 1,
                textDecorationLine: myDone ? 'line-through' : 'none',
                lineHeight: 22,
              }} numberOfLines={2}>{h.name}</Text>
              {h.time && <Text style={{ fontSize: 12, color: tk.text3, marginTop: 3 }}>{h.time}</Text>}

              {/* Таймер */}
              {!!h.timerSeconds && h.timerSeconds > 0 && !myDone && (() => {
                const mins = Math.floor(h.timerSeconds / 60);
                return (
                  <TouchableOpacity
                    onStartShouldSetResponder={() => true}
                    onPress={() => {/* timer handled in detail screen */}}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                      <Path d="M12 6v6l4 2M12 2a10 10 0 100 20A10 10 0 0012 2z"
                        stroke={txtColor} strokeWidth="1.8" strokeLinecap="round" opacity={0.6}/>
                    </Svg>
                    <Text style={{ fontSize: 10, color: txtColor, opacity: 0.6 }}>
                      {mins} {lang === 'en' ? 'min' : 'мин'}
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
              {!!h.desc && (
                <Text style={{ fontSize: 10, color: txtColor, opacity: 0.45, marginTop: 2,
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
                      opacity={streak >= 30 ? 1 : streak >= 7 ? 0.8 : 0.5}/>
                  </Svg>
                  <Text style={{ fontSize: 10, color: txtColor, opacity: 0.6, fontWeight: '600' }}>
                    {streak >= 365 ? '365+' : streak >= 100 ? `${streak}` : streak}
                  </Text>
                  {streak >= 7 && (
                    <Text style={{ fontSize: 8, color: txtColor, opacity: 0.5, fontWeight: '700' }}>
                      {streak >= 365 ? 'год' : streak >= 30 ? 'мес' : 'дн'}
                    </Text>
                  )}
                </View>
              )}
              {isQuit && <View/>}
            </View>
            {/* Чекбокс */}
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexShrink: 0 }}>
              {hasPartner && (
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
                      <Path d="M5 12l5 5L19 7" stroke="#ffffff" strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round"/>
                    </Svg>
                  )}
                </View>
              </TouchableOpacity>
            </View>
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
  sortDone, flashId, counts, onToggle, onDelete, onOpenDetail, onReorder,
  onDragStart, onDragEnd, onCountChange }: {
  habits: Habit[]; myId: string; partnerId?: string; logs: Record<string,boolean>;
  hasPartner: boolean; tk: Theme; isEn: boolean; sortDone?: boolean; flashId?: string|null;
  counts?: Record<string, number>;
  onToggle: (id: string) => void; onDelete: (h: Habit) => void;
  onOpenDetail: (h: Habit) => void; onReorder: (habits: Habit[]) => void;
  onDragStart?: () => void; onDragEnd?: () => void;
  onCountChange?: (habitId: string, n: number) => void;
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
        .map(id => getHabit(id)).filter(Boolean) as Habit[];
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
interface Props {
  myId: string; myName: string; lang: string; tk: Theme;
  theme?: 'dark' | 'light';
  selectedAvatar?: string;
  habits: Habit[]; members: Member[]; logs: Record<string,boolean>;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenDetail: (h: Habit) => void;
  onAddHabit: () => void;
  onOpenProfile: () => void;
  onReorder: (habits: Habit[]) => void;
}

//  Главный экран 
export default function TodayScreen({
  myId, myName, lang, tk, theme = 'dark', habits, members, logs,
  onToggle, onDelete, onOpenDetail, onAddHabit, onOpenProfile, onReorder, onRefresh,
}: Props) {
  const isEn = lang === 'en';
  const L = (ru: string, en: string, uk?: string, be?: string, kk?: string) =>
    lang==='en' ? en : lang==='uk' ? (uk||ru) : lang==='be' ? (be||ru) : lang==='kk' ? (kk||ru) : ru;
  const [searchQ, setSearchQ] = useState('');
  const [sortDone,   setSortDone]   = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [flashId, setFlashId] = useState<string|null>(null);
  const [habitCounts, setHabitCounts] = useState<Record<string,number>>({});

  // Загрузить счётчики из Storage при монтировании
  useEffect(() => {
    const key = `habit_counts_${todayS()}`;
    AsyncStorage.getItem(key).then(val => {
      if (val) { try { setHabitCounts(JSON.parse(val)); } catch {} }
    });
  }, []);
  const [isDragging, setIsDragging] = useState(false); // выполненные в конец
  const today = new Date();
  const dow = todayDow();
  const ds  = todayS();
  const partner = members.find(m => m && m.id !== myId);
  const hasPartner = !!partner;

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
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140 }}
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
        }}
        scrollEventThrottle={16}>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center',
          justifyContent: 'space-between', marginTop: 8, marginBottom: 4 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: tk.text3, letterSpacing: 0.3, marginBottom: 3 }}>{dateStr}</Text>
            <Text style={{ fontSize: 24, fontWeight: '500', color: tk.text, letterSpacing: -0.6, lineHeight: 28 }}>
              {isEn ? 'Today' : 'Сегодня'}
            </Text>
          </View>
          <TouchableOpacity onPress={onOpenProfile}>
            {hasPartner ? (
              <View style={{ flexDirection: 'row' }}>
                <ProfileAvatar name={partner!.name} size={40} tk={tk} />
                <View style={{ marginLeft: -12 }}>
                  <ProfileAvatar name={myName} size={40} tk={tk} />
                </View>
              </View>
            ) : (
              <ProfileAvatar name={myName} size={42} tk={tk} />
            )}
          </TouchableOpacity>
        </View>

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
                  height: '100%', backgroundColor: tk.text3, borderRadius: 1 }} />
              </View>
              <Text style={{ fontSize: 12, fontWeight: '500', color: tk.text3, minWidth: 30, textAlign: 'right' }}>
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

        {/* Прогресс партнёра */}
        {hasPartner && partner && (() => {
          const partDoneCount = todayH.filter(h => partnerId && isLogged(h.id, partnerId, logs, ds)).length;
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

        {/* Habits header */}
        <View style={{ flexDirection: 'row', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ fontSize: 10, color: tk.text3, letterSpacing: 1.5, textTransform: 'uppercase' }}>
            {(lang === 'en' ? 'Habits' : lang==='uk' ? 'Звички' : lang==='be' ? 'Звычкі' : lang==='kk' ? 'Әдеттер' : 'Привычки')}{todayH.length > 0 ? ` (${todayH.length})` : ''}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {todayH.length > 1 ? (
              <TouchableOpacity onPress={() => setSortDone(s => !s)}
                style={{ paddingHorizontal: 8, paddingVertical: 3,
                  backgroundColor: sortDone ? tk.bg3 : 'transparent',
                  borderRadius: 6, borderWidth: 1,
                  borderColor: sortDone ? tk.border : 'transparent' }}>
                <Text style={{ fontSize: 9, color: sortDone ? tk.text2 : tk.text3, letterSpacing: 0.5 }}>
                  {(lang === 'en' ? 'DONE LAST' : lang==='uk' ? 'ВИКОНАНІ ВНИЗ' : lang==='be' ? 'ВЫКАНАНЫЯ ЎНІЗ' : lang==='kk' ? 'ОРЫНДАЛҒАНДАР ТӨМЕН' : 'СДЕЛАННЫЕ ВНИЗ')}
                </Text>
              </TouchableOpacity>
            ) : null}
            {todayH.length > 1 ? (
              <Text style={{ fontSize: 10, color: tk.text3, opacity: 0.5 }}>
                {(lang === 'en' ? 'Hold to reorder' : lang==='uk' ? 'Утримуйте для переміщення' : lang==='be' ? 'Утрымлівайце для перамяшчэння' : lang==='kk' ? 'Жылжыту үшін ұстаңыз' : 'Зажмите для перемещения')}
              </Text>
            ) : null}
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

        {todayH.length === 0 ? (
          <TouchableOpacity onPress={onAddHabit} activeOpacity={0.7}
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
                  {(lang === 'en' ? 'Add your first habit\nand start tracking' : lang==='uk' ? 'Додай першу звичку\nта починай відстежувати' : lang==='be' ? 'Дадай першую звычку\nі пачні адсочваць' : lang==='kk' ? 'Бірінші әдетіңді қос\nжәне бақылауды бастa' : 'Добавь первую привычку\nи начни отслеживать')}
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
        ) : (
          <DraggableList
            habits={searchQ
              ? todayH.filter(h => (h.name||'').toLowerCase().includes(searchQ.toLowerCase()))
              : todayH
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
          />
        )}

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
              borderColor: tk.bg === '#0a0a0a'
                ? 'rgba(255,255,255,0.25)'
                : tk.border,
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
    </View>
  );
}
