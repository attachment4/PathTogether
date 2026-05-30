# PathTogether Widget — Инструкция по установке

## Три размера виджета
- **2x1** — маленький: счётчик X/Y + прогресс-бар
- **4x2** — средний: список привычек с прогрессом
- **4x4** — большой: полный список + имя пользователя

---

## Шаги для активации

### 1. Установить зависимости
```bash
npm install react-native-android-widget --legacy-peer-deps
```

### 2. Создать preview изображение
Положи любое изображение 320x146px в `assets/widget-preview.png`

### 3. Зарегистрировать виджет в index.js
Добавь в конец `index.js`:
```js
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './src/widget/widgetTaskHandler';

registerWidgetTaskHandler(widgetTaskHandler);
```

### 4. Создать src/widget/widgetTaskHandler.ts
```typescript
import { WidgetTaskHandlerProps } from 'react-native-android-widget';
import React from 'react';
import { SmallWidget, MediumWidget, LargeWidget } from './HabitsWidget';
import { getWidgetData } from './widgetTask';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const data = await getWidgetData();
  const habits = data?.habits || [];
  const doneCount = data?.doneCount || 0;
  const totalCount = data?.totalCount || 0;
  const userName = data?.userName || '';

  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
      props.renderWidget(
        React.createElement(MediumWidget, { habits, doneCount, totalCount, userName })
      );
      break;
    case 'WIDGET_CLICK':
      // Открыть приложение - обрабатывается автоматически через clickAction="OPEN_APP"
      break;
  }
}
```

### 5. EAS Build
```bash
# Виджет работает только в нативной сборке
eas build --platform android --profile rustore
```

---

## Как добавить виджет на рабочий стол
1. Долгое нажатие на рабочем столе
2. Виджеты → PathTogether
3. Выбери размер (2x1, 4x2, или 4x4)
4. Перетащи на рабочий стол

---

## Обновление данных
Виджет обновляется автоматически при:
- Отметке/снятии привычки
- Открытии приложения
- Каждые 30 минут (Android ограничение)

---

## Стиль виджета
Виджет использует тёмную тему (чёрный фон #0a0a0a, белый текст).
Цвета привычек отображаются как точки рядом с названием.
