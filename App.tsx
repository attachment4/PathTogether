import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, TouchableWithoutFeedback, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, StatusBar, Alert,
  ActivityIndicator, Share, PanResponder, Animated, BackHandler, Modal,
  Dimensions, useColorScheme, Keyboard,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useFonts, Nunito_700Bold, Nunito_500Medium, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import * as Network from 'expo-network';
import { onAuthStateChanged } from 'firebase/auth';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import QRCodeSVG from 'react-native-qrcode-svg';

import { getTK, WD_RU, WD_EN } from './src/theme';
import { Storage, Habit, Member } from './src/store';
import { mkid, secureCode, todayS, todayDow, getLast7Days, isLogged, calcStreak} from './src/utils';
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
} from './src/notifications';
import { buildAchievements } from './src/screens/AchievementsScreen';
import * as Haptics from 'expo-haptics';
import { initPurchases } from './src/purchases';
import { registerDeviceToken, requestPartnerNotification } from './src/pushNotifications';
const Notifications = { setBadgeCountAsync: async () => {} }; // stub

import OnboardingScreen   from './src/screens/OnboardingScreen';
import SettingsScreen    from './src/screens/SettingsScreen';
import PaywallScreen     from './src/screens/PaywallScreen';
import {
  Subscription, loadSubscription, canInvite, canAddMember, PLAN_LIMITS,
} from './src/subscription';



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
  const [myName,      setMyName]      = useState('');
  const [space,       setSpace]       = useState<Space|null>(null);
  const [screen,      setScreen]      = useState<Screen>('auth');
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
  });
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  // Синхронизируем ref для PanResponder (замыкание не видит стейт)
  useEffect(() => { screenRef.current = screen; }, [screen]);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        if (!cancelled) setIsOnline(!!state.isConnected);
      } catch { if (!cancelled) setIsOnline(true); }
    };
    check();
    const id = setInterval(check, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);
  // FIX 1: ждём ответа Firebase перед рендером экрана входа
  const [authChecked, setAuthChecked] = useState(false);
  const [lang,        setLang]        = useState('ru');
  const [invLink,     setInvLink]     = useState('');
  const [detailH,     setDetailH]     = useState<Habit|null>(null);
  const [editH,       setEditH]       = useState<Habit|null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pendInv,     setPendInv]     = useState<string|null>(null);

  // FIX 2: рефы для подписок Firestore
  const unsubH = useRef<(()=>void)|null>(null);
  const unsubL = useRef<(()=>void)|null>(null);
  const unsubM = useRef<(()=>void)|null>(null);
  // Флаг: сейчас идёт регистрация — onAuthStateChanged не должен мешать
  const isRegistering = useRef(false);
  const prevAchIds    = useRef<Set<string>>(new Set()); // уже разблокированные достижения

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
  const [detailNotes, setDetailNotes] = useState<Record<string,string>>({});
  const [noteText, setNoteText] = useState('');
  const [noteKbHeight, setNoteKbHeight] = useState(0);

  const animateScreenChange = (newScreen: Screen, direction: 'forward' | 'back' = 'forward') => {
    if (newScreen === screen) return;
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



  const blank = {name:'',icon:'',color:'#f5f5f5',days:[0,1,2,3,4,5,6],time:'',desc:'',target:0,unit:'',category:'habit' as any, type:'good' as 'good'|'quit', timerSeconds:0, routine:undefined as any, noteEnabled:false};
  const [nh, setNh] = useState(blank);

  const tk    = getTK(theme);
  const isEn  = lang==='en';
  const L = (ru: string, en: string, uk?: string, be?: string, kk?: string) =>
    lang==='en' ? en : lang==='uk' ? (uk||ru) : lang==='be' ? (be||ru) : lang==='kk' ? (kk||ru) : ru;
  const toast$ = (msg:string,ok=true) => { setToast({msg,ok}); setTimeout(()=>setToast(null),2500); };

  useEffect(() => {
    Storage.loadTheme().then(t=>{if(t)setTheme(t);setThemeLoaded(true);});
    Storage.loadLanguage().then(l=>{if(l)setLang(l);});
    Storage.get<string>('onboarding_name').then(n=>{
      if(n && !myName) setMyName(n);
    }).catch(()=>{});
    Storage.loadNotifTimeMorning().then(t=>{if(t)setNotifTimeMorning(t);});
    Storage.get<boolean>('haptics_enabled').then(v=>{if(v===false)setHapticsEnabled(false);}).catch(()=>{});
    Storage.loadNotifTimeEvening().then(t=>{if(t)setNotifTimeEvening(t);});
  }, []);

  //  Auth listener 
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        stopSubs();
        setSpace(null); setMyId('');
        setAuthChecked(true); setScreen('auth');
        return;
      }
      // Если идёт регистрация — onSuccess сам всё сделает
      if (isRegistering.current) return;
      setMyId(user.uid);
      // Параллельно: AsyncStorage (быстро) + один Firestore запрос если нужен
      const [name, savedTheme, savedLang, savedAvatar, session] = await Promise.all([
        Storage.loadName(),
        Storage.loadTheme(),
        Storage.loadLanguage(),
        Storage.get(`avatar_${user.uid}`),
        Storage.loadUserSession(user.uid), // один запрос вместо двух
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
      setThemeLoaded(true);
      setAuthChecked(true);
      if (!session.onbDone) { setScreen('onboarding'); return; }
      if (session.spaceId) startSubs(session.spaceId);
      setScreen('today');
      // Подписка — в фоне
      loadSubscription(user.uid).then(sub => setSubscription(sub)).catch(()=>{});
    });
    return () => { unsub(); stopSubs(); };
  }, []);

  useEffect(() => {
    const handle = ({url}:{url:string}) => {
      const parsed = Linking.parse(url);
      // Поддерживаем оба формата: ?code=XXX и ?invite=XXX (старый)
      const code = (parsed.queryParams?.code || parsed.queryParams?.invite) as string;
      if (code) setPendInv(code);
    };
    const sub = Linking.addEventListener('url', handle);
    Linking.getInitialURL().then(url=>{if(url)handle({url});});
    return ()=>sub.remove();
  }, []);

  // FIX 2: подписки вместо одноразовых запросов — данные приходят мгновенно из кеша
  const stopSubs = () => { unsubH.current?.(); unsubH.current=null; unsubL.current?.(); unsubL.current=null; unsubM.current?.(); unsubM.current=null; };
  const startSubs = (sid:string) => {
    stopSubs();
    setSpace(p => p?.id===sid ? p : {id:sid,habits:[],logs:{},members:[]});
    // Если то же пространство — не сбрасываем данные (они придут через listener)
    unsubH.current = Storage.subscribeHabits(sid, habits => {
      setSpace(p=>p?{...p,habits}:{id:sid,habits,logs:{},members:[]});
      // Перепланируем уведомления привычек при каждом обновлении
      const hp = (space?.members?.length ?? 0) > 1;
      scheduleHabitNotifications(habits, hp, notifEnabled).catch(()=>{});
    });
    // prevLogsRef хранит последнее известное состояние логов ВНЕ setState
    // чтобы отличить изменения партнёра от собственных записей
    const prevLogsRef = { current: {} as Record<string,boolean> };

    unsubL.current = Storage.subscribeLogs(sid, (newLogs) => {
      // Сравниваем с prevLogsRef — новые ключи только от партнёра
      const today = new Date().toISOString().split('T')[0];
      setSpace(prev => {
        if (!prev) {
          prevLogsRef.current = newLogs;
          return {id:sid,habits:[],logs:newLogs,members:[]};
        }
        const partner = prev.members.find(m => m.id !== myId);
        if (partner && partnerNotif) {
          Object.keys(newLogs).forEach(key => {
            // Ключ формат: habitId_date_userId
            // Строго проверяем что ключ заканчивается на _today_partnerId
            const expectedSuffix = `_${today}_${partner.id}`;
            if (!prevLogsRef.current[key] && key.endsWith(expectedSuffix)) {
              const hid = key.replace(expectedSuffix, '');
              const habit = prev.habits.find(h => h.id === hid);
              if (habit) {
                notifyPartnerDone(partner.name, habit.name).catch(()=>{});
                requestPartnerNotification({
                  fromUid: myId, fromName: myName,
                  toUid: partner.id, habitName: habit.name,
                  spaceId: space?.id || '',
                }).catch(()=>{});
              }
            }
          });
        }
        prevLogsRef.current = newLogs;
        return {...prev, logs: newLogs};
      });
    });
    unsubM.current = Storage.subscribeMembers(sid, members => {
      setSpace(p => p ? {...p, members} : {id:sid,habits:[],logs:{},members});
      const hasPartnerNow = members.length > 1;
      // Перепланируем уведомления при изменении состава (пришёл/ушёл партнёр)
      scheduleAppReminder(hasPartnerNow, notifEnabled).catch(()=>{});
      scheduleMorningMotivation(hasPartnerNow, notifEnabled).catch(()=>{});
    });
  };

  const ensureSpace = async (): Promise<Space> => {
    if (space) return space;
    if (!myId) throw new Error('Not authenticated');
    // Если space уже загружен - возвращаем его напрямую (самый быстрый путь)
    if (space?.id) return space;
    const existingId = await Storage.loadCurrentSpace(myId);
    if (existingId) {
      if (!space || space.id !== existingId) startSubs(existingId);
      return space?.id === existingId ? space : {id:existingId,habits:[],logs:{},members:[]};
    }
    const sid = mkid();
    const members:Member[] = [{id:myId,name:myName,role:'owner',joined:todayS()}];
    // ВАЖНО: сначала создаём members (с memberIds/ownerIds) — Rules проверяют их при записи habits
    await Storage.setMembers(sid, members);
    await Promise.all([
      Storage.setHabits(sid,[]),
      Storage.setLogs(sid,{}),
      Storage.setMeta(sid,{name:'PathTogether'}),
      Storage.saveCurrentSpace(sid),
    ]);
    startSubs(sid);
    return {id:sid,habits:[],logs:{},members};
  };

  const saveH = async (h:Habit[],sid?:string) => {
    const id=sid||space?.id; if(!id) return;
    try { await Storage.setHabits(id,h); }
    catch (e) {
      console.warn('[saveL]', e);
      // Не показываем ошибку - UI уже обновлён оптимистично
    }
  };
  const saveL = async (l:Record<string,boolean>,sid?:string) => {
    const id=sid||space?.id; if(!id) return;
    try { await Storage.setLogs(id,l); }
    catch (e) {
      console.warn('[saveL]', e);
      // Не показываем ошибку - UI уже обновлён оптимистично
    }
  };

  const toggle = async (hid:string) => {
    const key=`${hid}_${todayS()}_${myId}`;
    const l={...(space?.logs||{})};
    const wasLogged = !!l[key];
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
      .filter((h:any)=>!h.archived && h.days?.includes(todayDow2) && !l[`${h.id}_${todayS()}_${myId}`]).length;
    scheduleEveningReminder(pendingCount, notifEnabled).catch(()=>{});
    // Показываем modal для заметки если включено и это отметка (не снятие)
    if (!wasLogged) {
      const habit = (space?.habits||[]).find((h:any)=>h.id===hid);
      if (habit?.noteEnabled) {
        setNoteText('');
        setNoteModal({habitId:hid, date:todayS()});
      }
    }
    // Хаптика: короткий импульс при отметке, двойной при снятии
    // Оптимистичное обновление — сразу обновляем UI без ожидания Firestore
    setSpace(prev => prev ? { ...prev, logs: l } : prev);
    // Кэш для офлайн режима
    AsyncStorage.setItem('offline_logs_' + (space?.id||''), JSON.stringify(l)).catch(()=>{});
    try {
      saveL(l).catch(e => console.warn('[toggle saveL]', e)); // fire and forget
      // Обновляем badge и серию
      const currentHabit = space?.habits?.find(h=>h.id===hid);
      if (currentHabit) {
        const streak = calcStreak(hid, myId, l, currentHabit.days);
        const hasP = (space?.members?.length ?? 0) > 1;
        if (streak >= 2) scheduleStreakReminder(streak, hasP, notifEnabled).catch(()=>{});
        // maxStreak вычисляется через useMemo из logs — не нужно сохранять отдельно
    // Widget update: активируется после EAS Build (npm install react-native-android-widget)

        // Запросить отзыв после 5 выполнений
        if (totalDone === 5 || totalDone === 25) {
          setTimeout(() => {
            Linking.openURL('rustore://review?packageName=com.attach4.pathtogether').catch(()=>{});
          }, 2000);
        }
      }
      // Badge = кол-во невыполненных привычек сегодня
      const dow2 = todayDow();
      const todayHabits = (space?.habits||[]).filter(h=>h.days?.includes(dow2));
      const doneCnt = todayHabits.filter(h=>isLogged(h.id,myId,l)).length;
      const remaining = Math.max(0, todayHabits.length - doneCnt);
      Notifications.setBadgeCountAsync(remaining).catch(()=>{});
      // Проверяем новые достижения
      const totalDoneNow = Object.keys(l).filter(k=>k.includes(`_${myId}`)).length;
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
      let h=[...(cs.habits||[])];
      const isEdit=!!editH;
      if(editH){h=h.map(x=>x.id===editH.id?{...x,...nh}:x);}
      else{h.push({...nh,id:mkid(),ownerId:myId,ownerName:myName,createdAt:todayS(),order:h.length});}
      scheduleHabitTimeNotifications(h).catch(()=>{});
      await saveH(h,cs.id);
      // Оптимистичное обновление: применяем сразу, не ждём Firestore listener
      // Используем функциональный апдейт чтобы не зависеть от замыкания
      setSpace(prev => {
        if (!prev) return {id:cs.id,habits:h,logs:{},members:[]};
        return {...prev, id:cs.id, habits:h};
      });
      toast$(isEdit?(isEn?'Saved ':'Сохранено '):(isEn?'Added ':'Добавлено '));
      setNh(blank);setEditH(null);
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

  const genInvite = async () => {
    // Проверяем подписку перед созданием инвайта
    if (!canInvite(subscription)) {
      setScreen('paywall');
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
      await Storage.setInvite(code,{spaceId:s.id,spaceName:'PathTogether',creatorId:myId});
      // Deep link: pathtogether://invite?code=XXX — открывает приложение напрямую
      // Для QR-кода используем универсальную ссылку с fallback страницей
      const link=`pathtogether://invite?code=${code}`;
      setInvLink(link); return link;
    } catch {
      toast$(isEn?'Could not create invite':'Не удалось создать инвайт',false);
      return '';
    }
  };

  const doJoin = async (code:string) => {
    // Проверяем подписку и лимит участников
    if (!canInvite(subscription)) {
      setPendInv(null);
      setScreen('paywall');
      return;
    }
    if (!canAddMember(subscription, members.length)) {
      Alert.alert(
        (lang === 'en' ? 'Member limit reached' : 'Достигнут лимит участников'),
        isEn
          ? `Your ${PLAN_LIMITS[subscription.plan].label_en} plan allows up to ${PLAN_LIMITS[subscription.plan].maxMembers} member(s). Upgrade to add more.`
          : `Тариф ${PLAN_LIMITS[subscription.plan].label_ru} позволяет до ${PLAN_LIMITS[subscription.plan].maxMembers} участника(ов). Обновите тариф чтобы добавить больше.`,
        [
          { text: (lang === 'en' ? 'Cancel' : 'Отмена'), style: 'cancel' },
          { text: (lang === 'en' ? 'Upgrade' : 'Обновить'), onPress: () => { setPendInv(null); setScreen('paywall'); } },
        ]
      );
      return;
    }
    try {
      const inv=await Storage.getInvite(code);
      if(!inv){toast$(isEn?'Invalid link':'Ссылка недействительна',false);return;}
      if(space?.id===inv.spaceId){toast$(isEn?'Already here':'Уже здесь',false);return;}
      const ref=doc(db,'spaces',inv.spaceId,'data','members');
      // Получаем подписку хоста пространства для проверки его лимита
      const hostSubSnap = await getDoc(doc(db,'users',inv.creatorId)).catch(()=>null);
      const hostPlan: 'free'|'duo'|'team'|'admin' =
        (hostSubSnap?.exists() ? hostSubSnap.data().plan : null) || 'free';
      const hostMax = PLAN_LIMITS[hostPlan]?.maxMembers ?? 1;
      await runTransaction(db,async tx=>{
        const snap=await tx.get(ref);
        const cur:Member[]=snap.exists()?(snap.data().v||[]):[];
        if(cur.find(m=>m.id===myId)) return;
        // Серверная проверка лимита хоста
        if(cur.length >= hostMax) {
          throw new Error('LIMIT_REACHED');
        }
        const updated=[...cur,{id:myId,name:myName,role:'member' as const,joined:todayS()}];
        tx.set(ref,{
          v: updated,
          memberIds: updated.map(m=>m.id),
          ownerIds:  updated.filter(m=>m.role==='owner').map(m=>m.id),
        });
      });
      await Storage.saveCurrentSpace(inv.spaceId);
      startSubs(inv.spaceId);
      setPendInv(null);
      // Удаляем инвайт после использования
      try { await deleteDoc(doc(db,'invites',code)); } catch {}
      toast$(isEn?'Joined! ':'Присоединились! ');
    } catch(e:any) {
      if (e?.message === 'LIMIT_REACHED') {
        toast$((lang === 'en' ? 'Space is full' : 'Пространство заполнено'), false);
      } else {
        toast$(isEn?'Error':'Ошибка',false);
      }
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

  if (screen==='onboarding') return (
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
    }}/>
  );

  if (screen==='auth') return (
    <View style={{flex:1,paddingTop:TOP,backgroundColor:tk.bg}}>
      <AuthScreen tk={tk} lang={lang} onSuccess={async(uid,name,isNew)=>{
        isRegistering.current = true;
        try {
          setupNotificationChannel().catch(()=>{});
          setMyId(uid);
          setMyName(name);
          await Storage.saveName(name);
          initPurchases(uid).catch(()=>{});
          registerDeviceToken(uid).catch(()=>{});
          if (isNew) {
            // Новый пользователь — очищаем весь локальный кеш пространства
            await Storage.set('space_id', null);
            await Storage.set('onboarding_done', null);
            setScreen('onboarding');
            return;
          }
          // Существующий пользователь — загружаем только его данные из Firestore
          const session = await Storage.loadUserSession(uid);
          if (!session.onbDone) { setScreen('onboarding'); return; }
          if (session.spaceId) startSubs(session.spaceId);
          setScreen('today');
          loadSubscription(uid).then(sub => setSubscription(sub)).catch(()=>{});
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

  if (screen==='pro') return (
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

  if (screen==='paywall') return (
    <PaywallScreen lang={lang} tk={tk} myId={myId}
      subscription={subscription}
      onPlanChange={sub => setSubscription(sub)}
      onBack={()=>setScreen('pro')}/>
  );

  if (screen==='settings') return (
    <SettingsScreen lang={lang} tk={tk} myId={myId}
      notifEnabled={notifEnabled} partnerNotifEnabled={partnerNotif}
      hasPartner={(space?.members?.length ?? 0) > 1}
      notifTimeMorning={notifTimeMorning} notifTimeEvening={notifTimeEvening}
      hapticsEnabled={hapticsEnabled}
      onHapticsToggle={async v=>{setHapticsEnabled(v);await Storage.set('haptics_enabled',v);}}
      autoTheme={autoTheme}
      onAutoTheme={async v=>{setAutoTheme(v);await Storage.saveTheme(v?'auto':(theme==='dark'?'dark':'light'));}}
      onNotifTimeMorning={async(t)=>{setNotifTimeMorning(t);await Storage.saveNotifTimeMorning(t);scheduleHabitNotifications(habits,(space?.members?.length??0)>1,notifEnabled).catch(()=>{});}}
      onNotifTimeEvening={async(t)=>{setNotifTimeEvening(t);await Storage.saveNotifTimeEvening(t);scheduleHabitNotifications(habits,(space?.members?.length??0)>1,notifEnabled).catch(()=>{});}}
      habits={habits}
      onNotifToggle={async(v)=>{
        setNotifEnabled(v);
        await Storage.set('notif_enabled',v);
        const hasP = (space?.members?.length ?? 0) > 1;
        const habits2 = space?.habits || [];
        scheduleHabitNotifications(habits2, hasP, v).catch(()=>{});
        scheduleAppReminder(hasP, v).catch(()=>{});
        scheduleMorningMotivation(hasP, v).catch(()=>{});
      }}
      onPartnerNotifToggle={async(v)=>{setPartnerNotif(v);await Storage.set('partner_notif',v);}}
      onBack={()=>setScreen('profile')}
      onDeleteAccount={async()=>{const uid=myId;stopSubs();await auth.signOut();setSpace(null);setMyId('');setMyName('');setScreen('auth');}}/>
  );

  if (screen==='mood') return (
    <MoodScreen myId={myId} lang={lang} tk={tk}
      onBack={() => animateScreenChange('profile', 'back')} />
  );

  if (screen==='stats') return (
    <View style={{flex:1,paddingTop:TOP,backgroundColor:tk.bg}}>
      <StatisticsScreen
        myId={myId} myName={myName} lang={lang} tk={tk}
        habits={habits}
        logs={logs}
        members={members}
        maxStreak={maxStreak}
        totalDone={Object.keys(logs).filter(k=>k.includes(`_${myId}`)).length}
        plan={subscription.plan}
        onBack={()=>setScreen('profile')}/>
    </View>
  );

  if (screen==='achievements') return (
    <View style={{flex:1,paddingTop:TOP,backgroundColor:tk.bg}}>
      <AchievementsScreen lang={lang} tk={tk} habitCount={habits.length}
        totalDone={Object.keys(logs).filter(k=>k.includes(`_${myId}`)).length}
        maxStreak={maxStreak}
        partnerTotalDone={members.length>1?Object.keys(logs).filter(k=>k.includes(`_${members.find(m=>m.id!==myId)?.id||''}`)).length:undefined}
        friendCount={members.length>1?1:0} onBack={()=>setScreen('profile')}/>
    </View>
  );

  if (screen==='profile') return (
    <View style={{flex:1,paddingTop:TOP,backgroundColor:tk.bg}}
      {...tabSwipePan.panHandlers}>
      <ProfileScreen myId={myId} myName={myName} lang={lang} tk={tk} theme={theme}
        subscription={subscription}
        habitCount={habits.length} friendCount={members.length>1?1:0}
        totalDone={Object.keys(logs).filter(k=>k.includes(`_${myId}`)).length}
        maxStreak={maxStreak}
        partnerName={members.find(m=>m.id!==myId)?.name}
        partnerJoined={members.find(m=>m.id!==myId)?.joined}
        partnerStreak={members.length>1?Math.max(0,...habits.map(h=>calcStreak(h.id,members.find(m=>m.id!==myId)?.id||'',logs,h.days))):undefined}
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
        onNameChange={name=>setMyName(name)}
        onLogout={async()=>{const uid=myId;stopSubs();await auth.signOut();await Storage.set(`space_id_${uid}`,null);await Storage.set(`onboarding_done_${uid}`,null);setSpace(null);setMyId('');setMyName('');setScreen('auth');}}/>
      {toast&&<Toast msg={toast.msg} ok={toast.ok} tk={tk}/>}
      {/* Note Modal */}
      <Modal
        visible={!!noteModal}
        transparent
        animationType="slide"
        onRequestClose={()=>{Keyboard.dismiss();setNoteModal(null);}}
        statusBarTranslucent>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.5)',justifyContent:'flex-end'}}>
            <TouchableWithoutFeedback onPress={()=>{}}>
              <View style={{backgroundColor:tk.bg,borderTopLeftRadius:20,borderTopRightRadius:20,
                padding:20,paddingBottom:Platform.OS==='ios'?34:20,
                marginBottom: noteKbHeight}}>
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
                  style={{backgroundColor:tk.bg2,borderWidth:1,borderColor:tk.border,
                    borderRadius:14,padding:12,fontSize:14,color:tk.text,
                    height:72,textAlignVertical:'top',marginBottom:12}}/>
                <View style={{flexDirection:'row',gap:10}}>
                  <TouchableOpacity onPress={()=>{Keyboard.dismiss();setNoteModal(null);}}
                    style={{flex:1,padding:12,borderRadius:14,borderWidth:1,borderColor:tk.border,alignItems:'center'}}>
                    <Text style={{color:tk.text2,fontSize:14}}>{isEn?'Skip':'Пропустить'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={async()=>{
                      Keyboard.dismiss();
                      if(noteModal && noteText.trim()) await Storage.setNote(myId,noteModal.habitId,noteModal.date,noteText.trim());
                      setNoteModal(null);
                    }}
                    style={{flex:1,padding:12,borderRadius:14,backgroundColor:tk.text,alignItems:'center'}}>
                    <Text style={{color:tk.bg,fontSize:14,fontWeight:'700'}}>{isEn?'Save':'Сохранить'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Cover View — перекрывает старый экран при переходе */}
      {coverVisible && (
        <Animated.View pointerEvents="none" style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: tk.bg, opacity: coverOpacity, zIndex: 999,
        }}/>
      )}
      {TAB_SCREENS.includes(screen) && <BottomNav screen={screen} onPress={s=>s==='add'?setScreen('addHabit'):animateScreenChange(s as Screen)} tk={tk} lang={lang} theme={theme}
      friendsBadge={members.length>1 ? members.filter(m=>m.id!==myId).filter(m=>{
        const dow=todayDow();
        const todayH=(space?.habits||[]).filter(h=>!h.archived && h.days?.includes(dow));
        return todayH.some(h=>isLogged(h.id,m.id,logs));
      }).length : 0}/>}
    </View>
  );

  if (screen==='addHabit') return (
    <View style={{flex:1,paddingTop:TOP,backgroundColor:tk.bg}}>
      <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{flex:1}}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{padding:20,paddingBottom:60}} keyboardShouldPersistTaps="handled">
          <View style={{flexDirection:'row',alignItems:'center',gap:12,marginBottom:28}}>
            <TouchableOpacity onPress={()=>{
              if(nh.name.trim()) {
                const {Alert: A} = require('react-native');
                A.alert(
                  isEn?'Discard changes?':'Отменить изменения?',
                  isEn?'You have unsaved changes':'У вас есть несохранённые изменения',
                  [
                    {text:isEn?'Keep editing':'Продолжить редактирование',style:'cancel'},
                    {text:isEn?'Discard':'Отменить',style:'destructive',onPress:()=>{setScreen('add');setEditH(null);setNh(blank);setShowTimePicker(false);}},
                  ]
                );
              } else {
                setScreen('add');setEditH(null);setNh(blank);setShowTimePicker(false);
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
          {/* Категория */}
          {/* Тип привычки */}
          <Text style={{fontSize:10,color:tk.text3,letterSpacing:1,textTransform:'uppercase',fontWeight:'400',marginBottom:12,marginTop:4}}>
            {isEn?'Habit type':'Тип привычки'}
          </Text>
          <View style={{flexDirection:'row',gap:10,marginBottom:20}}>
            {([
              {t:'good', color:'#8cb8a0', ru:'Полезная',   en:'Build habit',
               path:'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z'},
              {t:'quit', color:'#c8a0a0', ru:'Избавиться', en:'Quit habit',
               path:'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 13H7v-2h10v2z'},
            ] as any[]).map(({t,color,ru,en,path})=>{
              const sel = (nh as any).type===t;
              return (
                <TouchableOpacity key={t} onPress={()=>setNh((p:any)=>({...p,type:t}))}
                  style={{flex:1,padding:14,borderRadius:16,borderWidth:1.5,alignItems:'center',gap:8,
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
            <Text style={{flex:1,fontSize:14,fontWeight:'400',color:tk.text}}>
              {isEn?'Ask for a note on completion':'Запрашивать заметку при выполнении'}
            </Text>
          </TouchableOpacity>

          {/* Таймер */}
          <Text style={{fontSize:10,color:tk.text3,letterSpacing:1,textTransform:'uppercase',fontWeight:'400',marginBottom:10}}>
            {isEn?'Timer (optional)':'Таймер (необязательно)'}
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
  if (screen==='invite') return (
    <View style={{flex:1,paddingTop:TOP,backgroundColor:tk.bg}}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{padding:20,paddingBottom:60}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:12,marginBottom:28}}>
          <TouchableOpacity onPress={()=>setScreen('add')}
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

        <TouchableOpacity onPress={async()=>{
          const l=await genInvite(); if(!l) return;
          try {
            const msgRu = `Привет! Давай вместе отслеживать привычки в PathTogether\n\nПросто открой ссылку:\n${l}`;
            const msgEn = `Hey! Let's track habits together in PathTogether\n\nOpen the link:\n${l}`;
            await Share.share({message: isEn ? msgEn : msgRu});
          }
          catch { await Clipboard.setStringAsync(l); toast$(isEn?'Link copied ':'Ссылка скопирована '); }
        }} style={{backgroundColor:tk.text,borderRadius:14,padding:14,alignItems:'center',
                shadowColor: tk.glowColor,
                shadowOpacity: tk.glowOpacity,
                shadowRadius: tk.glowRadius,
                shadowOffset: { width: 0, height: 0 },
                elevation: 0,
              }}>
          <Text style={{color:tk.bg,fontSize:14,fontWeight:'500'}}>{isEn?'Share':'Поделиться'}</Text>
        </TouchableOpacity>
      </ScrollView>
      {toast&&<Toast msg={toast.msg} ok={toast.ok} tk={tk}/>}
    </View>
  );

  //  DETAIL 
  if (screen==='detail'&&detailH) {
    const h=detailH;
    // Load notes for this habit (last 14 days)
    const loadDetailNotes = async () => {
      const dates: string[] = [];
      for (let i = 0; i < 14; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
      }
      const notes = await Storage.getNotesForHabit(myId, h.id, dates);
      setDetailNotes(notes);
    };
    if (Object.keys(detailNotes).length === 0) loadDetailNotes(); const own=h.ownerId===myId;
    const myStreak=calcStreak(h.id,myId,logs,h.days);
    return (
      <View style={{flex:1,paddingTop:TOP,backgroundColor:tk.bg}}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{padding:20,paddingBottom:60}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:12,marginBottom:24}}>
            <TouchableOpacity onPress={()=>{setDetailH(null);setDetailNotes({});animateScreenChange('today','back');}}
              style={{width:36,height:36,borderRadius:10,backgroundColor:tk.bg2,borderWidth:1,borderColor:tk.border,alignItems:'center',justifyContent:'center'}}>
              <Text style={{color:tk.text,fontSize:16}}>←</Text>
            </TouchableOpacity>
            <Text style={{fontSize:20,fontWeight:'500',color:tk.text,letterSpacing:-0.3,flex:1}}>{isEn?'Details':'Подробности'}</Text>
            {own&&(<TouchableOpacity onPress={()=>{setEditH(h);setNh({name:h.name,icon:h.icon,color:h.color,days:h.days||[0,1,2,3,4,5,6],time:h.time||'',desc:h.desc||'',target:h.target||0,unit:h.unit||'',category:h.category||'habit'});setDetailH(null);setShowTimePicker(false);setScreen('addHabit');}}
              style={{width:36,height:36,borderRadius:10,backgroundColor:tk.bg2,borderWidth:1,borderColor:tk.border,alignItems:'center',justifyContent:'center'}}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke={tk.text2} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                <Path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" stroke={tk.text2} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              </Svg>
            </TouchableOpacity>)}
          </View>
          <View style={{backgroundColor:tk.bg2,borderWidth:1,borderColor:tk.border,borderRadius:16,padding:20,alignItems:'center',gap:10,marginBottom:20}}>
            <View style={{width:64,height:64,borderRadius:18,
              backgroundColor:h.color&&h.color!=='#f5f5f5'&&h.color!=='#fafafa'?h.color:tk.bg3,
              alignItems:'center',justifyContent:'center'}}>
              <Text style={{fontSize:26,fontWeight:'700',
                color:(()=>{const hx=(h.color||'#f5f5f5').replace('#','');
                  const r=parseInt(hx.substring(0,2),16),g=parseInt(hx.substring(2,4),16),b=parseInt(hx.substring(4,6),16);
                  return (r*299+g*587+b*114)/1000>160?'#111111':'#ffffff';})()}}>
                {h.name?.[0]?.toUpperCase()||'?'}
              </Text>
            </View>
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
          {/* 30-дневный календарь */}
          <Text style={{fontSize:10,color:tk.text3,letterSpacing:1,textTransform:'uppercase',fontWeight:'400',marginBottom:10}}>{isEn?'Last 30 days':'Последние 30 дней'}</Text>
          <View style={{backgroundColor:tk.bg2,borderWidth:1,borderColor:tk.border,borderRadius:14,padding:12,marginBottom:16}}>
            <View style={{flexDirection:'row',flexWrap:'wrap',gap:4}}>
              {Array.from({length:30},(_,i)=>{
                const d=new Date();d.setDate(d.getDate()-(29-i));
                const ds=d.toISOString().split('T')[0];
                const dw=(d.getDay()+6)%7;
                const active=h.days?.includes(dw);
                const done=isLogged(h.id,myId,logs,ds);
                return <View key={ds} style={{width:'10%' as any,aspectRatio:1,borderRadius:4,
                  backgroundColor:done?tk.text:active?tk.bg3:'transparent',
                  borderWidth:active&&!done?0.5:0,borderColor:tk.border,
                  opacity:active?1:0.2}}/>;
              })}
            </View>
            <View style={{flexDirection:'row',gap:12,marginTop:8,justifyContent:'flex-end'}}>
              <View style={{flexDirection:'row',alignItems:'center',gap:4}}>
                <View style={{width:8,height:8,borderRadius:2,backgroundColor:tk.text}}/>
                <Text style={{fontSize:9,color:tk.text3}}>{isEn?'Done':'Выполнено'}</Text>
              </View>
              <View style={{flexDirection:'row',alignItems:'center',gap:4}}>
                <View style={{width:8,height:8,borderRadius:2,backgroundColor:tk.bg3,borderWidth:0.5,borderColor:tk.border}}/>
                <Text style={{fontSize:9,color:tk.text3}}>{isEn?'Missed':'Пропущено'}</Text>
              </View>
            </View>
          </View>
          <Text style={{fontSize:10,color:tk.text3,letterSpacing:1,textTransform:'uppercase',fontWeight:'400',marginBottom:12}}>7 {isEn?'days':'дней'}</Text>
          {members.map(m=>(
            <View key={m.id} style={{flexDirection:'row',alignItems:'center',gap:8,marginBottom:10}}>
              <View style={{width:26,height:26,borderRadius:13,backgroundColor:tk.bg2,borderWidth:1,borderColor:tk.border,alignItems:'center',justifyContent:'center'}}>
                <Text style={{fontSize:10,fontWeight:'700',color:m.id===myId?tk.text:tk.text3}}>{m.name[0]?.toUpperCase()}</Text>
              </View>
              <View style={{flexDirection:'row',gap:4,flex:1}}>
                {l7.map(d=>{
                  const dw=(new Date(d+'T12:00:00').getDay()+6)%7;
                  const act=h.days?.includes(dw); const lg=isLogged(h.id,m.id,logs,d);
                  return <View key={d} style={{flex:1,aspectRatio:1,borderRadius:50,
                    backgroundColor:lg?(m.id===myId?tk.text:tk.text3):tk.bg2,
                    borderWidth:1,borderColor:tk.border,opacity:!act?0.2:1}}/>;
                })}
              </View>
              <Text style={{fontSize:10,color:tk.text3,width:28,textAlign:'right'}}>
                {m.id===myId?(isEn?'me':'Я'):m.name.slice(0,4)}
              </Text>
            </View>
          ))}
          {/* 30-дневный мини-календарь */}
          {(()=>{
            const cal30: {d:string; state:'done'|'miss'|'skip'|'future'}[] = [];
            for(let i=29;i>=0;i--){
              const _now=new Date(); const dt=new Date(_now); dt.setDate(dt.getDate()-i);
              const ds2=dt.toISOString().split('T')[0];
              const dw=(dt.getDay()+6)%7;
              const isFuture=dt>_now;
              const scheduled=h.days?.includes(dw) && (!h.createdAt||ds2>=h.createdAt);
              if(isFuture) cal30.push({d:ds2,state:'future'});
              else if(!scheduled) cal30.push({d:ds2,state:'skip'});
              else if(logs[`${h.id}_${ds2}_${myId}`]) cal30.push({d:ds2,state:'done'});
              else cal30.push({d:ds2,state:'miss'});
            }
            return (
              <View style={{marginBottom:20}}>
                <Text style={{fontSize:11,fontWeight:'700',color:tk.text3,letterSpacing:1.5,textTransform:'uppercase',marginBottom:10}}>
                  {isEn?'Last 30 days':'Последние 30 дней'}
                </Text>
                <View style={{flexDirection:'row',flexWrap:'wrap',gap:4}}>
                  {cal30.map((c,i)=>(
                    <View key={i} style={{width:24,height:24,borderRadius:6,
                      backgroundColor:
                        c.state==='done' ? tk.text :
                        c.state==='miss' ? 'rgba(239,68,68,0.2)' :
                        c.state==='future' ? tk.bg2 : tk.bg2,
                      borderWidth:1,
                      borderColor:
                        c.state==='done' ? 'transparent' :
                        c.state==='miss' ? 'rgba(239,68,68,0.3)' : tk.border,
                      alignItems:'center',justifyContent:'center'
                    }}>
                      {c.state==='done'&&(
                        <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                          <Path d="M5 13l4 4L19 7" stroke={tk.bg} strokeWidth="2.5"
                            strokeLinecap="round" strokeLinejoin="round"/>
                        </Svg>
                      )}
                    </View>
                  ))}
                </View>
                <View style={{flexDirection:'row',gap:12,marginTop:8,alignItems:'center'}}>
                  <View style={{flexDirection:'row',alignItems:'center',gap:4}}>
                    <View style={{width:8,height:8,borderRadius:2,backgroundColor:tk.text}}/>
                    <Text style={{fontSize:10,color:tk.text3}}>{isEn?'Done':'Выполнено'}</Text>
                  </View>
                  <View style={{flexDirection:'row',alignItems:'center',gap:4}}>
                    <View style={{width:8,height:8,borderRadius:2,backgroundColor:'rgba(239,68,68,0.3)'}}/>
                    <Text style={{fontSize:10,color:tk.text3}}>{isEn?'Missed':'Пропущено'}</Text>
                  </View>
                </View>
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
              <TouchableOpacity
                onPress={async()=>{
                  const updated=(space?.habits||[]).map((x:any)=>x.id===h.id?{...x,archived:!h.archived}:x);
                  await saveH(updated);
                  setDetailH(null); setScreen('today');
                }}
                style={{paddingVertical:16,paddingHorizontal:4,borderBottomWidth:1,borderBottomColor:tk.border}}>
                <Text style={{color:tk.text2,fontSize:15}}>
                  {h.archived?(isEn?'Unarchive':'Разархивировать'):(isEn?'Archive':'Архивировать')}
                </Text>
              </TouchableOpacity>
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
        <TouchableOpacity onPress={()=>setScreen('invite')}
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
        onInviteScreen={()=>setScreen('invite')}
        onLeaveSpace={async()=>{
          if(!space?.id||!myId) return;
          // Убираем себя из members
          const newMembers=members.filter(m=>m.id!==myId);
          await Storage.setMembers(space.id,newMembers);
          stopSubs();
          // Удаляем spaceId из AsyncStorage И Firestore — иначе при перезапуске вернётся
          await Storage.set(`space_id_${myId}`,null);
          await Storage.clearSpaceId(myId);
          setSpace(null);
          setScreen('today');
          toast$(isEn?'Left the shared space':'Вышли из общего пространства');
        }}/>
    );
    if (screen==='calendar') return (
      <CalendarScreen myId={myId} lang={lang} tk={tk} habits={habits} members={members} logs={logs}
        spaceId={space?.id}
        onToggleLog={async(hid,dateStr)=>{
          const key=`${hid}_${dateStr}_${myId}`;
          const l={...(space?.logs||{})};
          if(l[key]) delete l[key]; else l[key]=true;
          try { await saveL(l); } catch {}
        }}/>
    );
    return (
      <TodayScreen myId={myId} myName={myName} lang={lang} tk={tk} theme={theme} selectedAvatar={selectedAvatar}
        habits={habits} members={members} logs={logs} onToggle={toggle}
        onDelete={async(id)=>{
          const h=(space?.habits||[]).filter(x=>x.id!==id);
          const l={...(space?.logs||{})};
          Object.keys(l).filter(k=>k.startsWith(id+'_')).forEach(k=>delete l[k]);
          await saveH(h); await saveL(l);
        }}
        onRefresh={async()=>{
          if (!space?.id) return;
          try {
            const [h, l, m] = await Promise.all([
              Storage.getHabits(space.id),
              Storage.getLogs(space.id),
              Storage.getMembers(space.id),
            ]);
            setSpace(prev => prev ? {...prev, habits:h||[], logs:l||{}, members:m||[]} : prev);
          } catch {}
        }}
        onReorder={async(reordered)=>{
          if(!space?.id) return;
          // Присваиваем порядковый номер каждой привычке перед сохранением
          const withOrder = reordered.map((h, idx) => ({ ...h, order: idx }));
          try { await saveH(withOrder); } catch {}
        }}
        onOpenDetail={h=>{setDetailH(h);setScreen('detail');}}
        onAddHabit={()=>setScreen('addHabit')} onOpenProfile={()=>setScreen('profile')}/>
    );
  })();

  // Куда возвращает кнопка назад для каждого экрана
  const backDestination: Partial<Record<Screen,Screen>> = {
    settings:'profile', achievements:'profile', paywall:'profile',
    pro:'profile', detail:'today', addHabit:'add', invite:'add',
  };

  return (
    <View style={{flex:1,paddingTop:TOP,backgroundColor:tk.bg}}
      {...(TAB_SCREENS.includes(screen) ? tabSwipePan.panHandlers : {})}>
      {!isOnline && (
        <View style={{ backgroundColor: '#7c4dff22', borderBottomWidth: 1, borderColor: '#7c4dff44',
          paddingVertical: 8, paddingHorizontal: 16, flexDirection: 'row',
          alignItems: 'center', gap: 8 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#7c4dff' }}/>
          <Text style={{ fontSize: 12, color: tk.text2, flex: 1 }}>
            {lang === 'en'
              ? 'Offline mode — data saved locally, will sync when connected'
              : lang === 'uk'
                ? 'Офлайн режим — дані збережені локально'
                : 'Офлайн режим — данные сохранены локально, синхронизируются при подключении'}
          </Text>
        </View>
      )}
      <Animated.View style={{ flex: 1, opacity: screenOpacity, transform: [{ translateX: screenTranslateX }], backgroundColor: tk.bg }}>
        {mainScreen}
      </Animated.View>
      {/* Note Modal */}
      <Modal
        visible={!!noteModal}
        transparent
        animationType="slide"
        onRequestClose={()=>{Keyboard.dismiss();setNoteModal(null);}}
        statusBarTranslucent>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.5)',justifyContent:'flex-end'}}>
            <TouchableWithoutFeedback onPress={()=>{}}>
              <View style={{backgroundColor:tk.bg,borderTopLeftRadius:20,borderTopRightRadius:20,
                padding:20,paddingBottom:Platform.OS==='ios'?34:20,
                marginBottom: noteKbHeight}}>
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
                  style={{backgroundColor:tk.bg2,borderWidth:1,borderColor:tk.border,
                    borderRadius:14,padding:12,fontSize:14,color:tk.text,
                    height:72,textAlignVertical:'top',marginBottom:12}}/>
                <View style={{flexDirection:'row',gap:10}}>
                  <TouchableOpacity onPress={()=>{Keyboard.dismiss();setNoteModal(null);}}
                    style={{flex:1,padding:14,borderRadius:14,borderWidth:1,borderColor:tk.border,alignItems:'center'}}>
                    <Text style={{color:tk.text2,fontSize:14}}>{isEn?'Skip':'Пропустить'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={async()=>{
                      Keyboard.dismiss();
                      if(noteModal && noteText.trim()) await Storage.setNote(myId,noteModal.habitId,noteModal.date,noteText.trim());
                      setNoteModal(null);
                    }}
                    style={{flex:1,padding:14,borderRadius:14,backgroundColor:tk.text,alignItems:'center'}}>
                    <Text style={{color:tk.bg,fontSize:14,fontWeight:'700'}}>{isEn?'Save':'Сохранить'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Cover View — перекрывает старый экран при переходе */}
      {coverVisible && (
        <Animated.View pointerEvents="none" style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: tk.bg, opacity: coverOpacity, zIndex: 999,
        }}/>
      )}
      {TAB_SCREENS.includes(screen) && <BottomNav screen={screen} onPress={s=>s==='add'?setScreen('addHabit'):animateScreenChange(s as Screen)} tk={tk} lang={lang} theme={theme}
      friendsBadge={members.length>1 ? members.filter(m=>m.id!==myId).filter(m=>{
        const dow=todayDow();
        const todayH=(space?.habits||[]).filter(h=>!h.archived && h.days?.includes(dow));
        return todayH.some(h=>isLogged(h.id,m.id,logs));
      }).length : 0}/>}
      {/* Android-style bottom cross bar для под-экранов */}
      {Platform.OS==='android' && backDestination[screen] && (
        <View style={{position:'absolute',bottom:0,left:0,right:0,
          backgroundColor:tk.bg+'f2',
          borderTopWidth:0.5,borderTopColor:tk.border,
          paddingBottom:8,paddingTop:4,
          flexDirection:'row',justifyContent:'center'}}>
          <TouchableOpacity
            onPress={()=>animateScreenChange(backDestination[screen]!)}
            hitSlop={{top:12,bottom:12,left:60,right:60}}
            style={{paddingVertical:8,paddingHorizontal:32}}>
            <View style={{width:48,height:4,borderRadius:2,backgroundColor:tk.text3,opacity:0.5}}/>
          </TouchableOpacity>
        </View>
      )}
      {pendInv&&(
        <View style={{position:'absolute',bottom:80,left:20,right:20,backgroundColor:tk.bg2,borderRadius:14,padding:16,borderWidth:1,borderColor:tk.border}}>
          <Text style={{fontSize:13,fontWeight:'600',color:tk.text,marginBottom:10}}> {isEn?'You were invited':'Вас приглашают'}</Text>
          <View style={{flexDirection:'row',gap:8}}>
            <TouchableOpacity onPress={()=>setPendInv(null)} style={{flex:1,padding:10,borderRadius:10,backgroundColor:tk.bg3,alignItems:'center'}}>
              <Text style={{fontSize:12,color:tk.text3}}>{isEn?'Decline':'Отклонить'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={()=>doJoin(pendInv)} style={{flex:2,padding:10,borderRadius:10,backgroundColor:tk.text,alignItems:'center'}}>
              <Text style={{fontSize:12,fontWeight:'700',color:tk.bg}}>{isEn?'Accept':'Принять'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {loading&&<Loader tk={tk}/>}
      {toast&&<Toast msg={toast.msg} ok={toast.ok} tk={tk}/>}
    </View>
  );
}
