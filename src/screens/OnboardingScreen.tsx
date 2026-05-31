import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Dimensions, Animated,
  StatusBar, Platform, TextInput,
} from 'react-native';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { Theme } from '../theme';
import { Storage } from '../store';
import { STATUS_BAR_TOP } from '../utils';

const { width: W, height: H } = Dimensions.get('window');
const TOP = STATUS_BAR_TOP + 4; // onboarding needs extra breathing room
interface Props { tk: Theme; lang?: string; onDone: () => void; }

//  Иллюстрации 

// Слайд 1: логотип + subtitle (чистый текстовый слайд как в презентации)
function Illo0({ tk }: { tk: Theme }) {
  const fade = useRef(new Animated.Value(0)).current;
  const y    = useRef(new Animated.Value(12)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 700, delay: 200, useNativeDriver: true }),
      Animated.timing(y,    { toValue: 0, duration: 600, delay: 200, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY: y }], alignItems: 'flex-start', marginTop: 8 }}>
      {/* Разделитель как в презентации */}
      <View style={{ width: 40, height: 2, backgroundColor: tk.text3, marginBottom: 24 }} />
      <Text style={{ fontSize: 14, color: tk.text3, lineHeight: 22 }}>
        Ваш путь к привычкам — теперь вместе.{'\n'}Помогаем строить дисциплину и укреплять связи.
      </Text>
    </Animated.View>
  );
}

