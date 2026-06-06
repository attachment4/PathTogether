import React, { useState } from 'react';
import { View, Platform, Text, ScrollView, TouchableOpacity, Alert, Share, TextInput } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { Theme } from '../theme';
import { tr } from '../i18n';
import { Habit, Member } from '../store';
import { isLogged, todayDow, todayS } from '../utils';

// Локализация
import { Subscription, PLAN_LIMITS, canInvite, canAddMember } from '../subscription';

interface Props {
  myId: string; myName: string; lang: string; tk: Theme;
  habits: Habit[]; members: Member[]; logs: Record<string,boolean>;
  subscription: Subscription;
  onOpenPaywall: () => void;
  invLink: string;
  onCreateLink: () => void;
  onCopyLink: () => void;
  onInviteScreen: () => void;
  onLeaveSpace?: () => void;
  onKickMember?: (memberId: string) => void;
  onJoinByCode?: (code: string) => void;
  confirmations?: import('../store').HabitConfirmation[];
  onConfirmPartner?: (habitId: string) => void;
}

export default function FriendsScreen({ myId, myName, lang, tk, habits, members, logs, subscription, onOpenPaywall, invLink, onCreateLink, onCopyLink, onInviteScreen, onLeaveSpace, onKickMember, onJoinByCode, confirmations, onConfirmPartner }: Props) {
  const isEn = lang === 'en';
  const L = (ru: string, en: string, uk?: string, be?: string, kk?: string) =>
    lang==='en' ? en : lang==='uk' ? (uk||ru) : lang==='be' ? (be||ru) : lang==='kk' ? (kk||ru) : ru;
  const partner = members.find(m => m && m.id !== myId);
  const dow = todayDow();
  const todayH = habits.filter(h => h.days?.includes(dow));
  const [joinCode, setJoinCode] = useState('');

  return (
    <View style={{ flex: 1, backgroundColor: tk.bg, paddingTop: Platform.OS === 'ios' ? 50 : (require('react-native').StatusBar.currentHeight || 24) + 4 }}>

      <ScrollView showsVerticalScrollIndicator={false}
        scrollEventThrottle={16} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>

        {/* Header */}
        <Text style={{ fontSize: 9, color: tk.text3, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 10 }}>PathTogether</Text>
        <Text style={{ fontSize: 22, fontWeight: '700', color: tk.text, marginBottom: 4 }}>{(lang === 'en' ? 'Friends' : 'Друзья')}</Text>
        <Text style={{ fontSize: 12, color: tk.text3, marginBottom: 22 }}>
          {(lang === 'en' ? 'Track habits together' : 'Отслеживайте привычки вместе')}
        </Text>

        {/* Progress comparison */}
        {members.length > 0 && (
          <View style={{ backgroundColor: tk.bg2, borderWidth: 1, borderColor: tk.border, borderRadius: 14, padding: 14,
            shadowColor: tk.cardShadowColor, shadowOpacity: tk.cardShadowOpacity,
            shadowRadius: tk.cardShadowRadius, shadowOffset: { width: 0, height: 3 }, elevation: 0, marginBottom: 12 }}>
            <Text style={{ fontSize: 9, color: tk.text3, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>
              {(lang === 'en' ? 'Today' : lang==='uk' ? 'Сьогодні' : lang==='be' ? 'Сёння' : lang==='kk' ? 'Бүгін' : 'Сегодня')}
            </Text>
            {members.filter(Boolean).map(m => {
              const done = todayH.filter(h => isLogged(h.id, m.id, logs)).length;
              const pct = todayH.length ? done / todayH.length : 0;
              const isMe = m.id === myId;
              return (
                <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: isMe ? tk.bg3 : tk.bg2, borderWidth: 1, borderColor: tk.border, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: isMe ? tk.text : tk.text3 }}>{(m.name||'')[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                      <Text style={{ fontSize: 11, color: isMe ? tk.text : tk.text2 }}>
                        {m.name}{isMe ? ((lang === 'en' ? ' (you)' : ' (ты)')) : ''}
                      </Text>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: isMe ? tk.text : tk.text3 }}>{done}/{todayH.length}</Text>
                    </View>
                    <View style={{ height: 2.5, backgroundColor: tk.border, borderRadius: 2 }}>
                      <View style={{ width: `${Math.round(pct * 100)}%` as any, height: '100%', backgroundColor: isMe ? tk.text : tk.text3, borderRadius: 2 }} />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Partner card */}
        {partner && (
          <View style={{ backgroundColor: tk.bg2, borderWidth: 1, borderColor: tk.border, borderRadius: 14, padding: 14,
            shadowColor: tk.cardShadowColor, shadowOpacity: tk.cardShadowOpacity,
            shadowRadius: tk.cardShadowRadius, shadowOffset: { width: 0, height: 3 }, elevation: 0, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: tk.bg3, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: tk.text2 }}>{(partner.name||'')[0]?.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: tk.text }}>{partner.name}</Text>
                <Text style={{ fontSize: 10, color: tk.text3 }}>
                  {(lang === 'en' ? 'With us since' : 'С нами с')} {partner.joined}
                </Text>
              </View>
            </View>
            {/* Partner streak */}
            {(() => {
              const partStreak = Math.max(0, ...habits.map(h => {
                let s = 0; const d = new Date();
                for (let i = 0; i < 365; i++) {
                  const ds = d.toISOString().split('T')[0];
                  const dw = (d.getDay() + 6) % 7;
                  if (h.days?.includes(dw) && isLogged(h.id, partner.id, logs, ds)) s++;
                  else if (h.days?.includes(dw)) break;
                  d.setDate(d.getDate() - 1);
                }
                return s;
              }));
              const doneToday = todayH.filter(h => isLogged(h.id, partner.id, logs)).length;
              return (
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                  <View style={{ flex: 1, backgroundColor: tk.bg3, borderRadius: 10, padding: 10, alignItems: 'center' }}>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: tk.text }}>{doneToday}/{todayH.length}</Text>
                    <Text style={{ fontSize: 9, color: tk.text2, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>{(lang === 'en' ? 'today' : 'сегодня')}</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: tk.bg3, borderRadius: 10, padding: 10, alignItems: 'center' }}>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: tk.text }}>{partStreak}</Text>
                    <Text style={{ fontSize: 9, color: tk.text2, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>{(lang === 'en' ? 'streak' : 'серия')}</Text>
                  </View>
                </View>
              );
            })()}
            {todayH.map(h => {
              const done = isLogged(h.id, partner.id, logs);
              const needsMyConfirm = !!(
                h.requirePartnerConfirm &&
                confirmations?.some(c =>
                  c.habitId === h.id &&
                  c.date === todayS() &&
                  c.fromId === partner.id &&
                  !c.confirmedBy
                )
              );
              return (
                <View key={h.id} style={{ borderRadius: 12, marginBottom: 6, overflow: 'hidden' }}>
                {needsMyConfirm && (
                  <TouchableOpacity
                    onPress={() => onConfirmPartner?.(h.id)}
                    activeOpacity={0.7}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8,
                      paddingHorizontal: 12, paddingVertical: 8,
                      backgroundColor: tk.accent + '18', borderWidth: 1, borderColor: tk.accent + '60',
                      borderBottomWidth: 0, borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                    <Text style={{ fontSize: 14, color: tk.accent }}>✓</Text>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: tk.accent, flex: 1 }}>
                      {lang === 'en'
                        ? `Confirm: ${partner.name} completed «${h.name}»`
                        : `Подтвердить: ${partner.name} выполнил «${h.name}»`}
                    </Text>
                  </TouchableOpacity>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10,
                  paddingHorizontal: 12, paddingVertical: 10,
                  backgroundColor: done ? tk.bg3 : tk.bg,
                  borderRadius: needsMyConfirm ? 0 : 12,
                  borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
                  borderWidth: 1, borderColor: needsMyConfirm ? tk.accent + '60' : tk.border,
                  borderTopWidth: needsMyConfirm ? 0 : 1,
                  opacity: done ? 0.7 : 1 }}>
                  {(() => {
                    const bg = h.color && h.color !== '#f5f5f5' && h.color !== '#ffffff' ? h.color : tk.bg3;
                    const hex = bg.replace('#','');
                    const r=parseInt(hex.substring(0,2),16), g=parseInt(hex.substring(2,4),16), b=parseInt(hex.substring(4,6),16);
                    const textCol = (r*299+g*587+b*114)/1000 > 140 ? '#111' : '#fff';
                    return (
                      <View style={{ width: 28, height: 28, borderRadius: 8,
                        backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: textCol }}>
                          {(h.name||'')[0]?.toUpperCase()}
                        </Text>
                      </View>
                    );
                  })()}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, color: done ? tk.text3 : tk.text,
                      fontWeight: done ? '400' : '500',
                      textDecorationLine: done ? 'line-through' : 'none' }}>
                      {h.name}
                    </Text>
                    {h.time && <Text style={{ fontSize: 10, color: tk.text3 }}>{h.time}</Text>}
                  </View>
                  <View style={{ width: 22, height: 22, borderRadius: 11,
                    backgroundColor: done ? tk.text : 'transparent',
                    borderWidth: 1.5, borderColor: done ? tk.text : tk.border,
                    alignItems: 'center', justifyContent: 'center' }}>
                    {!!done && (
                      <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                        <Path d="M5 13l4 4L19 7" stroke={tk.bg} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </Svg>
                    )}
                  </View>
                </View>
                </View>
              );
            })}
            {todayH.length === 0 && (
              <Text style={{ fontSize: 12, color: tk.text3, textAlign: 'center', padding: 12 }}>
                {(lang === 'en' ? 'No habits for today' : 'Нет привычек на сегодня')}
              </Text>
            )}
          </View>
        )}

        {/* Leave / kick buttons */}
        {partner && (onLeaveSpace || onKickMember) && (
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            {onLeaveSpace && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(()=>{});
                  Alert.alert(
                    lang === 'en' ? 'Leave shared space?' : 'Покинуть пространство?',
                    lang === 'en'
                      ? 'All shared habits, streaks and joint history will be lost for you. This cannot be undone.'
                      : 'Все совместные привычки, серии и совместная история будут потеряны для вас. Это действие необратимо.',
                    [
                      { text: lang === 'en' ? 'Cancel' : 'Отмена', style: 'cancel' },
                      {
                        text: lang === 'en' ? 'Continue' : 'Продолжить',
                        style: 'destructive',
                        onPress: () => Alert.alert(
                          lang === 'en' ? 'Are you absolutely sure?' : 'Вы точно уверены?',
                          lang === 'en'
                            ? `You and ${partner.name} will lose all your progress together.`
                            : `Вы и ${partner.name} потеряете весь совместный прогресс.`,
                          [
                            { text: lang === 'en' ? 'Cancel' : 'Отмена', style: 'cancel' },
                            { text: lang === 'en' ? 'Leave forever' : 'Выйти навсегда', style: 'destructive', onPress: onLeaveSpace },
                          ]
                        ),
                      },
                    ]
                  );
                }}
                style={{ flex: 1, backgroundColor: tk.bg2, borderWidth: 1, borderColor: tk.border,
                  borderRadius: 14, padding: 13, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: tk.text3 }}>
                  {lang === 'en' ? 'Leave space' : 'Выйти'}
                </Text>
              </TouchableOpacity>
            )}
            {onKickMember && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(()=>{});
                  Alert.alert(
                    lang === 'en' ? `Remove ${partner.name}?` : `Убрать ${partner.name}?`,
                    lang === 'en' ? 'They will lose access to the shared space.' : 'Партнёр потеряет доступ к общему пространству.',
                    [
                      { text: lang === 'en' ? 'Cancel' : 'Отмена', style: 'cancel' },
                      { text: lang === 'en' ? 'Remove' : 'Убрать', style: 'destructive', onPress: () => onKickMember(partner.id) },
                    ]
                  );
                }}
                style={{ flex: 1, backgroundColor: tk.bg2, borderWidth: 1, borderColor: '#e05555',
                  borderRadius: 14, padding: 13, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#e05555' }}>
                  {lang === 'en' ? 'Remove partner' : 'Убрать партнёра'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Invite block */}
        <View style={{ backgroundColor: tk.bg2, borderWidth: 1, borderColor: tk.border, borderRadius: 14, padding: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: '500', color: tk.text, marginBottom: 6, letterSpacing: -0.2 }}>
            {(lang === 'en' ? 'Invite friend' : lang==='uk' ? 'Запросити друга' : lang==='be' ? 'Запрасіць сябра' : lang==='kk' ? 'Досты шақыру' : 'Пригласить друга')}
          </Text>
          <Text style={{ fontSize: 11, color: tk.text3, marginBottom: 14, lineHeight: 16 }}>
            {(lang === 'en' ? 'Share a link — your friend will see your habits immediately' : 'Поделитесь ссылкой — друг сразу увидит ваши привычки')}
          </Text>
          {invLink ? (
            <View style={{ gap: 8 }}>
              {/* Кнопка QR — всегда видна, чтобы можно было вернуться */}
              <TouchableOpacity onPress={onInviteScreen}
                style={{ backgroundColor: tk.text, borderRadius: 12, padding: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Rect x="3" y="3" width="8" height="8" rx="1.5" stroke={tk.bg} strokeWidth="1.8"/>
                  <Rect x="13" y="3" width="8" height="8" rx="1.5" stroke={tk.bg} strokeWidth="1.8"/>
                  <Rect x="3" y="13" width="8" height="8" rx="1.5" stroke={tk.bg} strokeWidth="1.8"/>
                  <Path d="M13 13h2.5v2.5M18.5 13H21M13 18.5v2.5M18.5 18.5H21v2.5h-2.5M15.5 15.5h2.5v2.5h-2.5z" stroke={tk.bg} strokeWidth="1.5" strokeLinecap="round"/>
                </Svg>
                <Text style={{ color: tk.bg, fontSize: 13, fontWeight: '700' }}>
                  {(lang === 'en' ? 'Show QR code' : 'Показать QR-код')}
                </Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={() => Share.share({ message: invLink })}
                  style={{ flex: 1, backgroundColor: tk.bg3, borderRadius: 12,
                    padding: 12, alignItems: 'center', borderWidth: 1, borderColor: tk.border }}>
                  <Text style={{ color: tk.text2, fontSize: 13, fontWeight: '600' }}>
                    {(lang === 'en' ? 'Share link' : 'Поделиться')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onCopyLink}
                  style={{ flex: 1, backgroundColor: tk.bg3, borderRadius: 12,
                    padding: 12, alignItems: 'center', borderWidth: 1, borderColor: tk.border }}>
                  <Text style={{ color: tk.text2, fontSize: 13, fontWeight: '600' }}>
                    {(lang === 'en' ? 'Copy' : 'Скопировать')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity onPress={onInviteScreen}
              style={{ backgroundColor: tk.text, borderRadius: 12, padding: 12, alignItems: 'center' }}>
              <Text style={{ color: tk.bg, fontSize: 13, fontWeight: '700' }}>
                {(lang === 'en' ? 'Create invite link' : 'Пригласить')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Join by code */}
        {!partner && onJoinByCode && (
          <View style={{ backgroundColor: tk.bg2, borderWidth: 1, borderColor: tk.border, borderRadius: 14, padding: 16, marginTop: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: tk.text, marginBottom: 6 }}>
              {isEn ? 'Join by code' : 'Войти по коду'}
            </Text>
            <Text style={{ fontSize: 11, color: tk.text3, marginBottom: 12, lineHeight: 16 }}>
              {isEn ? 'Paste the invite link or code you received' : 'Вставьте ссылку или код из приглашения'}
            </Text>
            <TextInput
              value={joinCode}
              onChangeText={setJoinCode}
              placeholder={isEn ? 'Paste link or code...' : 'Вставьте ссылку или код...'}
              placeholderTextColor={tk.text3}
              autoCapitalize="none"
              autoCorrect={false}
              style={{ backgroundColor: tk.bg3, borderRadius: 10, borderWidth: 1,
                borderColor: tk.border, padding: 11, fontSize: 12, color: tk.text, marginBottom: 10 }}
            />
            <TouchableOpacity
              onPress={() => {
                const raw = joinCode.trim();
                if (!raw) return;
                // Извлекаем код из ссылки или берём как есть
                let code = raw;
                try {
                  const match = raw.match(/[?&](?:code|invite)=([^&]+)/);
                  if (match) code = match[1];
                } catch {}
                if (!code) return;
                setJoinCode('');
                onJoinByCode(code);
              }}
              style={{ backgroundColor: tk.text, borderRadius: 12, padding: 12, alignItems: 'center' }}>
              <Text style={{ color: tk.bg, fontSize: 13, fontWeight: '700' }}>
                {isEn ? 'Join' : 'Присоединиться'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Empty state - solo */}
        {members.length <= 1 && (
          <View style={{ alignItems: 'center', paddingVertical: 32, gap: 12 }}>
            <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
              <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={tk.text3} strokeWidth="1.5" strokeLinecap="round"/>
              <Circle cx="9" cy="7" r="4" stroke={tk.text3} strokeWidth="1.5" fill="none"/>
              <Path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke={tk.text3} strokeWidth="1.5" strokeLinecap="round"/>
            </Svg>
            <Text style={{ fontSize: 15, fontWeight: '600', color: tk.text2 }}>
              {(lang === 'en' ? 'No partner yet' : 'Пока нет партнёра')}
            </Text>
            <Text style={{ fontSize: 12, color: tk.text3, textAlign: 'center', lineHeight: 18, paddingHorizontal: 32 }}>
              {(lang === 'en'
                ? 'Share your invite link — your friend opens it and joins instantly'
                : 'Поделитесь ссылкой-приглашением — друг откроет её и сразу присоединится')}
            </Text>
            <View style={{ backgroundColor: tk.bg2, borderRadius: 12, borderWidth: 1,
              borderColor: tk.border, paddingHorizontal: 16, paddingVertical: 10, marginTop: 4 }}>
              <Text style={{ fontSize: 12, color: tk.text2, textAlign: 'center', lineHeight: 18 }}>
                {lang === 'en'
                  ? '1. Tap "Share invite" above\n2. Send the link to your friend\n3. They open the link → you\'re connected'
                  : '1. Нажмите «Пригласить» выше\n2. Отправьте ссылку другу\n3. Друг открывает ссылку → вы вместе'}
              </Text>
            </View>
          </View>
        )}

      </ScrollView>
    </View>
  );
}
