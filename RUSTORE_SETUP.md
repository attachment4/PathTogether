# RuStore — Интеграция PathTogether

## Статус
Приложение готово к публикации в RuStore.
Текущий режим оплаты: тестовый (показывает Alert).

---

## Шаги для публикации

### 1. Регистрация в RuStore Console
1. Зайди на https://console.rustore.ru
2. Зарегистрируйся как разработчик
3. Создай новое приложение: `com.attach4.pathtogether`
4. Загрузи APK/AAB через EAS Build

### 2. EAS Build
```bash
npm install -g eas-cli
eas login
eas build --platform android --profile production
```

### 3. In-App Покупки через RuStore SDK

Установи пакет:
```bash
npm install @rustore/react-native-rustore-billing-client
```

Product IDs (создай в Console → Продукты):
- `com.pathtogether.duo.monthly` — Пара (129₽/мес)
- `com.pathtogether.team.monthly` — Команда (299₽/мес)

Интеграция в `src/purchases.ts`:
```typescript
import RuStoreBillingClient from '@rustore/react-native-rustore-billing-client';

// Инициализация
await RuStoreBillingClient.init('ВАШ_CONSOLE_APPLICATION_ID');

// Покупка
const paymentResult = await RuStoreBillingClient.purchaseProduct({
  productId: 'com.pathtogether.duo.monthly',
});
```

### 4. Push-уведомления
RuStore поддерживает FCM. Файл `google-services.json` уже подключён.
Firebase Console → Cloud Messaging → Server Key (уже настроено).

### 5. Описание для RuStore (русский)

**Краткое описание (80 символов):**
Отслеживай привычки вместе с партнёром в реальном времени

**Полное описание:**
PathTogether — минималистичное приложение для отслеживания привычек вдвоём.

Создавай привычки, отмечай выполнение и наблюдай за прогрессом партнёра в реальном времени. Поддержка и совместная ответственность делают новые привычки устойчивыми.

**Что внутри:**
• Совместное отслеживание привычек с партнёром
• Серии дней и достижения (45+ наград)
• Календарь активности и детальная статистика
• Напоминания на выбранное время
• 5 языков: русский, английский, украинский, белорусский, казахский
• Тёмная и светлая темы

**Тарифы:**
• Бесплатно: до 5 привычек, соло-режим
• Пара (129₽/мес): совместное отслеживание с 1 партнёром
• Команда (299₽/мес): до 5 участников, командная статистика

### 6. Категории и теги
- Категория: Здоровье и фитнес
- Теги: привычки, продуктивность, здоровье, партнёр, трекер

### 7. Рейтинг приложения
- Возрастное ограничение: 6+
- Нет насилия, нет нежелательного контента

### 8. Скриншоты (нужно подготовить)
Рекомендуемые размеры: 1080×1920px (Portrait)
1. Главный экран с привычками
2. Экран партнёра/друзей
3. Статистика с heatmap
4. Достижения
5. Онбординг

---

## Технические требования RuStore
- minSdkVersion: 23 (Android 6.0)
- targetSdkVersion: 34
- Подпись: keystore из EAS

## Статус готовности
- [x] Русский язык основной
- [x] Без Google Play Billing (тестовый режим)
- [x] Ссылка на управление подпиской → rustore.ru
- [x] Политика конфиденциальности
- [x] Push-уведомления через FCM
- [ ] RuStore Billing SDK (нужна интеграция)
- [ ] Загрузка в Console
- [ ] Прохождение модерации (обычно 3-5 дней)
