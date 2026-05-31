import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert, PanResponder, Animated,
  Platform, StatusBar,
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { Theme } from '../theme';
import { tr } from '../i18n';
import { Subscription, PLAN_LIMITS, loadSubscription, cancelPlan, getDaysLeft } from '../subscription';
import { purchasePlan, restorePurchases } from '../purchases';

// Локализация
interface Props {
  lang: string; tk: Theme;
  myId: string;
  subscription: Subscription;
  onPlanChange: (sub: Subscription) => void;
  onBack: () => void;
}

//  Стрелка назад 
function BackArrow({ onPress, tk }: { onPress: () => void; tk: Theme }) {
  return (
    <TouchableOpacity onPress={onPress}
      hitSlop={{ top: 14, bottom: 14, left: 20, right: 20 }}
      style={{ padding: 8 }}>
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path d="M19 12H5M5 12l7 7M5 12l7-7"
          stroke={tk.text2} strokeWidth="1.7"
          strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    </TouchableOpacity>
  );
}

//  Карточка плана 
function PlanCard({ plan, sub, isEn, lang, onSelect, tk, isSelected }: {
  plan: 'free' | 'duo' | 'team';
  sub: Subscription;
  isEn: boolean;
  lang?: string;
  onSelect: (plan: 'free' | 'duo' | 'team') => void;
  tk: Theme;
  isSelected?: boolean;
}) {
  const info = PLAN_LIMITS[plan];
  const isCurrent = sub.plan === plan && sub.isActive;
  const accentColor = plan === 'duo' ? tk.accent : plan === 'team' ? '#0ea5e9' : (tk.text3);

  return (
    <TouchableOpacity
      onPress={() => onSelect(plan)}
      activeOpacity={0.75}
      style={{
        flex: 1,
        padding: 12,
        borderRadius: 14,
        backgroundColor: isSelected || isCurrent ? tk.bg2 : tk.bg,
        borderWidth: isSelected || isCurrent ? 1.5 : 1,
        borderColor: isSelected || isCurrent ? accentColor : tk.border,
        alignItems: 'center',
        gap: 6,
      }}>
      <View style={{ width: 6, height: 6, borderRadius: 3,
        backgroundColor: isSelected || isCurrent ? accentColor : tk.border }} />
      <Text style={{ fontSize: 13, fontWeight: '500', color: tk.text, textAlign: 'center' }}>
        {isEn ? info.label_en : info.label_ru}
      </Text>
      <Text style={{ fontSize: 11, color: isSelected || isCurrent ? accentColor : tk.text3, textAlign: 'center' }}>
        {isEn ? info.price_en : info.price_ru}
      </Text>
    </TouchableOpacity>
  );
}

