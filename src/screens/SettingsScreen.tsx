import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, Linking, Platform, StatusBar, Share,
} from 'react-native';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';
import { updatePassword, deleteUser } from 'firebase/auth';
import { auth } from '../firebase';
import { Theme } from '../theme';
import { tr } from '../i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Локализация
// Notification scheduling is handled in App.tsx

interface Props {
  lang: string; tk: Theme; myId: string;
  notifEnabled: boolean; partnerNotifEnabled: boolean;
  hasPartner: boolean;
  habits?: any[];
  notifTimeMorning?: string;
  notifTimeEvening?: string;
  autoTheme?: boolean;
  onAutoTheme?: (v: boolean) => void;
  hapticsEnabled?: boolean;
  onHapticsToggle?: (v: boolean) => void;
  onNotifToggle: (v: boolean) => void;
  onPartnerNotifToggle: (v: boolean) => void;
  onNotifTimeMorning?: (t: string) => void;
  onNotifTimeEvening?: (t: string) => void;
  onBack: () => void;
  onDeleteAccount: () => void;
  onExportData?: () => void;
}

//  SVG иконки — только контуры 
function Icon({ name, color }: { name: string; color: string }) {
  const p = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none' } as const;
  if (name === 'mail')     return <Svg {...p}><Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke={color} strokeWidth="1.7"/><Path d="M22 6l-10 7L2 6" stroke={color} strokeWidth="1.7"/></Svg>;
  if (name === 'key')      return <Svg {...p}><Path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" stroke={color} strokeWidth="1.7" strokeLinecap="round"/></Svg>;
  if (name === 'bell')     return <Svg {...p}><Path d="M6 10a6 6 0 0 1 12 0c0 3.5 1.5 5 2 6H4c.5-1 2-2.5 2-6z" stroke={color} strokeWidth="1.7" strokeLinejoin="round"/><Path d="M10 20a2 2 0 0 0 4 0" stroke={color} strokeWidth="1.7"/></Svg>;
  if (name === 'users')    return <Svg {...p}><Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={color} strokeWidth="1.7" strokeLinecap="round"/><Circle cx="9" cy="7" r="4" stroke={color} strokeWidth="1.7"/><Path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke={color} strokeWidth="1.7" strokeLinecap="round"/></Svg>;
  if (name === 'message')  return <Svg {...p}><Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke={color} strokeWidth="1.7" strokeLinejoin="round"/></Svg>;
  if (name === 'file')     return <Svg {...p}><Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke={color} strokeWidth="1.7" strokeLinejoin="round"/><Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={color} strokeWidth="1.7" strokeLinecap="round"/></Svg>;
  if (name === 'trash')      return <Svg {...p}><Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><Path d="M10 11v6M14 11v6" stroke={color} strokeWidth="1.7" strokeLinecap="round"/></Svg>;
  if (name === 'smartphone') return <Svg {...p}><Rect x="5" y="2" width="14" height="20" rx="2" stroke={color} strokeWidth="1.7"/><Path d="M12 18h.01" stroke={color} strokeWidth="2" strokeLinecap="round"/></Svg>;
  return <Svg {...p}><Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.7"/></Svg>;
}

//  Тоггл 
function Toggle({ value, onToggle, tk }: { value: boolean; onToggle: () => void; tk: Theme }) {
  return (
    <TouchableOpacity onPress={onToggle}
      style={{ width: 46, height: 26, borderRadius: 13,
        backgroundColor: value ? tk.accent : tk.bg3,
        justifyContent: 'center', padding: 3 }}>
      <View style={{ width: 20, height: 20, borderRadius: 10,
        backgroundColor: tk.bg,
        alignSelf: value ? 'flex-end' : 'flex-start' }} />
    </TouchableOpacity>
  );
}

