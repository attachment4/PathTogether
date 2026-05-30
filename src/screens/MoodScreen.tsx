import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  ScrollView, Platform, StatusBar,
} from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { Theme } from '../theme';
import { Storage, MoodEntry } from '../store';
import { todayS } from '../utils';
import { STATUS_BAR_TOP as TOP } from '../utils';

interface Props {
  myId: string;
  lang: string;
  tk: Theme;
  onBack: () => void;
}

// Mood represented as abstract shapes/fills, not emoji
const MOODS: { val: 1|2|3|4|5; label_ru: string; label_en: string; color: string }[] = [
  { val: 1, label_ru: 'Плохо',     label_en: 'Bad',   color: '#c8a0a0' },
  { val: 2, label_ru: 'Так себе',  label_en: 'Meh',   color: '#c8b48c' },
  { val: 3, label_ru: 'Нормально', label_en: 'Okay',  color: '#b8b88c' },
  { val: 4, label_ru: 'Хорошо',    label_en: 'Good',  color: '#8cb8a0' },
  { val: 5, label_ru: 'Отлично',   label_en: 'Great', color: '#8ca8c8' },
];

// Abstract mood face - minimal SVG
function MoodFace({ val, color, size = 40 }: { val: number; color: string; size?: number }) {
  const s = size;
  const c = s / 2;
  const r = s * 0.42;
  const eyeY = c - s * 0.08;
  const eyeR = s * 0.05;
  const eyeX = c * 0.55;
  const mouthY = c + s * 0.14;
  const mouthW = s * 0.28;

  // Mouth curve based on mood
  const curves: Record<number, string> = {
    1: `M ${c - mouthW} ${mouthY + s*0.06} Q ${c} ${mouthY - s*0.06} ${c + mouthW} ${mouthY + s*0.06}`,
    2: `M ${c - mouthW} ${mouthY + s*0.02} Q ${c} ${mouthY - s*0.01} ${c + mouthW} ${mouthY + s*0.02}`,
    3: `M ${c - mouthW} ${mouthY} L ${c + mouthW} ${mouthY}`,
    4: `M ${c - mouthW} ${mouthY - s*0.02} Q ${c} ${mouthY + s*0.06} ${c + mouthW} ${mouthY - s*0.02}`,
    5: `M ${c - mouthW} ${mouthY - s*0.06} Q ${c} ${mouthY + s*0.1} ${c + mouthW} ${mouthY - s*0.06}`,
  };

  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={s*0.045}/>
      <Circle cx={c - eyeX} cy={eyeY} r={eyeR} fill={color}/>
      <Circle cx={c + eyeX} cy={eyeY} r={eyeR} fill={color}/>
      <Path d={curves[val]} stroke={color} strokeWidth={s*0.045}
        strokeLinecap="round" fill="none"/>
    </Svg>
  );
}



