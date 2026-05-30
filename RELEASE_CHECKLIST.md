# PathTogether — Финальный чеклист релиза RuStore

## Статус готовности

### Код ✓
- [x] Все экраны реализованы
- [x] Мультиязычность (ru/en/uk/be/kk)  
- [x] Push уведомления (Cloud Functions готовы)
- [x] RuStore Billing SDK (ленивая загрузка, ждёт App ID)
- [x] 45 достижений с переводами
- [x] Виджет (ждёт EAS Build)
- [x] Статистика с heatmap
- [x] Онбординг с анимациями

---

## ШАГ 1 — google-services.json (КРИТИЧНО)
**Без этого EAS Build не соберётся**

1. Firebase Console → https://console.firebase.google.com/project/pathtogether-1d449/settings/general
2. Android apps → com.attach4.pathtogether
3. Скачай **google-services.json**
4. Положи в корень: `PathTogetherRelease/google-services.json`
5. Раскомментируй в `app.json`:
   ```json
   "googleServicesFile": "./google-services.json"
   ```

---

## ШАГ 2 — RuStore Console
1. Зарегистрируйся: https://console.rustore.ru
2. Создай приложение → укажи `com.attach4.pathtogether`
3. Скопируй **App ID** (числовой)
4. Вставь в `src/purchases.ts`:
   ```ts
   const RUSTORE_APP_ID = '123456'; // твой App ID
   ```
5. Создай подписки → Монетизация:
   - `com.pathtogether.duo.monthly` — 129 ₽/мес
   - `com.pathtogether.team.monthly` — 299 ₽/мес

---

## ШАГ 3 — Cloud Functions
```bash
cd functions
npm install
firebase login
firebase use pathtogether-1d449
firebase deploy --only functions
```

---

## ШАГ 4 — EAS Build
```bash
# Установи EAS CLI
npm install -g eas-cli

# Логин (аккаунт hattachment44)
eas login

# Сборка APK для RuStore
eas build --platform android --profile rustore

# Скачай APK после сборки (ссылка придёт в терминал)
```
**Первая сборка создаст keystore автоматически — EAS сохранит его.**

---

## ШАГ 5 — После EAS Build: активировать виджет
В `app.json` добавь плагин:
```json
"plugins": [
  ...,
  ["react-native-android-widget", {
    "widgets": [{
      "name": "HabitsWidget",
      "label": "PathTogether",
      "description": "Привычки на сегодня",
      "previewImage": "./assets/widget-preview.png",
      "minWidth": "160dp",
      "minHeight": "80dp",
      "targetCellWidth": 2,
      "targetCellHeight": 1,
      "resizable": "both"
    }]
  }]
]
```
В `index.js` добавь:
```js
import { registerWidgetTaskHandler } from 'react-native-android-widget';
registerWidgetTaskHandler(async (props) => {
  const { getWidgetData } = require('./src/widget/widgetTask');
  const { MediumWidget } = require('./src/widget/HabitsWidget');
  const data = await getWidgetData();
  if (props.widgetAction === 'WIDGET_ADDED' || props.widgetAction === 'WIDGET_UPDATE') {
    props.renderWidget(React.createElement(MediumWidget, data || { habits: [], doneCount: 0, totalCount: 0 }));
  }
});
```

---

## ШАГ 6 — Загрузить в RuStore Console
1. Версии → Создать версию
2. Загрузи APK
3. Заполни:

**Краткое описание (≤80 символов):**
```
Отслеживай привычки вместе с партнёром в реальном времени
```

**Полное описание:**
```
PathTogether — минималистичное приложение для совместного отслеживания привычек.

Создавай привычки, отмечай выполнение и наблюдай за прогрессом партнёра в реальном времени. Push-уведомления сообщат когда партнёр выполнил привычку.

Что внутри:
• Совместное отслеживание с партнёром
• 45+ достижений с легендарными наградами  
• Серии дней, тепловая карта активности
• Напоминания на выбранное время
• 5 языков: русский, украинский, белорусский, казахский, английский
• Тёмная и светлая темы

Тарифы:
• Бесплатно — личные привычки, без ограничений
• Пара (129 ₽/мес) — совместное отслеживание с партнёром
• Команда (299 ₽/мес) — до 5 участников
```

4. Скриншоты (минимум 2, размер 1080×1920px):
   - Главный экран с привычками
   - Экран друзей/партнёра
   - Статистика
   - Достижения

5. Возрастной рейтинг: **6+**
6. Категория: **Здоровье и фитнес**
7. Отправь на модерацию (обычно 3-5 рабочих дней)

---

## Что нужно от тебя (в порядке приоритета)

| # | Действие | Где |
|---|---------|-----|
| 1 | Скачать google-services.json | Firebase Console |
| 2 | Зарегистрировать приложение в RuStore | console.rustore.ru |
| 3 | Вставить RuStore App ID в код | src/purchases.ts |
| 4 | Запустить EAS Build | Терминал |
| 5 | Задеплоить Cloud Functions | Терминал |
| 6 | Сделать скриншоты приложения | Телефон |
| 7 | Загрузить APK в RuStore Console | console.rustore.ru |

---
*PathTogether v1.0.0 | com.attach4.pathtogether | minSDK 23*