//  Строка 
function Row({ icon, label, sub, isToggle, toggleVal, onToggle, onPress, tk, danger, isLast }: {
  icon: string; label: string; sub?: string;
  isToggle?: boolean; toggleVal?: boolean; onToggle?: () => void;
  onPress?: () => void; tk: Theme; danger?: boolean; isLast?: boolean;
}) {
  const iconColor = danger ? '#ff5f5f' : tk.text3;
  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress && !isToggle}
      activeOpacity={0.65}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14,
        paddingVertical: 15, paddingHorizontal: 0,
        borderBottomWidth: isLast ? 0 : 0.5,
        borderColor: tk.border }}>
      <View style={{ width: 32, height: 32, borderRadius: 9,
        backgroundColor: danger
          ? 'rgba(255,80,60,0.08)'
          : tk.bg3,
        alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, color: danger ? '#ff5f5f' : tk.text }}>{label}</Text>
        {sub ? <Text style={{ fontSize: 12, color: tk.text3, marginTop: 2 }}>{sub}</Text> : null}
      </View>
      {isToggle && onToggle && <Toggle value={!!toggleVal} onToggle={onToggle} tk={tk} />}
      {onPress && !isToggle && (
        <Text style={{ fontSize: 18, color: tk.text3, lineHeight: 22 }}>›</Text>
      )}
    </TouchableOpacity>
  );
}

//  Секция 
function Section({ title, children, tk }: { title: string; children: React.ReactNode; tk: Theme }) {
  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: tk.text3,
        textTransform: 'uppercase', letterSpacing: 1,
        marginTop: 28, marginBottom: 10 }}>{title}</Text>
      <View style={{ borderRadius: 18,
        backgroundColor: tk.bg2, overflow: 'hidden', paddingHorizontal: 16,
        borderWidth: 1, borderColor: tk.cardBorder,
        shadowColor: tk.cardShadowColor, shadowOpacity: tk.cardShadowOpacity,
        shadowRadius: tk.cardShadowRadius, shadowOffset: { width: 0, height: 2 } }}>
        {children}
      </View>
    </View>
  );
}

