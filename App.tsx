import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, TouchableWithoutFeedback, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, StatusBar, Alert,
  ActivityIndicator, Share, PanResponder, Animated, BackHandler, Modal,
  Dimensions, useColorScheme, Keyboard, Image, useWindowDimensions,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useFonts, Nunito_700Bold, Nunito_500Medium, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import * as Network from 'expo-network';
import { onAuthStateChanged } from 'firebase/auth';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import QRCodeSVG from 'react-native-qrcode-svg';

import { getTK, WD_RU, WD_EN } from './src/theme';
import { Storage, Habit, Member, HabitReaction } from './src/store';
import { mkid, secureCode, todayS, todayDow, getLast7Days, isLogged, calcStreak, calcJointStreak } from './src/utils';
import { auth, db } from './src/firebase';
import { doc, getDoc, runTransaction, deleteDoc } from 'firebase/firestore';
import {
  scheduleHabitNotifications,
  scheduleAppReminder,
  scheduleStreakReminder,
  scheduleMorningMotivation,
  scheduleEveningReminder,
  notifyPartnerDone,
  setupNotificationChannel,
  notifyAchievement,
  scheduleHabitTimeNotifications,
  scheduleNudgeNotification,
  requestPermissions,
  cancelHabitNotifications,
} from './src/notifications';
import WeekPlanModal from './src/components/WeekPlanModal';
import { buildAchievements } from './src/screens/AchievementsScreen';
import * as Haptics from 'expo-haptics';
import { initPurchases } from './src/purchases';
import { registerDeviceToken, sendPartnerNotification, sendReactionNotification } from './src/pushNotifications';
import { setBadgeCount as _setBadgeCount } from './src/notifications';

import OnboardingScreen   from './src/screens/OnboardingScreen';
import SettingsScreen    from './src/screens/SettingsScreen';
import PaywallScreen     from './src/screens/PaywallScreen';
import {
  Subscription, loadSubscription, canInvite, canAddMember, PLAN_LIMITS, saveRegisteredAt,
} from './src/subscription';
import { updateWidgetData } from './src/widget/widgetTask';



import AuthScreen         from './src/screens/AuthScreen';
import TodayScreen        from './src/screens/TodayScreen';
import MoodScreen          from './src/screens/MoodScreen';
import FriendsScreen      from './src/screens/FriendsScreen';
import CalendarScreen     from './src/screens/CalendarScreen';
import ProfileScreen      from './src/screens/ProfileScreen';
import AchievementsScreen from './src/screens/AchievementsScreen';
import StatisticsScreen    from './src/screens/StatisticsScreen';
import { tr } from './src/i18n';

const TOP = Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 24) + 4;
// Высота нижней навигации Android — фиксированное значение
// Gesture nav = ~20px, button nav = ~48px, используем 36 как баланс
const ANDROID_NAV_BAR = Platform.OS === 'android' ? 36 : 0;
type Screen = 'onboarding'|'auth'|'today'|'friends'|'add'|'calendar'|'profile'|'addHabit'|'invite'|'detail'|'achievements'|'settings'|'pro'|'paywall'|'mood'|'stats';
interface Space { id:string; habits:Habit[]; logs:Record<string,boolean>; members:Member[]; }

//  QR Code (pure SVG, без доп. библиотек) 
function QRCode({ value, size=160, fg='#000', bg='#fff' }: { value:string; size?:number; fg?:string; bg?:string }) {
  if (!value) return (
    <View style={{width:size,height:size,backgroundColor:bg,alignItems:'center',justifyContent:'center',borderRadius:8}}>
      <Text style={{color:fg,fontSize:11,textAlign:'center',opacity:0.35}}>{'QR\nпоявится\nпосле\nгенерации'}</Text>
    </View>
  );
  return <QRCodeSVG value={value} size={size} color={fg} backgroundColor={bg}/>;
}

//  Мелкие компоненты 
const Toast = ({msg,ok,tk}:{msg:string;ok:boolean;tk:ReturnType<typeof getTK>}) => (
  <View style={{position:'absolute',bottom:100,left:20,right:20,backgroundColor:tk.bg2,
    borderRadius:12,padding:13,borderWidth:1,borderColor:tk.border,
    shadowColor:'#000',shadowOpacity:0.4,shadowRadius:8}}>
    <Text style={{color:ok?tk.text:tk.text2,fontSize:13,fontWeight:'600',textAlign:'center'}}>{msg}</Text>
  </View>
);
const Loader = ({tk}:{tk:ReturnType<typeof getTK>}) => (
  <View style={{position:'absolute',top:0,bottom:0,left:0,right:0,backgroundColor:tk.bg+'cc',alignItems:'center',justifyContent:'center'}}>
    <ActivityIndicator color={tk.text} size="large"/>
  </View>
);

//  Bottom Nav 

// Маппинг старых ярких цветов на пастельные
const LEGACY_COLOR_MAP: Record<string, string> = {
  '#ff8a8a': '#f2b8b8', '#ffb347': '#f7cfa0', '#ffd700': '#f7ebb0',
  '#90ee90': '#b8e0c8', '#87ceeb': '#b8d4e8', '#da70d6': '#cbb8e8',
  '#ffb6c1': '#f0b8d0', '#20b2aa': '#a8d8d4', '#dda0dd': '#d4b8e0',
  '#98fb98': '#b8d8b8', '#f0e68c': '#e8d8a0', '#87cefa': '#b8d0e8',
  '#ffa07a': '#e8c0a8', '#b0c4de': '#c0ccd8', '#d2b48c': '#d4c0a8',
};

const NAV=[
  {s:'today',   ru:'Сегодня',   en:'Today',    uk:'Сьогодні',  be:'Сёння',   kk:'Бүгін'},
  {s:'friends', ru:'Друзья',    en:'Friends',  uk:'Друзі',     be:'Сябры',   kk:'Достар'},
  {s:'add',     ru:'',          en:'',         uk:'',          be:'',        kk:''},
  {s:'calendar',ru:'Календарь', en:'Calendar', uk:'Календар',  be:'Каляндар',kk:'Күнтізбе'},
  {s:'profile', ru:'Профиль',   en:'Profile',  uk:'Профіль',   be:'Профіль', kk:'Профиль'},
];
function BottomNav({screen,onPress,tk,lang,theme,friendsBadge}:{screen:Screen;onPress:(s:Screen)=>void;tk:ReturnType<typeof getTK>;lang:string;theme:'dark'|'light';friendsBadge?:number}) {
  const en=lang==='en';
  const TABS=['today','friends','calendar','profile'];
  const active=TABS.includes(screen)?screen:'today';
  const bottomPad = Platform.OS === 'ios' ? 28 : ANDROID_NAV_BAR + 8;
  return (
    <View style={{position:'absolute',bottom:0,left:0,right:0}}>
      <View style={{
        backgroundColor: theme==='dark' ? 'rgba(10,10,10,0.92)' : 'rgba(255,255,255,0.92)',
        borderTopWidth: 0.5, borderTopColor: theme==='dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
        flexDirection:'row',alignItems:'center',paddingHorizontal:6,paddingTop:12,paddingBottom:bottomPad+6}}>
      {NAV.map(item => {
        if (item.s==='add') return (
          <View key="add" style={{flex:1,alignItems:'center'}}>
            <TouchableOpacity onPress={()=>onPress('add')} activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={en ? 'Add habit' : 'Добавить привычку'}
              style={{width:58,height:58,borderRadius:29,backgroundColor:tk.text,alignItems:'center',justifyContent:'center',marginBottom:2,
                shadowColor:'#000',shadowOpacity:0.18,shadowRadius:10,elevation:6}}>
              <Text style={{color:tk.bg,fontSize:30,lineHeight:34,fontWeight:'400'}}>+</Text>
            </TouchableOpacity>
          </View>
        );
        const isA=active===item.s;
        const badge = item.s==='friends' && friendsBadge && friendsBadge>0 ? friendsBadge : 0;
        const tabLabel = lang==='en'?item.en:lang==='uk'?item.uk:lang==='be'?item.be:lang==='kk'?item.kk:item.ru;
        return (
          <TouchableOpacity key={item.s} onPress={()=>onPress(item.s as Screen)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isA }}
            accessibilityLabel={tabLabel}
            style={{flex:1,alignItems:'center',gap:5,paddingVertical:4}}>
            <View style={{position:'relative'}}>
              <NavIcon name={item.s} active={isA} tk={tk}/>
              {badge>0 && <View style={{position:'absolute',top:-3,right:-3,
                width:8,height:8,borderRadius:4,backgroundColor:tk.text,
                borderWidth:1.5,borderColor:tk.bg}}/>}
            </View>
            <Text style={{fontSize:10,fontWeight:isA?'700':'500',color:isA?tk.text:tk.text2}}>{tabLabel}</Text>
          </TouchableOpacity>
        );
      })}
      </View>
    </View>
  );
}
function NavIcon({name,active,tk}:{name:string;active:boolean;tk:ReturnType<typeof getTK>}) {
  const c=active?tk.text:tk.text2;
  const s={width:20,height:20,alignItems:'center' as const,justifyContent:'center' as const};
  if (name==='today') return (
    <View style={[s,{borderWidth:1.5,borderColor:c,borderRadius:5,gap:2,padding:2}]}>
      <View style={{width:'100%',height:1,backgroundColor:c}}/>
      <View style={{flexDirection:'row',gap:2,marginTop:1}}>
        {[0,1,2].map(i=><View key={i} style={{width:4,height:4,borderRadius:1,backgroundColor:c}}/>)}
      </View>
    </View>
  );
  if (name==='friends') return (
    <Svg width="22" height="20" viewBox="0 0 24 22" fill="none">
      <Circle cx="8" cy="6" r="4" stroke={c} strokeWidth="1.8"/>
      <Path d="M1 20c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
      <Circle cx="17" cy="7" r="3" stroke={c} strokeWidth="1.8" opacity="0.55"/>
      <Path d="M14 20c0-2.761 1.791-5 4-5s4 2.239 4 5" stroke={c} strokeWidth="1.8" strokeLinecap="round" opacity="0.55"/>
    </Svg>
  );
  if (name==='calendar') return (
    <View style={[s,{borderWidth:1.5,borderColor:c,borderRadius:5,padding:2,gap:1.5}]}>
      <View style={{flexDirection:'row',gap:2}}>{[0,1,2].map(i=><View key={i} style={{width:4,height:3,borderRadius:1,backgroundColor:c}}/>)}</View>
      <View style={{flexDirection:'row',gap:2}}>{[0,1,2].map(i=><View key={i} style={{width:4,height:3,borderRadius:1,backgroundColor:active?tk.text2:tk.text2}}/>)}</View>
    </View>
  );
  if (name==='profile') return (
    <View style={s}>
      <View style={{width:10,height:10,borderRadius:5,borderWidth:1.5,borderColor:c,marginBottom:1}}/>
      <View style={{width:18,height:8,borderRadius:4,borderWidth:1.5,borderColor:c}}/>
    </View>
  );
  return null;
}