export default function MoodScreen({ myId, lang, tk, onBack }: Props) {
  const isEn = lang === 'en';
  const [todayMood, setTodayMood] = useState<MoodEntry | null>(null);
  const [selectedMood, setSelectedMood] = useState<1|2|3|4|5 | null>(null);
  const [note, setNote] = useState('');
  const [history, setHistory] = useState<MoodEntry[]>([]);
  const [viewEntry, setViewEntry] = useState<MoodEntry|null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const entry = await Storage.getMood(myId, todayS());
    if (entry) { setTodayMood(entry); setSelectedMood(entry.mood); setNote(entry.note || ''); }
    const dates: string[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }
    const entries = await Storage.getMoodRange(myId, dates);
    setHistory(entries.sort((a, b) => b.date.localeCompare(a.date)));
  };

  const saveMood = async () => {
    if (!selectedMood) return;
    const entry: MoodEntry = { date: todayS(), mood: selectedMood, note: note.trim(), uid: myId };
    await Storage.setMood(entry);
    setTodayMood(entry);
    loadData();
  };

  const avgMood = history.length > 0
    ? (history.reduce((s, e) => s + e.mood, 0) / history.length).toFixed(1)
    : '—';

  const selectedMoodData = MOODS.find(m => m.val === selectedMood);

  return (
    <View style={{ flex: 1, backgroundColor: tk.bg, paddingTop: TOP }}>
      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <TouchableOpacity onPress={onBack}
            style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: tk.bg2,
              borderWidth: 1, borderColor: tk.border, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M19 12H5M5 12l7 7M5 12l7-7" stroke={tk.text2} strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round"/>
            </Svg>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: tk.text }}>
              {isEn ? 'Mood' : 'Настроение'}
            </Text>
            <Text style={{ fontSize: 12, color: tk.text3 }}>
              {isEn ? `14-day avg: ${avgMood} / 5` : `Среднее за 14 дней: ${avgMood} / 5`}
            </Text>
          </View>
        </View>

        {/* Today picker - large faces */}
        <Text style={{ fontSize: 9, color: tk.text3, letterSpacing: 1.5,
          textTransform: 'uppercase', marginBottom: 16 }}>
          {isEn ? 'How are you today?' : 'Как ты сегодня?'}
        </Text>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          {MOODS.map(m => (
            <TouchableOpacity key={m.val} onPress={() => setSelectedMood(m.val)}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 14,
                borderRadius: 16, borderWidth: 1.5,
                borderColor: selectedMood === m.val ? m.color : tk.border,
                backgroundColor: selectedMood === m.val
                  ? m.color + '18'
                  : tk.bg2 }}>
              <MoodFace val={m.val} color={selectedMood === m.val ? m.color : tk.text3} size={36}/>
            </TouchableOpacity>
          ))}
        </View>

        {/* Selected label */}
        {selectedMoodData && (
          <Text style={{ textAlign: 'center', fontSize: 13, fontWeight: '600',
            color: selectedMoodData.color, marginBottom: 16 }}>
            {isEn ? selectedMoodData.label_en : selectedMoodData.label_ru}
          </Text>
        )}

        {/* Note */}
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={isEn ? 'Add a note...' : 'Заметка...'}
          placeholderTextColor={tk.text3}
          multiline maxLength={200}
          style={{ backgroundColor: tk.bg2, borderWidth: 1, borderColor: tk.border,
            borderRadius: 14, padding: 14, fontSize: 14, color: tk.text,
            minHeight: 80, textAlignVertical: 'top', marginBottom: 16 }}/>

        <TouchableOpacity onPress={saveMood} disabled={!selectedMood}
          style={{ backgroundColor: selectedMood ? tk.text : tk.bg3,
            borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 36 }}>
          <Text style={{ color: selectedMood ? tk.bg : tk.text3, fontSize: 15, fontWeight: '700' }}>
            {todayMood
              ? (isEn ? 'Update' : 'Обновить')
              : (isEn ? 'Save' : 'Сохранить')}
          </Text>
        </TouchableOpacity>

        {/* Graph */}
        {history.length > 0 && (
          <>
            <Text style={{ fontSize: 9, color: tk.text3, letterSpacing: 1.5,
              textTransform: 'uppercase', marginBottom: 14 }}>
              {isEn ? '14 days' : '14 дней'}
            </Text>

            <View style={{ backgroundColor: tk.bg2, borderRadius: 16,
              borderWidth: 1, borderColor: tk.border, padding: 16, marginBottom: 20 }}>
              {/* Y axis labels */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 72, gap: 3 }}>
                {[...Array(14)].map((_, i) => {
                  const idx = 13 - i;
                  const entry = history[idx];
                  const mood = entry?.mood || 0;
                  const m = MOODS.find(x => x.val === mood);
                  const barH = mood ? (mood / 5) * 60 : 3;
                  return (
                    <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                      <View style={{ width: '100%', height: barH, borderRadius: 3,
                        backgroundColor: m ? m.color : tk.border,
                        opacity: mood ? 1 : 0.3 }}/>
                      <Text style={{ fontSize: 7, color: tk.text3 }}>
                        {entry ? new Date(entry.date).getDate() : ''}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* History list */}
            <Text style={{ fontSize: 9, color: tk.text3, letterSpacing: 1.5,
              textTransform: 'uppercase', marginBottom: 14 }}>
              {isEn ? 'History' : 'История'}
            </Text>

            {history.slice(0, 7).map(e => {
              const m = MOODS.find(x => x.val === e.mood)!;
              const d = new Date(e.date + 'T12:00:00');
              const dateStr = isEn
                ? d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
                : d.toLocaleDateString('ru', { month: 'short', day: 'numeric' });
              return (
                <TouchableOpacity key={e.date}
                onPress={() => setViewEntry(e)}
                style={{ flexDirection: 'row', alignItems: 'center',
                  gap: 12, paddingVertical: 12,
                  borderBottomWidth: 1, borderBottomColor: tk.border }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12,
                    backgroundColor: m.color + '20',
                    borderWidth: 1, borderColor: m.color + '40',
                    alignItems: 'center', justifyContent: 'center' }}>
                    <MoodFace val={e.mood} color={m.color} size={26}/>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: tk.text }}>
                      {isEn ? m.label_en : m.label_ru}
                    </Text>
                    {!!e.note && (
                      <Text style={{ fontSize: 11, color: tk.text3, marginTop: 1 }} numberOfLines={1}>
                        {e.note}
                      </Text>
                    )}
                  </View>
                  <Text style={{ fontSize: 11, color: tk.text3 }}>{dateStr}</Text>
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>
      {/* Модалка просмотра записи настроения */}
      {viewEntry && (() => {
        const m = MOODS.find(x => x.val === viewEntry.mood)!;
        const d = new Date(viewEntry.date + 'T12:00:00');
        const dateStr = isEn
          ? d.toLocaleDateString('en', { month: 'long', day: 'numeric' })
          : d.toLocaleDateString('ru', { month: 'long', day: 'numeric' });
        return (
          <TouchableOpacity
            style={{ position:'absolute', top:0, left:0, right:0, bottom:0,
              backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end' }}
            activeOpacity={1} onPress={() => setViewEntry(null)}>
            <TouchableOpacity activeOpacity={1}
              style={{ backgroundColor:tk.bg, borderTopLeftRadius:20,
                borderTopRightRadius:20, padding:24, paddingBottom:40 }}>
              <View style={{ alignItems:'center', gap:12, marginBottom:20 }}>
                <View style={{ width:64, height:64, borderRadius:18,
                  backgroundColor: m.color+'20', borderWidth:1.5,
                  borderColor: m.color+'60', alignItems:'center', justifyContent:'center' }}>
                  <MoodFace val={viewEntry.mood} color={m.color} size={40}/>
                </View>
                <Text style={{ fontSize:18, fontWeight:'700', color:tk.text }}>
                  {isEn ? m.label_en : m.label_ru}
                </Text>
                <Text style={{ fontSize:13, color:tk.text3 }}>{dateStr}</Text>
              </View>
              {viewEntry.note ? (
                <View style={{ backgroundColor:tk.bg2, borderRadius:14,
                  borderWidth:1, borderColor:tk.border, padding:14 }}>
                  <Text style={{ fontSize:14, color:tk.text, lineHeight:20 }}>{viewEntry.note}</Text>
                </View>
              ) : (
                <Text style={{ fontSize:13, color:tk.text3, textAlign:'center' }}>
                  {isEn ? 'No note for this day' : 'Заметка не добавлена'}
                </Text>
              )}
              <TouchableOpacity onPress={() => setViewEntry(null)}
                style={{ marginTop:20, padding:14, borderRadius:14,
                  backgroundColor:tk.bg2, alignItems:'center' }}>
                <Text style={{ fontSize:14, fontWeight:'600', color:tk.text2 }}>
                  {isEn ? 'Close' : 'Закрыть'}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        );
      })()}
    </View>
  );
}