// Слайд 2: "Создавайте цели" — мокап карточек привычек
function Illo1({ tk }: { tk: Theme }) {
  const habits = [
    { letter: 'У', name: 'Утренняя пробежка', days: 'пн вт чт пт',  done: true },
    { letter: 'Ч', name: 'Читать 20 минут',   days: 'ежедневно',     done: true },
    { letter: 'М', name: 'Медитация',          days: 'пн ср пт',      done: false },
  ];
  return (
    <View style={{ gap: 8, width: '100%' }}>
      {habits.map((h, i) => (
        <View key={i} style={{
          backgroundColor: tk.bg2, borderRadius: 16,
          borderWidth: 1, borderColor: tk.border,
          padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
        }}>
          <View style={{ width: 36, height: 36, borderRadius: 10,
            backgroundColor: tk.bg3, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: '500', color: tk.text2 }}>{h.letter}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: h.done ? tk.text2 : tk.text,
              textDecorationLine: h.done ? 'line-through' : 'none' }}>{h.name}</Text>
            <Text style={{ fontSize: 10, color: tk.text3, marginTop: 2 }}>{h.days}</Text>
          </View>
          <View style={{ width: 22, height: 22, borderRadius: 11,
            borderWidth: 1.5, borderColor: h.done ? tk.text : tk.border,
            backgroundColor: h.done ? tk.text : 'transparent',
            alignItems: 'center', justifyContent: 'center' }}>
            {h.done && (
              <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                <Path d="M5 13l4 4L19 7" stroke={tk.bg} strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round"/>
              </Svg>
            )}
          </View>
        </View>
      ))}
      {/* Фичи снизу */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
        {['Гибкий график', 'Напоминания', 'Цвет карточки'].map(f => (
          <View key={f} style={{ flex: 1, backgroundColor: tk.bg2,
            borderRadius: 10, borderWidth: 1, borderColor: tk.border,
            paddingVertical: 8, alignItems: 'center' }}>
            <Text style={{ fontSize: 9, color: tk.text3, textAlign: 'center', letterSpacing: 0.3 }}>{f}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// Слайд 3: "Двигайтесь вдвоём" — совместный прогресс
function Illo2({ tk }: { tk: Theme }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.03, duration: 1400, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,    duration: 1400, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <View style={{ gap: 10, width: '100%' }}>
      <Animated.View style={{
        backgroundColor: tk.bg2, borderRadius: 16,
        borderWidth: 1, borderColor: tk.border,
        shadowColor: tk.cardShadowColor, shadowOpacity: tk.cardShadowOpacity,
        shadowRadius: tk.cardShadowRadius, shadowOffset: { width: 0, height: 3 }, elevation: 0,
        padding: 16, transform: [{ scale: pulse }],
      }}>
        <Text style={{ fontSize: 10, color: tk.text3, letterSpacing: 2,
          textTransform: 'uppercase', marginBottom: 14 }}>Сегодня вместе</Text>
        {[
          { name: 'Анна', letter: 'А', done: true, pct: '100%' },
          { name: 'Иван', letter: 'И', done: false, pct: '60%' },
        ].map(u => (
          <View key={u.name} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14,
                backgroundColor: u.done ? tk.text : tk.bg3,
                borderWidth: 1, borderColor: tk.border,
                alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 11, fontWeight: '500',
                  color: u.done ? tk.bg : tk.text2 }}>{u.letter}</Text>
              </View>
              <Text style={{ flex: 1, fontSize: 13, color: tk.text,
                fontWeight: '500' }}>{u.name}</Text>
              <Text style={{ fontSize: 11, color: tk.text3 }}>{u.pct}</Text>
            </View>
            <View style={{ height: 3, backgroundColor: tk.border, borderRadius: 2 }}>
              <View style={{ height: 3, width: typeof u.pct === 'string' ? parseInt(u.pct) : u.pct,
                backgroundColor: u.done ? tk.text : tk.text3, borderRadius: 2 }} />
            </View>
          </View>
        ))}
      </Animated.View>
      {/* Трекер настроения */}
      <View style={{ backgroundColor: tk.bg2, borderRadius: 12,
        borderWidth: 1, borderColor: tk.border, padding: 12,
        flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {['#c8a0a0','#c8b48c','#b8b88c','#8cb8a0','#8ca8c8'].map((c,i)=>(
            <View key={i} style={{ width: i===3?28:20, height: i===3?28:20, borderRadius: 14,
              borderWidth: i===3?2:1, borderColor: i===3?c:'transparent',
              backgroundColor: c+'44', alignItems:'center', justifyContent:'center' }}>
            </View>
          ))}
        </View>
        <Text style={{ flex:1, fontSize: 11, color: tk.text3 }}>Трекер настроения</Text>
      </View>
      {/* Серия */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {[['7', 'дней серия'], ['2', 'общих цели'], ['14', 'дней вместе']].map(([v, l]) => (
          <View key={l} style={{ flex: 1, backgroundColor: tk.bg2,
            borderRadius: 12, borderWidth: 1, borderColor: tk.border,
            paddingVertical: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '500', color: tk.text }}>{v}</Text>
            <Text style={{ fontSize: 9, color: tk.text3, marginTop: 2,
              textAlign: 'center', letterSpacing: 0.3 }}>{l.toUpperCase()}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// Слайд 4: "Анализируйте успех" — горизонтальные бары как в презентации
function Illo3({ tk }: { tk: Theme }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 1000, delay: 200, useNativeDriver: false }).start();
  }, []);
  const bars = [
    { label: 'Вы',       pct: 0.90, val: '90%' },
    { label: 'Цель',     pct: 0.75, val: '75%' },
    { label: 'Среднее',  pct: 0.45, val: '45%' },
  ];
  return (
    <View style={{ gap: 10, width: '100%' }}>
      {bars.map((b, i) => {
        const w = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${b.pct * 100}%`] });
        return (
          <View key={i} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: tk.text }}>{b.label}</Text>
              <Text style={{ fontSize: 13, color: tk.text3 }}>{b.val}</Text>
            </View>
            <View style={{ height: 36, backgroundColor: tk.bg2,
              borderRadius: 10, borderWidth: 1, borderColor: tk.border,
              overflow: 'hidden', justifyContent: 'center' }}>
              <Animated.View style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                backgroundColor: i === 0 ? tk.text : tk.bg3,
                width: w, borderRadius: 10,
              }} />
            </View>
          </View>
        );
      })}
      <Text style={{ fontSize: 12, color: tk.text3, lineHeight: 18, marginTop: 4 }}>
        Серии побед, проценты выполнения за месяц — всё в одном месте
      </Text>
    </View>
  );
}

// Слайд 5: финальный — галочка подтверждения
function Illo4({ tk, checked, onCheck }: { tk: Theme; checked: boolean; onCheck: () => void }) {
  const scale     = useRef(new Animated.Value(1)).current;
  const checkAnim = useRef(new Animated.Value(0)).current;
  const pulseRing = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!checked) {
      // Пульсирующее кольцо — подсказка нажать
      Animated.loop(Animated.sequence([
        Animated.timing(pulseRing, { toValue: 1.12, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseRing, { toValue: 1.0,  duration: 900, useNativeDriver: true }),
      ])).start();
    } else {
      pulseRing.stopAnimation();
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.16, friction: 4, tension: 120, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1,    friction: 6, tension: 80,  useNativeDriver: true }),
      ]).start();
      Animated.timing(checkAnim, { toValue: 1, duration: 320, useNativeDriver: true }).start();
    }
  }, [checked]);

  return (
    <View style={{ alignItems: 'center', gap: 28 }}>
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        {/* Пульсирующее кольцо-подсказка */}
        {!checked && (
          <Animated.View style={{
            position: 'absolute',
            width: 148, height: 148, borderRadius: 74,
            borderWidth: 1.5, borderColor: tk.text3,
            transform: [{ scale: pulseRing }],
            opacity: pulseRing.interpolate({ inputRange: [1, 1.12], outputRange: [0.5, 0] }),
          }} />
        )}
        <TouchableOpacity onPress={onCheck} activeOpacity={0.85}>
          <Animated.View style={{
            width: 120, height: 120, borderRadius: 60,
            backgroundColor: checked ? tk.text : tk.bg2,
            borderWidth: checked ? 0 : 2, borderColor: tk.border,
            alignItems: 'center', justifyContent: 'center',
            shadowColor: tk.glowColor, shadowOpacity: checked ? tk.glowOpacity : tk.cardShadowOpacity,
            shadowRadius: checked ? tk.glowRadius : tk.cardShadowRadius,
            shadowOffset: { width: 0, height: 0 }, elevation: checked ? tk.glowElevation : tk.cardElevation,
            transform: [{ scale: checked ? scale : new Animated.Value(1) }],
          }}>
            {checked ? (
              <Animated.View style={{
                opacity: checkAnim,
                transform: [{ scale: checkAnim.interpolate({ inputRange:[0,1], outputRange:[0.4,1] }) }],
              }}>
                <Svg width={54} height={54} viewBox="0 0 24 24" fill="none">
                  <Path d="M5 13l4 4L19 7" stroke={tk.bg} strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round"/>
                </Svg>
              </Animated.View>
            ) : (
              <Svg width={34} height={34} viewBox="0 0 24 24" fill="none">
                <Path d="M20 6L9 17l-5-5" stroke={tk.text3} strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round"/>
              </Svg>
            )}
          </Animated.View>
        </TouchableOpacity>
      </View>
      {checked && (
        <Animated.Text style={{ fontSize: 14, color: tk.text2,
          fontWeight: '500', opacity: checkAnim }}>
          Отлично — начнём
        </Animated.Text>
      )}
    </View>
  );
}

//  Данные слайдов 
const SLIDES = [
  { id: 's0', accentTitle: 'PathTogether', regularTitle: '',
    sub: '' },
  { id: 's1', accentTitle: 'привычки',     regularTitle: 'Строй хорошие ',
    sub: 'Полезные цели и избавление от плохих привычек. Рутины на утро, день и вечер.' },
  { id: 's2', accentTitle: 'вдвоём',       regularTitle: 'Двигайтесь ',
    sub: 'Пригласи партнёра. Следите за прогрессом друг друга в реальном времени.' },
  { id: 's3', accentTitle: 'настроение',   regularTitle: 'Следи за ',
    sub: 'Трекер настроения, заметки к привычкам и подробная статистика.' },
  { id: 's4', accentTitle: 'первому шагу?', regularTitle: 'Готов к ',
    sub: 'Выбери цель чтобы мы подготовили персональные рекомендации.' },
];

export default function OnboardingScreen({ tk, lang = 'ru', onDone }: Props) {
  const [cur, setCur]           = useState(0);
  const [goal, setGoal]         = useState<string>('');
  const [userName, setUserName]  = useState<string>('');
  const [finalChecked, setFinalChecked] = useState(false);

  const slideOp      = useRef(new Animated.Value(1)).current;
  const slideX       = useRef(new Animated.Value(0)).current;
  const progress     = useRef(new Animated.Value(1 / SLIDES.length)).current;
  const btnScale     = useRef(new Animated.Value(1)).current;
  const transitioning = useRef(false);

  const slide   = SLIDES[cur];
  const isFinal = slide.id === 's4';
  const isFirst = cur === 0;
  const isLast  = cur === SLIDES.length - 1;
  const canGo   = isFinal ? finalChecked : true;

  const transition = () => {
    if (transitioning.current) return;
    transitioning.current = true;
    Animated.timing(slideX, { toValue: -28, duration: 200, useNativeDriver: true }
    ).start(() => {
      setCur(c => {
        const next = Math.min(c + 1, SLIDES.length - 1);
        Animated.timing(progress, {
          toValue: (next + 1) / SLIDES.length, duration: 400, useNativeDriver: false,
        }).start();
        return next;
      });
      slideX.setValue(28);
      setTimeout(() => {
        Animated.spring(slideX, { toValue: 0, friction: 9, tension: 65, useNativeDriver: true }
        ).start(() => { transitioning.current = false; });
      }, 16);
    });
  };

  const goNext = async () => {
    if (!canGo || transitioning.current) return;
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.95, duration: 70, useNativeDriver: true }),
      Animated.spring(btnScale, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
    if (isLast) {
      Animated.timing(slideX, { toValue: -30, duration: 280, useNativeDriver: true }
      ).start(async () => {
        await Storage.saveOnboarding();
        if (goal) await Storage.set('onboarding_goal', goal).catch(()=>{});
        if (userName.trim()) await Storage.set('onboarding_name', userName.trim()).catch(()=>{});
        onDone();
      });
      return;
    }
    if (cur < SLIDES.length - 1) transition();
  };

  const progressW = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={{ flex: 1, backgroundColor: tk.bg }}>

      {/* Прогресс полоска */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: tk.bg2, zIndex: 10 }}>
        <Animated.View style={{ height: 2, backgroundColor: tk.text, width: progressW }} />
      </View>

      {/* Контент */}
      <Animated.View style={{
        flex: 1, paddingTop: TOP + 20, paddingHorizontal: 28,
        paddingBottom: 130,
        transform: [{ translateX: slideX }],
      }}>
        {/* Тег-метка сверху */}
        {!isFirst && (
          <Text style={{ fontSize: 10, color: tk.text3, letterSpacing: 2.5,
            textTransform: 'uppercase', marginBottom: 18 }}>
            {cur} / {SLIDES.length - 1}
          </Text>
        )}

        {/* Заголовок — стиль из презентации: обычный + акцентный */}
        {isFirst ? (
          <Text style={{ fontSize: 48, fontWeight: '500', color: tk.text,
            letterSpacing: -1, lineHeight: 54, marginBottom: 4 }}>
            PathTogether
          </Text>
        ) : (
          <Text style={{ fontSize: 36, fontWeight: '500', lineHeight: 42,
            letterSpacing: -0.5, marginBottom: slide.sub ? 10 : 24 }}>
            <Text style={{ color: tk.text2 }}>{slide.regularTitle}</Text>
            <Text style={{ color: tk.text }}>{slide.accentTitle}</Text>
          </Text>
        )}

        {!!slide.sub && (
          <Text style={{ fontSize: 14, color: tk.text3, lineHeight: 21, marginBottom: cur === 4 ? 16 : 28 }}>
            {slide.sub}
          </Text>
        )}

        {/* Имя пользователя на первом слайде */}
        {cur === 0 && (
          <View style={{ marginBottom: 24, width: '100%' }}>
            <TextInput
              value={userName}
              onChangeText={setUserName}
              placeholder={lang === 'en' ? 'Your name' : lang==='uk' ? "Ваше ім'я" : 'Ваше имя'}
              placeholderTextColor={tk.text3}
              maxLength={30}
              style={{ backgroundColor: tk.bg2, borderWidth: 1.5,
                borderColor: userName ? tk.text : tk.border,
                borderRadius: 16, padding: 16, fontSize: 16,
                color: tk.text, textAlign: 'center', fontWeight: '500' }}
            />
            {userName.length > 0 && (
              <Text style={{ fontSize: 11, color: tk.text3, textAlign: 'center', marginTop: 8 }}>
                {lang === 'en' ? `Hi, ${userName}!` : `Привет, ${userName}!`}
              </Text>
            )}
          </View>
        )}

        {/* Выбор цели на финальном слайде */}
        {cur === 4 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 }}>
            {[
              { id: 'health',       ru: 'Здоровье',      en: 'Health' },
              { id: 'productivity', ru: 'Продуктивность', en: 'Productivity' },
              { id: 'mindfulness',  ru: 'Спокойствие',   en: 'Mindfulness' },
              { id: 'social',       ru: 'Общение',        en: 'Social' },
              { id: 'quit',         ru: 'Бросить плохое',en: 'Quit habits' },
              { id: 'together',     ru: 'С партнёром',   en: 'Together' },
            ].map(g => (
              <TouchableOpacity key={g.id}
                onPress={() => setGoal(g.id)}
                style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
                  backgroundColor: goal === g.id ? tk.text : tk.bg2,
                  borderWidth: 1.5, borderColor: goal === g.id ? 'transparent' : tk.border }}>
                <Text style={{ fontSize: 13, fontWeight: goal === g.id ? '700' : '400',
                  color: goal === g.id ? tk.bg : tk.text2 }}>
                  {lang === 'en' ? g.en : g.ru}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Иллюстрации */}
        {cur === 0 && <Illo0 tk={tk} />}
        {cur === 1 && <Illo1 tk={tk} />}
        {cur === 2 && <Illo2 tk={tk} />}
        {cur === 3 && <Illo3 tk={tk} />}
        {cur === 4 && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 16 }}>
            <Illo4 tk={tk} checked={finalChecked} onCheck={() => setFinalChecked(f => !f)} />
          </View>
        )}
      </Animated.View>

      {/* Нижняя панель */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingHorizontal: 28,
        paddingBottom: Platform.OS === 'ios' ? 44 : 28,
        paddingTop: 16,
        backgroundColor: tk.bg,
        borderTopWidth: 0.5, borderTopColor: tk.border,
      }}>
        {/* Точки */}
        <Text style={{ fontSize: 11, color: tk.text3, textAlign: 'center', marginBottom: 8 }}>
          {cur + 1} / {SLIDES.length}
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4, marginBottom: 14 }}>
          {SLIDES.map((_, i) => (
            <View key={i} style={{
              height: 2, borderRadius: 1,
              width: i === cur ? 18 : 4,
              backgroundColor: i === cur ? tk.text : tk.border,
            }} />
          ))}
        </View>

        {/* Кнопка */}
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity onPress={goNext} disabled={!canGo} activeOpacity={0.85}
            style={{
              backgroundColor: canGo ? tk.text : tk.bg2,
              borderWidth: 1, borderColor: canGo ? 'transparent' : tk.border,
              borderRadius: 14, paddingVertical: 15,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
            <Text style={{ fontSize: 15, fontWeight: '600',
              color: canGo ? tk.bg : tk.text3 }}>
              {isFinal ? (finalChecked ? 'Погнали' : 'Подтверди выше') : 'Далее'}
            </Text>
            {canGo && (
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path d="M5 12h14M13 6l6 6-6 6" stroke={tk.bg} strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"/>
              </Svg>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}