function PlanDetail({ plan, isEn, lang, tk, onSelect }: {
  plan: 'duo' | 'team';
  isEn: boolean;
  lang: string;
  tk: Theme;
  onSelect: (plan: 'duo' | 'team') => void;
}) {
  const accentColor = plan === 'duo' ? tk.accent : '#0ea5e9';
  const features = {
    duo: [
      { icon: 'ti-users',      text: isEn ? 'Invite 1 friend or partner' : 'Пригласить друга или партнёра' },
      { icon: 'ti-chart-line', text: isEn ? 'See progress in real time' : 'Прогресс в реальном времени' },
      { icon: 'ti-flame',      text: isEn ? 'Shared streaks & achievements' : 'Общие серии и достижения' },
      { icon: 'ti-bell',       text: isEn ? 'Partner completion alerts' : 'Уведомления о выполнении' },
    ],
    team: [
      { icon: 'ti-users',        text: isEn ? 'Up to 5 members' : 'До 5 участников' },
      { icon: 'ti-layout-board', text: isEn ? 'Team activity board' : 'Общая доска активности' },
      { icon: 'ti-chart-line',   text: isEn ? 'Assign habits to members' : 'Назначать привычки' },
      { icon: 'ti-flame',        text: isEn ? 'Group streaks & goals' : 'Групповые серии и цели' },
    ],
  };
  const info = PLAN_LIMITS[plan];
  const priceNum = plan === 'duo' ? '129' : '299';

  return (
    <View style={{ backgroundColor: tk.bg2, borderRadius: 16,
      borderWidth: 1, borderColor: tk.border, padding: 18, marginTop: 12 }}>
      <View style={{ marginBottom: 14 }}>
        <Text style={{ fontSize: 17, fontWeight: '500', color: tk.text, letterSpacing: -0.3 }}>
          {isEn ? info.label_en : info.label_ru}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
          <Text style={{ fontSize: 28, fontWeight: '500', color: tk.text, letterSpacing: -1 }} numberOfLines={1} adjustsFontSizeToFit>
            {priceNum} ₽
          </Text>
          <Text style={{ fontSize: 12, color: tk.text3 }}>
            {isEn ? '/ month' : '/ месяц'}
          </Text>
        </View>
        <Text style={{ fontSize: 11, color: tk.text3, marginTop: 2 }}>
          {isEn ? 'Cancel anytime' : 'Отмена в любое время'}
        </Text>
      </View>

      {features[plan].map((f, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center',
          gap: 12, marginBottom: 12 }}>
          <View style={{ width: 32, height: 32, borderRadius: 9,
            backgroundColor: accentColor + '15',
            borderWidth: 1, borderColor: accentColor + '25',
            alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              {f.icon === 'ti-users' && <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke={accentColor} strokeWidth="1.5" strokeLinecap="round"/>}
              {f.icon === 'ti-chart-line' && <Path d="M3 20l5-7 4 3 5-8 4 5" stroke={accentColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>}
              {f.icon === 'ti-flame' && <Path d="M12 19c-3.3 0-6-2.7-6-6 0-2.5 1.5-4.5 3-6 .5 1.5 1.5 2.5 3 3-.5-2 .5-4 2-5 1 3 3 4 3 7 0 3.9-2.2 7-5 7z" stroke={accentColor} strokeWidth="1.5" strokeLinecap="round"/>}
              {f.icon === 'ti-bell' && <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" stroke={accentColor} strokeWidth="1.5" strokeLinecap="round"/>}
              {f.icon === 'ti-layout-board' && <><Rect x="3" y="3" width="7" height="7" rx="1" stroke={accentColor} strokeWidth="1.5"/><Rect x="14" y="3" width="7" height="7" rx="1" stroke={accentColor} strokeWidth="1.5"/><Rect x="3" y="14" width="7" height="7" rx="1" stroke={accentColor} strokeWidth="1.5"/><Rect x="14" y="14" width="7" height="7" rx="1" stroke={accentColor} strokeWidth="1.5"/></>}
            </Svg>
          </View>
          <Text style={{ flex: 1, fontSize: 14, color: tk.text2, lineHeight: 20 }}>{f.text}</Text>
        </View>
      ))}

      <TouchableOpacity onPress={() => onSelect(plan)}
        style={{ backgroundColor: accentColor, borderRadius: 12,
          padding: 14, alignItems: 'center', marginTop: 6 }}>
        <Text style={{ fontSize: 15, fontWeight: '500', color: '#fff' }}>
          {isEn ? `Choose ${info.label_en}` : `Выбрать ${info.label_ru}`}
        </Text>
      </TouchableOpacity>
    </View>
  );
}


export default function PaywallScreen({
  lang, tk, myId, subscription, onPlanChange, onBack,
}: Props) {
  const isEn = lang === 'en';
  const [selectedPlan, setSelectedPlan] = React.useState<'duo'|'team'>('duo');

  const L = (ru: string, en: string, uk?: string, be?: string, kk?: string) =>
    lang==='en' ? en : lang==='uk' ? (uk||ru) : lang==='be' ? (be||ru) : lang==='kk' ? (kk||ru) : ru;
  const [loading, setLoading] = useState(false);
  const daysLeft = getDaysLeft(subscription);
  const translateY = React.useRef(new Animated.Value(0)).current;

  // Свайп вниз — закрыть
  const dismissPan = React.useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gs) =>
      gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.5,
    onPanResponderMove: (_, gs) => {
      if (gs.dy > 0) translateY.setValue(gs.dy);
    },
    onPanResponderRelease: (_, gs) => {
      if (gs.dy > 80) {
        Animated.timing(translateY, { toValue: 600, duration: 200, useNativeDriver: true })
          .start(() => onBack());
      } else {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      }
    },
  })).current;

  const handleSelect = async (plan: 'free' | 'duo' | 'team') => {
    if (plan === subscription.plan && subscription.isActive) return;

    if (plan === 'free') {
      Alert.alert(
        (lang === 'en' ? 'Cancel subscription?' : 'Отменить подписку?'),
        isEn
          ? 'You will lose access to partner features immediately.'
          : 'Вы потеряете доступ к функциям с партнёром немедленно.',
        [
          { text: (lang === 'en' ? 'Keep plan' : 'Оставить'), style: 'cancel' },
          {
            text: (lang === 'en' ? 'Cancel subscription' : 'Отменить подписку'),
            style: 'destructive',
            onPress: async () => {
              const sub = await cancelPlan(myId);
              onPlanChange(sub);
            },
          },
        ]
      );
      return;
    }

    // RevenueCat покупка
    setLoading(true);
    try {
      const result = await purchasePlan(plan, lang, myId);
      // Платёж открыт в браузере — ждём вебхука от ЮКассы
      // Показываем инструкцию
      Alert.alert(
        isEn ? 'Payment opened' : 'Оплата открыта',
        isEn
          ? 'Complete payment in the browser. After payment, tap "Restore purchases" to activate your plan.'
          : 'Завершите оплату в браузере. После оплаты нажмите «Восстановить покупки».',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: tk.bg }}>
      {/* Топбар */}
      <View style={{ flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight || 24) + 12, paddingBottom: 4, gap: 12 }}>
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
          {(lang === 'en' ? 'Plans' : 'Тарифы')}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingTop: 12, paddingBottom: 120 }}>

        {/* Заголовок */}
        <View style={{ alignItems: 'center', marginBottom: 24, paddingTop: 8 }}>
          <Text style={{ fontSize: 24, fontWeight: '700', color: tk.text, textAlign: 'center', letterSpacing: -0.5 }}>
            {isEn ? 'Choose your plan' : 'Выберите план'}
          </Text>
          <Text style={{ fontSize: 14, color: tk.text2, textAlign: 'center', marginTop: 8, lineHeight: 22 }}>
            {isEn
              ? 'Free forever. Upgrade when you need a partner.'
              : 'Бесплатно навсегда. Подключите партнёра когда будете готовы.'}
          </Text>
        </View>

        {/* Статус: Trial */}
        {subscription.plan === 'trial' && subscription.isActive && (
          <View style={{ backgroundColor: 'rgba(124,58,237,0.1)', borderWidth: 1,
            borderColor: 'rgba(124,58,237,0.3)', borderRadius: 16, padding: 16,
            marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 22 }}>🎉</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#7c3aed' }}>
                {isEn ? 'You have 3 days of free access!' : 'У тебя 3 дня бесплатного доступа!'}
              </Text>
              {daysLeft !== null && (
                <Text style={{ fontSize: 12, color: tk.text3, marginTop: 2 }}>
                  {isEn ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining` : `Осталось ${daysLeft} ${daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'}`}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Статус: Admin */}
        {subscription.isAdmin && (
          <View style={{ backgroundColor: 'rgba(34,197,94,0.1)', borderWidth: 1,
            borderColor: 'rgba(34,197,94,0.25)', borderRadius: 16, padding: 16,
            marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: tk.text }}>
                {(lang === 'en' ? 'Administrator' : 'Администратор')}
              </Text>
              <Text style={{ fontSize: 12, color: tk.text3, marginTop: 2 }}>
                {(lang === 'en' ? 'All features unlocked forever' : 'Все функции разблокированы навсегда')}
              </Text>
            </View>
          </View>
        )}

        {/* Статус: Early Bird */}
        {subscription.isEarlyBird && !subscription.isAdmin && (
          <View style={{ backgroundColor: 'rgba(249,115,22,0.1)', borderWidth: 1,
            borderColor: 'rgba(249,115,22,0.25)', borderRadius: 16, padding: 16,
            marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: tk.text2 }}>
                {(lang === 'en' ? 'Early Bird' : 'Early Bird')}
              </Text>
              <Text style={{ fontSize: 12, color: tk.text3, marginTop: 2 }}>
                {isEn
                  ? `You are among the first 10 users! Team plan is free for ${daysLeft ?? 14} days.`
                  : `Вы среди первых 10 пользователей! Team бесплатно ${daysLeft ?? 14} дней.`}
              </Text>
            </View>
          </View>
        )}

        {/* Статус: обычная платная подписка */}
        {subscription.plan !== 'free' && subscription.plan !== 'trial' && !subscription.isAdmin && !subscription.isEarlyBird && (
          <View style={{ backgroundColor: PLAN_LIMITS[subscription.plan].color + '15',
            borderWidth: 1, borderColor: PLAN_LIMITS[subscription.plan].color + '30',
            borderRadius: 14, padding: 14, marginBottom: 16,
            flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 20 }}>
              {''}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '600',
                color: PLAN_LIMITS[subscription.plan].color }}>
                {isEn ? PLAN_LIMITS[subscription.plan].label_en : PLAN_LIMITS[subscription.plan].label_ru}
                {' '}{(lang === 'en' ? 'is active' : 'активен')}
              </Text>
              {daysLeft !== null && (
                <Text style={{ fontSize: 11, color: tk.text3, marginTop: 2 }}>
                  {isEn ? `${daysLeft} days remaining` : `Осталось ${daysLeft} дней`}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Карточки планов */}
        {!subscription.isAdmin && (
          <>
            {/* Selector row */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
              {(['free', 'duo', 'team'] as const).map(plan => (
                <PlanCard key={plan} plan={plan} sub={subscription}
                  isEn={isEn}
                  isSelected={plan !== 'free' && selectedPlan === plan}
                  onSelect={(p) => {
                    if (p === 'free') {
                      setSelectedPlan('duo');
                    } else {
                      setSelectedPlan(p as 'duo'|'team');
                    }
                  }}
                  tk={tk} />
              ))}
            </View>
            {/* Free plan features */}
            <View style={{ backgroundColor: tk.bg2, borderRadius: 14,
              borderWidth: 1, borderColor: tk.border, padding: 14, marginTop: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '500', color: tk.text, marginBottom: 10 }}>
                {isEn ? 'Free — always free' : 'Бесплатно — навсегда'}
              </Text>
              {[
                isEn ? 'Unlimited habits & reminders' : 'Привычки и напоминания без ограничений',
                isEn ? 'Calendar, statistics, streaks' : 'Календарь, статистика, серии',
                isEn ? '45 achievements' : '45 достижений',
                isEn ? 'Solo mode only' : 'Только для себя',
              ].map((f, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: tk.text3 }}/>
                  <Text style={{ fontSize: 13, color: tk.text2 }}>{f}</Text>
                </View>
              ))}
            </View>

            {/* Detail card for selected paid plan */}
            {selectedPlan && (
              <PlanDetail
                plan={selectedPlan}
                isEn={isEn} lang={lang} tk={tk}
                onSelect={handleSelect}
              />
            )}
          </>
        )}

        {/* Restore purchases — secondary button */}
        <TouchableOpacity
          onPress={async () => {
            const result = await restorePurchases(lang, myId);
            if (result && result.plan !== 'free') {
              // Перечитываем подписку из Firestore — активация уже произошла на сервере через вебхук
              const sub = await loadSubscription(myId);
              onPlanChange(sub);
            }
          }}
          style={{
            marginTop: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: tk.border,
            padding: 13,
            alignItems: 'center',
          }}>
          <Text style={{ fontSize: 14, fontWeight: '500', color: tk.text2 }}>
            {lang === 'en' ? 'Restore purchases' : 'Восстановить покупки'}
          </Text>
        </TouchableOpacity>

        {/* Footnote */}
        <View style={{ marginTop: 12, gap: 6 }}>
          <Text style={{ fontSize: 11, color: tk.text3, textAlign: 'center', lineHeight: 16 }}>
            {isEn
              ? 'Subscriptions renew automatically. Cancel anytime in settings.'
              : 'Подписка продлевается автоматически. Отменить можно в настройках.'}
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}
