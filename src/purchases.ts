/**
 * Оплата через ЮКасса + Firebase Functions
 */

import { Alert, Linking } from 'react-native';
import { auth } from './firebase';

export const PRODUCT_IDS = {
  duo:  'com.pathtogether.duo.monthly',
  team: 'com.pathtogether.team.monthly',
};

export const PRICES = {
  duo:  { ru: '129 ₽/мес', en: '129 ₽/mo' },
  team: { ru: '299 ₽/мес', en: '299 ₽/mo' },
};

const FUNCTIONS_BASE = 'https://path-together-server.vercel.app';

async function getIdToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken();
}

export async function initPurchases(_userId: string): Promise<void> {}

export async function purchasePlan(
  plan: 'duo' | 'team',
  lang: string,
  uid: string,
): Promise<{ success: boolean; cancelled?: boolean; paymentUrl?: string }> {
  const isEn = lang === 'en';

  try {
    const idToken = await getIdToken();

    const response = await fetch(`${FUNCTIONS_BASE}/api/create-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({ uid, plan }),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const json = await response.json();
    const confirmationUrl = json?.result?.confirmationUrl || json?.confirmationUrl;

    if (!confirmationUrl) {
      throw new Error('No payment URL');
    }

    const canOpen = await Linking.canOpenURL(confirmationUrl);
    if (canOpen) {
      await Linking.openURL(confirmationUrl);
      return { success: false, paymentUrl: confirmationUrl };
    }

    throw new Error('Cannot open payment URL');

  } catch (e: any) {
    console.warn('[purchasePlan]', e);
    Alert.alert(
      isEn ? 'Payment error' : 'Ошибка оплаты',
      isEn ? 'Could not open payment page. Try again.' : 'Не удалось открыть страницу оплаты. Попробуйте ещё раз.'
    );
    return { success: false };
  }
}

/**
 * Проверяет статус плана на сервере и возвращает актуальные данные.
 * Активация плана происходит только через вебхук ЮКассы — клиент только читает.
 */
export async function restorePurchases(
  lang: string,
  uid: string,
): Promise<{ plan: 'duo' | 'team' | 'free'; expiresAt?: string } | null> {
  const isEn = lang === 'en';

  try {
    const idToken = await getIdToken();

    const response = await fetch(`${FUNCTIONS_BASE}/api/check-plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({ uid }),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const json = await response.json();
    const result = json?.result;

    if (!result || result.plan === 'free') {
      Alert.alert(
        isEn ? 'Nothing found' : 'Ничего не найдено',
        isEn ? 'No active subscriptions.' : 'Активных подписок нет.'
      );
      return { plan: 'free' };
    }

    Alert.alert(
      isEn ? 'Restored!' : 'Восстановлено!',
      isEn ? `Plan "${result.plan}" is active.` : `Тариф "${result.plan}" активен.`
    );
    return { plan: result.plan, expiresAt: result.expiresAt };

  } catch (e) {
    console.warn('[restorePurchases]', e);
    return null;
  }
}
