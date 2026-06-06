import { initializeApp, getApps } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager, // React Native — одна "вкладка"
} from 'firebase/firestore';
import { initializeAuth, getAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey:            'AIzaSyBe1ywh7O8K0-b4v8A1yGTOnqEWA3hNnYI',
  authDomain:        'pathtogether-1d449.firebaseapp.com',
  projectId:         'pathtogether-1d449',
  storageBucket:     'pathtogether-1d449.firebasestorage.app',
  messagingSenderId: '257808858919',
  appId:             '1:257808858919:web:465f79f4138263aff2b302',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// ── Firestore с персистентным кешом ─────────────────────────────────────────
let db: ReturnType<typeof initializeFirestore>;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentSingleTabManager({ forceOwnership: true }),
    }),
    ignoreUndefinedProperties: true,
  });
} catch {
  // Firestore уже инициализирован (Hot Reload) или среда не поддерживает кеш
  const { getFirestore } = require('firebase/firestore');
  db = getFirestore(app);
}
export { db };

// ── Auth с сохранением сессии через AsyncStorage ─────────────────────────────
// getReactNativePersistence экспортируется только в react-native бандле (@firebase/auth/dist/rn),
// который Metro подхватывает автоматически через поле "react-native" в package.json.
// require() используем чтобы избежать TS-ошибки (браузерные типы не объявляют эту функцию).
let auth: ReturnType<typeof getAuth>;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getReactNativePersistence } = require('@firebase/auth/dist/rn/index.js');
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  // Уже инициализирован или getReactNativePersistence недоступен — берём готовый инстанс
  auth = getAuth(app);
}
export { auth };
