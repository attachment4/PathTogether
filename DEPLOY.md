# PathTogether — Деплой в RuStore

## Статус компонентов
- [x] Код приложения готов
- [x] Cloud Functions написаны (functions/index.js)
- [x] Push уведомления через FCM
- [x] RuStore Billing SDK (ленивая загрузка)
- [x] eas.json настроен
- [ ] google-services.json (нужен от тебя)
- [ ] RuStore App ID (после регистрации)
- [ ] EAS Build (команды ниже)
- [ ] Деплой Cloud Functions

---

## ШАГ 1 — google-services.json

1. Firebase Console → Project Settings → General
2. Android apps → com.attach4.pathtogether
3. Скачай google-services.json
4. Положи в корень проекта: PathTogetherRelease/google-services.json
5. Раскомментируй в app.json:
   ```json
   "googleServicesFile": "./google-services.json"
   ```

---

## ШАГ 2 — Задеплоить Cloud Functions

```bash
cd functions
npm install
firebase login
firebase use pathtogether-1d449
firebase deploy --only functions
```

Функции:
- `notifyPartner` — callable, отправляет push
- `onNotificationCreated` — Firestore триггер, автоотправка
- `cleanupNotifications` — очистка каждые 24ч

---

## ШАГ 3 — RuStore Console

1. Зайди на https://console.rustore.ru
2. Создай приложение: com.attach4.pathtogether
3. Скопируй App ID (число)
4. Вставь в src/purchases.ts:
   ```ts
   const RUSTORE_APP_ID = '123456'; // твой App ID
   ```
5. Создай подписки в Монетизация → Подписки:
   - ID: `com.pathtogether.duo.monthly`, цена 129₽
   - ID: `com.pathtogether.team.monthly`, цена 299₽

---

## ШАГ 4 — EAS Build

```bash
# Установить EAS CLI
npm install -g eas-cli

# Логин
eas login  # используй аккаунт hattachment44

# Сборка APK для RuStore
eas build --platform android --profile rustore

# После сборки скачай APK и загрузи в RuStore Console
```

Первая сборка создаст keystore — EAS сохранит его автоматически.

---

## ШАГ 5 — Загрузить в RuStore

1. RuStore Console → Приложения → PathTogether → Версии
2. Загрузи APK
3. Заполни:
   - Краткое описание (до 80 символов)
   - Полное описание
   - Скриншоты (минимум 2, 1080×1920px)
   - Иконка (512×512px — уже есть в assets/)
4. Возрастной рейтинг: 6+
5. Категория: Здоровье и фитнес
6. Отправь на модерацию (3-5 дней)

---

## ШАГ 6 — Описание для RuStore (копипаст)

**Краткое (80 символов):**
```
Отслеживай привычки вместе с партнёром в реальном времени
```

**Полное:**
```
PathTogether — минималистичное приложение для совместного отслеживания привычек.

Создавай привычки, отмечай выполнение и наблюдай за прогрессом партнёра в реальном времени. Push-уведомления сообщат когда партнёр выполнил привычку.

Что внутри:
• Совместное отслеживание с партнёром
• 45+ достижений с легендарными наградами
• Серии дней, статистика, heatmap активности
• Напоминания на выбранное время
• 5 языков: русский, английский, украинский, белорусский, казахский
• Тёмная и светлая темы

Тарифы:
• Бесплатно — до 5 привычек, соло
• Пара (129₽/мес) — с 1 партнёром
• Команда (299₽/мес) — до 5 участников
```

---

## Переменные которые нужно подставить

| Файл | Что заменить | Где взять |
|------|-------------|-----------|
| `src/purchases.ts` | `RUSTORE_APP_ID` | RuStore Console → Настройки → App ID |
| `app.json` | раскомментировать `googleServicesFile` | после добавления google-services.json |
| `src/screens/AuthScreen.tsx` | уже подставлен Web Client ID | ✓ готово |

---

## Команды для проверки

```bash
# Запустить локально
npx expo start --clear

# Проверить TypeScript
npx tsc --noEmit

# Сборка preview APK (без RuStore Billing)
eas build --platform android --profile preview
```
