const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

// ── Отправить push партнёру (callable) ───────────────────────────────────────
exports.notifyPartner = functions.region('europe-west1').https.onCall(async (data) => {
  const { fromName, toUid, habitName } = data;
  if (!toUid || !habitName) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
  }
  try {
    const tokenDoc = await db.collection('users').doc(toUid).get();
    const token = tokenDoc.data()?.fcmToken;
    if (!token) return { success: false, reason: 'no_token' };

    await messaging.send({
      token,
      notification: {
        title: fromName || 'PathTogether',
        body: `выполнил${fromName ? '' : 'и'}: ${habitName}`,
      },
      data: { type: 'habit_done', habitName },
      android: {
        priority: 'high',
        notification: { channelId: 'partner', sound: 'default' },
      },
    });
    return { success: true };
  } catch (e) {
    console.error('[notifyPartner]', e);
    return { success: false, error: String(e) };
  }
});

// ── Firestore триггер: автоматически при записи уведомления ──────────────────
exports.onNotificationCreated = functions
  .region('europe-west1')
  .firestore.document('spaces/{spaceId}/notifications/{notifId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    if (!data || data.sent || data.type !== 'habit_done') return null;

    try {
      const tokenDoc = await db.collection('users').doc(data.toUid).get();
      const token = tokenDoc.data()?.fcmToken;
      if (!token) {
        await snap.ref.update({ sent: true, error: 'no_token' });
        return null;
      }

      await messaging.send({
        token,
        notification: {
          title: data.fromName || 'PathTogether',
          body: `${data.fromName} выполнил: ${data.habitName}`,
        },
        data: { type: 'habit_done', habitName: data.habitName },
        android: {
          priority: 'high',
          notification: { channelId: 'partner', sound: 'default' },
        },
      });

      await snap.ref.update({ sent: true, sentAt: admin.firestore.FieldValue.serverTimestamp() });
      return null;
    } catch (e) {
      console.error('[onNotificationCreated]', e);
      await snap.ref.update({ sent: true, error: String(e) });
      return null;
    }
  });

