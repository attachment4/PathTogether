/**
 * PathTogether — Android Widget
 * 
 * Показывает привычки на сегодня с прогрессом
 * Работает только в EAS Build (не Expo Go)
 * 
 * Установка:
 * npm install react-native-android-widget
 * npx expo install expo-task-manager
 */

import React from 'react';
import {
  FlexWidget,
  TextWidget,
} from 'react-native-android-widget';

export interface WidgetHabit {
  id: string;
  name: string;
  done: boolean;
  color?: string;
}

interface WidgetProps {
  habits: WidgetHabit[];
  doneCount: number;
  totalCount: number;
  userName?: string;
}

// ── 2x1 Маленький виджет ─────────────────────────────────────────────────────
export function SmallWidget({ doneCount, totalCount }: WidgetProps) {
  const pct = totalCount > 0 ? doneCount / totalCount : 0;
  return (
    <FlexWidget
      style={{ flex: 1, backgroundColor: '#0a0a0a', borderRadius: 20,
        padding: 16, justifyContent: 'space-between' }}
      clickAction="OPEN_APP">
      <TextWidget text="PathTogether"
        style={{ fontSize: 10, color: '#555', fontFamily: 'sans-serif' }}/>
      <TextWidget text={`${doneCount}/${totalCount}`}
        style={{ fontSize: 28, fontWeight: 'bold', color: '#fff', fontFamily: 'sans-serif-medium' }}/>
      <FlexWidget style={{ height: 3, backgroundColor: '#222', borderRadius: 2, overflow: 'hidden' }}>
        <FlexWidget style={{ width: `${Math.round(pct*100)}%`, height: 3,
          backgroundColor: pct === 1 ? '#fff' : '#444', borderRadius: 2 }}/>
      </FlexWidget>
    </FlexWidget>
  );
}

// ── 4x2 Средний виджет ───────────────────────────────────────────────────────
export function MediumWidget({ habits, doneCount, totalCount }: WidgetProps) {
  const pct = totalCount > 0 ? doneCount / totalCount : 0;
  return (
    <FlexWidget
      style={{ flex: 1, backgroundColor: '#0a0a0a', borderRadius: 20,
        padding: 14, gap: 8 }}
      clickAction="OPEN_APP">
      <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <TextWidget text="Сегодня"
          style={{ fontSize: 13, fontWeight: 'bold', color: '#fff', fontFamily: 'sans-serif-medium' }}/>
        <TextWidget text={`${doneCount}/${totalCount}`}
          style={{ fontSize: 12, color: '#666', fontFamily: 'sans-serif' }}/>
      </FlexWidget>
      <FlexWidget style={{ height: 2, backgroundColor: '#222', borderRadius: 1, overflow: 'hidden' }}>
        <FlexWidget style={{ width: `${Math.round(pct*100)}%`, height: 2,
          backgroundColor: '#fff', borderRadius: 1 }}/>
      </FlexWidget>
      {habits.slice(0, 5).map(h => (
        <FlexWidget key={h.id}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: h.done ? 0.4 : 1 }}
          clickAction="OPEN_APP">
          <FlexWidget style={{ width: 6, height: 6, borderRadius: 3,
            backgroundColor: h.done ? '#444' : (h.color || '#888') }}/>
          <TextWidget text={h.name}
            style={{ flex: 1, fontSize: 12, color: h.done ? '#555' : '#ccc', fontFamily: 'sans-serif' }}/>
        </FlexWidget>
      ))}
      {totalCount === 0 && (
        <TextWidget text="Нет привычек на сегодня"
          style={{ fontSize: 11, color: '#444', fontFamily: 'sans-serif' }}/>
      )}
    </FlexWidget>
  );
}

// ── 4x4 Большой виджет ───────────────────────────────────────────────────────
export function LargeWidget({ habits, doneCount, totalCount, userName }: WidgetProps) {
  const pct = totalCount > 0 ? doneCount / totalCount : 0;
  return (
    <FlexWidget
      style={{ flex: 1, backgroundColor: '#0a0a0a', borderRadius: 24,
        padding: 18, gap: 10 }}
      clickAction="OPEN_APP">
      <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <FlexWidget style={{ gap: 2 }}>
          <TextWidget text={`Привет, ${userName || ''}`}
            style={{ fontSize: 10, color: '#555', fontFamily: 'sans-serif' }}/>
          <TextWidget text={pct === 1 ? 'Всё выполнено!' : 'Сегодня'}
            style={{ fontSize: 18, fontWeight: 'bold', color: '#fff', fontFamily: 'sans-serif-medium' }}/>
        </FlexWidget>
        <TextWidget text={`${doneCount}/${totalCount}`}
          style={{ fontSize: 14, color: '#666', fontFamily: 'sans-serif' }}/>
      </FlexWidget>
      <FlexWidget style={{ height: 3, backgroundColor: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
        <FlexWidget style={{ width: `${Math.round(pct*100)}%`, height: 3,
          backgroundColor: pct === 1 ? '#fff' : '#444', borderRadius: 2 }}/>
      </FlexWidget>
      {habits.slice(0, 7).map(h => (
        <FlexWidget key={h.id}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: h.done ? 0.3 : 1 }}
          clickAction="OPEN_APP">
          <FlexWidget style={{ width: 18, height: 18, borderRadius: 9,
            backgroundColor: '#1a1a1a', borderWidth: 1,
            borderColor: h.done ? '#2a2a2a' : '#333',
            alignItems: 'center', justifyContent: 'center' }}>
            {h.done && (
              <TextWidget text="✓"
                style={{ fontSize: 9, color: '#555', fontFamily: 'sans-serif' }}/>
            )}
          </FlexWidget>
          <TextWidget text={h.name}
            style={{ flex: 1, fontSize: 13, color: h.done ? '#444' : '#ddd', fontFamily: 'sans-serif' }}/>
          <FlexWidget style={{ width: 5, height: 5, borderRadius: 2.5,
            backgroundColor: h.color || '#333', opacity: 0.6 }}/>
        </FlexWidget>
      ))}
    </FlexWidget>
  );
}
