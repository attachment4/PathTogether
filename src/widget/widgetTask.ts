/**
 * Background task для обновления виджета
 * Запускается при изменении привычек или по таймеру
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const WIDGET_DATA_KEY = 'widget_data';

export interface WidgetData {
  habits: Array<{ id: string; name: string; done: boolean; color?: string }>;
  doneCount: number;
  totalCount: number;
  userName: string;
  updatedAt: number;
}

// Сохранить данные для виджета
export async function updateWidgetData(data: WidgetData): Promise<void> {
  try {
    await AsyncStorage.setItem(WIDGET_DATA_KEY, JSON.stringify(data));
    // Уведомить нативный виджет об обновлении
    try {
      const { WidgetTaskHandler } = await import('react-native-android-widget');
      await WidgetTaskHandler.requestWidgetUpdate({
        widgetName: 'HabitsWidget',
        renderWidget: () => null, // обновится автоматически
        widgetNotFound: () => {},
      });
    } catch {
      // Виджет не установлен или SDK недоступен
    }
  } catch (e) {
    console.warn('[Widget] Failed to update data:', e);
  }
}

// Загрузить данные для виджета
export async function getWidgetData(): Promise<WidgetData | null> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_DATA_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