// ── Сохранить FCM токен ───────────────────────────────────────────────────────
exports.saveToken = functions.region('europe-west1').https.onCall(async (data) => {
  const { uid, token } = data;
  if (!uid || !token) throw new functions.https.HttpsError('invalid-argument', 'Missing uid or token');
  await db.collection('users').doc(uid).set({ fcmToken: token, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  return { success: true };
});

// ── Очистка старых уведомлений (каждые 24ч) ──────────────────────────────────
exports.cleanupNotifications = functions
  .region('europe-west1')
  .pubsub.schedule('every 24 hours')
  .onRun(async () => {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 дней
    const spaces = await db.collection('spaces').get();
    const batch = db.batch();
    let count = 0;
    for (const space of spaces.docs) {
      const old = await space.ref.collection('notifications')
        .where('sent', '==', true)
        .where('createdAt', '<', cutoff)
        .get();
      old.docs.forEach(d => { batch.delete(d.ref); count++; });
    }
    if (count > 0) await batch.commit();
    console.log(`Cleaned up ${count} old notifications`);
    return null;
  });

// ══════════════════════════════════════════════════════════════════════════════
// ЮКасса — платежи
// ══════════════════════════════════════════════════════════════════════════════
const axios = require('axios');

// ВАЖНО: задайте секрет через переменные окружения Firebase Functions:
//   firebase functions:config:set yookassa.shop_id="1369225" yookassa.secret="live_YOUR_NEW_KEY"
// Старый ключ live_yN4mAT3qQSU_... НЕОБХОДИМО ОТОЗВАТЬ в личном кабинете ЮКассы!
const YOOKASSA_SHOP_ID  = (functions.config().yookassa || {}).shop_id  || process.env.YOOKASSA_SHOP_ID  || '';
const YOOKASSA_SECRET   = (functions.config().yookassa || {}).secret    || process.env.YOOKASSA_SECRET   || '';
const YOOKASSA_BASE_URL = 'https://api.yookassa.ru/v3';

const PLANS = {
  duo:  { amount: '129.00', label: 'PathTogether — план «Пара»' },
  team: { amount: '299.00', label: 'PathTogether — план «Команда»' },
};

// ── Создать платёж (callable) ─────────────────────────────────────────────────
exports.createPayment = functions.region('europe-west1').https.onCall(async (data) => {
  const { uid, plan, returnUrl } = data;
  if (!uid || !plan || !PLANS[plan]) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing uid or plan');
  }

  const idempotenceKey = `${uid}_${plan}_${Date.now()}`;

  try {
    const response = await axios.post(
      `${YOOKASSA_BASE_URL}/payments`,
      {
        amount: { value: PLANS[plan].amount, currency: 'RUB' },
        confirmation: {
          type: 'redirect',
          return_url: returnUrl || 'pathtogether://payment-result',
        },
        capture: true,
        description: PLANS[plan].label,
        metadata: { uid, plan },
        receipt: {
          customer: { email: '' },
          items: [{
            description: PLANS[plan].label,
            quantity: '1.00',
            amount: { value: PLANS[plan].amount, currency: 'RUB' },
            vat_code: 1,
            payment_mode: 'full_payment',
            payment_subject: 'service',
          }],
        },
      },
      {
        auth: { username: YOOKASSA_SHOP_ID, password: YOOKASSA_SECRET },
        headers: {
          'Idempotence-Key': idempotenceKey,
          'Content-Type': 'application/json',
        },
      }
    );

    const payment = response.data;

    // Сохраняем платёж в Firestore для последующей проверки
    await db.collection('payments').doc(payment.id).set({
      uid,
      plan,
      paymentId: payment.id,
      status: payment.status,
      amount: PLANS[plan].amount,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      paymentId: payment.id,
      confirmationUrl: payment.confirmation.confirmation_url,
    };
  } catch (e) {
    console.error('[createPayment]', e?.response?.data || e);
    throw new functions.https.HttpsError('internal', 'Payment creation failed');
  }
});

// ── Вебхук от ЮКассы ──────────────────────────────────────────────────────────
exports.yookassaWebhook = functions.region('europe-west1').https.onRequest(async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }

  // Верификация подписи ЮКассы
  // Задайте секрет вебхука: firebase functions:config:set yookassa.webhook_secret="YOUR_WEBHOOK_SECRET"
  const webhookSecret = (functions.config().yookassa || {}).webhook_secret || process.env.YOOKASSA_WEBHOOK_SECRET;
  if (webhookSecret) {
    const crypto = require('crypto');
    const signature = req.headers['x-yookassa-signature'] || req.headers['x-yoomoney-signature'];
    if (signature) {
      const expected = crypto.createHmac('sha256', webhookSecret)
        .update(JSON.stringify(req.body)).digest('hex');
      if (signature !== expected) {
        console.warn('[yookassaWebhook] Invalid signature');
        res.status(403).send('Forbidden');
        return;
      }
    }
  }

  const event = req.body;
  console.log('[yookassaWebhook] event:', JSON.stringify(event));

  if (event?.event !== 'payment.succeeded') {
    res.status(200).send('ok');
    return;
  }

  const payment = event.object;
  const { uid, plan } = payment?.metadata || {};

  if (!uid || !plan) {
    console.warn('[yookassaWebhook] Missing metadata:', payment?.metadata);
    res.status(200).send('ok');
    return;
  }

  try {
    // Обновляем статус платежа
    await db.collection('payments').doc(payment.id).set(
      { status: 'succeeded', paidAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );

    // Активируем план — находим space пользователя
    const spacesSnap = await db.collection('spaces')
      .where('memberIds', 'array-contains', uid)
      .limit(1)
      .get();

    // Считаем дату окончания — +30 дней
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    if (!spacesSnap.empty) {
      await spacesSnap.docs[0].ref.update({
        plan,
        planUid: uid,
        planExpiresAt: expiresAt.toISOString(),
        planActivatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Также сохраняем в профиле пользователя
    await db.collection('users').doc(uid).set({
      plan,
      planExpiresAt: expiresAt.toISOString(),
      planPaymentId: payment.id,
    }, { merge: true });

    console.log(`[yookassaWebhook] Plan ${plan} activated for ${uid}`);
    res.status(200).send('ok');
  } catch (e) {
    console.error('[yookassaWebhook] Error:', e);
    res.status(500).send('Internal error');
  }
});

// ── Проверить активный план (callable) ───────────────────────────────────────
exports.checkPlan = functions.region('europe-west1').https.onCall(async (data) => {
  const { uid } = data;
  if (!uid) throw new functions.https.HttpsError('invalid-argument', 'Missing uid');

  try {
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();

    if (!userData?.plan || userData.plan === 'free') {
      return { plan: 'free' };
    }

    // Проверяем не истёк ли план
    if (userData.planExpiresAt) {
      const expires = new Date(userData.planExpiresAt);
      if (expires < new Date()) {
        // Plan expired — сбрасываем
        await db.collection('users').doc(uid).update({ plan: 'free' });
        return { plan: 'free', expired: true };
      }
    }

    return {
      plan: userData.plan,
      expiresAt: userData.planExpiresAt,
    };
  } catch (e) {
    console.error('[checkPlan]', e);
    return { plan: 'free' };
  }
});
