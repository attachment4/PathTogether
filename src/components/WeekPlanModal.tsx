import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Modal, Animated,
} from 'react-native';
import { Theme } from '../theme';
import { Habit } from '../store';
import { tArr } from '../i18n';

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

const DAYS_RU = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
const DAYS_EN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAYS_SHORT_RU = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const MONTHS_RU = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getDayName(lang: string, dow: number) {
  if (lang === 'en') return DAYS_EN[dow];
  return DAYS_RU[dow];
}
function getMonthShort(lang: string, m: number) {
  if (lang === 'en') return MONTHS_EN[m];
  return MONTHS_RU[m];
}

export default function WeekPlanModal({
  visible, onClose, tk, accent, accent2, lang,
  myId, habits, logs, onToggle,
}: Props) {
  const slideAnim = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0, useNativeDriver: true,
        tension: 65, friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 600, duration: 250, useNativeDriver: true,
      }).start();
    }
    // Если компонент размонтируется в середине анимации — гасим её,
    // иначе Animated держит handle и логирует varning о завершении
    // на отвязанном узле.
    return () => { slideAnim.stopAnimation(); };
  }, [visible]);

  // Следующие 7 дней начиная с сегодня
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
      {/* Затемнение фона */}
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: '#00000066' }}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Само меню */}
      <Animated.View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        transform: [{ translateY: slideAnim }],
        backgroundColor: tk.bg2,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        maxHeight: '85%',
        shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3, shadowRadius: 20, elevation: 20,
      }}>
        {/* Ручка */}
        <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: tk.border }} />
        </View>

        {/* Заголовок */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 }}>
          <Text style={{ fontSize: 20, fontWeight: '900', color: tk.text, flex: 1 }}>
            📅 {lang === 'en' ? 'Week plan' : 'План на неделю'}
          </Text>
          <TouchableOpacity onPress={onClose}
            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: tk.bg3, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: tk.text2, fontSize: 16, fontWeight: '700' }}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Список дней */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>

          {days.map((day, idx) => {
            const dow    = day.getDay(); // 0=вс
            const dowMon = (dow + 6) % 7; // 0=пн для фильтра привычек
            const ds     = dateStr(day);
            const today  = isToday(day);

            // Привычки этого дня
            const dayHabits = habits.filter(h => h.days?.includes(dowMon));
            const doneCount = dayHabits.filter(h => !!(logs[`${h.id}_${ds}_${myId}`])).length;

            return (
              <View key={ds}>
                {/* Разделитель между днями */}
                {idx > 0 && (
                  <View style={{ height: 1, backgroundColor: tk.border + '60', marginVertical: 12 }} />
                )}

                {/* Заголовок дня */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                  {/* Дата-кружок */}
                  <View style={{
                    width: 44, height: 44, borderRadius: 22,
                    backgroundColor: today ? accent : tk.bg3,
                    alignItems: 'center', justifyContent: 'center',
                    marginRight: 12,
                    shadowColor: today ? accent : 'transparent',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.4, shadowRadius: 8,
                  }}>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: today ? '#fff' : tk.text }}>
                      {day.getDate()}
                    </Text>
                    <Text style={{ fontSize: 9, color: today ? '#ffffff99' : tk.text3, fontWeight: '700', marginTop: -2 }}>
                      {getMonthShort(lang, day.getMonth())}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: today ? accent : tk.text }}>
                        {getDayName(lang, dow)}
                      </Text>
                      {today && (
                        <View style={{ backgroundColor: accent + '33', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 11, color: accent, fontWeight: '800' }}>
                            {lang === 'en' ? 'Today' : 'Сегодня'}
                          </Text>
                        </View>
                      )}
                    </View>
                    {dayHabits.length > 0 && (
                      <Text style={{ fontSize: 12, color: tk.text2, marginTop: 2 }}>
                        {doneCount}/{dayHabits.length} {lang === 'en' ? 'done' : 'выполнено'}
                      </Text>
                    )}
                  </View>

                  {/* Прогресс-дуга */}
                  {dayHabits.length > 0 && (
                    <View style={{
                      width: 36, height: 36, borderRadius: 18,
                      backgroundColor: doneCount === dayHabits.length ? '#2ED57322' : tk.bg3,
                      borderWidth: 2,
                      borderColor: doneCount === 0 ? tk.border : doneCount === dayHabits.length ? '#2ED573' : '#FECA57',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Text style={{ fontSize: 11, fontWeight: '900', color: doneCount === dayHabits.length ? '#2ED573' : tk.text2 }}>
                        {Math.round(doneCount / dayHabits.length * 100)}%
                      </Text>
                    </View>
                  )}
                </View>

                {/* Привычки дня */}
                {dayHabits.length === 0 ? (
                  <View style={{
                    backgroundColor: tk.bg3, borderRadius: 12,
                    padding: 12, alignItems: 'center',
                  }}>
                    <Text style={{ fontSize: 13, color: tk.text3, fontStyle: 'italic' }}>
                      {lang === 'en' ? 'No habits' : 'Нет привычек'}
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 7 }}>
                    {dayHabits.map(h => {
                      const done = !!(logs[`${h.id}_${ds}_${myId}`]);
                      return (
                        <TouchableOpacity
                          key={h.id}
                          onPress={() => { if (today) onToggle(h.id); }}
                          activeOpacity={today ? 0.7 : 1}
                          style={{
                            flexDirection: 'row', alignItems: 'center',
                            backgroundColor: done ? h.color + '18' : tk.bg,
                            borderRadius: 13, padding: 11,
                            borderWidth: 1.5,
                            borderColor: done ? h.color + '55' : tk.border,
                          }}>
                          {/* Иконка */}
                          <View style={{
                            width: 36, height: 36, borderRadius: 11,
                            backgroundColor: done ? h.color : h.color + '22',
                            alignItems: 'center', justifyContent: 'center',
                            marginRight: 10,
                          }}>
                            <Text style={{ fontSize: 18 }}>{h.icon}</Text>
                          </View>

                          {/* Название */}
                          <View style={{ flex: 1 }}>
                            <Text style={{
                              fontSize: 14, fontWeight: '700',
                              color: done ? h.color : tk.text,
                              textDecorationLine: done ? 'line-through' : 'none',
                            }}>{h.name}</Text>
                            {h.time ? (
                              <Text style={{ fontSize: 11, color: tk.text3, marginTop: 2 }}>⏰ {h.time.slice(0,5)}</Text>
                            ) : null}
                          </View>

                          {/* Чекбокс (только для сегодня) */}
                          {today && (
                            <View style={{
                              width: 26, height: 26, borderRadius: 13,
                              backgroundColor: done ? h.color : 'transparent',
                              borderWidth: 2, borderColor: h.color,
                              alignItems: 'center', justifyContent: 'center',
                            }}>
                              {done && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>✓</Text>}
                            </View>
                          )}

                          {/* Для будущих дней — только метка */}
                          {!today && (
                            <View style={{
                              paddingHorizontal: 8, paddingVertical: 3,
                              backgroundColor: tk.bg3, borderRadius: 8,
                            }}>
                              <Text style={{ fontSize: 10, color: tk.text3, fontWeight: '700' }}>
                                {lang === 'en' ? 'planned' : 'план'}
                              </Text>
                            </View>
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
