import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Modal, Animated,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Theme } from '../theme';
import { Habit } from '../store';

const DAYS_RU = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
const DAYS_EN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS_RU = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

interface Props {
  visible: boolean;
  onClose: () => void;
  tk: Theme;
  accent: string;
  accent2: string;
  lang: string;
  myId: string;
  habits: Habit[];
  logs: Record<string, boolean>;
  onToggle: (habitId: string) => void;
}

export default function WeekPlanModal({
  visible, onClose, tk, lang,
  myId, habits, logs, onToggle,
}: Props) {
  const slideAnim = useRef(new Animated.Value(600)).current;
  const isEn = lang === 'en';

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0, useNativeDriver: true, tension: 65, friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 600, duration: 250, useNativeDriver: true,
      }).start();
    }
    return () => { slideAnim.stopAnimation(); };
  }, [visible]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  const dateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  const isToday = (d: Date) => {
    const now = new Date();
    return d.getDate()===now.getDate() && d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: '#00000066' }}
        activeOpacity={1}
        onPress={onClose}
      />
      <Animated.View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        transform: [{ translateY: slideAnim }],
        backgroundColor: tk.bg,
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        maxHeight: '88%',
        shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.15, shadowRadius: 12, elevation: 16,
        borderTopWidth: 1, borderColor: tk.border,
      }}>
        {/* Ручка */}
        <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 2 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: tk.border }} />
        </View>

        {/* Заголовок */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: tk.text, flex: 1, letterSpacing: -0.3 }}>
            {isEn ? 'Week plan' : 'План на неделю'}
          </Text>
          <TouchableOpacity onPress={onClose}
            style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: tk.bg2,
              borderWidth: 1, borderColor: tk.border,
              alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: tk.text3, fontSize: 14 }}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}>

          {days.map((day, idx) => {
            const dow    = day.getDay();
            const dowMon = (dow + 6) % 7;
            const ds     = dateStr(day);
            const today  = isToday(day);
            const dayHabits = habits.filter(h => h.days?.includes(dowMon));
            const doneCount = dayHabits.filter(h => !!(logs[`${h.id}_${ds}_${myId}`])).length;
            const allDone = dayHabits.length > 0 && doneCount === dayHabits.length;

            return (
              <View key={ds}>
                {idx > 0 && (
                  <View style={{ height: 1, backgroundColor: tk.border, marginVertical: 14 }} />
                )}

                {/* Заголовок дня */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <View style={{
                    width: 40, height: 40, borderRadius: 10,
                    backgroundColor: today ? tk.text : tk.bg2,
                    borderWidth: today ? 0 : 1, borderColor: tk.border,
                    alignItems: 'center', justifyContent: 'center',
                    marginRight: 12,
                  }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: today ? tk.bg : tk.text }}>
                      {day.getDate()}
                    </Text>
                    <Text style={{ fontSize: 10, color: today ? tk.bg + 'cc' : tk.text2, marginTop: -1 }}>
                      {isEn ? MONTHS_EN[day.getMonth()] : MONTHS_RU[day.getMonth()]}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 15, fontWeight: today ? '600' : '500', color: tk.text }}>
                        {isEn ? DAYS_EN[dow] : DAYS_RU[dow]}
                      </Text>
                      {today && (
                        <View style={{ backgroundColor: tk.bg2, borderRadius: 6,
                          paddingHorizontal: 7, paddingVertical: 2,
                          borderWidth: 1, borderColor: tk.border }}>
                          <Text style={{ fontSize: 10, color: tk.text3, fontWeight: '500' }}>
                            {isEn ? 'Today' : 'Сегодня'}
                          </Text>
                        </View>
                      )}
                    </View>
                    {dayHabits.length > 0 && (
                      <Text style={{ fontSize: 11, color: tk.text3, marginTop: 1 }}>
                        {doneCount}/{dayHabits.length} {isEn ? 'done' : 'выполнено'}
                      </Text>
                    )}
                  </View>

                  {dayHabits.length > 0 && (
                    <View style={{
                      paddingHorizontal: 10, paddingVertical: 4,
                      backgroundColor: allDone ? tk.text + '12' : tk.bg2,
                      borderRadius: 8, borderWidth: 1,
                      borderColor: allDone ? tk.text + '30' : tk.border,
                    }}>
                      <Text style={{ fontSize: 11, fontWeight: '600',
                        color: allDone ? tk.text : tk.text3 }}>
                        {Math.round(doneCount / dayHabits.length * 100)}%
                      </Text>
                    </View>
                  )}
                </View>

                {/* Привычки */}
                {dayHabits.length === 0 ? (
                  <View style={{ paddingVertical: 10, paddingHorizontal: 4 }}>
                    <Text style={{ fontSize: 12, color: tk.text3 }}>
                      {isEn ? 'No habits' : 'Нет привычек'}
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 6 }}>
                    {dayHabits.map(h => {
                      const done = !!(logs[`${h.id}_${ds}_${myId}`]);
                      return (
                        <TouchableOpacity
                          key={h.id}
                          onPress={() => { if (today) onToggle(h.id); }}
                          activeOpacity={today ? 0.7 : 1}
                          style={{
                            flexDirection: 'row', alignItems: 'center',
                            backgroundColor: tk.bg2,
                            borderRadius: 12, padding: 10,
                            borderWidth: 1,
                            borderColor: done ? tk.text + '30' : tk.border,
                            gap: 10,
                          }}>
                          {/* Цветная полоска слева */}
                          <View style={{
                            width: 3, height: 28, borderRadius: 2,
                            backgroundColor: h.color && h.color !== '#f5f5f5' ? h.color : tk.border,
                          }} />

                          {/* Название */}
                          <Text style={{
                            flex: 1, fontSize: 13, fontWeight: '500',
                            color: done ? tk.text3 : tk.text,
                            textDecorationLine: done ? 'line-through' : 'none',
                          }} numberOfLines={1}>{h.name}</Text>

                          {h.time ? (
                            <Text style={{ fontSize: 10, color: tk.text3 }}>{h.time.slice(0,5)}</Text>
                          ) : null}

                          {/* Чекбокс (сегодня) */}
                          {today && (
                            <View style={{
                              width: 22, height: 22, borderRadius: 11,
                              backgroundColor: done ? tk.text : 'transparent',
                              borderWidth: 1.5, borderColor: done ? tk.text : tk.border,
                              alignItems: 'center', justifyContent: 'center',
                            }}>
                              {done && (
                                <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                                  <Path d="M5 13l4 4L19 7" stroke={tk.bg} strokeWidth="2.5"
                                    strokeLinecap="round" strokeLinejoin="round"/>
                                </Svg>
                              )}
                            </View>
                          )}

                          {/* Метка «план» для будущих */}
                          {!today && (
                            <Text style={{ fontSize: 10, color: tk.text2 }}>
                              {isEn ? 'plan' : 'план'}
                            </Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}
