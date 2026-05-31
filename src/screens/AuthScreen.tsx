import React, { useState, useEffect } from 'react';
// Google Sign In загружается лениво — только при вызове, не при старте
let _GoogleSignin: any = null;
let _statusCodes: any = {};
const getGoogleSignin = () => {
  if (!_GoogleSignin) {
    try {
      const mod = require('@react-native-google-signin/google-signin');
      _GoogleSignin = mod.GoogleSignin;
      _statusCodes = mod.statusCodes;
    } catch { _GoogleSignin = null; }
  }
  return { GoogleSignin: _GoogleSignin, statusCodes: _statusCodes };
};
import Svg, { Path } from 'react-native-svg';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Alert, Keyboard,
  Linking,
} from 'react-native';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithCredential,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../firebase';
const IS_EXPO_GO = typeof __DEV__ !== 'undefined' && __DEV__;

import { Storage } from '../store';
import { Theme } from '../theme';
import { tr } from '../i18n';

// Локализация

interface Props {
  tk: Theme;
  lang?: string;
  onSuccess: (uid: string, name: string, isNew: boolean) => void;
  onGuest?: () => void;
}

const Field = ({ label, value, onChange, placeholder, secure, tk }: {
  label: string; value: string; onChange: (v:string)=>void;
  placeholder: string; secure?: boolean; tk: Theme;
}) => {
  const [show, setShow] = React.useState(false);
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 9, color: tk.text3, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>{label}</Text>
      <View style={{
        backgroundColor: tk.bg2, borderWidth: 1, borderColor: tk.border,
        borderRadius: 12, flexDirection: 'row', alignItems: 'center',
      }}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={tk.text3}
          secureTextEntry={secure && !show}
          autoCapitalize="none"
          style={{ flex: 1, padding: 13, fontSize: 13, color: tk.text }}
        />
        {secure && (
          <TouchableOpacity onPress={() => setShow(s => !s)}
            style={{ paddingHorizontal: 14, paddingVertical: 13 }}>
            <View style={{ width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}>
              {show ? (
                <View>
                  <View style={{ width: 18, height: 2, backgroundColor: tk.text3, borderRadius: 1, transform: [{rotate: '45deg'}], position: 'absolute', top: 8 }} />
                  <View style={{ width: 18, height: 11, borderRadius: 9, borderWidth: 1.5, borderColor: tk.text3, backgroundColor: 'transparent' }} />
                </View>
              ) : (
                <View style={{ width: 18, height: 11, borderRadius: 9, borderWidth: 1.5, borderColor: tk.text3, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: tk.text3 }} />
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default function AuthScreen({ tk, lang = 'ru', onSuccess, onGuest }: Props) {
  const [tab,      setTab]      = useState<'login'|'reg'>('login');
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [emailError, setEmailError] = useState('');
  const isEn = lang === 'en';
  const L = (ru: string, en: string, uk?: string, be?: string, kk?: string) =>
    lang==='en' ? en : lang==='uk' ? (uk||ru) : lang==='be' ? (be||ru) : lang==='kk' ? (kk||ru) : ru;

  const WEB_CLIENT_ID = '257808858919-0oqlrefmft1qunke3iaoqrcm2st9vrfj.apps.googleusercontent.com';

  // GoogleSignin настраивается при первом вызове googleSignIn

  const googleSignIn = async () => {
    const { GoogleSignin, statusCodes } = getGoogleSignin();
    if (!GoogleSignin) {
      Alert.alert('Ошибка', 'Google Sign In недоступен в этой версии приложения');
      return;
    }
    try {
      setLoading(true);
      GoogleSignin.configure({ webClientId: WEB_CLIENT_ID, offlineAccess: true });
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const userInfo = await GoogleSignin.signIn();
      const tokens = await GoogleSignin.getTokens();
      const idToken = tokens.idToken || (userInfo as any).data?.idToken || (userInfo as any).idToken;
      if (!idToken) throw new Error('No ID token');
      const credential = GoogleAuthProvider.credential(idToken);
      const userCred = await signInWithCredential(auth, credential);
      const user = userCred.user;
      // Определяем новый ли это пользователь через additionalUserInfo
      const isNewUser = (userCred as any).additionalUserInfo?.isNewUser ?? false;
      onSuccess(user.uid, user.displayName || user.email?.split('@')[0] || 'User', isNewUser);
    } catch (e: any) {
      if (e.code === statusCodes?.SIGN_IN_CANCELLED) {
        // пользователь отменил
      } else if (e.code === statusCodes?.IN_PROGRESS) {
        // уже идёт вход
      } else {
        console.warn('[Google SignIn]', e);
        Alert.alert('Ошибка', e?.message || 'Google Sign In failed');
      }
    } finally {
      setLoading(false);
    }
  };



  const submit = async () => {
    setEmailError('');
    if (!email.trim() || !password.trim()) {
      Alert.alert('Ошибка', 'Заполните все поля'); return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setEmailError(isEn ? 'Enter a valid email' : 'Введите корректный email');
      return;
    }
    if (tab === 'reg' && !name.trim()) {
      Alert.alert('Ошибка', 'Введите имя'); return;
    }
    setLoading(true);
    try {
      let uid = '';
      let displayName = name.trim();
      if (tab === 'reg') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password.trim());
        await updateProfile(cred.user, { displayName });
        uid = cred.user.uid;
      } else {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password.trim());
        uid = cred.user.uid;
        displayName = cred.user.displayName || email.split('@')[0];
      }
      await Storage.saveName(displayName);
      Keyboard.dismiss();
      onSuccess(uid, displayName, tab === 'reg');
    } catch (e: any) {
      const msg = e.code === 'auth/user-not-found' ? 'Пользователь не найден'
        : e.code === 'auth/wrong-password' ? 'Неверный пароль'
        : e.code === 'auth/email-already-in-use' ? 'Email уже используется'
        : e.code === 'auth/weak-password' ? 'Пароль слишком слабый'
        : e.code === 'auth/invalid-email' ? 'Неверный email'
        : e.code === 'auth/network-request-failed' ? 'Нет подключения к интернету. Проверьте соединение и попробуйте ещё раз.' : 'Ошибка: ' + (e.code || e.message);
      Alert.alert('Ошибка', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: tk.bg }}>
      {/* BG glows */}
      <View style={{ position: 'absolute', top: 0, right: 0, width: 180, height: 180,
        backgroundColor: '#1a1a3e', borderRadius: 90, opacity: 0.4,
        transform: [{ translateX: 60 }, { translateY: -60 }] }} />
      <View style={{ position: 'absolute', bottom: 100, left: 0, width: 150, height: 150,
        backgroundColor: '#2e1a2e', borderRadius: 75, opacity: 0.3,
        transform: [{ translateX: -60 }] }} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 24, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled">

          {/* Brand */}
          <View style={{ marginBottom: 32 }}>
            <Text style={{ fontSize: 9, color: tk.text3, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 12 }}>PathTogether</Text>
            <Text style={{ fontSize: 26, fontWeight: '500', color: tk.text, lineHeight: 32 }}>
              {tab === 'login' ? 'Добро\nпожаловать' : 'Создать\nаккаунт'}
            </Text>
            <Text style={{ fontSize: 13, color: tk.text3, marginTop: 6 }}>
              {tab === 'login' ? 'Войди чтобы продолжить' : 'Заполни данные ниже'}
            </Text>
          </View>

          {/* Tabs */}
          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: tk.border, marginBottom: 24 }}>
            {(['login','reg'] as const).map(t => (
              <TouchableOpacity key={t} onPress={() => setTab(t)}
                style={{ flex: 1, paddingVertical: 10, borderBottomWidth: 2,
                  borderBottomColor: tab === t ? tk.text : 'transparent', marginBottom: -1 }}>
                <Text style={{ fontSize: 13, fontWeight: tab === t ? '600' : '500',
                  color: tab === t ? tk.text : tk.text3, textAlign: 'center' }}>
                  {t === 'login' ? 'Войти' : 'Регистрация'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Fields */}
          {tab === 'reg' && (
            <Field label="Имя" value={name} onChange={setName} placeholder="Иван" tk={tk} />
          )}
          <Field label="Email" value={email} onChange={v => { setEmail(v); setEmailError(''); }} placeholder="ivan@gmail.com" tk={tk} />
          {!!emailError && (
            <Text style={{ fontSize: 11, color: '#ef4444', marginTop: -10, marginBottom: 10, marginLeft: 2 }}>{emailError}</Text>
          )}
          <Field label="Пароль" value={password} onChange={setPassword} placeholder="••••••••" secure tk={tk} />

          {tab === 'login' && (
            <TouchableOpacity
              style={{ alignSelf: 'flex-end', marginBottom: 20, marginTop: -6 }}
              onPress={() => {
                if (!email.trim()) {
                  Alert.alert(
                    (lang === 'en' ? 'Enter email' : 'Введите email'),
                    (lang === 'en' ? 'Enter your email above first' : 'Сначала введите email в поле выше')
                  );
                  return;
                }
                Alert.alert(
                  (lang === 'en' ? 'Reset password?' : 'Сброс пароля?'),
                  isEn ? `Send reset link to ${email}?` : `Отправить ссылку на ${email}?`,
                  [
                    { text: (lang === 'en' ? 'Cancel' : 'Отмена'), style: 'cancel' },
                    {
                      text: (lang === 'en' ? 'Send' : 'Отправить'),
                      onPress: async () => {
                        try {
                          await sendPasswordResetEmail(auth, email.trim());
                          Alert.alert(
                            (lang === 'en' ? 'Email sent!' : 'Письмо отправлено!'),
                            (lang === 'en' ? 'Check your inbox' : 'Проверьте почту')
                          );
                        } catch (e: any) {
                          Alert.alert((lang === 'en' ? 'Error' : 'Ошибка'), e.message);
                        }
                      }
                    }
                  ]
                );
              }}>
              <Text style={{ fontSize: 11, color: tk.text3 }}>
                {(lang === 'en' ? 'Forgot password?' : 'Забыл пароль?')}
              </Text>
            </TouchableOpacity>
          )}

          {/* Button */}
          <TouchableOpacity
            onPress={submit}
            disabled={loading}
            style={{
              backgroundColor: tk.text, borderRadius: 14,
              padding: 14, alignItems: 'center', marginTop: 8, marginBottom: 16,
            }}>
            {loading
              ? <ActivityIndicator color={tk.bg} />
              : <Text style={{ fontSize: 14, fontWeight: '500', color: tk.bg }}>
                  {tab === 'login' ? 'Войти' : 'Создать аккаунт'}
                </Text>
            }
          </TouchableOpacity>


          {/* Terms */}
          {/* Google Sign In */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: tk.border }} />
            <Text style={{ fontSize: 11, color: tk.text3 }}>{(lang === 'en' ? 'or' : 'или')}</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: tk.border }} />
          </View>
          <TouchableOpacity
            onPress={googleSignIn}
            style={{ backgroundColor: tk.bg2, borderWidth: 1.5, borderColor: tk.border,
              borderRadius: 14, padding: 14, alignItems: 'center',
              flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 10 }}>
            <Svg width={20} height={20} viewBox="0 0 48 48">
              <Path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.8 2.5 30.2 0 24 0 14.6 0 6.6 5.4 2.8 13.3l7.8 6C12.4 13 17.8 9.5 24 9.5z"/>
              <Path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 2.9-2.2 5.4-4.7 7.1l7.3 5.7c4.3-4 6.9-9.9 6.9-16.8z"/>
              <Path fill="#FBBC05" d="M10.6 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7L2.5 13.3A24 24 0 0 0 0 24c0 3.8.9 7.4 2.5 10.6l8.1-5.9z"/>
              <Path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.3-5.7c-2 1.4-4.6 2.2-7.9 2.2-6.2 0-11.5-4.2-13.4-9.9l-7.8 6.1C6.6 42.6 14.6 48 24 48z"/>
            </Svg>
            <Text style={{ fontSize: 14, fontWeight: '600', color: tk.text2 }}>
              {(lang === 'en' ? 'Continue with Google' : lang==='uk' ? 'Увійти через Google' : lang==='be' ? 'Увайсці праз Google' : lang==='kk' ? 'Google арқылы кіру' : 'Войти через Google')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ marginTop: 24, alignItems: 'center' }}
            onPress={() => Linking.openURL('https://attachment4.github.io/PathTogether/legal.html')}>
            <Text style={{ fontSize: 10, color: tk.text3, textDecorationLine: 'underline' }}>
              {(lang === 'en' ? 'Terms of Use & Privacy Policy' : 'Условия использования и политика конфиденциальности')}
            </Text>
          </TouchableOpacity>

          {onGuest && (
            <TouchableOpacity
              onPress={onGuest}
              style={{ marginTop: 20, alignItems: 'center', paddingVertical: 8 }}>
              <Text style={{ fontSize: 13, color: tk.text3 }}>
                {lang === 'en' ? 'Continue as guest →' : lang === 'uk' ? 'Продовжити як гість →' : 'Продолжить без регистрации →'}
              </Text>
            </TouchableOpacity>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
