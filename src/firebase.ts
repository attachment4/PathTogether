import { initializeApp, getApps } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import {
  initializeAuth,
  getReactNativePersistence,
  getAuth,
} from 'firebase/auth';
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
// Включаем offline persistence - данные кэшируются локально
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

let auth: ReturnType<typeof getAuth>;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app);
}
export { auth };