// ── Desktop ──────────────────────────────────────────────────────────────────
const SIDEBAR_W = 252;
function SideNav({screen,onPress,tk,lang,theme,guest,onAuth,friendsBadge}:{screen:Screen;onPress:(s:Screen)=>void;tk:ReturnType<typeof getTK>;lang:string;theme:'dark'|'light';guest?:boolean;onAuth?:()=>void;friendsBadge?:number}) {
  const active = (['today','friends','calendar','profile'] as string[]).includes(screen) ? screen : 'today';
  const lbl = (item:any) => lang==='en'?item.en:lang==='uk'?item.uk:lang==='be'?item.be:lang==='kk'?item.kk:item.ru;
  const en = lang==='en';
  return (
    <View style={{position:'absolute',left:0,top:0,bottom:0,width:SIDEBAR_W,
      backgroundColor: theme==='dark' ? '#0c0c0c' : '#ffffff',
      borderRightWidth:1, borderRightColor: tk.border,
      paddingVertical:22, paddingHorizontal:14}}>
      {/* brand */}
      <View style={{flexDirection:'row',alignItems:'center',gap:11,paddingHorizontal:8,marginBottom:26}}>
        <View style={{width:32,height:32,borderRadius:9,backgroundColor:tk.accent,alignItems:'center',justifyContent:'center'}}>
          <Text style={{color:'#fff',fontSize:17,fontWeight:'900'}}>P</Text>
        </View>
        <Text style={{fontSize:17,fontWeight:'800',color:tk.text,letterSpacing:-0.3}}>PathTogether</Text>
      </View>
      {/* new habit */}
      <TouchableOpacity onPress={()=>onPress('add')} activeOpacity={0.85}
        style={{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:tk.text,
          borderRadius:12,paddingVertical:12,paddingHorizontal:14,marginBottom:18}}>
        <Text style={{color:tk.bg,fontSize:19,lineHeight:20,fontWeight:'500'}}>+</Text>
        <Text style={{color:tk.bg,fontSize:14,fontWeight:'700'}}>{en?'New habit':'Новая привычка'}</Text>
      </TouchableOpacity>
      {/* nav */}
      {NAV.filter(i=>i.s!=='add').map(item=>{
        const isA = active===item.s;
        const badge = item.s==='friends' && friendsBadge && friendsBadge>0 ? friendsBadge : 0;
        return (
          <TouchableOpacity key={item.s} onPress={()=>onPress(item.s as Screen)} activeOpacity={0.7}
            style={{flexDirection:'row',alignItems:'center',gap:13,paddingVertical:11,paddingHorizontal:12,
              borderRadius:10,marginBottom:3,
              backgroundColor: isA ? (theme==='dark'?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.05)') : 'transparent'}}>
            <View style={{width:22,alignItems:'center'}}><NavIcon name={item.s} active={isA} tk={tk}/></View>
            <Text style={{fontSize:14.5,fontWeight:isA?'700':'500',color:isA?tk.text:tk.text2}}>{lbl(item)}</Text>
            {badge>0 && <View style={{marginLeft:'auto',minWidth:18,height:18,borderRadius:9,backgroundColor:tk.accent,alignItems:'center',justifyContent:'center',paddingHorizontal:5}}><Text style={{color:'#fff',fontSize:11,fontWeight:'700'}}>{badge}</Text></View>}
          </TouchableOpacity>
        );
      })}
      <View style={{flex:1}}/>
      {guest && (
        <TouchableOpacity onPress={onAuth} activeOpacity={0.8}
          style={{borderWidth:1,borderColor:tk.border,borderRadius:12,paddingVertical:11,alignItems:'center'}}>
          <Text style={{fontSize:13.5,fontWeight:'700',color:tk.text}}>{en?'Sign in / Sign up':'Войти / Регистрация'}</Text>
        </TouchableOpacity>
      )}
      {Platform.OS === 'web' && (
        <TouchableOpacity onPress={()=>{ try { (window as any).location.assign('../'); } catch(e) {} }} activeOpacity={0.7}
          style={{marginTop:10,paddingVertical:8,alignItems:'center'}}>
          <Text style={{fontSize:12.5,color:tk.text3}}>← {en?'Back to site':'На сайт'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

//  App

//  Барабанный пикер времени
//  Бесконечный барабанный столбик 
function DrumColumn({ items, selected, onSelect, itemH, tk }: {
  items: string[]; selected: number; onSelect: (i: number) => void;
  itemH: number; tk: any;
}) {
  const VISIBLE = 5;
  const N = items.length;

  const OFFSET = (sel: number) => -(N + sel - 2) * itemH;
  const offsetY   = useRef(new Animated.Value(OFFSET(selected))).current;
  const lastY     = useRef(OFFSET(selected));
  const [curSel, setCurSel] = useState(selected);

  useEffect(() => {
    const v = OFFSET(selected);
    offsetY.setValue(v);
    lastY.current = v;
    setCurSel(selected);
  }, []);

  const normalize = (y: number): number => {
    const total = N * itemH;
    let v = y;
    while (v > -(itemH * 0.5))       v -= total;
    while (v < -(2 * N - 0.5) * itemH) v += total;
    return v;
  };

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: () => {
      offsetY.stopAnimation(v => { lastY.current = v; });
    },
    onPanResponderMove: (_, gs) => {
      const raw = lastY.current + gs.dy;
      offsetY.setValue(raw);
      // Обновляем выделение в реальном времени
      const normed  = normalize(raw);
      const absIdx  = Math.round((-normed + itemH * 2) / itemH);
      const realIdx = ((absIdx % N) + N) % N;
      setCurSel(realIdx);
    },
    onPanResponderRelease: (_, gs) => {
      const raw     = lastY.current + gs.dy;
      const normed  = normalize(raw);
      const absIdx  = Math.round((-normed + itemH * 2) / itemH);
      const realIdx = ((absIdx % N) + N) % N;
      const snapped = normalize(-(absIdx - 2) * itemH);
      offsetY.setValue(normalize(raw));
      lastY.current = snapped;
      setCurSel(realIdx);
      Animated.spring(offsetY, {
        toValue: snapped, useNativeDriver: true,
        friction: 7, tension: 55,
      }).start();
      onSelect(realIdx);
    },
  })).current;

  const tripled = [...items, ...items, ...items];

  return (
    <View style={{ height: itemH * VISIBLE, overflow: 'hidden', width: 80, backgroundColor: tk.bg2 }}
      {...pan.panHandlers}>
      <View pointerEvents="none" style={{
        position:'absolute', top: itemH * 2, height: itemH,
        left:0, right:0, zIndex:2,
        borderTopWidth:1, borderBottomWidth:1,
        borderColor: tk.border,
      }}/>
      <View pointerEvents="none" style={{
        position:'absolute',top:0,left:0,right:0,height:itemH*2,zIndex:1,
        backgroundColor:tk.bg2, opacity:1.0,
      }}/>
      <View pointerEvents="none" style={{
        position:'absolute',bottom:0,left:0,right:0,height:itemH*2,zIndex:1,
        backgroundColor:tk.bg2, opacity:1.0,
      }}/>
      <Animated.View style={{ transform:[{ translateY: offsetY }] }}>
        {tripled.map((item, i) => {
          const isSel = (i % N) === curSel;
          return (
            <View key={i} style={{ height:itemH, alignItems:'center', justifyContent:'center' }}>
              <Text style={{
                fontSize:   isSel ? 28 : 18,
                fontWeight: isSel ? '700' : '400',
                color:      isSel ? tk.text : tk.text3,
              }}>{item}</Text>
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
}

function TimePicker({ value, onChange, onClose, tk }: {
  value: string; onChange: (t: string) => void; onClose: () => void; tk: any;
}) {
  const ITEM_H = 52;
  const hours   = Array.from({length:24}, (_,i) => String(i).padStart(2,'0'));
  const minutes = Array.from({length:60}, (_,i) => String(i).padStart(2,'0'));

  const [h, m] = value && /^\d{1,2}:\d{2}$/.test(value)
    ? value.split(':').map(Number) : [8, 0];

  const [selH, setSelH] = useState(h);
  const [selM, setSelM] = useState(m);

  const confirm = () => {
    onChange(`${String(selH).padStart(2,'0')}:${String(selM).padStart(2,'0')}`);
    onClose();
  };
  const clear = () => { onChange(''); onClose(); };

  // SVG иконки для кнопок
  const IconClose = () => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M18 6L6 18M6 6l12 12"
        stroke={tk.text3} strokeWidth="1.8" strokeLinecap="round"/>
    </Svg>
  );
  const IconCheck = () => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M5 13l4 4L19 7"
        stroke={tk.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  );

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      {/* Затемнение — View без onPress чтобы не блокировать жесты */}
      <View style={{flex:1, backgroundColor:'rgba(0,0,0,0.45)', justifyContent:'flex-end'}}>
        <View style={{
          backgroundColor:tk.bg2,
          borderTopLeftRadius:24, borderTopRightRadius:24,
          paddingBottom:44,
          borderTopWidth:1, borderColor:tk.border,
        }}>
          {/* Хэндл */}
          <View style={{alignItems:'center', paddingTop:12, paddingBottom:4}}>
            <View style={{width:36, height:3, borderRadius:2,
              backgroundColor: tk.border}}/>
          </View>
          {/* Кнопки — крестик слева, галочка справа */}
          <View style={{flexDirection:'row', justifyContent:'space-between',
            alignItems:'center', paddingHorizontal:24, paddingTop:8, paddingBottom:16}}>
            <TouchableOpacity onPress={clear}
              hitSlop={{top:14,bottom:14,left:14,right:14}}
              style={{width:36,height:36,borderRadius:18,
                backgroundColor: tk.bg3,
                borderWidth: 1, borderColor: tk.border,
                alignItems:'center',justifyContent:'center'}}>
              <IconClose/>
            </TouchableOpacity>
            {/* Текущее время крупно по центру */}
            <Text style={{fontSize:28, fontWeight:'700', color:tk.text, letterSpacing:2}}>
              {String(selH).padStart(2,'0')}:{String(selM).padStart(2,'0')}
            </Text>
            <TouchableOpacity onPress={confirm}
              hitSlop={{top:14,bottom:14,left:14,right:14}}
              style={{width:36,height:36,borderRadius:18,
                backgroundColor: tk.bg3,
                borderWidth: 1, borderColor: tk.border,
                alignItems:'center',justifyContent:'center'}}>
              <IconCheck/>
            </TouchableOpacity>
          </View>
          {/* Барабаны */}
          <View style={{flexDirection:'row', alignItems:'center',
            justifyContent:'center', gap:0, paddingHorizontal:40}}>
            <DrumColumn items={hours}   selected={selH}
              onSelect={i=>{setSelH(i);}} itemH={ITEM_H} tk={tk}/>
            <Text style={{fontSize:28, fontWeight:'300', color:tk.text2,
              width:24, textAlign:'center', marginBottom:4}}>:</Text>
            <DrumColumn items={minutes} selected={selM}
              onSelect={i=>{setSelM(i);}} itemH={ITEM_H} tk={tk}/>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({Nunito_700Bold,Nunito_500Medium,Nunito_800ExtraBold});

  const [myId,        setMyId]        = useState('');
  const isGuest = () => myId === 'guest';
  const [myName,      setMyName]      = useState('');
  const [space,       setSpace]       = useState<Space|null>(null);
  const [screen,      setScreen]      = useState<Screen>('auth');
  // Десктоп-раскладка: web + широкий экран → боковое меню вместо нижнего бара
  const winW = useWindowDimensions().width;
  const isDesktop = Platform.OS === 'web' && winW >= 900;
  const [guestBannerHidden, setGuestBannerHidden] = useState(false);
  // Дата, на которой открыть календарь (при тапе по дню на «Сегодня»)
  const [calTarget, setCalTarget] = useState<Date | null>(null);
  // Куда вернуться из под-экрана (запоминаем откуда зашли)
  const navOrigin = useRef<Partial<Record<Screen, Screen>>>({});
  const [loading,     setLoading]     = useState(false);
  const [toast,       setToast]       = useState<{msg:string;ok:boolean}|null>(null);
  const [isOnline,    setIsOnline]    = useState(true);
  const [theme,       setTheme]       = useState<'dark'|'light'>('dark');
  const [autoTheme,   setAutoTheme]   = useState(false);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const systemScheme = useColorScheme();
  useEffect(() => {
    if (autoTheme && systemScheme) {
      setTheme(systemScheme === 'dark' ? 'dark' : 'light');
    }
  }, [systemScheme, autoTheme]);
  const [selectedAvatar, setSelectedAvatar] = useState<string|undefined>(undefined);
  const [notifEnabled,     setNotifEnabled]   = useState(true);
  const [partnerNotif,     setPartnerNotif]   = useState(true);
  const [notifTimeMorning, setNotifTimeMorning] = useState('12:00');
  const [notifTimeEvening, setNotifTimeEvening] = useState('18:00');
  const [subscription, setSubscription]   = useState<Subscription>({
    plan: 'free', expiresAt: null, purchasedAt: null, isActive: true,
    isAdmin: false, isEarlyBird: false,
  });
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [showWeekPlan, setShowWeekPlan] = useState(false);
  const [reactions, setReactions] = useState<HabitReaction[]>([]);
  const [todayMood, setTodayMood] = useState<1|2|3|4|5|null>(null);
  const [onboardingGoal, setOnboardingGoal] = useState<string>('');
  const [spaceNotes, setSpaceNotes] = useState<{habitId:string;date:string;uid:string;note:string}[]>([]);
  const unsubReactions    = useRef<(() => void) | null>(null);
  const habitsRef         = useRef<import('./src/store').Habit[]>([]);
  const prevReactionKeys  = useRef(new Set<string>());
  const prevConfirmKeys   = useRef(new Set<string>());
  const reactingRef       = useRef(false); // лок против спама реакций
  const unsubSpaceNotes    = useRef<(() => void) | null>(null);
  const unsubConfirmations = useRef<(() => void) | null>(null);
  const [confirmations, setConfirmations] = useState<import('./src/store').HabitConfirmation[]>([]);
  // Онбординг для партнёра: показывается после первого присоединения к чужому пространству
  const [partnerWelcome, setPartnerWelcome] = useState<{partnerName:string; habitCount:number} | null>(null);
  // Синхронизируем ref для PanResponder (замыкание не видит стейт)
  // Флаг: subscription загружена из Firestore (не дефолтное данные)
  const subscriptionLoaded = useRef(false);
  useEffect(() => { screenRef.current = screen; }, [screen]);

  // Загружаем настроение за сегодня при возврате на экран today
  useEffect(() => {
    if (screen === 'today' && myId && myId !== 'guest') {
      Storage.getMood(myId, todayS()).then(entry => {
        setTodayMood(entry ? entry.mood : null);
      }).catch(() => {});
    }
  }, [screen, myId]);

  // Автогенерация инвайт-ссылки при переходе на экран invite
  // Ждём загрузки subscription — иначе canInvite() вернёт false для платного юзера
  useEffect(() => {
    if (screen === 'invite' && !invLink && myId && myId !== 'guest' && subscriptionLoaded.current) {
      genInvite(true).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, invLink, subscription.plan]);

  // Загрузка заметок при открытии детального экрана привычки
  useEffect(() => {
    if (screen === 'detail' && detailH) {
      const dates: string[] = [];
      for (let i = 0; i < 14; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
      }
      Storage.getNotesForHabit(myId, detailH.id, dates)
        .then(notes => setDetailNotes(notes))
        .catch(() => {});
    }
    if (screen !== 'detail') setDetailNotes({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, detailH?.id]);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        if (!cancelled) setIsOnline(!!state.isConnected);
      } catch { if (!cancelled) setIsOnline(true); }
    };
    check();
    const id = setInterval(check, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // OTA обновления
  useEffect(() => {
    (async () => {
      try {
        const Updates = require('expo-updates');
        if (!Updates.isEnabled) return;
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) {
          await Updates.fetchUpdateAsync();
          Alert.alert(
            lang === 'en' ? 'Update available' : 'Доступно обновление',
            lang === 'en'
              ? 'A new version has been downloaded. Restart to apply.'
              : 'Новая версия загружена. Перезапустите приложение для применения.',
            [
              { text: lang === 'en' ? 'Later' : 'Позже', style: 'cancel' },
              {
                text: lang === 'en' ? 'Restart' : 'Перезапустить',
                onPress: () => Updates.reloadAsync().catch(() => {}),
              },
            ],
          );
        }
      } catch {}
    })();
  }, []);
  // FIX 1: ждём ответа Firebase перед рендером экрана входа
  const [authChecked, setAuthChecked] = useState(false);
  // Защита от ложного null: Firebase при старте сначала стреляет null пока грузит
  // сессию из AsyncStorage, потом стреляет снова с реальным юзером.
  // sessionEstablished = true после того как мы хотя бы раз увидели реального юзера
  // или загрузили сессию из офлайн-кеша — в этом состоянии null игнорируем.
  const sessionEstablished = useRef(false);
  const [lang,        setLang]        = useState('ru');
  const [invLink,     setInvLink]     = useState('');
  const prevInviteScreen = useRef<Screen>('friends');
  const [statsTab, setStatsTab] = useState<'me'|'partner'>('me');
  const [detailH,     setDetailH]     = useState<Habit|null>(null);
  const [editH,       setEditH]       = useState<Habit|null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [reminderTimePicker, setReminderTimePicker] = useState<'from'|'to'|null>(null);
  const [pendInv,     setPendInv]     = useState<string|null>(null);

  // FIX 2: рефы для подписок Firestore
  const unsubH = useRef<(()=>void)|null>(null);
  const unsubL = useRef<(()=>void)|null>(null);
  const unsubM = useRef<(()=>void)|null>(null);
  // Флаг: сейчас идёт регистрация — onAuthStateChanged не должен мешать
  const isRegistering = useRef(false);
  const prevAchIds    = useRef<Set<string>>(new Set()); // уже разблокированные достижения

  // Инициализируем prevAchIds уже разблокированными достижениями при первой загрузке space.
  // Без этого первый toggle после запуска триггерит уведомления для ВСЕХ выполненных достижений.
  useEffect(() => {
    if (!space?.id || !myId || myId === 'guest') return;
    const l = space.logs || {};
    const totalDone = Object.keys(l).filter(k => k.includes(`_${myId}`)).length;
    const maxStrk = (space.habits || []).length > 0
      ? Math.max(0, ...(space.habits || []).map((h: any) => calcStreak(h.id, myId, l, h.days)))
      : 0;
    const achs = buildAchievements({
      habitCount: (space.habits || []).length,
      totalDone,
      maxStreak: maxStrk,
      friendCount: (space.members || []).length > 1 ? 1 : 0,
    });
    achs.filter(a => a.done).forEach(a => prevAchIds.current.add(a.id));
  }, [space?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  //  Tab screens для свайпа и BackHandler
  const TAB_SCREENS: Screen[] = ['today', 'friends', 'calendar', 'profile'];

  // Android BackHandler
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Если на под-экране — возвращаемся назад
      if (!TAB_SCREENS.includes(screen) && screen !== 'auth' && screen !== 'onboarding') {
        // Определяем куда вернуться
        const backMap: Partial<Record<Screen, Screen>> = {
          settings: 'profile', achievements: 'profile',
          pro: 'profile', paywall: 'profile', detail: 'today', addHabit: 'today',
          invite: 'friends',
        };
        const back = backMap[screen];
        if (back) { setScreen(back); return true; }
      }
      // На главных вкладках — стандартное поведение (свернуть/выйти)
      return false;
    });
    return () => handler.remove();
  }, [screen]);

  //  Свайп между вкладками 
  const tabSwipePan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    // Захватываем жест если: горизонталь > 20px И горизонталь > вертикаль в 1.5 раза
    // Это даёт плавный свайп без конфликта со скроллом вверх/вниз
    onMoveShouldSetPanResponder: (_, gs) => {
      if (!TAB_SCREENS.includes(screenRef.current as Screen)) return false;
      const isHorizontal = Math.abs(gs.dx) > 20 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5;
      return isHorizontal;
    },
    onPanResponderRelease: (_, gs) => {
      const cur = TAB_SCREENS.indexOf(screenRef.current as Screen);
      if (cur === -1) return;
      // Порог срабатывания — 60px, достаточно для уверенного свайпа
      if (gs.dx < -60 && cur < TAB_SCREENS.length - 1) animateScreenChange(TAB_SCREENS[cur + 1]);
      if (gs.dx > 60 && cur > 0)                        animateScreenChange(TAB_SCREENS[cur - 1]);
    },
    // Не прерываем жест если ScrollView уже начал скроллить
    onPanResponderTerminationRequest: () => true,
  })).current;
  const screenRef  = useRef<Screen>('auth');
  const screenOpacity    = useRef(new Animated.Value(1)).current;
  const screenTranslateX = useRef(new Animated.Value(0)).current;

  // Плавное появление при смене экрана
  const [coverOpacity] = useState(new Animated.Value(0));
  const [coverVisible, setCoverVisible] = useState(false);
  const [noteModal, setNoteModal] = useState<{habitId:string;date:string}|null>(null);
  // Таймер для detail screen
  const [timerActive, setTimerActive] = useState(false);
  const [timerLeft,   setTimerLeft]   = useState(0);
  const timerRef          = useRef<ReturnType<typeof setInterval>|null>(null);
  const timerHabitName    = useRef<string>('');
  const timerTotalSeconds = useRef<number>(0);

  const startTimer = (seconds: number, habitName?: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerTotalSeconds.current = seconds;
    if (habitName) timerHabitName.current = habitName;
    setTimerLeft(seconds);
    setTimerActive(true);

    // Отменяем предыдущие timer-уведомления
    try {
      const N = require('expo-notifications');
      N.cancelScheduledNotificationAsync('timer_warning').catch(()=>{});
      N.cancelScheduledNotificationAsync('timer_done').catch(()=>{});

      const { Platform } = require('react-native');
      const isAndroid = Platform.OS === 'android';

      // Уведомление за 20 секунд до конца
      if (seconds > 20) {
        N.scheduleNotificationAsync({
          identifier: 'timer_warning',
          content: {
            title: '⏱ Почти готово!',
            body: `${timerHabitName.current || 'Привычка'} — осталось 20 секунд`,
            sound: 'default',
            ...(isAndroid ? { channelId: 'timer' } : {}),
          },
          trigger: { type: 'timeInterval', seconds: seconds - 20, repeats: false },
        }).catch(()=>{});
      }

      // Уведомление по завершении
      N.scheduleNotificationAsync({
        identifier: 'timer_done',
        content: {
          title: '✅ Время вышло!',
          body: `${timerHabitName.current || 'Привычка'} выполнена`,
          sound: 'default',
          ...(isAndroid ? { channelId: 'timer' } : {}),
        },
        trigger: { type: 'timeInterval', seconds, repeats: false },
      }).catch(()=>{});
    } catch {}

    timerRef.current = setInterval(() => {
      setTimerLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setTimerActive(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerActive(false);
    setTimerLeft(0);
    // Отменяем запланированные уведомления таймера
    try {
      const N = require('expo-notifications');
      N.cancelScheduledNotificationAsync('timer_warning').catch(()=>{});
      N.cancelScheduledNotificationAsync('timer_done').catch(()=>{});
    } catch {}
  };

  // Таймер НЕ останавливается при уходе с detail — продолжает тикать

  // Следим за клавиатурой чтобы модал заметки не перекрывался
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => {
      setNoteKbHeight(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setNoteKbHeight(0);
    });
    return () => { show.remove(); hide.remove(); };
  }, []);
  const [detailNotes, setDetailNotes] = useState<Record<string,string>>({});
  const [noteText, setNoteText] = useState('');
  const [noteKbHeight, setNoteKbHeight] = useState(0);

  const animateScreenChange = (newScreen: Screen, direction: 'forward' | 'back' = 'forward') => {
    if (newScreen === screen) return;
    // Запоминаем, откуда зашли на под-экран, чтобы кнопка «назад» вернула туда же
    if (direction === 'forward') navOrigin.current[newScreen] = screen;
    const inX = direction === 'forward' ? 40 : -40;
    // 1. Показываем cover поверх старого экрана
    setCoverVisible(true);
    coverOpacity.setValue(1);
    screenTranslateX.setValue(inX);
    screenOpacity.setValue(0);
    // 2. Меняем экран под cover
    setScreen(newScreen);
    // 3. Убираем cover и показываем новый экран
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(coverOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.timing(screenOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.spring(screenTranslateX, { toValue: 0, friction: 7, tension: 70, useNativeDriver: true }),
        ]).start(() => setCoverVisible(false));
      });
    });
  };



  const blank = {name:'',icon:'',color:'#f5f5f5',days:[0,1,2,3,4,5,6],time:'',desc:'',target:0,unit:'',category:'habit' as any, type:'good' as 'good'|'quit', timerSeconds:0, routine:undefined as any, noteEnabled:false, isShared:false, reminderInterval:0, reminderFrom:'08:00', reminderTo:'22:00', requirePartnerConfirm:false};
  const [nh, setNh] = useState(blank);

  const tk    = getTK(theme);
  const isEn  = lang==='en';
  const L = (ru: string, en: string, uk?: string, be?: string, kk?: string) =>
    lang==='en' ? en : lang==='uk' ? (uk||ru) : lang==='be' ? (be||ru) : lang==='kk' ? (kk||ru) : ru;
  const toast$ = (msg:string,ok=true) => { setToast({msg,ok}); setTimeout(()=>setToast(null),4000); };

  useEffect(() => {
    Storage.loadTheme().then(t=>{if(t)setTheme(t);setThemeLoaded(true);});
    Storage.loadLanguage().then(l=>{if(l)setLang(l);});
    Storage.get<string>('onboarding_name').then(n=>{
      if(n && !myName) setMyName(n);
    }).catch(()=>{});
    Storage.loadNotifTimeMorning().then(t=>{if(t)setNotifTimeMorning(t);});
    Storage.loadNotifTimeEvening().then(t=>{if(t)setNotifTimeEvening(t);});
    Storage.get<boolean>('haptics_enabled').then(v=>{if(v===false)setHapticsEnabled(false);}).catch(()=>{});
    Storage.get<boolean>('notif_enabled').then(v=>{if(v===false)setNotifEnabled(false);}).catch(()=>{});
    Storage.get<boolean>('partner_notif').then(v=>{if(v===false)setPartnerNotif(false);}).catch(()=>{});

    // Слушаем ответы на уведомления — быстрые реакции (👍❤️🔥) без открытия приложения
    let responseSub: any = null;
    try {
      const Notif = require('expo-notifications');
      if (typeof Notif.addNotificationResponseReceivedListener === 'function') {
        responseSub = Notif.addNotificationResponseReceivedListener(async (response: any) => {
          const actionId: string = response?.actionIdentifier ?? '';
          const data = response?.notification?.request?.content?.data ?? {};

          // ── Подтверждение выполнения привычки партнёром ────────────────────
          if (actionId === 'confirm_yes' || data?.type === 'confirm_request') {
            try {
              const habitId: string = data?.habitId ?? '';
              if (!habitId) return;
              const sid = space?.id ?? (await Storage.loadCurrentSpace(myId ?? ''));
              if (!sid || !myId || myId === 'guest') return;
              const partner = space?.members?.find((m: any) => m && m.id !== myId);
              if (!partner) return;
              // Записываем подтверждение
              const c: import('./src/store').HabitConfirmation = {
                habitId, date: todayS(), fromId: partner.id, confirmedBy: myId, ts: Date.now(),
              };
              await Storage.saveConfirmation(sid, c).catch(() => {});
              // Засчитываем лог партнёру
              const l = { ...(space?.logs ?? {}) };
              l[`${habitId}_${todayS()}_${partner.id}`] = true;
              await Storage.setLogs(sid, l).catch(() => {});
              // Уведомляем партнёра о подтверждении
              const habit = space?.habits?.find((h: any) => h.id === habitId);
              sendPartnerNotification({
                spaceId: sid, toUid: partner.id, fromName: myName,
                habitName: habit?.name ?? '', habitId, lang,
                customBody: isEn
                  ? `${myName} confirmed: ${habit?.name ?? ''}`
                  : `${myName} подтвердил: ${habit?.name ?? ''}`,
              }).catch(() => {});
            } catch (e) { console.warn('[confirm_yes]', e); }
            return;
          }

          if (!actionId.startsWith('react_')) return;
          // push-кнопки маппятся в ReactionKey (heart | lightning | star | crown)
          const actionToKey: Record<string, string> = {
            react_thumbs: 'star',      // ★
            react_heart:  'heart',     // ♡
            react_fire:   'fire',      // 🔥
          };
          const emoji = actionToKey[actionId];
          if (!emoji || !data.habitId) return;
          try {
            const sid = space?.id ?? (await Storage.loadCurrentSpace(myId ?? ''));
            if (!sid || myId === 'guest') return;
            const reaction: HabitReaction = {
              emoji, fromId: myId, fromName: myName,
              habitId: data.habitId, date: todayS(), ts: Date.now(),
            };
            await Storage.saveReaction(sid, reaction);
            // Уведомляем владельца привычки через FCM
            const owner = data.partnerName ? data.partnerName : '';
            const spaceData = space;
            if (spaceData) {
              const habit = spaceData.habits?.find((h: any) => h.id === data.habitId);
              const ownerMember = spaceData.members?.find((m: any) => m && m.id !== myId);
              if (ownerMember && habit) {
                sendReactionNotification({
                  spaceId: sid,
                  toUid: ownerMember.id,
                  fromName: myName,
                  emoji,
                  habitName: habit.name,
                  habitId: habit.id,
                  lang,
                }).catch(() => {});
              }
            }
          } catch (e) { console.warn('[reactions]', e); }
        });
      }
    } catch {}
    return () => { try { responseSub?.remove?.(); } catch {} };
  }, []);

  //  Auth listener 
  useEffect(() => {
    // Таймаут офлайн-входа: если Firebase молчит 3 сек — берём юзера из кэша
    let resolved = false;
    const offlineTimer = setTimeout(async () => {
      if (resolved) return;
      resolved = true;
      try {
        const [lastUid, lastName] = await Promise.all([
          Storage.get<string>('last_uid'),
          Storage.get<string>('last_name'),
        ]);
        if (lastUid) {
          sessionEstablished.current = true; // офлайн-сессия установлена
          setMyId(lastUid);
          setMyName(lastName || 'User');
          setThemeLoaded(true);
          setAuthChecked(true);
          // Загружаем данные из локального кэша Firestore
          const session = await Storage.loadUserSession(lastUid);
          if (!session.onbDone) { setScreen('onboarding'); return; }
          if (session.spaceId) {
            setSpace({ id: session.spaceId, habits: [], logs: {}, members: [] });
            startSubs(session.spaceId, lastUid);
          }
          setScreen('today');
        } else {
          // Новый юзер без кэша — показываем экран входа
          setAuthChecked(true);
          setScreen('auth');
        }
      } catch {
        setAuthChecked(true);
        setScreen('auth');
      }
    }, 3000);

    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
      if (!user) {
        // Firebase при старте ВСЕГДА сначала стреляет null пока восстанавливает сессию.
        // Не отменяем offlineTimer на null — пусть он разберётся с кешем.
        // Реагируем на null только если offlineTimer уже отработал (resolved=true)
        // и сессия не была установлена — это подлинный выход/нет аккаунта.
        if (sessionEstablished.current) return;
        if (!resolved) return; // ждём offlineTimer или реального пользователя
        stopSubs();
        setSpace(null); setMyId('');
        setAuthChecked(true); setScreen('auth');
        return;
      }
      // Пришёл реальный пользователь — отменяем offlineTimer
      if (!resolved) { resolved = true; clearTimeout(offlineTimer); }
      sessionEstablished.current = true; // сессия подтверждена Firebase
      // Если идёт регистрация — onSuccess сам всё сделает
      if (isRegistering.current) return;
      setMyId(user.uid);
      // Параллельно: AsyncStorage (быстро) + один Firestore запрос если нужен
      const [name, savedTheme, savedLang, savedAvatar, session, savedGoal] = await Promise.all([
        Storage.loadName(),
        Storage.loadTheme(),
        Storage.loadLanguage(),
        Storage.get(`avatar_${user.uid}`),
        Storage.loadUserSession(user.uid), // один запрос вместо двух
        Storage.get<string>('onboarding_goal'),
      ]);
      const displayName = name || user.displayName || user.email?.split('@')[0] || 'User';
      setMyName(displayName);
      if (!name) Storage.saveName(displayName).catch(()=>{});
      // Сохраняем uid для офлайн доступа
      Storage.set('last_uid', user.uid).catch(()=>{});
      Storage.set('last_name', displayName).catch(()=>{}); // не ждём
      if (savedTheme) setTheme(savedTheme);
      if (savedLang)  setLang(savedLang);
      if (savedAvatar) setSelectedAvatar(savedAvatar as string);
      if (savedGoal)  setOnboardingGoal(savedGoal);
      setThemeLoaded(true);
      setAuthChecked(true);
      if (!session.onbDone) { setScreen('onboarding'); return; }
      if (session.spaceId) {
        setSpace({ id: session.spaceId, habits: [], logs: {}, members: [] });
        startSubs(session.spaceId, user.uid); // передаём uid явно, т.к. setMyId асинхронный
      }
      setScreen('today');
      // Обновляем push-токен при каждом холодном старте (токен может протухнуть)
      requestPermissions().then(granted => {
        if (granted) registerDeviceToken(user.uid).catch(()=>{});
      }).catch(()=>{});
      // Подписка — в фоне
      loadSubscription(user.uid).then(sub => {
        setSubscription(sub);
        subscriptionLoaded.current = true;
      }).catch(() => { subscriptionLoaded.current = true; });
      } catch (e) {
        console.warn('[onAuthStateChanged]', e);
        setAuthChecked(true);
        setScreen('auth');
      }
    });
    return () => { unsub(); stopSubs(); clearTimeout(offlineTimer); };
  }, []);

  useEffect(() => {
    const handle = ({url}:{url:string}) => {
      const parsed = Linking.parse(url);
      // Обработка возврата после оплаты ЮКассы
      if (parsed.path === 'payment-result') {
        const uid = auth.currentUser?.uid;
        if (uid) {
          loadSubscription(uid).then(sub => {
            setSubscription(sub);
            subscriptionLoaded.current = true;
          }).catch(() => {});
        }
        return;
      }
      // Поддерживаем оба формата: ?code=XXX и ?invite=XXX (старый)
      const code = (parsed.queryParams?.code || parsed.queryParams?.invite) as string;
      if (code) setPendInv(code);
    };
    const sub = Linking.addEventListener('url', handle);
    Linking.getInitialURL().then(url=>{if(url)handle({url});});
    return ()=>sub.remove();
  }, []);


  // FIX 2: подписки вместо одноразовых запросов — данные приходят мгновенно из кеша
  const stopSubs = () => {
    unsubH.current?.(); unsubH.current=null;
    unsubL.current?.(); unsubL.current=null;
    unsubM.current?.(); unsubM.current=null;
    unsubReactions.current?.(); unsubReactions.current=null;
    unsubSpaceNotes.current?.(); unsubSpaceNotes.current=null;
    unsubConfirmations.current?.(); unsubConfirmations.current=null;
  };
  const startSubs = (sid:string, currentUid?: string) => {
    stopSubs();
    // currentUid передаётся явно чтобы избежать проблемы с closure — myId может быть
    // ещё пустым когда startSubs вызывается из onAuthStateChanged (setMyId асинхронный)
    const uid = currentUid || myId;

    unsubH.current = Storage.subscribeHabits(sid, habits => {
      try {
        const allHabits = Array.isArray(habits) ? habits.filter(Boolean) : [];
        // Личные привычки партнёра не должны быть видны — показываем только свои + совместные
        const safeHabits = uid
          ? allHabits.filter((h:any) => h.isShared || h.ownerId === uid)
          : allHabits;
        habitsRef.current = safeHabits;
        setSpace(p => {
          // Если space другого id — игнорируем; если null — создаём (Firestore кэш быстрее setState)
          if (p && p.id !== sid) return p;
          return p ? {...p, habits: safeHabits} : {id:sid, habits:safeHabits, logs:{}, members:[]};
        });
        setTimeout(() => {
          setSpace(prev => {
            const hasP = (prev?.members?.length ?? 0) > 1;
            Promise.resolve().then(() =>
              scheduleHabitNotifications(safeHabits, hasP, notifEnabled, lang).catch(()=>{})
            );
            return prev;
          });
        }, 100);
      } catch (e) { console.warn('[startSubs] habits cb', e); }
    });

    const prevLogsRef = { current: {} as Record<string,boolean> };

    unsubL.current = Storage.subscribeLogs(sid, (newLogs) => {
      try {
        const safeNewLogs = newLogs && typeof newLogs === 'object' ? newLogs : {};
        const today = new Date().toISOString().split('T')[0];
        setSpace(prev => {
          if (prev && prev.id !== sid) return prev;
          const base = prev ?? {id:sid, habits:[], logs:{}, members:[]};
          // Уведомления партнёра — только если оба участника уже загружены
          if (base.members.length > 1 && partnerNotif) {
            const partner = base.members.find(m => m && m.id !== uid);
            if (partner) {
              setTimeout(() => {
                Object.keys(safeNewLogs).forEach(key => {
                  const expectedSuffix = `_${today}_${partner.id}`;
                  if (!prevLogsRef.current[key] && key.endsWith(expectedSuffix)) {
                    const hid = key.replace(expectedSuffix, '');
                    const habit = base.habits.find(h => h.id === hid);
                    if (habit) {
                      notifyPartnerDone(partner.name, habit.name, habit.id).catch(()=>{});
                    }
                  }
                });
                prevLogsRef.current = safeNewLogs;
              }, 0);
            }
          } else {
            prevLogsRef.current = safeNewLogs;
          }
          return {...base, logs: safeNewLogs};
        });
      } catch (e) { console.warn('[startSubs] logs cb', e); }
    });

    unsubM.current = Storage.subscribeMembers(sid, members => {
      try {
        const safeMembers = Array.isArray(members) ? members.filter(Boolean) : [];

        // Детекция кика: список непустой, но текущего пользователя в нём нет
        if (safeMembers.length > 0 && !safeMembers.find((m: any) => m && m.id === uid)) {
          stopSubs();
          Storage.clearSpaceId(uid).catch(() => {});
          setSpace(null);
          setScreen('today');
          toast$(lang === 'en' ? 'You were removed from the shared space' : 'Вас удалили из общего пространства', false);
          return;
        }

        setSpace(p => {
          if (p && p.id !== sid) return p;
          return p ? {...p, members: safeMembers} : {id:sid, habits:[], logs:{}, members:safeMembers};
        });
        setTimeout(() => {
          const hasPartnerNow = safeMembers.length > 1;
          scheduleAppReminder(hasPartnerNow, notifEnabled, notifTimeEvening).catch(()=>{});
          scheduleMorningMotivation(hasPartnerNow, notifEnabled, notifTimeMorning).catch(()=>{});
          // Nudge: мягкое напоминание о партнёре вечером (opt-in через partnerNotif)
          if (hasPartnerNow) {
            const partner = safeMembers.find((m: any) => m && m.id !== (uid || myId));
            if (partner?.name) {
              scheduleNudgeNotification(partner.name, partnerNotif && notifEnabled).catch(()=>{});
            }
          } else {
            scheduleNudgeNotification('', false).catch(()=>{});
          }
        }, 0);
      } catch (e) { console.warn('[startSubs] members cb', e); }
    });


    unsubSpaceNotes.current = Storage.subscribeSpaceNotes(sid, notes => {
      setSpaceNotes(notes);
    });

    unsubConfirmations.current = Storage.subscribeConfirmations(sid, data => {
      setConfirmations(data);

      // Показываем локальное уведомление когда партнёр запросил подтверждение
      data.forEach((c: any) => {
        const key = `${c.habitId}_${c.date}_${c.fromId}`;
        const isNewRequest = !c.confirmedBy && c.fromId !== (uid || myId);
        if (isNewRequest && !prevConfirmKeys.current.has(key)) {
          prevConfirmKeys.current.add(key);
          try {
            const N = require('expo-notifications');
            if (N?.scheduleNotificationAsync) {
              const habitName = habitsRef.current.find((h: any) => h.id === c.habitId)?.name ?? '';
              N.scheduleNotificationAsync({
                content: {
                  title: isEn ? '✋ Confirmation needed' : '✋ Требуется подтверждение',
                  body: habitName
                    ? (isEn ? `Confirm: ${habitName}` : `Подтвердить: ${habitName}`)
                    : (isEn ? 'Your partner needs your confirmation' : 'Партнёр ожидает вашего подтверждения'),
                  sound: 'default',
                  data: { type: 'confirm_request', habitId: c.habitId },
                  ...(require('react-native').Platform.OS === 'android' ? { channelId: 'partner' } : {}),
                },
                trigger: null,
              }).catch(() => {});
            }
          } catch {}
        } else {
          prevConfirmKeys.current.add(key);
        }
      });
    });

    // Реакции партнёра на привычки
    unsubReactions.current = Storage.subscribeReactions(sid, incoming => {
      setReactions(incoming);

      // Определяем новые реакции от партнёра и показываем локальный пуш
      incoming.forEach(r => {
        const key = `${r.habitId}_${r.date}_${r.fromId}`;
        if (!prevReactionKeys.current.has(key) && r.fromId !== (uid || myId)) {
          prevReactionKeys.current.add(key);
          // Локальное уведомление — пользователь видит даже если приложение открыто
          try {
            const N = require('expo-notifications');
            if (N?.scheduleNotificationAsync) {
              const habit = habitsRef.current.find((h: any) => h.id === r.habitId);
              const keyToEmoji: Record<string,string> = {
                heart:'❤️', lightning:'⚡', star:'★', crown:'♛', fire:'🔥',
              };
              const displayEmoji = keyToEmoji[r.emoji] || r.emoji;
              N.scheduleNotificationAsync({
                content: {
                  title: `${r.fromName} отреагировал ${displayEmoji}`,
                  body: habit?.name ?? '',
                  sound: 'default',
                  data: { type: 'reaction', habitId: r.habitId },
                  ...(require('react-native').Platform.OS === 'android' ? { channelId: 'partner' } : {}),
                },
                trigger: null,
              }).catch(() => {});
            }
          } catch {}
        } else {
          prevReactionKeys.current.add(key);
        }
      });
    });
  };

  // ── Гостевой вход ────────────────────────────────────────────────────────────
  const handleGuest = async () => {
    const guestId = 'guest';
    const guestName = lang === 'en' ? 'Guest' : 'Гость';
    setMyId(guestId);
    setMyName(guestName);
    await Storage.saveName(guestName);
    await Storage.set('last_uid', guestId);
    await Storage.set('last_name', guestName);
    // Пропускаем онбординг для гостя — сразу в приложение
    setAuthChecked(true);
    setScreen('today');
  };

  // ── Гостевое пространство (только AsyncStorage, без Firestore) ──────────────
  const GUEST_SPACE_KEY = 'guest_space_id';
  const ensureGuestSpace = async (): Promise<Space> => {
    const existingId = await Storage.get<string>(GUEST_SPACE_KEY);
    const sid = existingId || 'guest_space_' + mkid();
    if (!existingId) await Storage.set(GUEST_SPACE_KEY, sid);
    const [habits, logs] = await Promise.all([
      Storage.get<any[]>('guest_habits_' + sid).then(h => h || []),
      Storage.get<Record<string,boolean>>('guest_logs_' + sid).then(l => l || {}),
    ]);
    const members: Member[] = [{ id: 'guest', name: myName || 'Гость', role: 'owner', joined: todayS() }];
    const s = { id: sid, habits, logs, members };
    setSpace(s);
    return s;
  };

  const ensureSpace = async (): Promise<Space> => {
    if (myId === 'guest') return ensureGuestSpace();
    if (space) return space;
    if (!myId) throw new Error('Not authenticated');
    if (space?.id) return space;
    const existingId = await Storage.loadCurrentSpace(myId);
    if (existingId) {
      if (!space || space.id !== existingId) startSubs(existingId);
      return space?.id === existingId ? space : {id:existingId,habits:[],logs:{},members:[]};
    }
    const sid = mkid();
    const members:Member[] = [{id:myId,name:myName,role:'owner',joined:todayS()}];
    await Storage.setMembers(sid, members);
    await Promise.all([
      Storage.setHabits(sid,[]),
      Storage.setLogs(sid,{}),
      Storage.setMeta(sid,{name:'PathTogether'}),
      Storage.saveCurrentSpace(sid),
    ]);
    const newSpace = {id:sid,habits:[],logs:{},members};
    setSpace(newSpace);
    startSubs(sid);
    return newSpace;
  };

  const saveH = async (h:Habit[],sid?:string) => {
    const id=sid||space?.id; if(!id) return;
    try {
      if (myId === 'guest') { await Storage.set('guest_habits_' + id, h); return; }
      await Storage.setHabits(id,h);
    } catch (e) { console.warn('[saveH]', e); }
  };
  const saveL = async (l:Record<string,boolean>,sid?:string) => {
    const id=sid||space?.id; if(!id) return;
    try {
      if (myId === 'guest') { await Storage.set('guest_logs_' + id, l); return; }
      await Storage.setLogs(id,l);
    } catch (e) { console.warn('[saveL]', e); }
  };

  // ── Синхронизация данных нативного Android-виджета ──────────────────────────
  // Пересобираем срез "привычки на сегодня" при любом изменении привычек/логов.
  useEffect(() => {
    if (!myId || myId === 'guest') return;
    const dow = todayDow();
    const date = todayS();
    const habits = (space?.habits || [])
      .filter((h:any) => h.days?.includes(dow))
      .sort((a:any,b:any) => (a.order??0)-(b.order??0))
      .map((h:any) => ({
        id: h.id,
        name: h.name,
        color: h.color,
        done: !!(space?.logs||{})[`${h.id}_${date}_${myId}`],
      }));
    const doneCount = habits.filter(h => h.done).length;
    updateWidgetData({
      habits,
      doneCount,
      totalCount: habits.length,
      userName: myName || '',
      updatedAt: Date.now(),
    }).catch(()=>{});
  }, [space?.habits, space?.logs, myId, myName]);

  const toggle = async (hid:string) => {
    const key=`${hid}_${todayS()}_${myId}`;
    const l={...(space?.logs||{})};
    const wasLogged = !!l[key];
    const habit = (space?.habits||[]).find((h:any)=>h.id===hid);
    const partner = space?.members?.find((m:any)=>m&&m.id!==myId);

    // requirePartnerConfirm: отметка создаёт pending подтверждение; повторный тап — отменяет pending
    if (habit?.requirePartnerConfirm && partner && space?.id && myId !== 'guest') {
      const pending = confirmations.find(
        (c:any) => c.habitId===hid && c.date===todayS() && c.fromId===myId && !c.confirmedBy
      );
      if (pending && !wasLogged) {
        // Отменяем pending — удаляем запись подтверждения
        try {
          const { deleteDoc, doc } = require('firebase/firestore');
          const { db } = require('./src/firebase');
          const key = `${hid}_${todayS()}_confirm`;
          await deleteDoc(doc(db, 'spaces', space.id, 'confirmations', key)).catch(()=>{});
        } catch {}
        toast$(isEn ? 'Request cancelled' : 'Запрос отменён', true);
        return;
      }
      if (!wasLogged && !pending) {
        const newPending: import('./src/store').HabitConfirmation = {
          habitId: hid, date: todayS(), fromId: myId, confirmedBy: '', ts: Date.now(),
        };
        await Storage.saveConfirmation(space.id, newPending).catch(()=>{});
        sendPartnerNotification({
          spaceId: space.id, toUid: partner.id, fromName: myName,
          habitName: habit.name, habitId: hid, lang,
          isConfirmRequest: true,
          customBody: isEn
            ? `${myName} asks you to confirm: ${habit.name}`
            : `${myName} просит подтвердить: ${habit.name}`,
        }).catch(()=>{});
        toast$(isEn
          ? `Waiting for ${partner.name}'s confirmation`
          : `Ожидает подтверждения от ${partner.name}`, true);
        return;
      }
    }

    if(l[key]) delete l[key]; else l[key]=true;
    // Хаптика
    if (hapticsEnabled) {
      if (!wasLogged) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});
      }
    }
    // Вечернее напоминание — если есть невыполненные привычки
    const todayDow2 = (new Date().getDay()+6)%7;
    const pendingCount = (space?.habits||[])
      .filter((h:any)=>h.days?.includes(todayDow2) && !l[`${h.id}_${todayS()}_${myId}`]).length;
    scheduleEveningReminder(pendingCount, notifEnabled).catch(()=>{});
    // Показываем modal для заметки если включено и это отметка (не снятие)
    if (!wasLogged) {
      const habit = (space?.habits||[]).find((h:any)=>h.id===hid);
      if (habit?.noteEnabled) {
        setNoteText('');
        setNoteModal({habitId:hid, date:todayS()});
      }
      // Фото добавляется явно через кнопку на карточке — не автоматически
    }
    // Хаптика: короткий импульс при отметке, двойной при снятии
    // Оптимистичное обновление — сразу обновляем UI без ожидания Firestore
    setSpace(prev => prev ? { ...prev, logs: l } : prev);
    // Кэш для офлайн режима
    Storage.set('offline_logs_' + (space?.id||''), l).catch(()=>{});
    try {
      saveL(l).catch(e => console.warn('[toggle saveL]', e)); // fire and forget
      // Отправляем FCM push партнёру если отметили (не сняли) привычку
      if (!wasLogged) {
        const partner = space?.members?.find(m => m && m.id !== myId);
        if (partner && space?.id && myId !== 'guest') {
          const habit = space?.habits?.find(h => h.id === hid);
          if (habit) {
            sendPartnerNotification({
              spaceId: space.id,
              toUid: partner.id,
              fromName: myName,
              habitName: habit.name,
              habitId: hid,
              lang,
            }).catch(() => {});
          }
        }
      }
      // Обновляем badge и серию
      const currentHabit = space?.habits?.find(h=>h.id===hid);
      if (currentHabit) {
        const streak = calcStreak(hid, myId, l, currentHabit.days);
        const hasP = (space?.members?.length ?? 0) > 1;
        if (streak >= 2) scheduleStreakReminder(streak, hasP, notifEnabled).catch(()=>{});
      }
      // Badge = кол-во невыполненных привычек сегодня
      const dow2 = todayDow();
      const todayHabits = (space?.habits||[]).filter(h=>h.days?.includes(dow2));
      const doneCnt = todayHabits.filter(h=>isLogged(h.id,myId,l)).length;
      const remaining = Math.max(0, todayHabits.length - doneCnt);
      _setBadgeCount(remaining).catch(()=>{});
      // Проверяем новые достижения — totalDoneNow объявляется ЗДЕСЬ, до использования
      const totalDoneNow = Object.keys(l).filter(k=>k.includes(`_${myId}`)).length;
      // Запросить отзыв после 5 и 25 выполнений
      if (totalDoneNow === 5 || totalDoneNow === 25) {
        setTimeout(() => {
          Linking.openURL('rustore://review?packageName=com.attach4.pathtogether').catch(()=>{});
        }, 2000);
      }
      const achs = buildAchievements({
        habitCount: space?.habits?.length ?? 0,
        totalDone: totalDoneNow,
        maxStreak: maxStreak,
        friendCount: (space?.members?.length ?? 1) > 1 ? 1 : 0,
        partnerTotalDone: undefined,
      });
      achs.filter(a => a.done && !prevAchIds.current.has(a.id)).forEach(a => {
        prevAchIds.current.add(a.id);
        notifyAchievement(isEn ? a.label_en : a.label_ru, lang).catch(()=>{});
      });
    }
    catch(e) { console.warn('[toggle]', e); } // silent fail - UI already updated
  };

  const submitHabit = async () => {
    if(!nh.name.trim()){toast$(isEn?'Enter a name!':'Введите название!',false);return;}
    // Время устанавливается через пикер — валидация формата не нужна
    if(!nh.days?.length){toast$(isEn?'Select at least one day':'Выберите хотя бы один день',false);return;}
    if(loading){return;} // защита от двойного нажатия
    setLoading(true);
    try {
      const cs=await ensureSpace();
      const isEdit=!!editH;
      // Формируем объект привычки
      const habitId = editH ? editH.id : mkid();
      const existingHabit = editH ? (cs.habits||[]).find(h=>h.id===editH.id) : null;
      const newHabit: Habit = existingHabit
        ? {...existingHabit, ...nh}
        : {...nh, id:habitId, ownerId:myId, ownerName:myName, createdAt:todayS(), order:(cs.habits||[]).length};
      // Используем upsertHabit (точечный setDoc) вместо setHabits (batch delete+write).
      // setHabits после join мог удалять привычки партнёра если подписки ещё не загрузились,
      // что приводило к откату оптимистичного обновления сразу после сохранения.
      if (myId !== 'guest') {
        await Storage.upsertHabit(cs.id, newHabit);
      } else {
        // Для гостя — полный список в AsyncStorage
        const h = isEdit
          ? (cs.habits||[]).map(x=>x.id===habitId?newHabit:x)
          : [...(cs.habits||[]), newHabit];
        await Storage.set('guest_habits_'+cs.id, h);
      }
      // Планируем уведомления для актуального списка привычек
      const allHabits = isEdit
        ? (cs.habits||[]).map(x=>x.id===habitId?newHabit:x)
        : [...(cs.habits||[]), newHabit];
      scheduleHabitTimeNotifications(
        allHabits,
        (cs.members?.length ?? 0) > 1,
        notifEnabled,
        lang,
      ).catch(()=>{});
      // Оптимистичное обновление: применяем сразу, не ждём Firestore listener
      setSpace(prev => {
        if (!prev) return {id:cs.id,habits:allHabits,logs:{},members:[]};
        const updated = isEdit
          ? prev.habits.map(x=>x.id===habitId?newHabit:x)
          : [...prev.habits.filter(x=>x.id!==habitId), newHabit];
        return {...prev, habits:updated};
      });
      toast$(isEdit?(isEn?'Saved ':'Сохранено '):(isEn?'Added ':'Добавлено '));
      setNh(blank);setEditH(null);setReminderTimePicker(null);
      // Используем animateScreenChange чтобы opacity вернулся в 1
      animateScreenChange('today');
    } catch (e: any) {
      console.error('[submitHabit] error:', e?.message || e);
      toast$(isEn?'Error saving habit':'Ошибка при сохранении',false);
    } finally {
      setLoading(false);
    }
  };

  const delHabit = async (id:string) => {
    const h=(space?.habits||[]).filter(x=>x.id!==id);
    const l={...(space?.logs||{})};
    Object.keys(l).filter(k=>k.startsWith(id+'_')).forEach(k=>delete l[k]);
    await saveH(h); await saveL(l);
    setSpace(prev => prev ? { ...prev, habits: h, logs: l } : prev);
    toast$(isEn?'Deleted':'Удалено');
    setDetailH(null);animateScreenChange('today');
  };

  const genInvite = async (silent = false) => {
    // Гостям нужна регистрация для приглашений
    if (isGuest()) {
      if (!silent) Alert.alert(
        lang === 'en' ? 'Create an account' : 'Создайте аккаунт',
        lang === 'en'
          ? 'To invite a partner you need to register. It only takes a minute!'
          : 'Чтобы пригласить партнёра, нужно зарегистрироваться. Это займёт минуту!',
        [
          { text: lang === 'en' ? 'Later' : 'Позже', style: 'cancel' },
          { text: lang === 'en' ? 'Register' : 'Зарегистрироваться', onPress: () => setScreen('auth') },
        ]
      );
      return '';
    }
    // Проверяем подписку перед созданием инвайта
    if (!canInvite(subscription)) {
      if (!silent) setScreen('paywall');
      return '';
    }
    // Проверяем лимит: уже достигнут максимум участников
    if (!canAddMember(subscription, members.length)) {
      Alert.alert(
        (lang === 'en' ? 'Member limit reached' : 'Достигнут лимит участников'),
        isEn
          ? `Your ${PLAN_LIMITS[subscription.plan].label_en} plan allows up to ${PLAN_LIMITS[subscription.plan].maxMembers} member(s).`
          : `Тариф «${PLAN_LIMITS[subscription.plan].label_ru}» позволяет до ${PLAN_LIMITS[subscription.plan].maxMembers} участника(ов).`,
        [
          { text: (lang === 'en' ? 'Cancel' : 'Отмена'), style: 'cancel' },
          { text: (lang === 'en' ? 'Upgrade' : 'Улучшить'), onPress: () => setScreen('paywall') },
        ]
      );
      return '';
    }
    try {
      const s=await ensureSpace();
      const code=await secureCode();
      // Лимит участников хоста сохраняем прямо в инвайт: присоединяющийся
      // не может прочитать users/{host} (запрещено правилами Firestore),
      // поэтому лимит должен быть доступен из самого документа инвайта.
      const hostMax = PLAN_LIMITS[subscription.plan]?.maxMembers ?? 1;
      await Storage.setInvite(code,{spaceId:s.id,spaceName:'PathTogether',creatorId:myId,hostPlan:subscription.plan,hostMax});
      // QR и ссылка должны открываться ЛЮБОЙ камерой → universal https-ссылка,
      // которая редиректит в приложение (или в стор). Кастомную схему
      // pathtogether:// большинство камер игнорируют, поэтому QR раньше "не сканировался".
      // Хост attachment4.github.io/PathTogether/invite.html уже зарегистрирован в intentFilters.
      const link=`https://attachment4.github.io/PathTogether/invite.html?code=${code}`;
      setInvLink(link); return link;
    } catch {
      toast$(isEn?'Could not create invite':'Не удалось создать инвайт',false);
      return '';
    }
  };

  const doJoin = async (code:string) => {
    if (!myId || myId === 'guest') {
      toast$(isEn ? 'Please sign in first' : 'Сначала войдите в аккаунт', false);
      return;
    }
    // Показываем лоадер сразу
    setLoading(true);
    setPendInv(null); // закрываем модал сразу, чтобы не висел поверх лоадера
    try {
      const inv = await Storage.getInvite(code);
      if (!inv) {
        toast$(isEn ? 'Invalid link' : 'Ссылка недействительна', false);
        return;
      }
      if ((inv as any).expiresAt && (inv as any).expiresAt < Date.now()) {
        toast$(isEn ? 'Invite link has expired' : 'Ссылка приглашения истекла', false);
        return;
      }
      // Проверяем реальное членство, а не stale spaceId в стейте/кеше.
      // Кикнутый пользователь может иметь space.id === inv.spaceId (кеш не чистится при кике),
      // но его нет в space.members — в этом случае нужно разрешить повторное вступление.
      const isActuallyMember = (space?.members ?? []).some(m => m && m.id === myId);
      if (space?.id === inv.spaceId && isActuallyMember) {
        toast$(isEn ? 'You are already in this space' : 'Вы уже в этом пространстве', false);
        return;
      }

      const membersRef = doc(db, 'spaces', inv.spaceId, 'data', 'members');
      const hostMax = typeof (inv as any).hostMax === 'number' ? (inv as any).hostMax : 99;

      await runTransaction(db, async tx => {
        const membSnap = await tx.get(membersRef);
        const cur: Member[] = membSnap.exists() ? (membSnap.data().v || []) : [];
        if (cur.find(m => m.id === myId)) return; // уже участник
        if (cur.length >= hostMax) throw new Error('LIMIT_REACHED');
        const updated = [...cur, { id: myId, name: myName, role: 'member' as const, joined: todayS() }];
        tx.set(membersRef, {
          v: updated,
          memberIds: updated.map(m => m.id),
          ownerIds:  updated.filter(m => m.role === 'owner').map(m => m.id),
        });
      });

      // Выходим из старого пространства
      if (space?.id && space.id !== inv.spaceId) {
        const oldMembers = (space.members || []).filter(m => m.id !== myId);
        Storage.setMembers(space.id, oldMembers).catch(() => {});
      }

      await Storage.saveCurrentSpace(inv.spaceId, myId);
      // Удаляем инвайт после использования — предотвращает повторное вступление
      Storage.deleteInvite(code).catch(() => {});

      // Сначала сбрасываем стейт чисто, только потом подключаем подписки
      // Это предотвращает крэш от одновременных setSpace из нескольких подписок
      setSpace({ id: inv.spaceId, habits: [], logs: {}, members: [] });
      await new Promise(r => setTimeout(r, 50)); // даём React смыть рендер
      startSubs(inv.spaceId);

      // Загружаем данные пространства чтобы показать онбординг партнёра
      try {
        const [partnerHabits, partnerMembers] = await Promise.all([
          Storage.getHabits(inv.spaceId),
          Storage.getMembers(inv.spaceId),
        ]);
        const owner = (partnerMembers || []).find((m: Member) => m && m.id !== myId);
        setPartnerWelcome({
          partnerName: owner?.name || (isEn ? 'Partner' : 'Партнёр'),
          habitCount: (partnerHabits || []).length,
        });
      } catch {
        // Фолбэк — просто навигируем
        animateScreenChange('friends');
      }

    } catch (e: any) {
      if (e?.message === 'LIMIT_REACHED') {
        toast$(isEn
          ? 'Space is full — host needs to upgrade their plan'
          : 'Пространство заполнено — хосту нужно улучшить тариф', false);
      } else {
        console.warn('[doJoin]', e);
        toast$(isEn ? 'Error joining space' : 'Ошибка при входе', false);
      }
    } finally {
      setLoading(false);
    }
  };

  const members=space?.members||[];
  const habits =space?.habits ||[];
  const logs   =space?.logs   ||{};



  const l7     =getLast7Days();
  const maxStreak=useMemo(()=>
    habits.length>0?Math.max(0,...habits.map(h=>calcStreak(h.id,myId,logs,h.days))):0,
    [habits,logs,myId]
  );

  // FIX 1: сплэш пока Firebase не ответил
  if (!fontsLoaded||!themeLoaded||!authChecked) return (
    <View style={{flex:1,backgroundColor:theme==='dark'?'#0a0a0a':'#f2f2f2',
      alignItems:'center',justifyContent:'center',gap:20}}>
      {/* Логотип */}
      <View style={{alignItems:'center',gap:16}}>
        <View style={{width:72,height:72,borderRadius:22,
          backgroundColor:theme==='dark'?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.06)',
          alignItems:'center',justifyContent:'center',
          borderWidth:1,borderColor:theme==='dark'?'rgba(255,255,255,0.12)':'rgba(0,0,0,0.08)'}}>
          <Svg width={36} height={36} viewBox="0 0 24 24" fill="none">
            <Path d="M12 2L8 7H4l2 5-3 4h5l4 6 4-6h5l-3-4 2-5h-4L12 2z"
              stroke={theme==='dark'?'#fff':'#000'} strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round"/>
          </Svg>
        </View>
        <View style={{alignItems:'center',gap:4}}>
          <Text style={{fontSize:22,fontWeight:'800',
            color:theme==='dark'?'#fff':'#000',letterSpacing:-0.5}}>
            PathTogether
          </Text>
          <Text style={{fontSize:12,color:theme==='dark'?'rgba(255,255,255,0.4)':'rgba(0,0,0,0.4)',
            letterSpacing:0.5}}>
            Build habits together
          </Text>
        </View>
      </View>
      <ActivityIndicator color={theme==='dark'?'rgba(255,255,255,0.4)':'rgba(0,0,0,0.3)'} size="small"/>
    </View>
  );

  // ── Онбординг партнёра — показывается после присоединения к чужому пространству ──
  if (partnerWelcome) return (
    <View style={{ flex: 1, backgroundColor: tk.bg, paddingTop: TOP,
      paddingHorizontal: 28, paddingBottom: 40, justifyContent: 'space-between' }}>
      <View style={{ flex: 1, justifyContent: 'center', gap: 28 }}>
        {/* Иллюстрация */}
        <View style={{ alignItems: 'center', gap: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 0 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32,
              backgroundColor: tk.text2, alignItems: 'center', justifyContent: 'center',
              borderWidth: 2, borderColor: tk.bg }}>
              <Text style={{ fontSize: 24, color: tk.bg, fontWeight: '700' }}>
                {partnerWelcome.partnerName[0]?.toUpperCase() || '?'}
              </Text>
            </View>
            <View style={{ width: 32, height: 2, backgroundColor: tk.border }} />
            <Text style={{ fontSize: 24 }}>🤝</Text>
            <View style={{ width: 32, height: 2, backgroundColor: tk.border }} />
            <View style={{ width: 64, height: 64, borderRadius: 32,
              backgroundColor: tk.text, alignItems: 'center', justifyContent: 'center',
              borderWidth: 2, borderColor: tk.bg }}>
              <Text style={{ fontSize: 24, color: tk.bg, fontWeight: '700' }}>
                {myName[0]?.toUpperCase() || 'Я'}
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 28, fontWeight: '500', color: tk.text,
            textAlign: 'center', letterSpacing: -0.5, lineHeight: 34 }}>
            {'Привет!\nТы в команде с '}
            <Text style={{ color: tk.accent }}>{partnerWelcome.partnerName}</Text>
          </Text>
        </View>

        {/* Факты о пространстве */}
        <View style={{ gap: 10 }}>
          {[
            { e: '📋', t: `${partnerWelcome.habitCount} ${partnerWelcome.habitCount === 1 ? 'привычка' : partnerWelcome.habitCount < 5 ? 'привычки' : 'привычек'} уже создано`, s: 'Добавь свои или выполняй общие' },
            { e: '👁', t: 'Видите прогресс друг друга', s: 'В реальном времени на главном экране' },
            { e: '🔥', t: 'Совместная серия начинается', s: 'Выполняйте привычки каждый день вместе' },
            { e: '💬', t: 'Реакции одним нажатием', s: 'Прямо из уведомления — 👍 ❤️ 🔥' },
          ].map(({ e, t, s }) => (
            <View key={t} style={{ flexDirection: 'row', gap: 14,
              backgroundColor: tk.bg2, borderRadius: 16,
              borderWidth: 1, borderColor: tk.border,
              paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 22 }}>{e}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: tk.text }}>{t}</Text>
                <Text style={{ fontSize: 11, color: tk.text3, marginTop: 2 }}>{s}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity
        onPress={() => { setPartnerWelcome(null); animateScreenChange('today'); }}
        activeOpacity={0.85}
        style={{ backgroundColor: tk.text, borderRadius: 16, paddingVertical: 16,
          alignItems: 'center', marginTop: 24 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: tk.bg }}>
          {isEn ? "Let's go!" : 'Погнали вместе!'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Десктоп-обёртка: сайдбар + центрированная колонка с max-width (как в Notion).
  // На мобиле/нативе возвращает контент как есть.
  const wrapDesk = (node: React.ReactNode, opts?: { sidebar?: boolean; maxW?: number }) => {
    if (!isDesktop) return node;
    const noSidebar = screen === 'onboarding' || screen === 'auth';
    const { sidebar = !noSidebar, maxW = 760 } = opts || {};
    return (
      <View style={{ flex: 1, paddingLeft: sidebar ? SIDEBAR_W : 0, backgroundColor: tk.bg }}>
        {sidebar && <SideNav screen={screen} onPress={s=>s==='add'?setScreen('addHabit'):animateScreenChange(s as Screen)} tk={tk} lang={lang} theme={theme} guest={isGuest()} onAuth={()=>setScreen('auth')}/>}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <View style={{ flex: 1, width: '100%', maxWidth: maxW }}>{node}</View>
        </View>
      </View>
    );
  };

  if (screen==='onboarding') return wrapDesk(
    <OnboardingScreen tk={tk} lang={lang} onDone={async(starterHabits)=>{
      await Storage.saveOnboarding();
      const {currentUser}=auth;
      if(currentUser){
        try {
          // ensureSpace создаёт space если его ещё нет (новый пользователь)
          const s = await ensureSpace();
          // Создаём стартовые привычки если выбраны
          if(starterHabits && starterHabits.length>0){
            const habits=starterHabits.map((h,i)=>({
              ...h,
              id:mkid(),
              ownerId:currentUser.uid,
              ownerName:myName||currentUser.displayName||'User',
              createdAt:todayS(),
              order:i,
              desc:'',
            }));
            await Storage.setHabits(s.id, habits);
          }
        } catch(e) { console.warn('[onDone]', e); }
        setScreen('today');
      } else setScreen('auth');
    }}
    onInvite={() => {
      // После онбординга сразу ведём на экран инвайта
      setScreen('today');
      // Небольшая задержка чтобы today успел отрендериться
      setTimeout(() => animateScreenChange('invite'), 300);
    }}
    />
  );

  if (screen==='auth') return (
    <View style={{flex:1,paddingTop:TOP,backgroundColor:tk.bg}}>
      <AuthScreen tk={tk} lang={lang} desktop={isDesktop} onGuest={handleGuest} onSuccess={async(uid,name,isNew)=>{
        isRegistering.current = true;
        try {
          setupNotificationChannel().catch(()=>{});
          // Запрашиваем разрешение — без него push не работает
          requestPermissions().then(granted => {
            if (granted) registerDeviceToken(uid).catch(()=>{});
          }).catch(()=>{});
          setMyId(uid);
          setMyName(name);
          await Storage.saveName(name);
          initPurchases(uid).catch(()=>{});
          if (isNew) {
            // Новый пользователь — очищаем весь локальный кеш пространства (per-user и legacy)
            await Storage.clearSpaceId(uid);
            await Storage.set(`onboarding_${uid}`, null);
            setSpace(null);
            saveRegisteredAt(uid).catch(()=>{});
            Keyboard.dismiss();
            setScreen('onboarding');
            return;
          }
          // Существующий пользователь — загружаем только его данные из Firestore
          const session = await Storage.loadUserSession(uid);
          if (!session.onbDone) { setScreen('onboarding'); return; }
          if (session.spaceId) {
            setSpace({ id: session.spaceId, habits: [], logs: {}, members: [] });
            startSubs(session.spaceId, uid);
          }
          Keyboard.dismiss();
          setScreen('today');
          loadSubscription(uid).then(sub => {
            setSubscription(sub);
            subscriptionLoaded.current = true;
          }).catch(() => { subscriptionLoaded.current = true; });
        } finally {
          isRegistering.current = false;
        }
      }}/>
    </View>
  );

  // PRO icons — минималистичные SVG без эмодзи
  const ProIcon = ({ type, color }: { type: string; color: string }) => {
    const s = { stroke: color, strokeWidth: '1.6', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
    if (type === 'infinity') return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path d="M12 12c-2-2.5-4-4-6-4a4 4 0 0 0 0 8c2 0 4-1.5 6-4z" {...s}/>
        <Path d="M12 12c2 2.5 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.5-6 4z" {...s}/>
      </Svg>
    );
    if (type === 'chart') return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path d="M3 3v18h18" {...s}/>
        <Path d="M7 16l4-4 4 4 4-6" {...s}/>
      </Svg>
    );
    if (type === 'people') return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Circle cx="9" cy="7" r="3" {...s}/>
        <Path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" {...s}/>
        <Path d="M16 3.13a4 4 0 0 1 0 7.75" {...s}/>
        <Path d="M21 21v-2a4 4 0 0 0-3-3.87" {...s}/>
      </Svg>
    );
    if (type === 'bell') return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" {...s}/>
        <Path d="M13.73 21a2 2 0 0 1-3.46 0" {...s}/>
      </Svg>
    );
    if (type === 'palette') return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path d="M12 2C6.48 2 2 6.48 2 12c0 2.76 1.12 5.26 2.93 7.07C6.73 20.87 9.24 22 12 22c1.1 0 2-.9 2-2v-.5c0-.28.22-.5.5-.5H16a6 6 0 0 0 6-6c0-5.52-4.48-10-10-10z" {...s}/>
        <Circle cx="6.5" cy="11.5" r="1.5" fill={color}/>
        <Circle cx="9.5" cy="7.5" r="1.5" fill={color}/>
        <Circle cx="14.5" cy="7.5" r="1.5" fill={color}/>
        <Circle cx="17.5" cy="11.5" r="1.5" fill={color}/>
      </Svg>
    );
    return null;
  };

  if (screen==='pro') return wrapDesk(
    <View style={{flex:1,backgroundColor:tk.bg}}>
      {/* Назад — стрелка как на других экранах */}
      <View style={{flexDirection:'row',alignItems:'center',paddingHorizontal:20,paddingTop:TOP,paddingBottom:4}}>
        <TouchableOpacity onPress={()=>setScreen('profile')}
          style={{width:36,height:36,borderRadius:10,backgroundColor:tk.bg2,
            borderWidth:1,borderColor:tk.border,alignItems:'center',justifyContent:'center'}}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M19 12H5M5 12l7 7M5 12l7-7"
              stroke={tk.text2} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </Svg>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{padding:20,paddingTop:0,paddingBottom:100}}>
        <View style={{alignItems:'center',marginBottom:32}}>
          <Text style={{fontSize:28,fontWeight:'700',color:tk.text,marginBottom:8}}>PathTogether PRO</Text>
          <Text style={{fontSize:15,color:tk.text3,textAlign:'center',lineHeight:22}}>
            {isEn?'Unlock the full experience':'Разблокируй полный опыт'}
          </Text>
        </View>
        {([
          {type:'infinity', title:isEn?'Unlimited habits':'Безлимитные привычки',    sub:isEn?'No limits on habit creation':'Создавай сколько угодно'},
          {type:'chart',    title:isEn?'Advanced stats':'Расширенная статистика',     sub:isEn?'Detailed charts and history':'Детальные графики и история'},
          {type:'people',   title:isEn?'Multiple partners':'Несколько партнёров',     sub:isEn?'Invite up to 5 people':'Пригласи до 5 человек'},
          {type:'bell',     title:isEn?'Smart reminders':'Умные напоминания',         sub:isEn?'AI-powered scheduling':'Расписание на основе AI'},
          {type:'palette',  title:isEn?'Custom themes':'Кастомные темы',             sub:isEn?'Exclusive color schemes':'Эксклюзивные цветовые схемы'},
        ] as {type:string;title:string;sub:string}[]).map((f,i)=>(
          <View key={i} style={{flexDirection:'row',alignItems:'center',gap:14,padding:16,
            backgroundColor:tk.bg2,borderRadius:16,marginBottom:10,
            borderWidth:1,borderColor:tk.border}}>
            <View style={{width:44,height:44,borderRadius:12,
              backgroundColor:tk.bg3,
              alignItems:'center',justifyContent:'center'}}>
              <ProIcon type={f.type} color={tk.text2}/>
            </View>
            <View style={{flex:1}}>
              <Text style={{fontSize:15,fontWeight:'600',color:tk.text}}>{f.title}</Text>
              <Text style={{fontSize:12,color:tk.text3,marginTop:2}}>{f.sub}</Text>
            </View>
          </View>
        ))}
        {subscription.plan === 'free' || !subscription.isActive ? (
          <>
            <TouchableOpacity
              onPress={()=>setScreen('paywall')}
              style={{backgroundColor:tk.bg==='#0a0a0a'?'#ffffff':'#111111',
                borderRadius:16,padding:18,alignItems:'center',marginTop:16}}>
              <Text style={{fontSize:17,fontWeight:'700',
                color:tk.bg==='#0a0a0a'?'#111111':'#ffffff'}}>
                {isEn?'Get PRO · 299₽/month':'Получить PRO · 299₽/мес'}
              </Text>
              <Text style={{fontSize:12,
                color:tk.bg==='#0a0a0a'?'rgba(0,0,0,0.5)':'rgba(255,255,255,0.5)',marginTop:4}}>
                {isEn?'Cancel anytime':'Отмена в любое время'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={{alignItems:'center',marginTop:14,paddingVertical:4}}>
              <Text style={{fontSize:11,color:tk.text3,textDecorationLine:'underline'}}>
                {isEn?'Restore purchase':'Восстановить покупку'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={{backgroundColor:tk.bg2,borderRadius:16,padding:18,
            alignItems:'center',marginTop:16,borderWidth:1,borderColor:tk.border}}>
            <Text style={{fontSize:15,fontWeight:'600',color:tk.text}}>
              {isEn?'PRO is active':'PRO активен'}
            </Text>
            <Text style={{fontSize:12,color:tk.text3,marginTop:4}}>
              {isEn?'Thank you for subscribing':'Спасибо за подписку'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );

  if (screen==='paywall') return wrapDesk(
    <PaywallScreen lang={lang} tk={tk} myId={myId}
      subscription={subscription}
      onPlanChange={sub => setSubscription(sub)}
      onBack={()=>setScreen('pro')}/>
  );

  if (screen==='settings') return wrapDesk(
    <SettingsScreen lang={lang} tk={tk} myId={myId}
      notifEnabled={notifEnabled} partnerNotifEnabled={partnerNotif}
      hasPartner={(space?.members?.length ?? 0) > 1}
      notifTimeMorning={notifTimeMorning} notifTimeEvening={notifTimeEvening}
      hapticsEnabled={hapticsEnabled}
      onHapticsToggle={async v=>{setHapticsEnabled(v);await Storage.set('haptics_enabled',v);}}
      autoTheme={autoTheme}
      onAutoTheme={async v=>{setAutoTheme(v);await Storage.saveTheme(v?'auto':(theme==='dark'?'dark':'light'));}}
      onNotifTimeMorning={async(t)=>{setNotifTimeMorning(t);await Storage.saveNotifTimeMorning(t);scheduleMorningMotivation((space?.members?.length??0)>1,notifEnabled,t).catch(()=>{});}}
      onNotifTimeEvening={async(t)=>{setNotifTimeEvening(t);await Storage.saveNotifTimeEvening(t);scheduleAppReminder((space?.members?.length??0)>1,notifEnabled,t).catch(()=>{});}}
      habits={habits}
      onNotifToggle={async(v)=>{
        setNotifEnabled(v);
        await Storage.set('notif_enabled',v);
        const hasP = (space?.members?.length ?? 0) > 1;
        const habits2 = space?.habits || [];
        scheduleHabitNotifications(habits2, hasP, v, lang).catch(()=>{});
        scheduleAppReminder(hasP, v, notifTimeEvening).catch(()=>{});
        scheduleMorningMotivation(hasP, v, notifTimeMorning).catch(()=>{});
      }}
      onPartnerNotifToggle={async(v)=>{setPartnerNotif(v);await Storage.set('partner_notif',v);}}
      onBack={()=>animateScreenChange(navOrigin.current.settings||'profile','back')}
      onAddWidget={async()=>{
        const { pinHabitsWidget } = require('./src/widget/pinWidget');
        const ok = await pinHabitsWidget();
        if (!ok) {
          Alert.alert(
            isEn ? 'Add widget' : 'Добавить виджет',
            isEn
              ? 'Long-press the home screen → Widgets → PathTogether, then drag it out.'
              : 'Зажмите палец на главном экране → Виджеты → PathTogether, затем перетащите на экран.'
          );
        }
      }}
      onDeleteAccount={async()=>{ if(isGuest()){setMyId('');setMyName('');setScreen('auth');return;} const uid=myId;stopSubs();sessionEstablished.current=false;await auth.signOut();setSpace(null);setMyId('');setMyName('');setScreen('auth');}}/>
  );

  if (screen==='mood') {
    const moodPartner = members.find(m => m && m.id !== myId);
    return wrapDesk(
      <MoodScreen myId={myId} lang={lang} tk={tk}
        partnerId={moodPartner?.id}
        partnerName={moodPartner?.name}
        spaceId={space?.id}
        onBack={() => animateScreenChange(navOrigin.current.mood||'profile', 'back')} />
    );
  }

  if (screen==='stats') return wrapDesk(
    <View style={{flex:1,paddingTop:TOP,backgroundColor:tk.bg}}>
      <StatisticsScreen
        myId={myId} myName={myName} lang={lang} tk={tk}
        habits={habits}
        logs={logs}
        members={members}
        maxStreak={maxStreak}
        totalDone={Object.keys(logs).filter(k=>k.includes(`_${myId}`)).length}
        plan={subscription.plan}
        statsTab={statsTab}
        onStatsTabChange={setStatsTab}
        onBack={()=>animateScreenChange(navOrigin.current.stats||'profile','back')}/>
    </View>
  );

  if (screen==='achievements') return wrapDesk(
    <View style={{flex:1,paddingTop:TOP,backgroundColor:tk.bg}}>
      <AchievementsScreen lang={lang} tk={tk} habitCount={habits.length}
        totalDone={Object.keys(logs).filter(k=>k.includes(`_${myId}`)).length}
        maxStreak={maxStreak}
        partnerTotalDone={members.length>1?Object.keys(logs).filter(k=>k.includes(`_${members.find(m=>m&&m.id!==myId)?.id||''}`)).length:undefined}
        friendCount={members.length>1?1:0} onBack={()=>animateScreenChange(navOrigin.current.achievements||'profile','back')}/>
    </View>
  );

  if (screen==='profile') return wrapDesk(
    <View style={{flex:1,paddingTop:isDesktop?0:TOP,backgroundColor:tk.bg}}
      {...(isDesktop ? {} : tabSwipePan.panHandlers)}>
      <ProfileScreen myId={myId} myName={myName} lang={lang} tk={tk} theme={theme}
        subscription={subscription}
        habitCount={habits.length} friendCount={members.length>1?1:0}
        totalDone={Object.keys(logs).filter(k=>k.includes(`_${myId}`)).length}
        maxStreak={maxStreak}
        partnerName={members.find(m=>m&&m.id!==myId)?.name}
        partnerJoined={members.find(m=>m&&m.id!==myId)?.joined}
        partnerStreak={members.length>1?Math.max(0,...habits.map(h=>calcStreak(h.id,members.find(m=>m&&m.id!==myId)?.id||'',logs,h.days))):undefined}
        selectedAvatar={selectedAvatar}
        onAvatarChange={async(id)=>{setSelectedAvatar(id);await Storage.set(`avatar_${myId}`,id);}}
        onOpenAchievements={()=>animateScreenChange('achievements','forward')}
        onOpenMood={()=>animateScreenChange('mood','forward')}
        onOpenSettings={()=>animateScreenChange('settings','forward')}
        onOpenPro={()=>animateScreenChange('paywall','forward')}
        onOpenStats={()=>animateScreenChange('stats','forward')}
        onBack={()=>animateScreenChange('calendar')}
        onToggleTheme={async()=>{const n=theme==='dark'?'light':'dark';await Storage.saveTheme(n);setTheme(n);}}
        onLanguageChange={async l=>{setLang(l);await Storage.saveLanguage(l);}}
        onNameChange={async name=>{
          setMyName(name);
          // Обновляем имя в members пространства — партнёр увидит новое имя
          if (space?.id && myId && myId !== 'guest') {
            try {
              const updatedMembers = (space.members || []).map(m =>
                m.id === myId ? { ...m, name } : m
              );
              await Storage.setMembers(space.id, updatedMembers);
              setSpace(prev => prev ? { ...prev, members: updatedMembers } : prev);
            } catch (e) { console.warn('[onNameChange] members update', e); }
          }
        }}
        onLogout={async()=>{
          if (isGuest()) { setMyId(''); setMyName(''); setScreen('auth'); return; }
          const uid=myId;
          stopSubs();
          sessionEstablished.current = false; // сбрасываем — реальный выход
          await auth.signOut();
          await Storage.clearSpaceId(uid);
          await Storage.set(`onboarding_${uid}`, null);
          setSpace(null); setMyId(''); setMyName(''); setScreen('auth');}}/>
      {toast&&<Toast msg={toast.msg} ok={toast.ok} tk={tk}/>}

      {/* Cover View — перекрывает старый экран при переходе */}
      {coverVisible && (
        <Animated.View pointerEvents="none" style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: tk.bg, opacity: coverOpacity, zIndex: 999,
        }}/>
      )}
      {!isDesktop && TAB_SCREENS.includes(screen) && <BottomNav screen={screen} onPress={s=>s==='add'?setScreen('addHabit'):animateScreenChange(s as Screen)} tk={tk} lang={lang} theme={theme}
      friendsBadge={members.length>1 ? members.filter(m=>m&&m.id!==myId).filter(m=>{
        const dow=todayDow();
        const todayH=(space?.habits||[]).filter(h=>h.days?.includes(dow));
        return todayH.some(h=>isLogged(h.id,m.id,logs));
      }).length : 0}/>}
    </View>
  );

  if (screen==='addHabit') return wrapDesk(
    <View style={{flex:1,paddingTop:TOP,backgroundColor:tk.bg}}>
      <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{flex:1}}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{padding:20,paddingBottom:60}} keyboardShouldPersistTaps="handled">
          <View style={{flexDirection:'row',alignItems:'center',gap:12,marginBottom:28}}>
            <TouchableOpacity onPress={()=>{
              const backTarget = editH ? 'detail' : 'today';
              if(nh.name.trim()) {
                const {Alert: A} = require('react-native');
                A.alert(
                  isEn?'Discard changes?':'Отменить изменения?',
                  isEn?'You have unsaved changes':'У вас есть несохранённые изменения',
                  [
                    {text:isEn?'Keep editing':'Продолжить редактирование',style:'cancel'},
                    {text:isEn?'Discard':'Отменить',style:'destructive',onPress:()=>{animateScreenChange(backTarget,'back');setEditH(null);setNh(blank);setShowTimePicker(false);setReminderTimePicker(null);}},
                  ]
                );
              } else {
                animateScreenChange(backTarget,'back');setEditH(null);setNh(blank);setShowTimePicker(false);setReminderTimePicker(null);
              }
            }}
              style={{width:36,height:36,borderRadius:10,backgroundColor:tk.bg2,borderWidth:1,borderColor:tk.border,alignItems:'center',justifyContent:'center'}}>
              <Text style={{color:tk.text,fontSize:16}}>←</Text>
            </TouchableOpacity>
            <Text style={{fontSize:20,fontWeight:'500',color:tk.text,letterSpacing:-0.3,flex:1}}>
              {editH?(isEn?'Edit habit':'Редактировать'):(isEn?'New habit':'Новая привычка')}
            </Text>
          </View>
          {/* Быстрые шаблоны — только если имя ещё не введено */}
          {!nh.name && !editH && (
            <View style={{marginBottom:16}}>
              <Text style={{fontSize:9,color:tk.text3,letterSpacing:1.5,
                textTransform:'uppercase',marginBottom:8}}>{isEn?'Quick start':'Быстрый старт'}</Text>
              {/* Паки по категориям */}
              {[
                {
                  pack: isEn?'Morning':'Утро',
                  items: isEn
                    ? [{n:'Morning run',i:'exercise',d:[0,1,2,3,4],r:'morning'},{n:'Meditation',i:'meditate',d:[0,1,2,3,4,5,6],r:'morning'},{n:'Cold shower',d:[0,1,2,3,4,5,6],r:'morning'},{n:'Journal',d:[0,1,2,3,4,5,6],r:'morning'}]
                    : [{n:'Утренняя пробежка',i:'exercise',d:[0,1,2,3,4],r:'morning'},{n:'Медитация',i:'meditate',d:[0,1,2,3,4,5,6],r:'morning'},{n:'Холодный душ',d:[0,1,2,3,4,5,6],r:'morning'},{n:'Дневник',d:[0,1,2,3,4,5,6],r:'morning'}]
                },
                {
                  pack: isEn?'Day':'День',
                  items: isEn
                    ? [{n:'Drink water',i:'water',d:[0,1,2,3,4,5,6],t:8,u:'glasses',r:'afternoon'},{n:'Read 20 min',i:'read',d:[0,1,2,3,4,5,6],r:'afternoon'},{n:'No social media',i:'nosocial',d:[0,1,2,3,4],r:'afternoon'},{n:'Walk 30 min',i:'walk',d:[0,1,2,3,4,5,6],r:'afternoon'}]
                    : [{n:'Пить воду',i:'water',d:[0,1,2,3,4,5,6],t:8,u:'стаканов',r:'afternoon'},{n:'Читать 20 минут',i:'read',d:[0,1,2,3,4,5,6],r:'afternoon'},{n:'Без соцсетей',i:'nosocial',d:[0,1,2,3,4],r:'afternoon'},{n:'Прогулка 30 мин',i:'walk',d:[0,1,2,3,4,5,6],r:'afternoon'}]
                },
                {
                  pack: isEn?'Evening':'Вечер',
                  items: isEn
                    ? [{n:'Evening walk',i:'walk',d:[0,1,2,3,4,5,6],r:'evening'},{n:'No phone before bed',d:[0,1,2,3,4,5,6],r:'evening',type:'quit'},{n:'Gratitude',d:[0,1,2,3,4,5,6],r:'evening'},{n:'Sleep by 23:00',d:[0,1,2,3,4,5,6],r:'evening'}]
                    : [{n:'Вечерняя прогулка',i:'walk',d:[0,1,2,3,4,5,6],r:'evening'},{n:'Без телефона перед сном',d:[0,1,2,3,4,5,6],r:'evening',type:'quit'},{n:'Благодарность',d:[0,1,2,3,4,5,6],r:'evening'},{n:'Сон до 23:00',d:[0,1,2,3,4,5,6],r:'evening'}]
                },
              ].map(({pack,items})=>(
                <View key={pack} style={{marginBottom:10}}>
                  <Text style={{fontSize:11,color:tk.text3,marginBottom:6,fontWeight:'600'}}>{pack}</Text>
                  <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>
                    {items.map((tpl:any)=>(
                      <TouchableOpacity key={tpl.n} onPress={()=>setNh((p:any)=>({...p,
                        name:tpl.n,days:tpl.d,target:tpl.t||0,unit:tpl.u||'',
                        icon:tpl.i||'',routine:tpl.r,type:tpl.type||'good'}))}
                        style={{backgroundColor:tk.bg2,borderWidth:1,borderColor:tk.border,
                          borderRadius:18,paddingHorizontal:10,paddingVertical:5}}>
                        <Text style={{fontSize:11,color:tk.text2}}>{tpl.n}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
          <Text style={{fontSize:10,color:tk.text3,letterSpacing:1,textTransform:'uppercase',fontWeight:'400',marginBottom:8}}>{isEn?'Name':'Название'}</Text>
          <TextInput value={nh.name} onChangeText={v=>setNh(p=>({...p,name:v}))}
            placeholder={isEn?'Morning run':'Утренняя пробежка'} placeholderTextColor={tk.text3}
            style={{backgroundColor:tk.bg2,borderWidth:1,borderColor:tk.border,borderRadius:12,padding:13,fontSize:13,color:tk.text,marginBottom:20}}/>

          {/* ── Тип привычки: Только я / Совместная ── */}
          {(space?.members||[]).length > 1 && (
            <View style={{marginBottom:20}}>
              <Text style={{fontSize:10,color:tk.text3,letterSpacing:1,
                textTransform:'uppercase',fontWeight:'400',marginBottom:10}}>
                {isEn?'Who tracks it?':'Кто отслеживает?'}
              </Text>
              <View style={{flexDirection:'row',gap:8}}>
                {/* Только я */}
                <TouchableOpacity
                  onPress={()=>setNh((p:any)=>({...p,isShared:false}))}
                  activeOpacity={0.75}
                  style={{flex:1,borderRadius:14,borderWidth:1.5,padding:14,
                    alignItems:'center',gap:6,
                    borderColor:!(nh as any).isShared?tk.text:tk.border,
                    backgroundColor:!(nh as any).isShared?tk.bg3:tk.bg2}}>
                  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                    <Circle cx="12" cy="8" r="4" stroke={!(nh as any).isShared?tk.text:tk.text3} strokeWidth="1.7"/>
                    <Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"
                      stroke={!(nh as any).isShared?tk.text:tk.text3} strokeWidth="1.7" strokeLinecap="round"/>
                  </Svg>
                  <Text style={{fontSize:13,fontWeight:'600',
                    color:!(nh as any).isShared?tk.text:tk.text3}}>
                    {isEn?'Just me':'Только я'}
                  </Text>
                  <Text style={{fontSize:10,color:tk.text3,textAlign:'center'}}>
                    {isEn?'My personal habit':'Моя личная привычка'}
                  </Text>
                </TouchableOpacity>

                {/* Совместная */}
                <TouchableOpacity
                  onPress={()=>setNh((p:any)=>({...p,isShared:true}))}
                  activeOpacity={0.75}
                  style={{flex:1,borderRadius:14,borderWidth:1.5,padding:14,
                    alignItems:'center',gap:6,
                    borderColor:(nh as any).isShared?tk.text:tk.border,
                    backgroundColor:(nh as any).isShared?tk.bg3:tk.bg2}}>
                  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                    <Circle cx="9" cy="8" r="3.5" stroke={(nh as any).isShared?tk.text:tk.text3} strokeWidth="1.7"/>
                    <Path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"
                      stroke={(nh as any).isShared?tk.text:tk.text3} strokeWidth="1.7" strokeLinecap="round"/>
                    <Circle cx="17" cy="8" r="3" stroke={(nh as any).isShared?tk.text2:tk.text3} strokeWidth="1.5"/>
                    <Path d="M17 14c2 .5 4 2.5 4 6"
                      stroke={(nh as any).isShared?tk.text2:tk.text3} strokeWidth="1.5" strokeLinecap="round"/>
                  </Svg>
                  <Text style={{fontSize:13,fontWeight:'600',
                    color:(nh as any).isShared?tk.text:tk.text3}}>
                    {isEn?'Together':'Вместе'}
                  </Text>
                  <Text style={{fontSize:10,color:tk.text3,textAlign:'center'}}>
                    {isEn?'Both track this habit':'Оба отслеживают'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Доп опции — только в режиме "вместе" */}
              {(nh as any).isShared && (
                <View style={{marginTop:8,gap:6}}>
                  {([
                    {key:'requirePartnerConfirm', label:isEn?'Partner must confirm':'Партнёр должен подтвердить', sub:isEn?'They see a confirm button on the habit':'Партнёр увидит кнопку подтверждения'},
                  ] as {key:string;label:string;sub:string}[]).map(opt=>{
                    const isOn=!!(nh as any)[opt.key];
                    return (
                      <TouchableOpacity key={opt.key}
                        onPress={()=>setNh((p:any)=>({...p,[opt.key]:!p[opt.key]}))}
                        style={{flexDirection:'row',alignItems:'center',gap:10,
                          paddingVertical:10,paddingHorizontal:12,borderRadius:12,
                          borderWidth:1,borderColor:isOn?tk.text2:tk.border,
                          backgroundColor:isOn?tk.bg3:tk.bg2}}>
                        <View style={{width:20,height:20,borderRadius:5,borderWidth:1.5,
                          borderColor:isOn?tk.accent:tk.text3,
                          backgroundColor:isOn?tk.accent:'transparent',
                          alignItems:'center',justifyContent:'center'}}>
                          {isOn&&<Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                            <Path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
                          </Svg>}
                        </View>
                        <View style={{flex:1}}>
                          <Text style={{fontSize:13,color:isOn?tk.text:tk.text2}}>{opt.label}</Text>
                          <Text style={{fontSize:10,color:tk.text3,marginTop:1}}>{opt.sub}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* Категория */}
          {/* Тип привычки */}
          <Text style={{fontSize:10,color:tk.text3,letterSpacing:1,textTransform:'uppercase',fontWeight:'400',marginBottom:12,marginTop:4}}>
            {isEn?'Habit type':'Тип привычки'}
          </Text>
          <View style={{flexDirection:'row',gap:10,marginBottom:20}}>
            {([
              {t:'good', color:'#8cb8a0', ru:'Полезная',   en:'Build habit',   sub_ru:'Отмечай каждый день',        sub_en:'Check off daily',
               path:'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z'},
              {t:'quit', color:'#c8a0a0', ru:'Избавиться', en:'Quit habit',    sub_ru:'Считает дни без срывов',      sub_en:'Counts days without',
               path:'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 13H7v-2h10v2z'},
            ] as any[]).map(({t,color,ru,en,sub_ru,sub_en,path})=>{
              const sel = (nh as any).type===t;
              return (
                <TouchableOpacity key={t} onPress={()=>setNh((p:any)=>({...p,type:t}))}
                  style={{flex:1,padding:14,borderRadius:16,borderWidth:1.5,alignItems:'center',gap:6,
                    borderColor:sel?color:tk.border,
                    backgroundColor:sel?(color+'18'):tk.bg2}}>
                  <View style={{width:40,height:40,borderRadius:12,
                    backgroundColor:sel?(color+'22'):tk.bg3,
                    alignItems:'center',justifyContent:'center'}}>
                    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                      <Path d={path} stroke={sel?color:tk.text3} strokeWidth="1.5"
                        strokeLinecap="round" strokeLinejoin="round"/>
                    </Svg>
                  </View>
                  <Text style={{fontSize:12,fontWeight:'500',color:sel?color:tk.text3}}>
                    {isEn?en:ru}
                  </Text>
                  <Text style={{fontSize:10,color:tk.text3,textAlign:'center',lineHeight:13}}>
                    {isEn?sub_en:sub_ru}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>


          {/* Рутина */}
          <Text style={{fontSize:10,color:tk.text3,letterSpacing:1,textTransform:'uppercase',fontWeight:'400',marginBottom:12}}>
            {isEn?'Routine':'Рутина'}
          </Text>
          <View style={{flexDirection:'row',gap:8,marginBottom:20}}>
            {([
              [undefined, isEn?'Any time':'Любое время', ''],
              ['morning',  isEn?'Morning':'Утро',  ''],
              ['afternoon',isEn?'Afternoon':'День',''],
              ['evening',  isEn?'Evening':'Вечер', ''],
            ] as [string|undefined,string,string][]).map(([val,label,emoji])=>{
              const sel=(nh as any).routine===val;
              return (
                <TouchableOpacity key={String(val)} onPress={()=>setNh((p:any)=>({...p,routine:val}))}
                  style={{flex:1,padding:10,borderRadius:14,borderWidth:1.5,alignItems:'center',gap:4,
                    borderColor:sel?tk.text:tk.border,
                    backgroundColor:sel?tk.bg3:tk.bg2}}>
                  {emoji?<Text style={{fontSize:16}}>{emoji}</Text>:null}
                  <Text style={{fontSize:11,fontWeight:'600',color:sel?tk.text:tk.text3}}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Заметки при выполнении */}
          <TouchableOpacity onPress={()=>setNh((p:any)=>({...p,noteEnabled:!(p as any).noteEnabled}))}
            style={{flexDirection:'row',alignItems:'center',gap:12,marginBottom:20,
              paddingVertical:12,paddingHorizontal:14,borderRadius:14,
              borderWidth:1,borderColor:(nh as any).noteEnabled?tk.text2:tk.border,
              backgroundColor:tk.bg2}}>
            <View style={{width:20,height:20,borderRadius:5,borderWidth:1.5,
              borderColor:(nh as any).noteEnabled?tk.accent:tk.text3,
              backgroundColor:(nh as any).noteEnabled?tk.accent:'transparent',
              alignItems:'center',justifyContent:'center',flexShrink:0}}>
              {(nh as any).noteEnabled&&(
                <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
                  <Path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
                </Svg>
              )}
            </View>
            <View style={{flex:1}}>
              <Text style={{fontSize:14,fontWeight:'400',color:tk.text}}>
                {isEn?'Ask for a note on completion':'Запрашивать заметку при выполнении'}
              </Text>
              <Text style={{fontSize:11,color:tk.text3,marginTop:2}}>
                {isEn?'A text field appears after each check-in':'После каждой отметки появится поле для текста'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Таймер */}
          <Text style={{fontSize:10,color:tk.text3,letterSpacing:1,textTransform:'uppercase',fontWeight:'400',marginBottom:4}}>
            {isEn?'Timer (optional)':'Таймер (необязательно)'}
          </Text>
          <Text style={{fontSize:11,color:tk.text3,marginBottom:10}}>
            {isEn?'Countdown starts when you open the habit':'Обратный отсчёт запустится при открытии привычки'}
          </Text>
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:20}}>
            {([[0,'—'],[300,'5 мин'],[600,'10 мин'],[900,'15 мин'],[1200,'20 мин'],[1800,'30 мин']] as [number,string][]).map(([sec,label])=>(
              <TouchableOpacity key={sec} onPress={()=>setNh((p:any)=>({...p,timerSeconds:sec}))}
                style={{paddingHorizontal:12,paddingVertical:8,borderRadius:10,borderWidth:1,
                  borderColor:(nh as any).timerSeconds===sec?tk.text:tk.border,
                  backgroundColor:(nh as any).timerSeconds===sec?tk.bg3:tk.bg2}}>
                <Text style={{fontSize:12,color:(nh as any).timerSeconds===sec?tk.text:tk.text3}}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={{fontSize:10,color:tk.text3,letterSpacing:1,textTransform:'uppercase',fontWeight:'400',marginBottom:8,marginTop:4}}>
            {isEn?'Category':'Категория'}
          </Text>
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:20}}>
            {[
              {id:'health',ru:'Здоровье',en:'Health'},
              {id:'sport',ru:'Спорт',en:'Sport'},
              {id:'mind',ru:'Развитие',en:'Mind'},
              {id:'work',ru:'Работа',en:'Work'},
              {id:'social',ru:'Общение',en:'Social'},
              {id:'habit',ru:'Другое',en:'Other'},
            ].map((cat:any)=>{
              const sel=(nh as any).category===cat.id||(!((nh as any).category)&&cat.id==='habit');
              return (
                <TouchableOpacity key={cat.id}
                  onPress={()=>setNh((p:any)=>({...p,category:cat.id}))}
                  style={{paddingHorizontal:14,paddingVertical:8,borderRadius:20,
                    backgroundColor:sel?tk.text:tk.bg2,
                    borderWidth:1,borderColor:sel?'transparent':tk.border}}>
                  <Text style={{fontSize:12,color:sel?tk.bg:tk.text2,fontWeight:sel?'600':'400'}}>
                    {isEn?cat.en:cat.ru}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={{fontSize:10,color:tk.text3,letterSpacing:1,textTransform:'uppercase',fontWeight:'400',marginBottom:10}}>{isEn?'Color':'Цвет карточки'}</Text>
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:10,marginBottom:20}}>
            {/* Пастельные */}
            <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:8}}>
              {['#f5cdc8','#f5d9b0','#f5e8a0','#c8e8c8','#a8cce8','#c8b8e8','#f0b8d4','#a8d8d0',
                '#b8e0b8','#e8d8a8','#a8c8e8','#f0c8a8',
              ].map(c=>(
                <TouchableOpacity key={c} onPress={()=>setNh((p:any)=>({...p,color:c}))}
                  style={{width:38,height:38,borderRadius:19,backgroundColor:c,
                    borderWidth:(nh as any).color===c?3:0,borderColor:tk.text,
                    shadowColor:c,shadowOpacity:(nh as any).color===c?0.5:0,shadowRadius:6,elevation:(nh as any).color===c?3:0}}/>
              ))}
            </View>
            {/* Насыщенные */}
            <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
              {['#e8756a','#e89d5a','#d4b84a','#6abf7a','#5a9fd4','#8b6abf','#d46a9d','#5ab8b0',
                '#2d3748','#4a5568','#744210','#1a365d',
              ].map(c=>(
                <TouchableOpacity key={c} onPress={()=>setNh((p:any)=>({...p,color:c}))}
                  style={{width:38,height:38,borderRadius:19,backgroundColor:c,
                    borderWidth:(nh as any).color===c?3:0,borderColor:tk.text,
                    shadowColor:c,shadowOpacity:(nh as any).color===c?0.5:0,shadowRadius:6,elevation:(nh as any).color===c?3:0}}/>
              ))}
            </View>
          </View>
          <Text style={{fontSize:10,color:tk.text3,letterSpacing:1,textTransform:'uppercase',fontWeight:'400',marginBottom:8}}>
            {isEn?'Time':'Время'} <Text style={{textTransform:'none',fontSize:9,color:tk.text3}}>({isEn?'optional':'необязательно'})</Text>
          </Text>
          <TouchableOpacity onPress={()=>setShowTimePicker(true)}
            style={{backgroundColor:tk.bg2,borderWidth:1,borderColor:tk.border,borderRadius:12,
              padding:13,marginBottom:20,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
            <Text style={{fontSize:14,color:nh.time?tk.text:tk.text3}}>
              {nh.time || (isEn?'Not set':'Не задано')}
            </Text>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Circle cx="12" cy="12" r="9" stroke={tk.text3} strokeWidth="1.5"/>
              <Path d="M12 7v5l3 3" stroke={tk.text3} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </Svg>
          </TouchableOpacity>
          {showTimePicker && (
            <TimePicker
              value={nh.time}
              onChange={t=>setNh(p=>({...p,time:t}))}
              onClose={()=>setShowTimePicker(false)}
              tk={tk}
            />
          )}

          {/* Интервальные напоминания */}
          <Text style={{fontSize:10,color:tk.text3,letterSpacing:1,textTransform:'uppercase',fontWeight:'400',marginBottom:10}}>
            {isEn?'Repeat reminder':'Повторять напоминание'}
          </Text>
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:6,marginBottom:8}}>
            {([0,1,2,3,4,6] as number[]).map(h=>(
              <TouchableOpacity key={h} onPress={()=>setNh((p:any)=>({...p,reminderInterval:h}))}
                style={{paddingHorizontal:12,paddingVertical:7,borderRadius:10,
                  borderWidth:1.5,
                  borderColor:(nh as any).reminderInterval===h?tk.text:tk.border,
                  backgroundColor:(nh as any).reminderInterval===h?tk.text:tk.bg2}}>
                <Text style={{fontSize:12,fontWeight:'500',
                  color:(nh as any).reminderInterval===h?tk.bg:tk.text3}}>
                  {h===0?(isEn?'Off':'Выкл'):isEn?`Every ${h}h`:`Каждые ${h}ч`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {(nh as any).reminderInterval > 0 && (
            <View style={{marginBottom:20}}>
              <View style={{flexDirection:'row',gap:10,alignItems:'center',marginBottom:8}}>
                <Text style={{fontSize:12,color:tk.text3}}>{isEn?'From':'С'}</Text>
                <TouchableOpacity
                  onPress={()=>setReminderTimePicker('from')}
                  style={{flex:1,backgroundColor:tk.bg2,borderWidth:1,
                    borderColor:reminderTimePicker==='from'?tk.text:tk.border,
                    borderRadius:10,padding:10,alignItems:'center'}}>
                  <Text style={{fontSize:13,color:tk.text}}>{(nh as any).reminderFrom||'08:00'}</Text>
                </TouchableOpacity>
                <Text style={{fontSize:12,color:tk.text3}}>{isEn?'to':'до'}</Text>
                <TouchableOpacity
                  onPress={()=>setReminderTimePicker('to')}
                  style={{flex:1,backgroundColor:tk.bg2,borderWidth:1,
                    borderColor:reminderTimePicker==='to'?tk.text:tk.border,
                    borderRadius:10,padding:10,alignItems:'center'}}>
                  <Text style={{fontSize:13,color:tk.text}}>{(nh as any).reminderTo||'22:00'}</Text>
                </TouchableOpacity>
              </View>
              {/* Инлайн-сетка часов */}
              {reminderTimePicker && (
                <View style={{backgroundColor:tk.bg2,borderRadius:14,borderWidth:1,
                  borderColor:tk.border,padding:10}}>
                  <Text style={{fontSize:10,color:tk.text3,marginBottom:8,letterSpacing:1,textTransform:'uppercase'}}>
                    {reminderTimePicker==='from'?(isEn?'Start time':'Начало'):(isEn?'End time':'Конец')}
                  </Text>
                  <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>
                    {Array.from({length:24},(_,h)=>`${String(h).padStart(2,'0')}:00`).map(t=>{
                      const cur = reminderTimePicker==='from'
                        ? (nh as any).reminderFrom||'08:00'
                        : (nh as any).reminderTo||'22:00';
                      const active = cur===t;
                      return (
                        <TouchableOpacity key={t}
                          onPress={()=>{
                            setNh((p:any)=>({...p,
                              [reminderTimePicker==='from'?'reminderFrom':'reminderTo']:t}));
                            setReminderTimePicker(null);
                          }}
                          style={{paddingHorizontal:10,paddingVertical:6,borderRadius:8,
                            borderWidth:1,
                            borderColor:active?tk.text:tk.border,
                            backgroundColor:active?tk.text:tk.bg}}>
                          <Text style={{fontSize:12,color:active?tk.bg:tk.text3,fontWeight:active?'600':'400'}}>{t}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <TouchableOpacity onPress={()=>setReminderTimePicker(null)}
                    style={{marginTop:10,alignItems:'center'}}>
                    <Text style={{fontSize:12,color:tk.text3}}>{isEn?'Close':'Закрыть'}</Text>
                  </TouchableOpacity>
                </View>
              )}
              {/* Быстрые пресеты */}
              {!reminderTimePicker && (
                <View style={{flexDirection:'row',gap:6}}>
                  {[['08:00','22:00'],['09:00','21:00'],['06:00','23:00']].map(([f,t])=>(
                    <TouchableOpacity key={f}
                      onPress={()=>setNh((p:any)=>({...p,reminderFrom:f,reminderTo:t}))}
                      style={{paddingHorizontal:10,paddingVertical:5,borderRadius:8,
                        borderWidth:1,borderColor:tk.border,backgroundColor:tk.bg2}}>
                      <Text style={{fontSize:10,color:tk.text3}}>{f.slice(0,5)}–{t.slice(0,5)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
          {(nh as any).reminderInterval === 0 && <View style={{marginBottom:20}}/>}

          <Text style={{fontSize:10,color:tk.text3,letterSpacing:1,textTransform:'uppercase',fontWeight:'400',marginBottom:8}}>
            {isEn?'Description':'Описание'} <Text style={{textTransform:'none',fontSize:9,color:tk.text3}}>({isEn?'optional':'необязательно'})</Text>
          </Text>
          <TextInput value={nh.desc||''} onChangeText={v=>setNh(p=>({...p,desc:v}))}
            placeholder={isEn?'E.g. Run 5km every morning':'Например: Бежать 5км каждое утро'} placeholderTextColor={tk.text3}
            multiline numberOfLines={3}
            style={{backgroundColor:tk.bg2,borderWidth:1,borderColor:tk.border,borderRadius:12,padding:13,fontSize:13,color:tk.text,marginBottom:20,minHeight:80,textAlignVertical:'top'}}/>
          {/* Цель в день */}
          <Text style={{fontSize:10,color:tk.text3,letterSpacing:1,textTransform:'uppercase',fontWeight:'400',marginBottom:8}}>
            {isEn?'Daily goal':'Цель в день'} <Text style={{textTransform:'none',fontSize:9,color:tk.text3}}>({isEn?'optional':'необязательно'})</Text>
          </Text>
          <View style={{flexDirection:'row',gap:10,marginBottom:20}}>
            <TextInput value={(nh as any).target?String((nh as any).target):''}
              onChangeText={v=>setNh((p:any)=>({...p,target:parseInt(v)||0}))}
              keyboardType="numeric" placeholder="0" placeholderTextColor={tk.text3}
              style={{flex:1,backgroundColor:tk.bg2,borderWidth:1,borderColor:tk.border,
                borderRadius:12,padding:13,color:tk.text,fontSize:13}}/>
            <TextInput value={(nh as any).unit||''}
              onChangeText={v=>setNh((p:any)=>({...p,unit:v}))}
              placeholder={isEn?'glasses, km...':'стаканов, км...'} placeholderTextColor={tk.text3}
              style={{flex:2,backgroundColor:tk.bg2,borderWidth:1,borderColor:tk.border,
                borderRadius:12,padding:13,color:tk.text,fontSize:13}}/>
          </View>

          <Text style={{fontSize:10,color:tk.text3,letterSpacing:1,textTransform:'uppercase',fontWeight:'400',marginBottom:10}}>{isEn?'Days':'Дни'}</Text>
          <View style={{flexDirection:'row',gap:5,marginBottom:28}}>
            {(isEn?WD_EN:WD_RU).map((d,i)=>(
              <TouchableOpacity key={i} onPress={()=>setNh(p=>({...p,days:p.days?.includes(i)?p.days.filter(x=>x!==i):[...(p.days||[]),i]}))}
                style={{flex:1,height:34,borderRadius:9,backgroundColor:nh.days?.includes(i)?tk.text:tk.bg2,borderWidth:1,borderColor:nh.days?.includes(i)?'transparent':tk.border,alignItems:'center',justifyContent:'center'}}>
                <Text style={{fontSize:10,fontWeight:'600',color:nh.days?.includes(i)?tk.bg:tk.text3}}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={submitHabit} activeOpacity={0.8}
            style={{backgroundColor:tk.text,borderRadius:14,padding:14,alignItems:'center',
                shadowColor: tk.glowColor,
                shadowOpacity: tk.glowOpacity,
                shadowRadius: tk.glowRadius,
                shadowOffset: { width: 0, height: 0 },
                elevation: 0,
              }}>
            <Text style={{color:tk.bg,fontSize:14,fontWeight:'500'}}>
              {editH?(isEn?'Save':'Сохранить'):(isEn?'Add habit':'Добавить привычку')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      {toast&&<Toast msg={toast.msg} ok={toast.ok} tk={tk}/>}
    </View>
  );

  //  INVITE 
  if (screen==='invite') {
    return wrapDesk(
    <View style={{flex:1,paddingTop:TOP,backgroundColor:tk.bg}}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{padding:20,paddingBottom:60}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:12,marginBottom:28}}>
          <TouchableOpacity onPress={()=>setScreen(prevInviteScreen.current)}
            hitSlop={{top:14,bottom:14,left:20,right:20}}
            style={{padding:4}}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M19 12H5M5 12l7 7M5 12l7-7"
                stroke={tk.text2} strokeWidth="1.7"
                strokeLinecap="round" strokeLinejoin="round"/>
            </Svg>
          </TouchableOpacity>
          <Text style={{fontSize:18,fontWeight:'600',color:tk.text}}>{isEn?'Invite friend':'Пригласить друга'}</Text>
        </View>
        <Text style={{fontSize:13,color:tk.text3,lineHeight:20,marginBottom:24}}>
          {isEn?'Share the link — your friend opens the app and joins':'Поделитесь ссылкой — друг откроет приложение и присоединится'}
        </Text>

        {/* FIX 3: реальный QR-код через SVG */}
        <View style={{backgroundColor:tk.bg2,borderWidth:1,borderColor:tk.border,borderRadius:16,padding:24,alignItems:'center',gap:14,marginBottom:16}}>
          <Text style={{fontSize:9,color:tk.text3,letterSpacing:1.5,textTransform:'uppercase'}}>QR-КОД</Text>
          <View style={{borderRadius:12,overflow:'hidden',padding:10,backgroundColor:'#ffffff'}}>
            <QRCode value={invLink} size={160} fg="#000000" bg="#ffffff"/>
          </View>
          <Text style={{fontSize:11,color:tk.text3,textAlign:'center'}}>
            {invLink
              ? (isEn?'Scan with camera to join':'Наведи камеру для входа')
              : (isEn?'Press "Share" to generate QR':'Нажми «Поделиться» для генерации QR')}
          </Text>
        </View>

        <Text style={{fontSize:10,color:tk.text3,letterSpacing:1,textTransform:'uppercase',fontWeight:'400',marginBottom:8}}>{isEn?'Or link':'Или ссылка'}</Text>
        <View style={{backgroundColor:tk.bg2,borderWidth:1,borderColor:tk.border,borderRadius:12,padding:13,flexDirection:'row',alignItems:'center',gap:8,marginBottom:16}}>
          <Text style={{fontSize:11,color:tk.text3,flex:1}} numberOfLines={1}>
            {invLink||(isEn?'Tap Share to generate...':'Нажми Поделиться...')}
          </Text>
          {!!invLink&&(
            <TouchableOpacity onPress={async()=>{await Clipboard.setStringAsync(invLink);toast$(isEn?'Copied ':'Скопировано ');}}
              style={{backgroundColor:tk.bg3,borderRadius:8,paddingHorizontal:10,paddingVertical:4}}>
              <Text style={{fontSize:11,color:tk.text2}}>{isEn?'Copy':'Копировать'}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{flexDirection:'row',gap:10}}>
          <TouchableOpacity onPress={async()=>{
            if(!invLink) return;
            try {
              const msgRu = `Привет! Давай вместе отслеживать привычки в PathTogether\n\nПросто открой ссылку:\n${invLink}`;
              const msgEn = `Hey! Let's track habits together in PathTogether\n\nOpen the link:\n${invLink}`;
              await Share.share({message: isEn ? msgEn : msgRu});
            }
            catch { await Clipboard.setStringAsync(invLink); toast$(isEn?'Link copied ':'Ссылка скопирована '); }
          }} style={{flex:3,backgroundColor:tk.text,borderRadius:14,padding:14,alignItems:'center',
                  shadowColor: tk.glowColor,
                  shadowOpacity: tk.glowOpacity,
                  shadowRadius: tk.glowRadius,
                  shadowOffset: { width: 0, height: 0 },
                  elevation: 0,
                  opacity: invLink ? 1 : 0.4,
                }}>
            <Text style={{color:tk.bg,fontSize:14,fontWeight:'500'}}>{isEn?'Share':'Поделиться'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={async()=>{ await genInvite(); }}
            style={{flex:2,backgroundColor:tk.bg2,borderRadius:14,padding:14,alignItems:'center',
              borderWidth:1,borderColor:tk.border}}>
            <Text style={{color:tk.text2,fontSize:13,fontWeight:'500'}}>{isEn?'New QR':'Новый QR'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      {!isOnline&&<View style={{position:'absolute',top:TOP,left:0,right:0,backgroundColor:'#e53e3e',paddingHorizontal:16,paddingVertical:8,flexDirection:'row',alignItems:'center',justifyContent:'center',zIndex:999}}><Text style={{color:'#fff',fontSize:12,fontWeight:'600'}}>{isEn?'No internet connection':'Нет подключения к интернету'}</Text></View>}
      {toast&&<Toast msg={toast.msg} ok={toast.ok} tk={tk}/>}
    </View>
    );
  }
  if (screen==='detail'&&detailH) {
    const h=detailH;
    const own=h.ownerId===myId;
    const myStreak=calcStreak(h.id,myId,logs,h.days);
    return (
      <View style={{flex:1,paddingTop:isDesktop?0:TOP,paddingLeft:isDesktop?SIDEBAR_W:0,backgroundColor:tk.bg}}>
        {isDesktop && <SideNav screen={screen} onPress={s=>s==='add'?setScreen('addHabit'):animateScreenChange(s as Screen)} tk={tk} lang={lang} theme={theme} guest={isGuest()} onAuth={()=>setScreen('auth')}/>}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{padding:isDesktop?32:20,paddingBottom:60,...(isDesktop?{maxWidth:780,width:'100%',alignSelf:'center'}:{})}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:12,marginBottom:24}}>
            <TouchableOpacity onPress={()=>{setDetailH(null);setDetailNotes({});animateScreenChange('today','back');}}
              style={{width:36,height:36,borderRadius:10,backgroundColor:tk.bg2,borderWidth:1,borderColor:tk.border,alignItems:'center',justifyContent:'center'}}>
              <Text style={{color:tk.text,fontSize:16}}>←</Text>
            </TouchableOpacity>
            <Text style={{fontSize:20,fontWeight:'500',color:tk.text,letterSpacing:-0.3,flex:1}}>{isEn?'Details':'Подробности'}</Text>
            {own&&(<TouchableOpacity onPress={()=>{setEditH(h);setNh({name:h.name,icon:h.icon,color:h.color,days:h.days||[0,1,2,3,4,5,6],time:h.time||'',desc:h.desc||'',target:h.target||0,unit:h.unit||'',category:h.category||'habit',type:h.type||'good',timerSeconds:h.timerSeconds||0,routine:h.routine,noteEnabled:h.noteEnabled||false,isShared:h.isShared||false,reminderInterval:h.reminderInterval||0,reminderFrom:h.reminderFrom||'08:00',reminderTo:h.reminderTo||'22:00',requirePartnerConfirm:h.requirePartnerConfirm||false});setDetailH(null);setShowTimePicker(false);setScreen('addHabit');}}
              style={{width:36,height:36,borderRadius:10,backgroundColor:tk.bg2,borderWidth:1,borderColor:tk.border,alignItems:'center',justifyContent:'center'}}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke={tk.text2} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                <Path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" stroke={tk.text2} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              </Svg>
            </TouchableOpacity>)}
          </View>
          <View style={{backgroundColor:tk.bg2,borderWidth:1,borderColor:tk.border,borderRadius:16,padding:20,alignItems:'center',gap:10,marginBottom:20}}>
            {(()=>{
              const isDefaultColor = !h.color || h.color==='#f5f5f5' || h.color==='#fafafa' || h.color==='#e8e8e8';
              const bgColor = isDefaultColor ? tk.bg3 : h.color;
              // Считаем контраст по реальному фону, а не по дефолтному светлому цвету
              const hx = bgColor.replace('#','');
              const r=parseInt(hx.substring(0,2),16)||0;
              const g=parseInt(hx.substring(2,4),16)||0;
              const b=parseInt(hx.substring(4,6),16)||0;
              const letterColor = (r*299+g*587+b*114)/1000 > 140 ? '#111111' : '#ffffff';
              return (
                <View style={{width:64,height:64,borderRadius:18,
                  backgroundColor:bgColor,alignItems:'center',justifyContent:'center'}}>
                  <Text style={{fontSize:26,fontWeight:'700',color:letterColor}}>
                    {h.name?.[0]?.toUpperCase()||'?'}
                  </Text>
                </View>
              );
            })()}
            <Text style={{fontSize:20,fontWeight:'500',color:tk.text,letterSpacing:-0.3}}>{h.name}</Text>
            {h.time?<Text style={{fontSize:12,color:tk.text3}}>{h.time}</Text>:null}
            {h.desc?<Text style={{fontSize:13,color:tk.text2,textAlign:'center',lineHeight:18,paddingHorizontal:8}}> {h.desc}</Text>:null}
          </View>
          {/* Статистика */}
          <View style={{flexDirection:'row',gap:10,marginBottom:16}}>
            <View style={{flex:1,backgroundColor:tk.bg2,borderWidth:1,borderColor:tk.border,borderRadius:14,padding:14,alignItems:'center'}}>
              <Text style={{fontSize:26,fontWeight:'700',color:tk.text}}>{myStreak}</Text>
              <Text style={{fontSize:10,color:tk.text3,marginTop:3,textTransform:'uppercase',letterSpacing:0.5}}>{isEn?'day streak':'дней серия'}</Text>
            </View>
            <View style={{flex:1,backgroundColor:tk.bg2,borderWidth:1,borderColor:tk.border,borderRadius:14,padding:14,alignItems:'center'}}>
              <Text style={{fontSize:26,fontWeight:'700',color:tk.text}}>
                {(()=>{const last30=Array.from({length:30},(_,i)=>{const d=new Date();d.setDate(d.getDate()-i);return d.toISOString().split('T')[0];});const doneD=last30.filter(d=>isLogged(h.id,myId,logs,d)).length;return Math.round(doneD/30*100)+'%';})()}
              </Text>
              <Text style={{fontSize:10,color:tk.text3,marginTop:3,textTransform:'uppercase',letterSpacing:0.5}}>{isEn?'30d rate':'за 30 дней'}</Text>
            </View>
            <View style={{flex:1,backgroundColor:tk.bg2,borderWidth:1,borderColor:tk.border,borderRadius:14,padding:14,alignItems:'center'}}>
              <Text style={{fontSize:26,fontWeight:'700',color:tk.text}}>
                {(()=>{const allLogs=Object.keys(logs).filter(k=>k.startsWith(h.id+'_')&&k.endsWith('_'+myId));return allLogs.length;})()}
              </Text>
              <Text style={{fontSize:10,color:tk.text3,marginTop:3,textTransform:'uppercase',letterSpacing:0.5}}>{isEn?'total':'всего'}</Text>
            </View>
          </View>
          {/* ── Таймер — только если задан timerSeconds ── */}
          {!!h.timerSeconds && h.timerSeconds > 0 && (
            <View style={{backgroundColor:tk.bg2,borderWidth:1,borderColor:tk.border,
              borderRadius:16,padding:20,marginBottom:16,alignItems:'center',gap:16}}>
              <Text style={{fontSize:10,color:tk.text3,letterSpacing:1,
                textTransform:'uppercase',fontWeight:'600'}}>
                {isEn?'Timer':'Таймер'}
              </Text>
              {/* Циферблат */}
              <Text style={{fontSize:52,fontWeight:'300',color:tk.text,letterSpacing:-2,
                fontVariant:['tabular-nums']}}>
                {(()=>{
                  const secs = timerActive ? timerLeft : h.timerSeconds;
                  const m = Math.floor(secs/60);
                  const s = secs%60;
                  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
                })()}
              </Text>
              {/* Прогресс бар */}
              {timerActive && (
                <View style={{width:'100%',height:3,backgroundColor:tk.border,borderRadius:2}}>
                  <View style={{height:3,borderRadius:2,backgroundColor:tk.text,
                    width:`${Math.round((timerLeft/h.timerSeconds)*100)}%` as any}}/>
                </View>
              )}
              {/* Кнопки */}
              <View style={{flexDirection:'row',gap:10,width:'100%'}}>
                {!timerActive ? (
                  <TouchableOpacity
                    onPress={()=>startTimer(h.timerSeconds!, h.name)}
                    style={{flex:1,backgroundColor:tk.text,borderRadius:12,padding:12,
                      alignItems:'center'}}>
                    <Text style={{color:tk.bg,fontSize:14,fontWeight:'600'}}>
                      {isEn?'▶  Start':'▶  Старт'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity
                      onPress={stopTimer}
                      style={{flex:1,backgroundColor:tk.bg3,borderRadius:12,padding:12,
                        alignItems:'center',borderWidth:1,borderColor:tk.border}}>
                      <Text style={{color:tk.text2,fontSize:14}}>
                        {isEn?'■  Stop':'■  Стоп'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={()=>startTimer(h.timerSeconds!, h.name)}
                      style={{flex:1,backgroundColor:tk.bg3,borderRadius:12,padding:12,
                        alignItems:'center',borderWidth:1,borderColor:tk.border}}>
                      <Text style={{color:tk.text2,fontSize:14}}>
                        {isEn?'↺  Reset':'↺  Сброс'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          )}

          {/* ── Статистика 30 дней — тепловая карта по неделям ── */}
          {(()=>{
            // Строим 35 ячеек (5 недель × 7 дней) с понедельника
            const today = new Date();
            // Начинаем с понедельника 5 недель назад
            const startDow = (today.getDay()+6)%7; // 0=пн
            const startDate = new Date(today);
            startDate.setDate(today.getDate() - startDow - 28); // назад 4 полных недели + текущая

            const cells: {ds:string; state:'done'|'miss'|'skip'|'future'; date:Date}[] = [];
            for(let i=0;i<35;i++){
              const dt=new Date(startDate); dt.setDate(startDate.getDate()+i);
              const ds2=dt.toISOString().split('T')[0];
              const dw=(dt.getDay()+6)%7;
              const isFuture = dt.setHours(0,0,0,0) > new Date().setHours(0,0,0,0);
              const scheduled = h.days?.includes(dw) && (!h.createdAt||ds2>=h.createdAt);
              if(isFuture) cells.push({ds:ds2,state:'future',date:dt});
              else if(!scheduled) cells.push({ds:ds2,state:'skip',date:dt});
              else if(logs[`${h.id}_${ds2}_${myId}`]) cells.push({ds:ds2,state:'done',date:dt});
              else cells.push({ds:ds2,state:'miss',date:dt});
            }

            const doneCount = cells.filter(c=>c.state==='done').length;
            const scheduledCount = cells.filter(c=>c.state==='done'||c.state==='miss').length;
            const rate = scheduledCount>0 ? Math.round(doneCount/scheduledCount*100) : 0;
            const WD = isEn?['M','T','W','T','F','S','S']:['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

            return (
              <View style={{marginBottom:20}}>
                <Text style={{fontSize:10,color:tk.text3,letterSpacing:1,
                  textTransform:'uppercase',fontWeight:'600',marginBottom:12}}>
                  {isEn?'Last 5 weeks':'Последние 5 недель'}
                </Text>

                {/* Заголовки дней */}
                <View style={{flexDirection:'row',marginBottom:4,paddingHorizontal:2}}>
                  <View style={{width:28}}/>{/* отступ под подписи недели */}
                  {WD.map((d,i)=>(
                    <Text key={i} style={{flex:1,textAlign:'center',fontSize:9,
                      color:tk.text3,fontWeight:'500'}}>{d}</Text>
                  ))}
                </View>

                {/* Сетка по неделям */}
                {Array.from({length:5},(_,week)=>{
                  const weekCells = cells.slice(week*7, week*7+7);
                  const weekDt = weekCells[0]?.date;
                  const monthLabel = weekDt
                    ? (isEn
                      ? weekDt.toLocaleDateString('en',{month:'short',day:'numeric'})
                      : `${weekDt.getDate()} ${['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'][weekDt.getMonth()]}`)
                    : '';
                  return (
                    <View key={week} style={{flexDirection:'row',alignItems:'center',marginBottom:4}}>
                      <Text style={{width:28,fontSize:8,color:tk.text3,textAlign:'right',paddingRight:4}}>
                        {monthLabel}
                      </Text>
                      {weekCells.map((c,di)=>{
                        const isToday = c.ds===todayS();
                        return (
                          <View key={di} style={{flex:1,margin:1.5,aspectRatio:1,borderRadius:5,
                            backgroundColor:
                              c.state==='done' ? tk.text :
                              c.state==='miss' ? 'rgba(239,68,68,0.22)' :
                              c.state==='future' ? 'transparent' : tk.bg2,
                            borderWidth: isToday ? 1.5 : (c.state==='skip'||c.state==='future') ? 0 : 0,
                            borderColor: isToday ? tk.text2 : 'transparent',
                            alignItems:'center',justifyContent:'center',
                          }}>
                            {c.state==='done'&&(
                              <Svg width={8} height={8} viewBox="0 0 24 24" fill="none">
                                <Path d="M5 13l4 4L19 7" stroke={tk.bg} strokeWidth="3"
                                  strokeLinecap="round" strokeLinejoin="round"/>
                              </Svg>
                            )}
                            {c.state==='miss'&&(
                              <View style={{width:3,height:3,borderRadius:2,
                                backgroundColor:'rgba(239,68,68,0.6)'}}/>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  );
                })}

                {/* Легенда + процент */}
                <View style={{flexDirection:'row',alignItems:'center',
                  justifyContent:'space-between',marginTop:10}}>
                  <View style={{flexDirection:'row',gap:14}}>
                    <View style={{flexDirection:'row',alignItems:'center',gap:5}}>
                      <View style={{width:10,height:10,borderRadius:3,backgroundColor:tk.text}}/>
                      <Text style={{fontSize:10,color:tk.text3}}>{isEn?'Done':'Выполнено'}</Text>
                    </View>
                    <View style={{flexDirection:'row',alignItems:'center',gap:5}}>
                      <View style={{width:10,height:10,borderRadius:3,backgroundColor:'rgba(239,68,68,0.22)'}}/>
                      <Text style={{fontSize:10,color:tk.text3}}>{isEn?'Missed':'Пропущено'}</Text>
                    </View>
                  </View>
                  <View style={{alignItems:'flex-end'}}>
                    <Text style={{fontSize:18,fontWeight:'700',color:
                      rate>=80?'#4ade80':rate>=50?tk.text2:'rgba(239,68,68,0.7)'}}>
                      {rate}%
                    </Text>
                    <Text style={{fontSize:9,color:tk.text3}}>
                      {doneCount}/{scheduledCount} {isEn?'days':'дней'}
                    </Text>
                  </View>
                </View>

                {/* 7-дневное сравнение участников */}
                {members.filter(Boolean).length > 1 && (
                  <View style={{marginTop:16}}>
                    <Text style={{fontSize:10,color:tk.text3,letterSpacing:1,
                      textTransform:'uppercase',fontWeight:'600',marginBottom:10}}>
                      {isEn?'Last 7 days · both':'7 дней · оба'}
                    </Text>
                    {members.filter(Boolean).map(m=>{
                      const week7 = l7;
                      const doneDays = week7.filter(d=>{
                        const dw=(new Date(d+'T12:00:00').getDay()+6)%7;
                        return h.days?.includes(dw) && isLogged(h.id,m.id,logs,d);
                      }).length;
                      const totalDays = week7.filter(d=>{
                        const dw=(new Date(d+'T12:00:00').getDay()+6)%7;
                        return h.days?.includes(dw);
                      }).length;
                      return (
                        <View key={m.id} style={{flexDirection:'row',alignItems:'center',
                          gap:10,marginBottom:8}}>
                          <View style={{width:28,height:28,borderRadius:14,
                            backgroundColor:m.id===myId?tk.text:tk.bg3,
                            borderWidth:1,borderColor:tk.border,
                            alignItems:'center',justifyContent:'center'}}>
                            <Text style={{fontSize:11,fontWeight:'700',
                              color:m.id===myId?tk.bg:tk.text2}}>
                              {(m.name||'?')[0]?.toUpperCase()}
                            </Text>
                          </View>
                          <View style={{flex:1}}>
                            <View style={{flexDirection:'row',gap:3,marginBottom:4}}>
                              {week7.map(d=>{
                                const dw=(new Date(d+'T12:00:00').getDay()+6)%7;
                                const act=h.days?.includes(dw);
                                const lg=isLogged(h.id,m.id,logs,d);
                                return (
                                  <View key={d} style={{flex:1,height:20,borderRadius:4,
                                    backgroundColor: lg
                                      ? (m.id===myId?tk.text:'rgba(255,255,255,0.45)')
                                      : act ? 'rgba(239,68,68,0.15)' : tk.bg2,
                                    borderWidth: act&&!lg ? 0 : 0,
                                    opacity: act ? 1 : 0.25,
                                  }}/>
                                );
                              })}
                            </View>
                          </View>
                          <Text style={{fontSize:12,fontWeight:'600',
                            color:tk.text2,width:32,textAlign:'right'}}>
                            {doneDays}/{totalDays}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })()}


          {own&&(
            <>
            {Object.keys(detailNotes).length > 0 && (
              <View style={{marginTop:8,marginBottom:4}}>
                <Text style={{fontSize:9,color:tk.text3,letterSpacing:1.5,
                  textTransform:'uppercase',marginBottom:10}}>
                  {isEn?'Notes':'Заметки'}
                </Text>
                {Object.entries(detailNotes)
                  .sort(([a],[b])=>b.localeCompare(a))
                  .slice(0,5)
                  .map(([date,note])=>{
                    const d=new Date(date+'T12:00:00');
                    const dateStr=isEn
                      ?d.toLocaleDateString('en',{month:'short',day:'numeric'})
                      :d.toLocaleDateString('ru',{month:'short',day:'numeric'});
                    return (
                      <View key={date} style={{flexDirection:'row',gap:10,
                        paddingVertical:10,borderBottomWidth:1,borderBottomColor:tk.border}}>
                        <Text style={{fontSize:11,color:tk.text3,width:42}}>{dateStr}</Text>
                        <Text style={{flex:1,fontSize:13,color:tk.text,lineHeight:18}}>{note}</Text>
                      </View>
                    );
                  })
                }
              </View>
            )}

            <View style={{marginTop:8}}>
              {/* Separator */}
              <View style={{height:1,backgroundColor:tk.border,marginBottom:0}}/>
              <TouchableOpacity onPress={()=>Alert.alert(isEn?'Delete habit?':'Удалить привычку?',isEn?'This cannot be undone.':'Это действие нельзя отменить.',[
                {text:isEn?'Cancel':'Отмена',style:'cancel'},
                {text:isEn?'Delete':'Удалить',style:'destructive',onPress:()=>delHabit(h.id)}
              ])} style={{paddingVertical:16,paddingHorizontal:4}}>
                <Text style={{color:'#e05555',fontSize:15}}>{isEn?'Delete habit':'Удалить привычку'}</Text>
              </TouchableOpacity>
            </View>
            </>
          )}
        </ScrollView>
        {toast&&<Toast msg={toast.msg} ok={toast.ok} tk={tk}/>}
      </View>
    );
  }

  if (screen==='add') return (
    <View style={{flex:1,paddingTop:TOP,backgroundColor:tk.bg}}>
      <View style={{padding:20}}>
        <Text style={{fontSize:9,color:tk.text3,letterSpacing:2,textTransform:'uppercase',marginBottom:16}}>{isEn?'Create':'Создать'}</Text>
      </View>
      <View style={{flex:1,padding:20,paddingTop:0,gap:12}}>
        <TouchableOpacity onPress={()=>{setEditH(null);setNh(blank);setShowTimePicker(false);setScreen('addHabit');}}
          style={{backgroundColor:tk.bg2,borderWidth:1,borderColor:tk.border,borderRadius:16,padding:22,alignItems:'center',gap:10}}>
          <View style={{width:56,height:56,borderRadius:28,backgroundColor:tk.text,alignItems:'center',justifyContent:'center'}}>
            <Text style={{fontSize:30,color:tk.bg,lineHeight:36,fontWeight:'300'}}>+</Text>
          </View>
          <Text style={{fontSize:15,fontWeight:'700',color:tk.text}}>{isEn?'New habit':'Новая привычка'}</Text>
          <Text style={{fontSize:12,color:tk.text3,textAlign:'center'}}>{isEn?'Track your daily goals':'Отслеживай ежедневные цели'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={()=>{prevInviteScreen.current='add';setScreen('invite');}}
          style={{backgroundColor:tk.bg2,borderWidth:1,borderColor:tk.border,borderRadius:16,padding:22,alignItems:'center',gap:10}}>
          <View style={{width:56,height:56,borderRadius:28,
            backgroundColor:tk.bg3,
            alignItems:'center',justifyContent:'center'}}>
            <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
              <Path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
                stroke={tk.text2} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              <Path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
                stroke={tk.text2} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
            </Svg>
          </View>
          <Text style={{fontSize:15,fontWeight:'700',color:tk.text}}>{isEn?'Invite partner':'Пригласить партнёра'}</Text>
          <Text style={{fontSize:12,color:tk.text3,textAlign:'center'}}>{isEn?'Track habits together':'Отслеживайте привычки вместе'}</Text>
        </TouchableOpacity>
      </View>
      <BottomNav screen={screen} onPress={setScreen} tk={tk} lang={lang} theme={theme}/>
    </View>
  );

  const mainScreen=(()=>{
    if (screen==='friends') return (
      <FriendsScreen myId={myId} myName={myName} lang={lang} tk={tk} habits={habits} members={members} logs={logs}
        subscription={subscription} onOpenPaywall={()=>setScreen('paywall')}
        invLink={invLink} onCreateLink={genInvite}
        onCopyLink={async()=>{await Clipboard.setStringAsync(invLink);toast$(isEn?'Copied ':'Скопировано ');}}
        onInviteScreen={()=>{prevInviteScreen.current='friends';setScreen('invite');}}
        onJoinByCode={(code)=>doJoin(code)}
        onLeaveSpace={async()=>{
          if(!space?.id||!myId) return;
          const newMembers=members.filter(m=>m&&m.id!==myId);
          await Storage.setMembers(space.id,newMembers);
          stopSubs();
          await Storage.set(`space_id_${myId}`,null);
          await Storage.clearSpaceId(myId);
          setSpace(null);
          setScreen('today');
          toast$(isEn?'Left the shared space':'Вышли из общего пространства');
        }}
        onKickMember={async(memberId)=>{
          if(!space?.id) return;
          const newMembers=members.filter(m=>m&&m.id!==memberId);
          await Storage.setMembers(space.id,newMembers);
          toast$(isEn?'Partner removed':'Партнёр удалён');
        }}
        confirmations={confirmations}
        onConfirmPartner={async(habitId)=>{
          if(!space?.id||!myId||myId==='guest') return;
          const partner=members.find((m:any)=>m&&m.id!==myId);
          if(!partner) return;
          const c:import('./src/store').HabitConfirmation={
            habitId,date:todayS(),fromId:partner.id,confirmedBy:myId,ts:Date.now(),
          };
          await Storage.saveConfirmation(space.id,c).catch(()=>{});
          const l={...(space?.logs||{})};
          l[`${habitId}_${todayS()}_${partner.id}`]=true;
          await Storage.setLogs(space.id,l).catch(()=>{});
          const habit=space.habits?.find((h:any)=>h.id===habitId);
          sendPartnerNotification({
            spaceId:space.id, toUid:partner.id, fromName:myName,
            habitName:habit?.name??'', habitId, lang,
            customBody: isEn
              ? `${myName} confirmed your habit: ${habit?.name??''} ✓`
              : `${myName} подтвердил вашу привычку: ${habit?.name??''} ✓`,
          }).catch(()=>{});
          toast$(isEn?'Confirmed ✓':'Подтверждено ✓');
        }}/>
    );
    if (screen==='calendar') return (
      <CalendarScreen myId={myId} lang={lang} tk={tk} habits={habits} members={members} logs={logs}
        spaceId={space?.id} initialDate={calTarget}
        onToggleLog={async(hid,dateStr)=>{
          const key=`${hid}_${dateStr}_${myId}`;
          const l={...(space?.logs||{})};
          if(l[key]) delete l[key]; else l[key]=true;
          try { await saveL(l); } catch {}
        }}/>
    );
    return (
      <TodayScreen myId={myId} myName={myName} lang={lang} tk={tk} theme={theme} selectedAvatar={selectedAvatar}
        spaceId={space?.id} onOpenCalendar={(date?:Date)=>{ setCalTarget(date||null); animateScreenChange('calendar'); }}
        habits={habits} members={members} logs={logs} onToggle={toggle}
        onDelete={async(id)=>{
          const h=(space?.habits||[]).filter(x=>x.id!==id);
          const l={...(space?.logs||{})};
          Object.keys(l).filter(k=>k.startsWith(id+'_')).forEach(k=>delete l[k]);
          cancelHabitNotifications(id).catch(()=>{});
          await saveH(h); await saveL(l);
        }}
        onRefresh={async()=>{
          if (!space?.id) return;
          try {
            const [allH, l, m] = await Promise.all([
              Storage.getHabits(space.id),
              Storage.getLogs(space.id),
              Storage.getMembers(space.id),
            ]);
            const h = (allH||[]).filter((x:any) => x.isShared || x.ownerId === myId);
            setSpace(prev => prev ? {...prev, habits:h, logs:l||{}, members:m||[]} : prev);
          } catch {
            toast$(isEn ? 'Failed to refresh, check connection' : 'Не удалось обновить, проверьте соединение', false);
          }
        }}
        onReorder={async(reordered)=>{
          if(!space?.id) return;
          // Присваиваем порядковый номер каждой привычке перед сохранением
          const withOrder = reordered.map((h, idx) => ({ ...h, order: idx }));
          try { await saveH(withOrder); } catch {}
        }}
        reactions={reactions}
        spaceNotes={spaceNotes}
        onWeekPlan={()=>setShowWeekPlan(true)}
        onOpenAchievements={()=>animateScreenChange('achievements','forward')}
        onOpenMood={()=>animateScreenChange('mood','forward')}
        todayMood={todayMood}
        onOpenStats={()=>animateScreenChange('stats','forward')}
        confirmations={confirmations}
        onboardingGoal={onboardingGoal}
        onConfirmPartner={async(habitId)=>{
          if(!space?.id||!myId||myId==='guest') return;
          const partner=members.find((m:any)=>m&&m.id!==myId);
          if(!partner) return;
          const c:import('./src/store').HabitConfirmation={
            habitId,date:todayS(),fromId:partner.id,confirmedBy:myId,ts:Date.now(),
          };
          await Storage.saveConfirmation(space.id,c).catch(()=>{});
          const l={...(space?.logs||{})};
          l[`${habitId}_${todayS()}_${partner.id}`]=true;
          await Storage.setLogs(space.id,l).catch(()=>{});
          // Push партнёру — его выполнение подтверждено
          const habit=space.habits?.find((h:any)=>h.id===habitId);
          sendPartnerNotification({
            spaceId:space.id, toUid:partner.id, fromName:myName,
            habitName:habit?.name??'', habitId, lang,
            customBody: isEn
              ? `${myName} confirmed your habit: ${habit?.name??''} ✓`
              : `${myName} подтвердил вашу привычку: ${habit?.name??''} ✓`,
          }).catch(()=>{});
          toast$(isEn?'Confirmed ✓':'Подтверждено ✓');
        }}
        onReact={async(habitId,reactionKey)=>{
          if(!space?.id || myId==='guest') return;
          if(reactingRef.current) return; // защита от спама
          reactingRef.current = true;
          try {
            const today = todayS();
            const existingAny = reactions.find(
              (r:any) => r.habitId===habitId && r.fromId===myId && r.date===today
            );
            const existingSame = existingAny?.emoji === reactionKey;
            if(existingAny) {
              setReactions(prev => prev.filter(
                r => !(r.habitId===habitId && r.fromId===myId && r.date===today)
              ));
              await Storage.deleteReaction(space.id, habitId, today, myId).catch(()=>{});
            }
            if(existingSame) return;
            const habit = space.habits?.find((h:any)=>h.id===habitId);
            const reaction = { emoji:reactionKey, fromId:myId, fromName:myName, habitId, date:today, ts:Date.now() };
            setReactions(prev => [...prev, reaction]);
            await Storage.saveReaction(space.id, reaction).catch(()=>{});
            // Push — только если реакция новая (не toggle off)
            const keyToLabel: Record<string,string> = { heart:'❤️', lightning:'⚡', star:'★', crown:'♛', fire:'🔥' };
            const owner = space.members?.find((m:any)=>m&&m.id!==myId);
            if(owner && habit) {
              sendReactionNotification({
                spaceId:space.id, toUid:owner.id, fromName:myName,
                emoji:keyToLabel[reactionKey]||reactionKey,
                habitName:habit.name, habitId, lang,
              }).catch(()=>{});
            }
          } finally {
            // Разблокируем через 600мс — достаточно для дебаунса
            setTimeout(() => { reactingRef.current = false; }, 600);
          }
        }}
        onOpenDetail={h=>{setDetailH(h);setScreen('detail');}}
        onAddHabit={(isShared)=>{setNh({...blank,isShared:!!isShared});setShowTimePicker(false);setScreen('addHabit');}} onOpenProfile={()=>setScreen('profile')}/>
    );
  })();

  // Куда возвращает кнопка назад для каждого экрана
  const backDestination: Partial<Record<Screen,Screen>> = {
    settings:'profile', achievements:'profile', paywall:'profile',
    pro:'profile', detail:'today', addHabit:'add', invite:'add',
  };

  return (
    <View style={{flex:1,paddingTop:isDesktop?0:TOP,paddingLeft:isDesktop?SIDEBAR_W:0,backgroundColor:tk.bg}}
      {...((!isDesktop && TAB_SCREENS.includes(screen)) ? tabSwipePan.panHandlers : {})}>
      {isDesktop && <SideNav screen={screen} onPress={s=>s==='add'?setScreen('addHabit'):animateScreenChange(s as Screen)} tk={tk} lang={lang} theme={theme} guest={isGuest()} onAuth={()=>setScreen('auth')}
        friendsBadge={members.length>1 ? members.filter(m=>m&&m.id!==myId).filter(m=>{const dow=todayDow();const todayH=(space?.habits||[]).filter(h=>h.days?.includes(dow));return todayH.some(h=>isLogged(h.id,m.id,logs));}).length : 0}/>}
      {isGuest() && !guestBannerHidden && (
        <View style={{ backgroundColor: tk.accent + '22', borderBottomWidth: 1, borderColor: tk.accent + '44',
          paddingVertical: 10, paddingHorizontal: 16, flexDirection: 'row',
          alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: tk.text, fontWeight: '600' }}>
              {lang === 'en' ? 'Guest mode' : 'Гостевой режим'}
            </Text>
            <Text style={{ fontSize: 11, color: tk.text3, marginTop: 1 }}>
              {lang === 'en'
                ? 'Without an account your progress is NOT saved. Sign up to keep your data and invite partners.'
                : 'Без аккаунта прогресс НЕ сохраняется. Зарегистрируйтесь, чтобы сохранять данные и пригласить партнёра.'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setScreen('auth')}
            style={{ backgroundColor: tk.text, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: tk.bg }}>
              {lang === 'en' ? 'Sign up' : 'Войти'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setGuestBannerHidden(true)} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 18, color: tk.text3, lineHeight: 18 }}>×</Text>
          </TouchableOpacity>
        </View>
      )}
      {!isOnline && (
        <View style={{ backgroundColor: tk.accent + '22', borderBottomWidth: 1, borderColor: tk.accent + '44',
          paddingVertical: 8, paddingHorizontal: 16, flexDirection: 'row',
          alignItems: 'center', gap: 8 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tk.accent }}/>
          <Text style={{ fontSize: 12, color: tk.text2, flex: 1 }}>
            {lang === 'en'
              ? 'Offline mode — data saved locally, will sync when connected'
              : lang === 'uk'
                ? 'Офлайн режим — дані збережені локально'
                : 'Офлайн режим — данные сохранены локально, синхронизируются при подключении'}
          </Text>
        </View>
      )}
      <Animated.View style={{ flex: 1, opacity: screenOpacity, transform: [{ translateX: screenTranslateX }], backgroundColor: tk.bg, alignItems: isDesktop?'center':'stretch' }}>
        {isDesktop ? <View style={{flex:1,width:'100%',maxWidth:760,paddingTop:24}}>{mainScreen}</View> : mainScreen}
      </Animated.View>
      {/* Note Modal */}
      <Modal
        visible={!!noteModal}
        transparent
        animationType="slide"
        onRequestClose={()=>{Keyboard.dismiss();setNoteModal(null);}}
        statusBarTranslucent>
        <KeyboardAvoidingView
          behavior={Platform.OS==='ios'?'padding':'height'}
          style={{flex:1}}
          keyboardVerticalOffset={Platform.OS==='ios'?0:24}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.5)',justifyContent:'flex-end'}}>
              <TouchableWithoutFeedback onPress={()=>{}}>
                <View style={{backgroundColor:tk.bg,borderTopLeftRadius:20,borderTopRightRadius:20,
                  padding:20,paddingBottom:Platform.OS==='ios'?44:28}}>
                  {/* Grab handle */}
                  <View style={{width:36,height:4,borderRadius:2,backgroundColor:tk.border,
                    alignSelf:'center',marginBottom:16}}/>
                  <Text style={{fontSize:15,fontWeight:'700',color:tk.text,marginBottom:4}}>
                    {isEn?'Add a note':'Добавить заметку'}
                  </Text>
                  <Text style={{fontSize:11,color:tk.text3,marginBottom:12}}>
                    {isEn?'Optional — how did it go?':'Необязательно — как прошло?'}
                  </Text>
                  <TextInput
                    value={noteText} onChangeText={setNoteText}
                    placeholder={isEn?'Type something...':'Напишите что-нибудь...'}
                    placeholderTextColor={tk.text3}
                    multiline maxLength={200}
                    autoFocus
                    style={{backgroundColor:tk.bg2,borderWidth:1,borderColor:tk.border,
                      borderRadius:14,padding:12,fontSize:14,color:tk.text,
                      minHeight:80,textAlignVertical:'top',marginBottom:16}}/>
                  <View style={{flexDirection:'row',gap:10}}>
                    <TouchableOpacity onPress={()=>{Keyboard.dismiss();setNoteModal(null);}}
                      style={{flex:1,padding:14,borderRadius:14,borderWidth:1,borderColor:tk.border,alignItems:'center'}}>
                      <Text style={{color:tk.text2,fontSize:14}}>{isEn?'Skip':'Пропустить'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={async()=>{
                        Keyboard.dismiss();
                        if(noteModal && noteText.trim()) {
                          await Storage.setNote(myId,noteModal.habitId,noteModal.date,noteText.trim());
                          if(space?.id) await Storage.saveHabitNoteToSpace(space.id,myId,noteModal.habitId,noteModal.date,noteText.trim()).catch(()=>{});
                        }
                        setNoteModal(null);
                      }}
                      style={{flex:2,padding:14,borderRadius:14,backgroundColor:tk.text,alignItems:'center'}}>
                      <Text style={{color:tk.bg,fontSize:14,fontWeight:'700'}}>{isEn?'Save':'Сохранить'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Cover View — перекрывает старый экран при переходе */}
      {coverVisible && (
        <Animated.View pointerEvents="none" style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: tk.bg, opacity: coverOpacity, zIndex: 999,
        }}/>
      )}
      {!isDesktop && TAB_SCREENS.includes(screen) && <BottomNav screen={screen} onPress={s=>s==='add'?setScreen('addHabit'):animateScreenChange(s as Screen)} tk={tk} lang={lang} theme={theme}
      friendsBadge={members.length>1 ? members.filter(m=>m&&m.id!==myId).filter(m=>{
        const dow=todayDow();
        const todayH=(space?.habits||[]).filter(h=>h.days?.includes(dow));
        return todayH.some(h=>isLogged(h.id,m.id,logs));
      }).length : 0}/>}
      {/* Android-style bottom cross bar для под-экранов */}
      {Platform.OS==='android' && (navOrigin.current[screen]||backDestination[screen]) && (
        <View style={{position:'absolute',bottom:0,left:0,right:0,
          backgroundColor:tk.bg+'f2',
          borderTopWidth:0.5,borderTopColor:tk.border,
          paddingBottom:8,paddingTop:4,
          flexDirection:'row',justifyContent:'center'}}>
          <TouchableOpacity
            onPress={()=>animateScreenChange((navOrigin.current[screen]||backDestination[screen])!,'back')}
            hitSlop={{top:12,bottom:12,left:60,right:60}}
            style={{paddingVertical:8,paddingHorizontal:32}}>
            <View style={{width:48,height:4,borderRadius:2,backgroundColor:tk.text3,opacity:0.5}}/>
          </TouchableOpacity>
        </View>
      )}
      {/* Invite banner — Modal чтобы показываться поверх ЛЮБОГО экрана */}
      {/* Модальное окно недельного плана */}
      <WeekPlanModal
        visible={showWeekPlan}
        onClose={() => setShowWeekPlan(false)}
        tk={tk}
        accent={tk.accent}
        accent2={tk.text2}
        lang={lang}
        myId={myId}
        habits={space?.habits || []}
        logs={space?.logs || {}}
        onToggle={async (habitId) => {
          const today = todayS();
          const key = `${habitId}_${today}_${myId}`;
          const l = { ...(space?.logs || {}) };
          if (l[key]) delete l[key]; else l[key] = true;
          try { await saveL(l); } catch {}
        }}
      />

      <Modal
        visible={!!pendInv && screen !== 'auth' && screen !== 'onboarding'}
        transparent
        animationType="fade"
        onRequestClose={() => setPendInv(null)}>
        <TouchableWithoutFeedback onPress={() => setPendInv(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={{ backgroundColor: tk.bg2, borderTopLeftRadius: 20, borderTopRightRadius: 20,
                padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
                borderTopWidth: 1, borderColor: tk.border }}>
                <View style={{ alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: tk.border }}/>
                </View>
                <Text style={{ fontSize: 17, fontWeight: '700', color: tk.text, marginBottom: 4 }}>
                  {isEn ? 'You were invited' : 'Вас приглашают'}
                </Text>
                <Text style={{ fontSize: 13, color: tk.text3, marginBottom: 20 }}>
                  {isEn ? 'Accept the invitation to track habits together' : 'Примите приглашение чтобы отслеживать привычки вместе'}
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity onPress={() => setPendInv(null)}
                    style={{ flex: 1, padding: 14, borderRadius: 14, backgroundColor: tk.bg3,
                      borderWidth: 1, borderColor: tk.border, alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, color: tk.text3 }}>{isEn ? 'Decline' : 'Отклонить'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => pendInv && doJoin(pendInv)}
                    style={{ flex: 2, padding: 14, borderRadius: 14, backgroundColor: tk.text, alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: tk.bg }}>{isEn ? 'Accept' : 'Принять'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      {loading&&<Loader tk={tk}/>}
      {toast&&<Toast msg={toast.msg} ok={toast.ok} tk={tk}/>}
    </View>
  );
}
