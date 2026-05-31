import React, { useState } from 'react';
import { View, Platform, Text, ScrollView, TouchableOpacity, Alert, Share, TextInput } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { Theme } from '../theme';
import { tr } from '../i18n';
import { Habit, Member } from '../store';
import { isLogged, todayDow } from '../utils';

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
  onJoinByCode?: (code: string) => void;
}

export default function FriendsScreen({ myId, myName, lang, tk, habits, members, logs, subscription, onOpenPaywall, invLink, onCreateLink, onCopyLink, onInviteScreen, onLeaveSpace, onJoinByCode }: Props) {
  const isEn = lang === 'en';
  const L = (ru: string, en: string, uk?: string, be?: string, kk?: string) =>
    lang==='en' ? en : lang==='uk' ? (uk||ru) : lang==='be' ? (be||ru) : lang==='kk' ? (kk||ru) : ru;
  const partner = members.find(m => m.id !== myId);
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
            {members.map(m => {
              const done = todayH.filter(h => isLogged(h.id, m.id, logs)).length;
              const pct = todayH.length ? done / todayH.length : 0;
              const isMe = m.id === myId;
              return (
                <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: isMe ? tk.bg3 : tk.bg2, borderWidth: 1, borderColor: tk.border, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: isMe ? tk.text : tk.text3 }}>{m.name[0]?.toUpperCase()}</Text>
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
                <Text style={{ fontSize: 15, fontWeight: '700', color: tk.text2 }}>{partner.name[0]?.toUpperCase()}</Text>
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
                    <Text style={{ fontSize: 9, color: tk.text3, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>{(lang === 'en' ? 'today' : 'сегодня')}</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: tk.bg3, borderRadius: 10, padding: 10, alignItems: 'center' }}>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: tk.text }}>{partStreak}</Text>
                    <Text style={{ fontSize: 9, color: tk.text3, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>{(lang === 'en' ? 'streak' : 'серия')}</Text>
                  </View>
                </View>
              );
            })()}
            {todayH.map(h => {
              const done = isLogged(h.id, partner.id, logs);
              return (
                <View key={h.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10,
                  paddingHorizontal: 12, paddingVertical: 10,
                  backgroundColor: done ? tk.bg3 : tk.bg,
                  borderRadius: 12, marginBottom: 6,
                  borderWidth: 1, borderColor: done ? tk.border : tk.border,
                  opacity: done ? 0.7 : 1 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 8,
                    backgroundColor: h.color && h.color !== '#f5f5f5' ? h.color : tk.bg3,
                    alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: tk.bg }}>
                      {h.name[0]?.toUpperCase()}
                    </Text>
                  </View>
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
              );
            })}
            {todayH.length === 0 && (
              <Text style={{ fontSize: 12, color: tk.text3, textAlign: 'center', padding: 12 }}>
                {(lang === 'en' ? 'No habits for today' : 'Нет привычек на сегодня')}
              </Text>
            )}
          </View>
        )}

        {/* Leave space button — only if has partner */}
        {partner && onLeaveSpace && (
          <TouchableOpacity
            onPress={() => Alert.alert(
              (lang === 'en' ? 'Leave shared space?' : 'Выйти из общего пространства?'),
              (lang === 'en' ? 'You will lose access to shared habits' : 'Вы потеряете доступ к общим привычкам'),
              [
                { text: (lang === 'en' ? 'Cancel' : 'Отмена'), style: 'cancel' },
                { text: (lang === 'en' ? 'Leave' : 'Выйти'), style: 'destructive', onPress: onLeaveSpace },
              ]
            )}
            style={{ backgroundColor: tk.bg2, borderWidth: 1, borderColor: tk.border,
              borderRadius: 14, padding: 14, alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: tk.text3 }}>
              {(lang === 'en' ? 'Leave shared space' : 'Выйти из общего пространства')}
            </Text>
          </TouchableOpacity>
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
              {(lang === 'en' ? 'Invite a friend to track habits together' : 'Пригласите друга чтобы отслеживать привычки вместе')}
            </Text>
          </View>
        )}

      </ScrollView>
    </View>
  );
}