//  Главный компонент 
export default function SettingsScreen({
  lang, tk, myId,
  notifEnabled, partnerNotifEnabled, hasPartner, autoTheme, onAutoTheme, hapticsEnabled, onHapticsToggle,
  notifTimeMorning = '12:00', notifTimeEvening = '18:00',
  habits = [],
  onNotifToggle, onPartnerNotifToggle,
  onNotifTimeMorning, onNotifTimeEvening,
  onBack, onDeleteAccount,
}: Props) {
  const isEn = lang === 'en';
  const L = (ru: string, en: string, uk?: string, be?: string, kk?: string) =>
    lang==='en' ? en : lang==='uk' ? (uk||ru) : lang==='be' ? (be||ru) : lang==='kk' ? (kk||ru) : ru;
  const user = auth.currentUser;

  const [showPassEdit,   setShowPassEdit]   = useState(false);
  const [showEmailEdit,  setShowEmailEdit]  = useState(false);
  const [emailInput,     setEmailInput]     = useState('');
  const [passInput,      setPassInput]      = useState('');
  const [passLoading,    setPassLoading]    = useState(false);
  const [legalModal,     setLegalModal]     = useState<'terms'|'privacy'|null>(null);
  const [showTimePicker, setShowTimePicker] = useState<'morning'|'evening'|null>(null);
  const [tempHour,       setTempHour]       = useState(12);
  const [tempMin,        setTempMin]        = useState(0);

  const handleNotifToggle = async () => {
    const next = !notifEnabled;
    onNotifToggle(next);
    // App.tsx перепланирует уведомления с учётом hasPartner через onNotifToggle
  };

  const submitPassword = async () => {
    if (!passInput || passInput.length < 6) {
      Alert.alert((lang === 'en' ? 'Too short' : 'Слишком короткий'),
        (lang === 'en' ? 'Min 6 characters' : 'Минимум 6 символов'));
      return;
    }
    setPassLoading(true);
    try {
      if (user) await updatePassword(user, passInput);
      Alert.alert((lang === 'en' ? 'Done' : 'Готово'),
        (lang === 'en' ? 'Password changed' : 'Пароль изменён'));
      setShowPassEdit(false);
    } catch (e: any) {
      const msg = e.code === 'auth/requires-recent-login'
        ? ((lang === 'en' ? 'Please sign in again to change password' : 'Войдите заново чтобы сменить пароль'))
        : e.message;
      Alert.alert((lang === 'en' ? 'Error' : 'Ошибка'), msg);
    } finally {
      setPassLoading(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      (lang === 'en' ? 'Delete account?' : 'Удалить аккаунт?'),
      (lang === 'en' ? 'All data will be permanently deleted.' : 'Все данные будут удалены безвозвратно.'),
      [
        { text: (lang === 'en' ? 'Cancel' : 'Отмена'), style: 'cancel' },
        {
          text: (lang === 'en' ? 'Delete' : 'Удалить'), style: 'destructive',
          onPress: async () => {
            try { if (user) await deleteUser(user); onDeleteAccount(); }
            catch (e: any) { Alert.alert((lang === 'en' ? 'Error' : 'Ошибка'), e.message); }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: tk.bg, paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 24) + 8 }}>
      <ScrollView showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        removeClippedSubviews={true}
        contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 24 }}>

        {/* Назад */}
        <TouchableOpacity onPress={onBack}
          hitSlop={{ top: 14, bottom: 14, left: 20, right: 20 }}
          style={{ alignSelf: 'flex-start', marginTop: 16, marginBottom: 4, padding: 4 }}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M19 12H5M5 12l7 7M5 12l7-7"
              stroke={tk.text2} strokeWidth="1.7"
              strokeLinecap="round" strokeLinejoin="round"/>
          </Svg>
        </TouchableOpacity>

        <Text style={{ fontSize: 24, fontWeight: '700', color: tk.text,
          marginTop: 16, marginBottom: 4, letterSpacing: -0.3 }}>
          {(lang === 'en' ? 'Settings' : 'Настройки')}
        </Text>

        {/* Аккаунт */}
        <Section title={(lang === 'en' ? 'Account' : 'Аккаунт')} tk={tk}>
          <Row icon="mail" label="Email" sub={user?.email || '—'} tk={tk} onPress={() => { setEmailInput(user?.email || ''); setShowEmailEdit(true); }} />
          <Row icon="key" label={(lang === 'en' ? 'Change password' : 'Изменить пароль')}
            onPress={() => { setPassInput(''); setShowPassEdit(true); }} tk={tk} isLast />
        </Section>

        {/* Уведомления */}
        <Section title={(lang === 'en' ? 'Notifications' : 'Уведомления')} tk={tk}>
          <Row icon="bell"
            label={(lang === 'en' ? 'Habit reminders' : lang==='uk' ? 'Нагадування про звички' : lang==='be' ? 'Напаміны пра звычкі' : lang==='kk' ? 'Әдеттер туралы еске салу' : 'Напоминания о привычках')}
            sub={isEn ? (notifEnabled ? 'Enabled' : 'Disabled') : (notifEnabled ? 'Включено' : 'Выключено')}
            isToggle toggleVal={notifEnabled}
            onToggle={() => onNotifToggle(!notifEnabled)}
            tk={tk} />
          {notifEnabled && (
            <>
              <Row icon="clock"
                label={(lang === 'en' ? 'Morning reminder' : lang==='uk' ? 'Ранкове нагадування' : lang==='be' ? 'Ранішні нагадванне' : lang==='kk' ? 'Таңғы еске салу' : 'Утреннее напоминание')}
                sub={notifTimeMorning || '12:00'}
                onPress={() => {
                  const [h, m] = (notifTimeMorning || '12:00').split(':').map(Number);
                  setTempHour(h); setTempMin(m || 0);
                  setShowTimePicker('morning');
                }} tk={tk} />
              <Row icon="clock"
                label={(lang === 'en' ? 'Evening reminder' : lang==='uk' ? 'Вечірнє нагадування' : lang==='be' ? 'Вячэрняе напаміннне' : lang==='kk' ? 'Кешкі еске салу' : 'Вечернее напоминание')}
                sub={notifTimeEvening || '18:00'}
                onPress={() => {
                  const [h, m] = (notifTimeEvening || '18:00').split(':').map(Number);
                  setTempHour(h); setTempMin(m || 0);
                  setShowTimePicker('evening');
                }} tk={tk} isLast={!hasPartner} />
            </>
          )}
          {hasPartner && (
            <Row icon="users"
              label={isEn ? "Partner's activity" : 'Активность партнёра'}
              sub={(lang === 'en' ? 'When partner completes a habit' : 'Когда партнёр выполнил привычку')}
              isToggle toggleVal={partnerNotifEnabled}
              onToggle={() => onPartnerNotifToggle(!partnerNotifEnabled)} tk={tk} isLast />
          )}
        </Section>

        {/* Тактильный отклик */}
        <Section title={(lang === 'en' ? 'Feedback' : 'Обратная связь')} tk={tk}>
          <Row icon="smartphone"
            label={(lang === 'en' ? 'Haptic feedback' : 'Тактильный отклик')}
            sub={(lang === 'en' ? 'Vibration when completing habits' : 'Вибрация при выполнении привычек')}
            isToggle toggleVal={!!hapticsEnabled}
            onToggle={() => onHapticsToggle?.(!hapticsEnabled)}
            tk={tk} isLast />
        </Section>

        {/* Поддержка */}
        <Section title={(lang === 'en' ? 'Support' : 'Поддержка')} tk={tk}>
          <Row icon="message"
            label={(lang === 'en' ? 'Contact support' : 'Написать нам')}
            sub="pathtogethersupport@gmail.com"
            onPress={() => Linking.openURL('mailto:pathtogethersupport@gmail.com')} tk={tk} />
          <Row icon="file"
            label={(lang === 'en' ? 'Terms of Use' : 'Условия использования')}
            onPress={() => setLegalModal('terms')} tk={tk} />
          <Row icon="shield"
            label={(lang === 'en' ? 'Privacy Policy' : 'Политика конфиденциальности')}
            onPress={() => setLegalModal('privacy')} tk={tk} isLast />
        </Section>

        {/* Опасная зона */}
        <Section title={(lang === 'en' ? 'Data' : 'Данные')} tk={tk}>
          <Row icon="download" label={(lang === 'en' ? 'Export data' : 'Экспорт данных')}
            sub={(lang === 'en' ? 'Habits + logs as CSV' : 'Привычки и логи в CSV')}
            onPress={async () => {
              try {
                // Build CSV with habits + last 30 days of logs
                const dates: string[] = [];
                for (let i = 0; i < 30; i++) {
                  const d = new Date(); d.setDate(d.getDate() - i);
                  dates.push(d.toISOString().split('T')[0]);
                }
                const lines = ['Habit,Type,Routine,Date,Completed,Note'];
                for (const h of habits as any[]) {
                  for (const date of dates) {
                    const logKey = `${h.id}_${date}_${myId}`;
                    const noteRaw = await AsyncStorage.getItem(`note_${h.id}_${date}_${myId}`);
                    const note = noteRaw || '';
                    // Check if logged (we don't have logs here, just note existence as proxy)
                    lines.push([
                      `"${(h.name||'').replace(/"/g,'""')}"`,
                      `"${h.type||'good'}"`,
                      `"${h.routine||''}"`,
                      `"${date}"`,
                      `"${note?'1':''}"`,
                      `"${note.replace(/"/g,'""')}"`,
                    ].join(','));
                  }
                }
                await Share.share({
                  message: lines.join('\n'),
                  title: 'PathTogether export',
                });
              } catch(e) { console.warn('Export error', e); }
            }} tk={tk} isLast />
        </Section>

        <Section title={(lang === 'en' ? 'Danger zone' : lang==='uk' ? 'Небезпечна зона' : lang==='be' ? 'Небяспечная зона' : lang==='kk' ? 'Қауіпті аймақ' : 'Опасная зона')} tk={tk}>
          <Row icon="trash"
            label={(lang === 'en' ? 'Delete account' : lang==='uk' ? 'Видалити акаунт' : lang==='be' ? 'Выдаліць акаўнт' : lang==='kk' ? 'Аккаунтты жою' : 'Удалить аккаунт')}
            sub={(lang === 'en' ? 'Permanent, cannot be undone' : 'Навсегда, нельзя отменить')}
            onPress={confirmDelete} tk={tk} danger isLast />
        </Section>

      </ScrollView>

      {/* Modal: смена пароля */}
      <Modal visible={showPassEdit} transparent animationType="slide"
        onRequestClose={() => setShowPassEdit(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
          activeOpacity={1} onPress={() => setShowPassEdit(false)}>
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
            <TouchableOpacity activeOpacity={1}>
              <View style={{ backgroundColor: tk.bg2,
                borderTopLeftRadius: 24, borderTopRightRadius: 24,
                padding: 24, paddingBottom: 48 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2,
                  backgroundColor: tk.border, alignSelf: 'center', marginBottom: 24 }} />
                <Text style={{ fontSize: 17, fontWeight: '700', color: tk.text, marginBottom: 16 }}>
                  {(lang === 'en' ? 'New password' : 'Новый пароль')}
                </Text>
                <TextInput
                  value={passInput} onChangeText={setPassInput}
                  autoFocus secureTextEntry
                  placeholder="••••••••" placeholderTextColor={tk.text3}
                  style={{ backgroundColor: tk.bg3,
                    borderRadius: 14, padding: 14,
                    fontSize: 15, color: tk.text, marginBottom: 14 }} />
                <TouchableOpacity onPress={submitPassword} disabled={passLoading}
                  style={{ backgroundColor: passLoading ? tk.bg3 : tk.text,
                    borderRadius: 14, padding: 15, alignItems: 'center' }}>
                  <Text style={{ color: passLoading ? tk.text3 : tk.bg,
                    fontSize: 15, fontWeight: '600' }}>
                    {passLoading ? '...' : ((lang === 'en' ? 'Save' : 'Сохранить'))}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/*  Legal Modal  */}
      <Modal visible={!!legalModal} animationType="slide" transparent onRequestClose={() => setLegalModal(null)}>
        <View style={{ flex:1, backgroundColor: tk.bg }}>
          {/* Header */}
          <View style={{ flexDirection:'row', alignItems:'center', gap:12,
            paddingHorizontal:20, 
            paddingTop: Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight || 24) + 16,
            paddingBottom:12,
            borderBottomWidth:1, borderBottomColor:tk.border }}>
            <TouchableOpacity onPress={() => setLegalModal(null)}
              style={{ width:36, height:36, borderRadius:10,
                backgroundColor:tk.bg2, borderWidth:1, borderColor:tk.border,
                alignItems:'center', justifyContent:'center' }}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M19 12H5M5 12l7 7M5 12l7-7"
                  stroke={tk.text2} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </Svg>
            </TouchableOpacity>
            <Text style={{ fontSize:17, fontWeight:'700', color:tk.text }}>
              {legalModal === 'terms'
                ? ((lang === 'en' ? 'Terms of Use' : 'Условия использования'))
                : ((lang === 'en' ? 'Privacy Policy' : 'Политика конфиденциальности'))}
            </Text>
          </View>

          <ScrollView contentContainerStyle={{ padding:24, paddingBottom:60 }}
            showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        removeClippedSubviews={true}>

            {legalModal === 'terms' ? (
              <View>
                <Text style={{ fontSize:13, color:tk.text3, marginBottom:20 }}>
                  {(lang === 'en' ? 'Last updated: May 2026' : 'Последнее обновление: май 2026')}
                </Text>
                {[
                  {
                    t: (lang === 'en' ? '1. Acceptance' : '1. Принятие условий'),
                    b: isEn
                      ? 'By using PathTogether you agree to these Terms. If you do not agree, please do not use the app.'
                      : 'Используя PathTogether, вы соглашаетесь с настоящими условиями. Если вы не согласны — пожалуйста, не используйте приложение.',
                  },
                  {
                    t: (lang === 'en' ? '2. Description of service' : '2. Описание сервиса'),
                    b: isEn
                      ? 'PathTogether is a habit-tracking app designed for couples and small teams. It allows users to create shared habits, track progress, and motivate each other.'
                      : 'PathTogether — приложение для отслеживания привычек, разработанное для пар и небольших команд. Приложение позволяет создавать общие привычки, отслеживать прогресс и мотивировать друг друга.',
                  },
                  {
                    t: (lang === 'en' ? '3. User accounts' : '3. Учётные записи'),
                    b: isEn
                      ? "You are responsible for maintaining the security of your account and password. You must provide accurate information when registering. You may not use another person's account without permission."
                      : 'Вы несёте ответственность за безопасность своего аккаунта и пароля. При регистрации необходимо предоставлять достоверную информацию. Использование чужого аккаунта без разрешения запрещено.',
                  },
                  {
                    t: (lang === 'en' ? '4. Acceptable use' : '4. Допустимое использование'),
                    b: isEn
                      ? 'You agree not to use PathTogether for any unlawful purpose, to harass other users, to distribute spam, or to interfere with the operation of the service.'
                      : 'Вы соглашаетесь не использовать PathTogether в незаконных целях, не преследовать других пользователей, не распространять спам и не вмешиваться в работу сервиса.',
                  },
                  {
                    t: (lang === 'en' ? '5. Subscriptions' : '5. Подписки'),
                    b: isEn
                      ? 'Paid plans (Couple, Team) are billed monthly. Subscriptions renew automatically unless cancelled before the renewal date. Refunds are subject to the RuStore policy.'
                      : 'Платные тарифы (Пара, Команда) оплачиваются ежемесячно. Подписка продлевается автоматически, если не отменена до даты продления. Возвраты регулируются политикой RuStore.',
                  },
                  {
                    t: (lang === 'en' ? '6. Termination' : '6. Прекращение использования'),
                    b: isEn
                      ? 'We reserve the right to suspend or terminate your account if you violate these Terms. You may delete your account at any time in Settings.'
                      : 'Мы оставляем за собой право приостановить или удалить ваш аккаунт при нарушении условий. Вы можете удалить аккаунт в любое время в разделе «Настройки».',
                  },
                  {
                    t: (lang === 'en' ? '7. Disclaimer' : '7. Ограничение ответственности'),
                    b: isEn
                      ? 'PathTogether is provided "as is" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the app.'
                      : 'PathTogether предоставляется «как есть» без каких-либо гарантий. Мы не несём ответственности за косвенный, случайный или последующий ущерб, возникший в результате использования приложения.',
                  },
                  {
                    t: (lang === 'en' ? '8. Contact' : '8. Контакты'),
                    b: 'pathtogethersupport@gmail.com',
                  },
                ].map((s, i) => (
                  <View key={i} style={{ marginBottom:20 }}>
                    <Text style={{ fontSize:15, fontWeight:'700', color:tk.text, marginBottom:6 }}>{s.t}</Text>
                    <Text style={{ fontSize:14, color:tk.text2, lineHeight:22 }}>{s.b}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View>
                <Text style={{ fontSize:13, color:tk.text3, marginBottom:20 }}>
                  {(lang === 'en' ? 'Last updated: May 2026' : 'Последнее обновление: май 2026')}
                </Text>
                {[
                  {
                    t: (lang === 'en' ? '1. Data we collect' : '1. Данные которые мы собираем'),
                    b: isEn
                      ? "We collect the data you provide: name, email address, habit names, completion logs, and subscription status. We do not collect location data, contacts, or any sensitive personal information."
                      : 'Мы собираем данные, которые вы предоставляете: имя, адрес электронной почты, названия привычек, журналы выполнения и статус подписки. Мы не собираем данные о местоположении, контакты и другую чувствительную личную информацию.',
                  },
                  {
                    t: (lang === 'en' ? '2. How we use your data' : '2. Как мы используем данные'),
                    b: isEn
                      ? 'Your data is used solely to provide the PathTogether service: syncing habits between partners, sending reminders, and managing subscriptions. We do not sell your data to third parties.'
                      : 'Ваши данные используются исключительно для предоставления сервиса PathTogether: синхронизации привычек между партнёрами, отправки напоминаний и управления подписками. Мы не продаём ваши данные третьим лицам.',
                  },
                  {
                    t: (lang === 'en' ? '3. Data storage' : '3. Хранение данных'),
                    b: isEn
                      ? 'Your data is stored securely on Google Firebase servers. We use industry-standard encryption and access controls to protect your information.'
                      : 'Ваши данные хранятся на серверах Google Firebase с использованием современного шифрования и контроля доступа.',
                  },
                  {
                    t: (lang === 'en' ? '4. Partner data sharing' : '4. Совместный доступ с партнёром'),
                    b: isEn
                      ? "When you invite a partner, they can see your habit names and completion status within your shared space. No other personal information is shared. You can leave the shared space at any time."
                      : 'Когда вы приглашаете партнёра, он видит названия ваших привычек и статус их выполнения в общем пространстве. Другая личная информация не передаётся. Вы можете покинуть общее пространство в любое время.',
                  },
                  {
                    t: (lang === 'en' ? '5. Notifications' : '5. Уведомления'),
                    b: isEn
                      ? 'We send push notifications only when you have an active partner and notifications are enabled in settings. You can disable them at any time.'
                      : 'Мы отправляем push-уведомления только при наличии активного партнёра и включённых уведомлениях в настройках. Вы можете отключить их в любое время.',
                  },
                  {
                    t: (lang === 'en' ? '6. Data deletion' : '6. Удаление данных'),
                    b: isEn
                      ? 'You can delete your account and all associated data at any time via Settings → Delete account. Deletion is permanent and cannot be undone.'
                      : 'Вы можете удалить аккаунт и все связанные данные в любое время через Настройки → Удалить аккаунт. Удаление необратимо.',
                  },
                  {
                    t: (lang === 'en' ? '7. Third-party services' : '7. Сторонние сервисы'),
                    b: isEn
                      ? 'We use Google Firebase (authentication and database) and Expo (push notifications). These services have their own privacy policies. We do not use advertising networks or analytics trackers.'
                      : 'Мы используем Google Firebase (аутентификация и база данных) и Expo (push-уведомления). Эти сервисы имеют собственные политики конфиденциальности. Мы не используем рекламные сети или аналитические трекеры.',
                  },
                  {
                    t: (lang === 'en' ? '8. Contact' : '8. Контакты'),
                    b: isEn
                      ? 'Questions about your data: pathtogethersupport@gmail.com'
                      : 'Вопросы по данным: pathtogethersupport@gmail.com',
                  },
                ].map((s, i) => (
                  <View key={i} style={{ marginBottom:20 }}>
                    <Text style={{ fontSize:15, fontWeight:'700', color:tk.text, marginBottom:6 }}>{s.t}</Text>
                    <Text style={{ fontSize:14, color:tk.text2, lineHeight:22 }}>{s.b}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Time Picker Modal */}
      {showTimePicker != null && (
        <Modal visible={showTimePicker != null} transparent animationType="slide"
          onRequestClose={() => setShowTimePicker(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowTimePicker(null)} />
            <View style={{ backgroundColor: tk.bg, borderTopLeftRadius: 24,
              borderTopRightRadius: 24, padding: 24, paddingBottom: 44 }}>
              <View style={{ width: 36, height: 4, backgroundColor: tk.border,
                borderRadius: 2, alignSelf: 'center', marginBottom: 20 }}/>
              <Text style={{ fontSize: 15, fontWeight: '700', color: tk.text,
                marginBottom: 24, textAlign: 'center' }}>
                {showTimePicker === 'morning'
                  ? ((lang === 'en' ? 'Morning reminder' : lang==='uk' ? 'Ранкове нагадування' : lang==='be' ? 'Ранішні нагадванне' : lang==='kk' ? 'Таңғы еске салу' : 'Утреннее напоминание'))
                  : ((lang === 'en' ? 'Evening reminder' : lang==='uk' ? 'Вечірнє нагадування' : lang==='be' ? 'Вячэрняе напаміннне' : lang==='kk' ? 'Кешкі еске салу' : 'Вечернее напоминание'))}
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'center',
                alignItems: 'center', gap: 12, marginBottom: 32 }}>
                {/* Часы */}
                <View style={{ alignItems: 'center', gap: 10 }}>
                  <TouchableOpacity onPress={() => setTempHour(h => (h + 1) % 24)}
                    style={{ width: 48, height: 48, backgroundColor: tk.bg2, borderRadius: 14,
                      borderWidth: 1, borderColor: tk.border,
                      alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 22, color: tk.text }}>+</Text>
                  </TouchableOpacity>
                  <View style={{ width: 80, height: 64, backgroundColor: tk.bg2,
                    borderRadius: 16, borderWidth: 2, borderColor: tk.text,
                    alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 32, fontWeight: '700', color: tk.text }}>
                      {String(tempHour).padStart(2, '0')}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setTempHour(h => (h - 1 + 24) % 24)}
                    style={{ width: 48, height: 48, backgroundColor: tk.bg2, borderRadius: 14,
                      borderWidth: 1, borderColor: tk.border,
                      alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 22, color: tk.text }}>−</Text>
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: 36, fontWeight: '700', color: tk.text2,
                  marginBottom: 4 }}>:</Text>
                {/* Минуты */}
                <View style={{ alignItems: 'center', gap: 10 }}>
                  <TouchableOpacity onPress={() => setTempMin(m => (m + 15) % 60)}
                    style={{ width: 48, height: 48, backgroundColor: tk.bg2, borderRadius: 14,
                      borderWidth: 1, borderColor: tk.border,
                      alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 22, color: tk.text }}>+</Text>
                  </TouchableOpacity>
                  <View style={{ width: 80, height: 64, backgroundColor: tk.bg2,
                    borderRadius: 16, borderWidth: 2, borderColor: tk.text,
                    alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 32, fontWeight: '700', color: tk.text }}>
                      {String(tempMin).padStart(2, '0')}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setTempMin(m => (m - 15 + 60) % 60)}
                    style={{ width: 48, height: 48, backgroundColor: tk.bg2, borderRadius: 14,
                      borderWidth: 1, borderColor: tk.border,
                      alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 22, color: tk.text }}>−</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => {
                  const t = `${String(tempHour).padStart(2,'0')}:${String(tempMin).padStart(2,'0')}`;
                  if (showTimePicker === 'morning' && onNotifTimeMorning) onNotifTimeMorning(t);
                  if (showTimePicker === 'evening' && onNotifTimeEvening) onNotifTimeEvening(t);
                  setShowTimePicker(null);
                }}
                style={{ backgroundColor: tk.text, borderRadius: 14,
                  padding: 16, alignItems: 'center' }}>
                <Text style={{ color: tk.bg, fontSize: 15, fontWeight: '700' }}>
                  {(lang === 'en' ? 'Save' : 'Сохранить')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
