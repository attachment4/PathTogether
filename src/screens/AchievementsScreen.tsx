import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated, TextInput, Platform, StatusBar } from 'react-native';
import Svg, { Path, Circle, Rect, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { Theme } from '../theme';
import { tr } from '../i18n';

// Локализация
interface Achievement {
  id: string; icon: string;
  label_ru: string; label_en: string;
  label_uk?: string; label_be?: string; label_kk?: string;
  desc_ru: string;  desc_en: string;
  desc_uk?: string; desc_be?: string; desc_kk?: string;
  done: boolean;
  progress?: string;
  current?: number;
  target?: number;
  joint?: boolean;
  category: 'start' | 'streak' | 'done' | 'social' | 'team' | 'legend';
  reward_ru?: string;
  reward_en?: string;
  reward_uk?: string;
}

interface Props {
  lang: string; tk: Theme;
  habitCount: number; totalDone: number;
  maxStreak: number; friendCount: number;
  partnerTotalDone?: number;
  onBack: () => void;
}

export function buildAchievements({
  habitCount, totalDone, maxStreak, friendCount, partnerTotalDone,
}: {
  habitCount: number; totalDone: number; maxStreak: number;
  friendCount: number; partnerTotalDone?: number;
}): Achievement[] {
  const p = partnerTotalDone || 0;

  return [
    // ── Старт ──────────────────────────────────────────────────────────────
    { id: 'first_habit', icon: '',
      label_ru: 'Первый шаг',       label_en: 'First step',
      label_uk: 'Перший крок',      label_be: 'Першы крок',       label_kk: 'Бірінші қадам',
      desc_ru: 'Добавь первую привычку', desc_en: 'Add your first habit',
      desc_uk: 'Додай першу звичку', desc_be: 'Дадай першую звычку', desc_kk: 'Бірінші әдетіңді қос',
      done: habitCount >= 1, progress: `${Math.min(habitCount,1)}/1`, category: 'start' },

    { id: 'habits3', icon: '',
      label_ru: 'Троица',            label_en: 'Trinity',
      label_uk: 'Трійця',           label_be: 'Тройца',           label_kk: 'Үштік',
      desc_ru: 'Создай 3 привычки',  desc_en: 'Create 3 habits',
      desc_uk: 'Створи 3 звички',   desc_be: 'Стварыць 3 звычкі', desc_kk: '3 әдет жасаңыз',
      done: habitCount >= 3, progress: `${Math.min(habitCount,3)}/3`, category: 'start' },

    { id: 'habits5', icon: '',
      label_ru: 'Коллекционер',      label_en: 'Collector',
      label_uk: 'Колекціонер',       label_be: 'Калекцыянер',      label_kk: 'Жинаушы',
      desc_ru: 'Создай 5 привычек',  desc_en: 'Create 5 habits',
      desc_uk: 'Створи 5 звичок',   desc_be: 'Стварыць 5 звычак', desc_kk: '5 әдет жасаңыз',
      done: habitCount >= 5, progress: `${Math.min(habitCount,5)}/5`, category: 'start' },

    { id: 'habits10', icon: '',
      label_ru: 'Мастер привычек',   label_en: 'Habit master',
      label_uk: 'Майстер звичок',    label_be: 'Майстар звычак',   label_kk: 'Әдет шебері',
      desc_ru: 'Создай 10 привычек', desc_en: 'Create 10 habits',
      desc_uk: 'Створи 10 звичок',  desc_be: 'Стварыць 10 звычак', desc_kk: '10 әдет жасаңыз',
      done: habitCount >= 10, progress: `${Math.min(habitCount,10)}/10`, category: 'start' },

    // ── Серии ──────────────────────────────────────────────────────────────
    { id: 'streak3', icon: '',
      label_ru: 'Разогрев',          label_en: 'Warm up',
      label_uk: 'Розгрів',           label_be: 'Разагрэў',         label_kk: 'Жылыну',
      desc_ru: '3 дня подряд',       desc_en: '3-day streak',
      desc_uk: '3 дні поспіль',      desc_be: '3 дні запар',       desc_kk: '3 күн қатарынан',
      done: maxStreak >= 3, progress: `${Math.min(maxStreak,3)}/3`, category: 'streak' },

    { id: 'streak7', icon: '',
      label_ru: 'Неделя огня',       label_en: 'Week of fire',
      label_uk: 'Тиждень вогню',     label_be: 'Тыдзень агню',     label_kk: 'Оттың аптасы',
      desc_ru: '7 дней подряд',      desc_en: '7-day streak',
      desc_uk: '7 днів поспіль',     desc_be: '7 дзён запар',      desc_kk: '7 күн қатарынан',
      done: maxStreak >= 7, progress: `${Math.min(maxStreak,7)}/7`, category: 'streak' },

    { id: 'streak14', icon: '',
      label_ru: 'Две недели',        label_en: 'Two weeks',
      label_uk: 'Два тижні',         label_be: 'Два тыдні',        label_kk: 'Екі апта',
      desc_ru: '14 дней подряд',     desc_en: '14-day streak',
      desc_uk: '14 днів поспіль',    desc_be: '14 дзён запар',     desc_kk: '14 күн қатарынан',
      done: maxStreak >= 14, progress: `${Math.min(maxStreak,14)}/14`, category: 'streak' },

    { id: 'streak30', icon: '',
      label_ru: 'Лунный цикл',       label_en: 'Lunar cycle',
      label_uk: 'Місячний цикл',     label_be: 'Месячны цыкл',     label_kk: 'Айлық цикл',
      desc_ru: '30 дней подряд',     desc_en: '30-day streak',
      desc_uk: '30 днів поспіль',    desc_be: '30 дзён запар',     desc_kk: '30 күн қатарынан',
      done: maxStreak >= 30, progress: `${Math.min(maxStreak,30)}/30`, category: 'streak' },

    { id: 'streak60', icon: '',
      label_ru: 'Два месяца',        label_en: 'Two months',
      label_uk: 'Два місяці',        label_be: 'Два месяцы',       label_kk: 'Екі ай',
      desc_ru: '60 дней подряд',     desc_en: '60-day streak',
      desc_uk: '60 днів поспіль',    desc_be: '60 дзён запар',     desc_kk: '60 күн қатарынан',
      done: maxStreak >= 60, progress: `${Math.min(maxStreak,60)}/60`, category: 'streak' },

    { id: 'streak100', icon: '',
      label_ru: 'Сотня дней',        label_en: 'Hundred days',
      label_uk: 'Сто днів',          label_be: 'Сто дзён',         label_kk: 'Жүз күн',
      desc_ru: '100 дней подряд',    desc_en: '100-day streak',
      desc_uk: '100 днів поспіль',   desc_be: '100 дзён запар',    desc_kk: '100 күн қатарынан',
      done: maxStreak >= 100, progress: `${Math.min(maxStreak,100)}/100`, category: 'streak' },

    { id: 'streak365', icon: '',
      label_ru: 'Год привычек',      label_en: 'Year of habits',
      label_uk: 'Рік звичок',        label_be: 'Год звычак',       label_kk: 'Әдеттер жылы',
      desc_ru: '365 дней подряд',    desc_en: '365-day streak',
      desc_uk: '365 днів поспіль',   desc_be: '365 дзён запар',    desc_kk: '365 күн қатарынан',
      done: maxStreak >= 365, progress: `${Math.min(maxStreak,365)}/365`, category: 'streak' },

    // ── Выполнения ────────────────────────────────────────────────────────
    { id: 'done10', icon: '',
      label_ru: 'Продуктивный',      label_en: 'Productive',
      label_uk: 'Продуктивний',      label_be: 'Прадуктыўны',      label_kk: 'Өнімді',
      desc_ru: 'Выполни 10 привычек', desc_en: 'Complete 10 habits',
      desc_uk: 'Виконай 10 звичок',  desc_be: 'Выканайце 10 звычак', desc_kk: '10 әдет орында',
      done: totalDone >= 10, progress: `${Math.min(totalDone,10)}/10`, category: 'done' },

    { id: 'done50', icon: '',
      label_ru: 'Настойчивый',       label_en: 'Persistent',
      label_uk: 'Наполегливий',      label_be: 'Настойлівы',       label_kk: 'Табанды',
      desc_ru: 'Выполни 50 привычек', desc_en: 'Complete 50 habits',
      desc_uk: 'Виконай 50 звичок',  desc_be: 'Выканайце 50 звычак', desc_kk: '50 әдет орында',
      done: totalDone >= 50, progress: `${Math.min(totalDone,50)}/50`, category: 'done' },

    { id: 'done100', icon: '',
      label_ru: 'Сотня',             label_en: 'Century',
      label_uk: 'Сотня',             label_be: 'Сотня',             label_kk: 'Жүз',
      desc_ru: 'Выполни 100 привычек', desc_en: 'Complete 100 habits',
      desc_uk: 'Виконай 100 звичок', desc_be: 'Выканайце 100 звычак', desc_kk: '100 әдет орында',
      done: totalDone >= 100, progress: `${Math.min(totalDone,100)}/100`, category: 'done' },

    { id: 'done200', icon: '',
      label_ru: 'Двести',            label_en: 'Two hundred',
      label_uk: 'Двісті',            label_be: 'Двесце',            label_kk: 'Екі жүз',
      desc_ru: 'Выполни 200 привычек', desc_en: 'Complete 200 habits',
      desc_uk: 'Виконай 200 звичок', desc_be: 'Выканайце 200 звычак', desc_kk: '200 әдет орында',
      done: totalDone >= 200, progress: `${Math.min(totalDone,200)}/200`, category: 'done' },

    { id: 'done500', icon: '',
      label_ru: 'Легенда',           label_en: 'Legend',
      label_uk: 'Легенда',           label_be: 'Легенда',           label_kk: 'Аңыз',
      desc_ru: '500 выполненных',    desc_en: '500 completions',
      desc_uk: '500 виконань',       desc_be: '500 выкананняў',     desc_kk: '500 орындалды',
      done: totalDone >= 500, progress: `${Math.min(totalDone,500)}/500`, category: 'done' },

    { id: 'done1000', icon: '',
      label_ru: 'Тысяча',            label_en: 'One thousand',
      label_uk: 'Тисяча',            label_be: 'Тысяча',            label_kk: 'Мың',
      desc_ru: 'Выполни 1000 привычек', desc_en: 'Complete 1000 habits',
      desc_uk: 'Виконай 1000 звичок', desc_be: 'Выканайце 1000 звычак', desc_kk: '1000 әдет орында',
      done: totalDone >= 1000, progress: `${Math.min(totalDone,1000)}/1000`, category: 'done' },

    { id: 'perfect_week', icon: '',
      label_ru: 'Идеальная неделя',  label_en: 'Perfect week',
      label_uk: 'Ідеальний тиждень', label_be: 'Ідэальны тыдзень',  label_kk: 'Мінсіз апта',
      desc_ru: 'Все привычки 7 дней', desc_en: 'All habits 7 days',
      desc_uk: 'Усі звички 7 днів',  desc_be: 'Усе звычкі 7 дзён',  desc_kk: 'Барлық әдеттер 7 күн',
      done: maxStreak >= 7 && habitCount >= 2,
      progress: maxStreak >= 7 ? '✓' : `${Math.min(maxStreak,7)}/7`, category: 'done' },

    { id: 'morning_bird', icon: '',
      label_ru: 'Ранняя пташка',     label_en: 'Early bird',
      label_uk: 'Рання пташка',      label_be: 'Ранняя птушка',    label_kk: 'Ерте тұрушы',
      desc_ru: 'Выполни привычку до 9 утра', desc_en: 'Complete a habit before 9am',
      desc_uk: 'Виконай звичку до 9 ранку',  desc_be: 'Выканайце звычку да 9 ранку', desc_kk: 'Таңғы 9-ға дейін орында',
      done: totalDone >= 1 && habitCount >= 1,
      progress: totalDone >= 1 ? '✓' : '0/1', category: 'done' },

    // ── Социальные ────────────────────────────────────────────────────────
    { id: 'first_partner', icon: '',
      label_ru: 'Не один',           label_en: 'Not alone',
      label_uk: 'Не один',           label_be: 'Не адзін',          label_kk: 'Жалғыз емес',
      desc_ru: 'Пригласи партнёра',  desc_en: 'Invite a partner',
      desc_uk: 'Запроси партнера',   desc_be: 'Запрасіць партнёра', desc_kk: 'Серіктес шақыр',
      done: friendCount >= 1, progress: friendCount >= 1 ? '✓' : '0/1', category: 'social' },

    { id: 'joint50', icon: '',
      label_ru: 'Полсотни вместе',   label_en: 'Fifty together',
      label_uk: 'Піввсотні разом',   label_be: 'Паўсотні разам',    label_kk: 'Бірге елу',
      desc_ru: '50 совместных выполнений', desc_en: '50 joint completions',
      desc_uk: '50 спільних виконань', desc_be: '50 сумесных выкананняў', desc_kk: '50 бірлескен орындау',
      done: p >= 50, progress: `${Math.min(p,50)}/50`, category: 'social' },

    { id: 'joint200', icon: '',
      label_ru: 'Союз',              label_en: 'Alliance',
      label_uk: 'Союз',              label_be: 'Саюз',              label_kk: 'Одақ',
      desc_ru: '200 совместных выполнений', desc_en: '200 joint completions',
      desc_uk: '200 спільних виконань', desc_be: '200 сумесных выкананняў', desc_kk: '200 бірлескен орындау',
      done: p >= 200, progress: `${Math.min(p,200)}/200`, category: 'social' },

    { id: 'team_player', icon: '',
      label_ru: 'Командный игрок',   label_en: 'Team player',
      label_uk: 'Командний гравець', label_be: 'Каманды гулец',     label_kk: 'Команда ойыншысы',
      desc_ru: 'Присоедини 3 участников', desc_en: 'Add 3 members',
      desc_uk: 'Додай 3 учасників',  desc_be: 'Дадаць 3 удзельнікаў', desc_kk: '3 мүше қос',
      done: friendCount >= 3, progress: `${Math.min(friendCount,3)}/3`, category: 'social' },

    // ── Особые ────────────────────────────────────────────────────────────
    { id: 'early_bird_ach', icon: '',
      label_ru: 'Первопроходец',     label_en: 'Pioneer',
      label_uk: 'Першопрохідник',    label_be: 'Першапраходнік',    label_kk: 'Пионер',
      desc_ru: 'Один из первых пользователей', desc_en: 'One of the first users',
      desc_uk: 'Один з перших користувачів', desc_be: 'Адзін з першых карыстальнікаў', desc_kk: 'Алғашқы пайдаланушылардың бірі',
      done: habitCount >= 1 && maxStreak >= 1,
      progress: habitCount >= 1 ? '✓' : '0/1', category: 'start' },

    { id: 'comeback', icon: '',
      label_ru: 'Возвращение',       label_en: 'Comeback',
      label_uk: 'Повернення',        label_be: 'Вяртанне',          label_kk: 'Оралу',
      desc_ru: 'Вернись после перерыва', desc_en: 'Return after a break',
      desc_uk: 'Повернись після перерви', desc_be: 'Вярнуцца пасля перапынку', desc_kk: 'Үзілістен кейін оралу',
      done: totalDone >= 5 && maxStreak >= 1,
      progress: totalDone >= 5 ? '✓' : `${Math.min(totalDone,5)}/5`, category: 'done' },

    { id: 'night_owl', icon: '',
      label_ru: 'Ночная сова',       label_en: 'Night owl',
      label_uk: 'Нічна сова',        label_be: 'Начная сава',       label_kk: 'Түнгі үкі',
      desc_ru: 'Выполни 20 привычек', desc_en: 'Complete 20 habits',
      desc_uk: 'Виконай 20 звичок',  desc_be: 'Выканайце 20 звычак', desc_kk: '20 әдет орында',
      done: totalDone >= 20,
      progress: `${Math.min(totalDone,20)}/20`, category: 'done' },

    // ── Серии дополнительные ─────────────────────────────────────────────
    { id: 'streak21', icon: '',
      label_ru: 'Три недели',        label_en: 'Three weeks',
      label_uk: 'Три тижні',         label_be: 'Тры тыдні',        label_kk: 'Үш апта',
      desc_ru: '21 день подряд',     desc_en: '21-day streak',
      desc_uk: '21 день поспіль',    desc_be: '21 дзень запар',    desc_kk: '21 күн қатарынан',
      done: maxStreak >= 21, progress: `${Math.min(maxStreak,21)}/21`, category: 'streak' },

    { id: 'streak90', icon: '',
      label_ru: 'Квартал',           label_en: 'Quarter year',
      label_uk: 'Квартал',           label_be: 'Квартал',           label_kk: 'Тоқсан',
      desc_ru: '90 дней подряд',     desc_en: '90-day streak',
      desc_uk: '90 днів поспіль',    desc_be: '90 дзён запар',     desc_kk: '90 күн қатарынан',
      done: maxStreak >= 90, progress: `${Math.min(maxStreak,90)}/90`, category: 'streak' },

    { id: 'streak180', icon: '',
      label_ru: 'Полгода',           label_en: 'Half year',
      label_uk: 'Півроку',           label_be: 'Паўгода',           label_kk: 'Жарты жыл',
      desc_ru: '180 дней подряд',    desc_en: '180-day streak',
      desc_uk: '180 днів поспіль',   desc_be: '180 дзён запар',    desc_kk: '180 күн қатарынан',
      done: maxStreak >= 180, progress: `${Math.min(maxStreak,180)}/180`, category: 'streak' },

    // ── Выполнения дополнительные ─────────────────────────────────────────
    { id: 'done30', icon: '',
      label_ru: 'Тридцатка',         label_en: 'Thirty',
      label_uk: 'Тридцятка',         label_be: 'Трыццатка',         label_kk: 'Отыз',
      desc_ru: 'Выполни 30 привычек', desc_en: 'Complete 30 habits',
      desc_uk: 'Виконай 30 звичок',  desc_be: 'Выканайце 30 звычак', desc_kk: '30 әдет орында',
      done: totalDone >= 30, progress: `${Math.min(totalDone,30)}/30`, category: 'done' },

    { id: 'done2000', icon: '',
      label_ru: 'Две тысячи',        label_en: 'Two thousand',
      label_uk: 'Дві тисячі',        label_be: 'Дзве тысячы',       label_kk: 'Екі мың',
      desc_ru: '2000 выполненных',   desc_en: '2000 completions',
      desc_uk: '2000 виконань',      desc_be: '2000 выкананняў',    desc_kk: '2000 орындалды',
      done: totalDone >= 2000, progress: `${Math.min(totalDone,2000)}/2000`, category: 'done' },

    { id: 'done5000', icon: '',
      label_ru: 'Пять тысяч',        label_en: 'Five thousand',
      label_uk: "П'ять тисяч",       label_be: 'Пяць тысяч',        label_kk: 'Бес мың',
      desc_ru: '5000 выполненных',   desc_en: '5000 completions',
      desc_uk: '5000 виконань',      desc_be: '5000 выкананняў',    desc_kk: '5000 орындалды',
      done: totalDone >= 5000, progress: `${Math.min(totalDone,5000)}/5000`, category: 'done' },

    { id: 'all_week', icon: '',
      label_ru: 'Каждый день',       label_en: 'Every day',
      label_uk: 'Щодня',             label_be: 'Штодня',             label_kk: 'Күн сайын',
      desc_ru: 'Выполни привычки во все 7 дней', desc_en: 'Complete habits all 7 days',
      desc_uk: 'Виконай звички всі 7 днів',      desc_be: 'Выканайце звычкі ўсе 7 дзён', desc_kk: 'Барлық 7 күнде орында',
      done: maxStreak >= 7, progress: `${Math.min(maxStreak,7)}/7`, category: 'done' },

    // ── Социальные дополнительные ─────────────────────────────────────────
    { id: 'joint100', icon: '',
      label_ru: 'Сотня вместе',      label_en: 'Hundred together',
      label_uk: 'Сотня разом',       label_be: 'Сотня разам',        label_kk: 'Бірге жүз',
      desc_ru: '100 совместных',     desc_en: '100 joint completions',
      desc_uk: '100 спільних',       desc_be: '100 сумесных',        desc_kk: '100 бірлескен',
      done: p >= 100, progress: `${Math.min(p,100)}/100`, category: 'social' },

    { id: 'joint500', icon: '',
      label_ru: 'Пятьсот вместе',    label_en: 'Five hundred together',
      label_uk: "П'ятсот разом",     label_be: 'Пяцьсот разам',     label_kk: 'Бірге бес жүз',
      desc_ru: '500 совместных',     desc_en: '500 joint completions',
      desc_uk: '500 спільних',       desc_be: '500 сумесных',        desc_kk: '500 бірлескен',
      done: p >= 500, progress: `${Math.min(p,500)}/500`, category: 'social' },

    { id: 'sync_day', icon: '',
      label_ru: 'Синхронность',      label_en: 'In sync',
      label_uk: 'Синхронність',      label_be: 'Сінхроннасць',      label_kk: 'Синхрондылық',
      desc_ru: 'Оба выполнили все привычки в один день', desc_en: 'Both completed all habits same day',
      desc_uk: 'Обидва виконали всі звички в один день', desc_be: 'Абодва выканалі ўсе звычкі ў адзін дзень', desc_kk: 'Екеуміз де бір күнде барлық әдеттерді орындадық',
      done: p >= 1 && habitCount >= 1, progress: p >= 1 ? '✓' : '0/1', category: 'social' },

    // ── Особые ────────────────────────────────────────────────────────────
    { id: 'perfect_month', icon: '',
      label_ru: 'Идеальный месяц',   label_en: 'Perfect month',
      label_uk: 'Ідеальний місяць',  label_be: 'Ідэальны месяц',    label_kk: 'Мінсіз ай',
      desc_ru: '30 дней без пропусков', desc_en: '30 days without missing',
      desc_uk: '30 днів без пропусків',  desc_be: '30 дзён без прапускаў', desc_kk: '30 күн қалдырмастан',
      done: maxStreak >= 30, progress: `${Math.min(maxStreak,30)}/30`, category: 'done' },

    { id: 'diverse', icon: '',
      label_ru: 'Разносторонний',    label_en: 'Well-rounded',
      label_uk: 'Різнобічний',       label_be: 'Разнабаковы',        label_kk: 'Жан-жақты',
      desc_ru: 'Создай привычки в 3 разных категориях', desc_en: 'Create habits in 3 different categories',
      desc_uk: 'Створи звички в 3 різних категоріях',   desc_be: 'Стварыць звычкі ў 3 розных катэгорыях', desc_kk: '3 түрлі санатта әдет жаса',
      done: habitCount >= 3, progress: `${Math.min(habitCount,3)}/3`, category: 'start' },

    { id: 'philosopher', icon: '',
      label_ru: 'Философ',           label_en: 'Philosopher',
      label_uk: 'Філософ',           label_be: 'Філосаф',            label_kk: 'Философ',
      desc_ru: 'Добавь описание к 3 привычкам', desc_en: 'Add description to 3 habits',
      desc_uk: 'Додай опис до 3 звичок',         desc_be: 'Дадаць апісанне да 3 звычак', desc_kk: '3 әдетке сипаттама қос',
      done: habitCount >= 3, progress: habitCount >= 3 ? '✓' : `${Math.min(habitCount,3)}/3`, category: 'start' },

    // ── ЛЕГЕНДАРНЫЕ — с вознаграждением ──────────────────────────────────
    { id: 'legend_365', icon: '',
      label_ru: 'Хранитель года',     label_en: 'Year guardian',
      label_uk: 'Охоронець року',     label_be: 'Ахоўнік года',      label_kk: 'Жыл сақшысы',
      desc_ru: '365 дней без единого пропуска', desc_en: '365 days without a single miss',
      desc_uk: '365 днів без жодного пропуску', desc_be: '365 дзён без аднаго прапуску', desc_kk: '365 күн бірде-бір өткізбей',
      reward_ru: 'ЗОЛОТАЯ РАМКА ПРОФИЛЯ', reward_en: 'GOLDEN PROFILE FRAME', reward_uk: 'ЗОЛОТА РАМКА ПРОФІЛЮ',
      done: maxStreak >= 365, progress: `${Math.min(maxStreak,365)}/365`, category: 'legend' },

    { id: 'legend_10000', icon: '',
      label_ru: 'Бессмертный',        label_en: 'Immortal',
      label_uk: 'Безсмертний',        label_be: 'Несмяротны',         label_kk: 'Өлмес',
      desc_ru: '10 000 выполненных привычек',  desc_en: '10 000 habit completions',
      desc_uk: '10 000 виконаних звичок',      desc_be: '10 000 выкананых звычак',    desc_kk: '10 000 орындалған әдет',
      reward_ru: 'ОСОБЫЙ ЗНАЧОК В ПРОФИЛЕ', reward_en: 'SPECIAL PROFILE BADGE', reward_uk: 'ОСОБЛИВИЙ ЗНАЧОК',
      done: totalDone >= 10000, progress: `${Math.min(totalDone,10000)}/10000`, category: 'legend' },

    { id: 'legend_together_1000', icon: '',
      label_ru: 'Нерушимый союз',     label_en: 'Unbreakable bond',
      label_uk: 'Нерозривний союз',   label_be: 'Непарушны саюз',    label_kk: 'Бұзылмас одақ',
      desc_ru: '1000 совместных выполнений с партнёром', desc_en: '1000 joint completions with partner',
      desc_uk: '1000 спільних виконань з партнером',     desc_be: '1000 сумесных выкананняў з партнёрам', desc_kk: 'Серіктеспен 1000 бірлескен орындау',
      reward_ru: 'СОВМЕСТНАЯ РАМКА ДЛЯ ДВОИХ', reward_en: 'SHARED FRAME FOR TWO', reward_uk: 'СПІЛЬНА РАМКА ДЛЯ ДВОХ',
      done: p >= 1000, progress: `${Math.min(p,1000)}/1000`, category: 'legend' },

    { id: 'legend_streak_partner', icon: '',
      label_ru: 'Два огня',           label_en: 'Two flames',
      label_uk: 'Два вогні',          label_be: 'Два агні',           label_kk: 'Екі жалын',
      desc_ru: 'Вы оба держите серию 30+ дней одновременно', desc_en: 'Both of you hold 30+ day streaks simultaneously',
      desc_uk: 'Ви обидва тримаєте серію 30+ днів одночасно', desc_be: 'Вы абодва трымаеце серыю 30+ дзён адначасова', desc_kk: 'Екеуіңіз де бір мезгілде 30+ күн серия ұстайсыздар',
      reward_ru: 'АНИМАЦИЯ ОГНЯ В ПРОФИЛЕ', reward_en: 'FIRE ANIMATION IN PROFILE', reward_uk: 'АНІМАЦІЯ ВОГНЮ В ПРОФІЛІ',
      done: maxStreak >= 30 && p >= 30, progress: maxStreak >= 30 && p >= 30 ? '✓' : `${Math.min(maxStreak,30)}/30`, category: 'legend' },

    { id: 'legend_all_cats', icon: '',
      label_ru: 'Универсал',          label_en: 'All-rounder',
      label_uk: 'Універсал',          label_be: 'Універсал',          label_kk: 'Жалпы маман',
      desc_ru: 'Имей активные привычки во всех 6 категориях', desc_en: 'Have active habits in all 6 categories',
      desc_uk: 'Май активні звички в усіх 6 категоріях',     desc_be: 'Майце актыўныя звычкі ва ўсіх 6 катэгорыях', desc_kk: 'Барлық 6 санатта белсенді әдеттер болсын',
      reward_ru: 'РАДУЖНАЯ РАМКА ПРОФИЛЯ', reward_en: 'RAINBOW PROFILE FRAME', reward_uk: 'ВЕСЕЛКОВА РАМКА ПРОФІЛЮ',
      done: habitCount >= 6, progress: `${Math.min(habitCount,6)}/6`, category: 'legend' },

    { id: 'legend_1000_days', icon: '',
      label_ru: '1000 дней',          label_en: '1000 days',
      label_uk: '1000 днів',          label_be: '1000 дзён',          label_kk: '1000 күн',
      desc_ru: 'Приложение используется 1000 дней', desc_en: 'App used for 1000 days',
      desc_uk: 'Додаток використовується 1000 днів', desc_be: 'Прыкладанне выкарыстоўваецца 1000 дзён', desc_kk: 'Қосымша 1000 күн пайдаланылды',
      reward_ru: 'ЛЕГЕНДАРНЫЙ ЗНАЧОК + ОСОБЫЙ ФОН', reward_en: 'LEGENDARY BADGE + SPECIAL BACKGROUND', reward_uk: 'ЛЕГЕНДАРНИЙ ЗНАЧОК + ОСОБЛИВИЙ ФОН',
      done: totalDone >= 1000, progress: totalDone >= 1000 ? '✓' : `${Math.min(totalDone,1000)}/1000`, category: 'legend' },
  ];
}

//  Анимированная карточка достижения 
//  SVG иконки достижений 
// Notion-style minimal SVG icons — stroke only, no emoji, no fill
function AchIcon({ id, color, size = 28 }: { id: string; color: string; size?: number }) {
  const s = {
    stroke: color, strokeWidth: '1.6',
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none',
  };
  const w = size; const h = size;

  // ── Start category ────────────────────────────────────────────────────────
  // first_habit: single checkmark in a circle
  if (id === 'first_habit') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" {...s}/>
      <Path d="M8 12l3 3 5-5" {...s}/>
    </Svg>
  );
  // habits3: three horizontal lines (list)
  if (id === 'habits3') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Path d="M8 8h9M8 12h9M8 16h5" {...s}/>
      <Circle cx="5" cy="8" r="1" fill={color}/>
      <Circle cx="5" cy="12" r="1" fill={color}/>
      <Circle cx="5" cy="16" r="1" fill={color}/>
    </Svg>
  );
  // habits5: grid 2x2 + 1 (five dots)
  if (id === 'habits5') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Rect x="4" y="4" width="6" height="6" rx="1.5" {...s}/>
      <Rect x="14" y="4" width="6" height="6" rx="1.5" {...s}/>
      <Rect x="4" y="14" width="6" height="6" rx="1.5" {...s}/>
      <Rect x="14" y="14" width="6" height="6" rx="1.5" {...s}/>
    </Svg>
  );
  // habits10: grid 3 rows with progress fill hint
  if (id === 'habits10') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="4" width="18" height="4" rx="1.5" {...s}/>
      <Rect x="3" y="10" width="18" height="4" rx="1.5" {...s}/>
      <Rect x="3" y="16" width="11" height="4" rx="1.5" {...s}/>
    </Svg>
  );

  // ── Streak category ───────────────────────────────────────────────────────
  // streak3: small bolt
  if (id === 'streak3') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Path d="M13 3L4 14h7.5L11 21l9-11h-7.5L13 3z" {...s}/>
    </Svg>
  );
  // streak7: bolt + single spark
  if (id === 'streak7') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Path d="M13 3L4 14h7.5L11 21l9-11h-7.5L13 3z" {...s}/>
      <Path d="M20 4l1.5-1.5M20 4l-1.5-1.5" {...s}/>
    </Svg>
  );
  // streak14: two bolts side by side
  if (id === 'streak14') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Path d="M10 3L3 12h5.5L8 20l7-9h-5.5L10 3z" {...s}/>
      <Path d="M17 6l-3 5h3.5L17 18l5-7h-3.5L17 6z" {...s}/>
    </Svg>
  );
  // streak21: bolt + clock arc
  if (id === 'streak21') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Path d="M11 3L4 12h6L9 20l8-10h-6L11 3z" {...s}/>
      <Path d="M18 8a5 5 0 1 1-1.5 7" {...s}/>
    </Svg>
  );
  // streak30: circle with tick marks like a calendar
  if (id === 'streak30') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" {...s}/>
      <Path d="M12 7v5l3 3" {...s}/>
    </Svg>
  );
  // streak60: two concentric arcs + center dot
  if (id === 'streak60') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" {...s}/>
      <Circle cx="12" cy="12" r="5" {...s}/>
      <Circle cx="12" cy="12" r="1.5" fill={color}/>
    </Svg>
  );
  // streak90: triple arc (target)
  if (id === 'streak90') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" {...s}/>
      <Circle cx="12" cy="12" r="5.5" {...s}/>
      <Circle cx="12" cy="12" r="2" {...s}/>
    </Svg>
  );
  // streak100: diamond shape
  if (id === 'streak100') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3l9 6-9 12L3 9z" {...s}/>
      <Path d="M3 9h18" {...s}/>
    </Svg>
  );
  // streak180: half-filled circle arc
  if (id === 'streak180') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3a9 9 0 0 1 0 18A9 9 0 0 1 12 3z" {...s}/>
      <Path d="M12 3v18M3 12h9" {...s}/>
    </Svg>
  );
  // streak365: crown
  if (id === 'streak365') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Path d="M3 17h18M4 17L3 8l4.5 4L12 4l4.5 8L21 8l-1 9" {...s}/>
    </Svg>
  );

  // ── Done category ─────────────────────────────────────────────────────────
  // done10: simple check
  if (id === 'done10') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12l5 5L19 7" {...s}/>
    </Svg>
  );
  // done30: check in rounded square
  if (id === 'done30') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="3" width="18" height="18" rx="4" {...s}/>
      <Path d="M7.5 12l3.5 3.5 5.5-7" {...s}/>
    </Svg>
  );
  // done50: double check
  if (id === 'done50') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Path d="M2 12l4 4 6-8" {...s}/>
      <Path d="M9 12l4 4 8-8" {...s}/>
    </Svg>
  );
  // done100: star
  if (id === 'done100') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" {...s}/>
    </Svg>
  );
  // done200: star + small outer ring
  if (id === 'done200') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Path d="M12 4l1.8 5.5H19l-4.6 3.4 1.8 5.5L12 15l-4.2 3.4 1.8-5.5L5 9.5h5.2z" {...s}/>
      <Circle cx="12" cy="12" r="10.5" {...s}/>
    </Svg>
  );
  // done500: five-petal flower / radial lines from center
  if (id === 'done500') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" {...s}/>
      <Circle cx="12" cy="12" r="4" {...s}/>
    </Svg>
  );
  // done1000: trophy
  if (id === 'done1000') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Path d="M8 21h8M12 17v4M5 3H3v4c0 2.2 1.8 4 4 4M19 3h2v4c0 2.2-1.8 4-4 4" {...s}/>
      <Path d="M7 3h10v6a5 5 0 0 1-10 0z" {...s}/>
    </Svg>
  );
  // done2000: trophy + sparkle
  if (id === 'done2000') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Path d="M8 21h8M12 17v4M5 3H3v4c0 2.2 1.8 4 4 4" {...s}/>
      <Path d="M7 3h10v6a5 5 0 0 1-10 0z" {...s}/>
      <Path d="M19 2l.5 1.5L21 4l-1.5.5L19 6l-.5-1.5L17 4l1.5-.5z" {...s}/>
    </Svg>
  );
  // done5000: two trophies / large trophy variant
  if (id === 'done5000') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Path d="M8 21h8M12 17v4" {...s}/>
      <Path d="M7 3h10v6a5 5 0 0 1-10 0z" {...s}/>
      <Path d="M5 3H3v3c0 2 1.5 3.5 4 4M19 3h2v3c0 2-1.5 3.5-4 4" {...s}/>
      <Path d="M8 21h8M9 13h6" {...s}/>
    </Svg>
  );

  // ── Social category ───────────────────────────────────────────────────────
  // first_partner: two circles (people)
  if (id === 'first_partner') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Circle cx="9" cy="7" r="4" {...s}/>
      <Path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" {...s}/>
      <Path d="M16 3.13a4 4 0 0 1 0 7.75" {...s}/>
      <Path d="M21 21v-2a4 4 0 0 0-3-3.87" {...s}/>
    </Svg>
  );
  // joint50: people + check
  if (id === 'joint50') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Circle cx="9" cy="7" r="4" {...s}/>
      <Path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" {...s}/>
      <Path d="M16 11l2 2 4-4" {...s}/>
    </Svg>
  );
  // joint100: heart
  if (id === 'joint100') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Path d="M12 21C12 21 3 14.5 3 8.5a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-9 12.5-9 12.5z" {...s}/>
    </Svg>
  );
  // joint200: heart + lines
  if (id === 'joint200') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Path d="M12 21C12 21 3 14.5 3 8.5a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-9 12.5-9 12.5z" {...s}/>
      <Path d="M9 12h6M12 9v6" {...s}/>
    </Svg>
  );
  // joint500: double heart
  if (id === 'joint500') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Path d="M12 19C12 19 5 14 5 9a4 4 0 0 1 7-2.65A4 4 0 0 1 19 9c0 5-7 10-7 10z" {...s}/>
      <Path d="M12 19C12 19 5 14 5 9" {...s}/>
      <Circle cx="19" cy="5" r="3" {...s}/>
    </Svg>
  );

  // ── Team category ─────────────────────────────────────────────────────────
  // team_player: three people
  if (id === 'team_player') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="7" r="3" {...s}/>
      <Circle cx="5" cy="8" r="2.5" {...s}/>
      <Circle cx="19" cy="8" r="2.5" {...s}/>
      <Path d="M1 20v-1a5 5 0 0 1 7-4.6M16 14.4A5 5 0 0 1 23 19v1" {...s}/>
      <Path d="M7 20v-1a5 5 0 0 1 10 0v1" {...s}/>
    </Svg>
  );
  // sync_day: two arrows rotating (sync)
  if (id === 'sync_day') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Path d="M4 4v5h5" {...s}/>
      <Path d="M20 20v-5h-5" {...s}/>
      <Path d="M4 9a9 9 0 0 1 15-3.4" {...s}/>
      <Path d="M20 15a9 9 0 0 1-15 3.4" {...s}/>
    </Svg>
  );

  // ── Routine category ──────────────────────────────────────────────────────
  // perfect_week: 7 dots in a row, all filled
  if (id === 'perfect_week') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Path d="M3 6h18M3 12h18M3 18h18" {...s}/>
      <Rect x="3" y="3" width="18" height="18" rx="3" {...s}/>
      <Path d="M8 12l2.5 2.5 5.5-5" {...s}/>
    </Svg>
  );
  // all_week: calendar with all days checked
  if (id === 'all_week') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="4" width="18" height="17" rx="2" {...s}/>
      <Path d="M8 2v4M16 2v4M3 10h18" {...s}/>
      <Path d="M7 14l2 2 4-4M15 14l2 2" {...s}/>
    </Svg>
  );
  // perfect_month: calendar with a star
  if (id === 'perfect_month') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="4" width="18" height="17" rx="2" {...s}/>
      <Path d="M8 2v4M16 2v4M3 10h18" {...s}/>
      <Path d="M12 13l1 3h3l-2.5 2 1 3L12 19.5 9.5 21l1-3L8 16h3z" {...s}/>
    </Svg>
  );
  // morning_bird: sun rising
  if (id === 'morning_bird') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Path d="M12 7a5 5 0 0 1 5 5H7a5 5 0 0 1 5-5z" {...s}/>
      <Path d="M5 12H3M21 12h-2M12 5V3M6.3 6.3L4.9 4.9M17.7 6.3l1.4-1.4" {...s}/>
      <Path d="M3 17h18" {...s}/>
    </Svg>
  );
  // early_bird_ach: alarm clock
  if (id === 'early_bird_ach') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="13" r="7" {...s}/>
      <Path d="M12 10v3l2 2" {...s}/>
      <Path d="M5 3L2 6M22 6l-3-3" {...s}/>
    </Svg>
  );
  // night_owl: moon + star
  if (id === 'night_owl') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" {...s}/>
      <Path d="M19 4l.4 1.2L20.6 5.6l-1.2.4L19 7.2l-.4-1.2L17.4 5.6l1.2-.4z" {...s}/>
    </Svg>
  );
  // comeback: arrow forming a loop
  if (id === 'comeback') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Path d="M4 4v5h5" {...s}/>
      <Path d="M4 9a9 9 0 1 0 2.4-5.8" {...s}/>
      <Path d="M12 8v4l3 3" {...s}/>
    </Svg>
  );

  // ── Diverse / Special ─────────────────────────────────────────────────────
  // diverse: four small squares (grid)
  if (id === 'diverse') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="3" width="8" height="8" rx="1.5" {...s}/>
      <Rect x="13" y="3" width="8" height="8" rx="1.5" {...s}/>
      <Rect x="3" y="13" width="8" height="8" rx="1.5" {...s}/>
      <Rect x="13" y="13" width="8" height="8" rx="1.5" {...s}/>
    </Svg>
  );
  // philosopher: open book
  if (id === 'philosopher') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Path d="M2 6s1.5-2 5-2 5 2 5 2v14s-1.5-1-5-1-5 1-5 1V6z" {...s}/>
      <Path d="M12 6s1.5-2 5-2 5 2 5 2v14s-1.5-1-5-1-5 1-5 1V6z" {...s}/>
      <Path d="M12 6v14" {...s}/>
    </Svg>
  );

  // ── Legend category ───────────────────────────────────────────────────────
  // legend_365: crown with gems
  if (id === 'legend_365') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Path d="M3 18h18M4 18L3 8l4.5 5L12 4l4.5 9L21 8l-1 10" {...s}/>
      <Circle cx="7" cy="8" r="1" fill={color}/>
      <Circle cx="12" cy="4" r="1" fill={color}/>
      <Circle cx="17" cy="8" r="1" fill={color}/>
    </Svg>
  );
  // legend_10000: infinity symbol
  if (id === 'legend_10000') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Path d="M12 12c-2-2.5-4-4-6-4a4 4 0 0 0 0 8c2 0 4-1.5 6-4z" {...s}/>
      <Path d="M12 12c2 2.5 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.5-6 4z" {...s}/>
    </Svg>
  );
  // legend_together_1000: interlocked rings
  if (id === 'legend_together_1000') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Circle cx="9" cy="12" r="6" {...s}/>
      <Circle cx="15" cy="12" r="6" {...s}/>
    </Svg>
  );
  // legend_streak_partner: two bolts
  if (id === 'legend_streak_partner') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Path d="M9 3L3 12h6L8 21l7-9h-6L9 3z" {...s}/>
      <Path d="M16 6l-3 6h4l-1 6 5-8h-4z" {...s}/>
    </Svg>
  );
  // legend_all_cats: four quadrant icon (all categories)
  if (id === 'legend_all_cats') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" {...s}/>
      <Path d="M12 3v18M3 12h18" {...s}/>
      <Path d="M7 7l2 2M15 7l2-2M7 17l2-2M15 17l2 2" {...s}/>
    </Svg>
  );
  // legend_1000_days: stack of layers
  if (id === 'legend_1000_days') return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2L2 7l10 5 10-5-10-5z" {...s}/>
      <Path d="M2 12l10 5 10-5" {...s}/>
      <Path d="M2 17l10 5 10-5" {...s}/>
    </Svg>
  );

  // Fallback: simple circle with question mark look (info dot)
  return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" {...s}/>
      <Path d="M12 8v4M12 16h.01" {...s}/>
    </Svg>
  );
}

function AchCard({ ach, isEn, lang, tk, delay }: { ach: Achievement; isEn: boolean; lang: string; tk: Theme; delay: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(anim, { toValue: 1, duration: 350, delay, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, delay, useNativeDriver: true, damping: 14, stiffness: 120 }),
    ]).start();
  }, []);

  const pct = ach.target ? (ach.current || 0) / ach.target : (ach.done ? 1 : 0);

  // Категорийные цвета
  const catColor: Record<string, string> = {
    start: tk.text, streak: tk.text2, done: tk.text,
    social: tk.text2, team: tk.text2,
  };
  const accent = ach.done ? catColor[ach.category] : tk.text3;

  return (
    <Animated.View style={{ opacity: anim, transform: [{ scale }], flex: 1, minWidth: '46%', maxWidth: '48%' }}>
      <View style={{
        backgroundColor: tk.bg2,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: ach.done ? tk.text : tk.border,
        padding: 14,
        gap: 8,
      }}>
        {/* Иконка + lock */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ width: 28, height: 28, opacity: ach.done ? 1 : 0.55 }}>
            <AchIcon id={ach.id} color={ach.done ? catColor[ach.category] : tk.text3} />
          </View>
          {ach.joint && (
            <View style={{ backgroundColor: tk.bg3, borderRadius: 6,
              paddingHorizontal: 5, paddingVertical: 2 }}>
              <Text style={{ fontSize: 8, color: tk.text2, fontWeight: '700', letterSpacing: 0.5 }}>
                {isEn ? 'JOINT' : 'СОВМ'}
              </Text>
            </View>
          )}
          {!ach.done && (
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path d="M7 11V7a5 5 0 0 1 10 0v4" stroke={tk.text3} strokeWidth="1.8" strokeLinecap="round"/>
              <Path d="M5 11h14v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" stroke={tk.text3} strokeWidth="1.8"/>
            </Svg>
          )}
        </View>

        {/* Название */}
        <Text style={{ fontSize: 13, fontWeight: '700', color: ach.done ? tk.text : tk.text2, lineHeight: 18 }}>
          {isEn ? ach.label_en : ach.label_uk && lang==='uk' ? ach.label_uk : ach.label_be && lang==='be' ? ach.label_be : ach.label_kk && lang==='kk' ? ach.label_kk : ach.label_ru}
        </Text>
        <Text style={{ fontSize: 10, color: tk.text3, lineHeight: 14 }}>
          {isEn ? ach.desc_en : ach.desc_uk && lang==='uk' ? ach.desc_uk : ach.desc_be && lang==='be' ? ach.desc_be : ach.desc_kk && lang==='kk' ? ach.desc_kk : ach.desc_ru}
        </Text>

        {/* Прогресс-бар */}
        {ach.progress && !ach.done && (
          <View>
            <View style={{ backgroundColor: tk.border, borderRadius: 3, height: 3, overflow: 'hidden' }}>
              <View style={{ width: `${Math.round(pct * 100)}%`, height: 3,
                backgroundColor: ach.done ? catColor[ach.category] : tk.text3,
                borderRadius: 3 }} />
            </View>
            <Text style={{ fontSize: 9, color: ach.done ? tk.text : tk.text3,
              fontWeight: '600', marginTop: 4, textAlign: 'right' }}>
              {ach.progress}
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

//  Главный компонент 

//  Модалка разблокировки достижения 
function AchUnlockModal({ ach, tk, isEn, lang, onClose }: {
  ach: Achievement | null; tk: Theme; isEn: boolean; lang: string; onClose: () => void;
}) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!ach) return;
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 100, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [ach]);

  if (!ach) return null;
  return (
    <TouchableOpacity
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      activeOpacity={1}
      onPress={onClose}>
      <Animated.View style={{ opacity, transform: [{ scale }],
        backgroundColor: tk.bg2, borderRadius: 20, borderWidth: 1.5,
        borderColor: tk.text, padding: 28, alignItems: 'center', gap: 12,
        width: 260, shadowColor: tk.glowColor, shadowOpacity: 0.18,
        shadowRadius: 20, shadowOffset: { width: 0, height: 0 } }}>
        <Text style={{ fontSize: 11, color: tk.text3, letterSpacing: 2,
          textTransform: 'uppercase' }}>{(lang === 'en' ? 'Achievement unlocked' : 'Достижение')}</Text>
        <View style={{ width: 60, height: 60, borderRadius: 18, backgroundColor: tk.bg3,
          alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: tk.border }}>
          <AchIcon id={ach.id} color={tk.text} />
        </View>
        <Text style={{ fontSize: 18, fontWeight: '500', color: tk.text }}>{isEn ? ach.label_en : ach.label_uk && lang==='uk' ? ach.label_uk : ach.label_be && lang==='be' ? ach.label_be : ach.label_kk && lang==='kk' ? ach.label_kk : ach.label_ru}</Text>
        <Text style={{ fontSize: 12, color: tk.text3, textAlign: 'center' }}>{isEn ? ach.desc_en : ach.desc_uk && lang==='uk' ? ach.desc_uk : ach.desc_be && lang==='be' ? ach.desc_be : ach.desc_kk && lang==='kk' ? ach.desc_kk : ach.desc_ru}</Text>
        <Text style={{ fontSize: 10, color: tk.text3, marginTop: 4 }}>
          {isEn ? 'Tap to close' : 'Нажми чтобы закрыть'}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function AchievementsScreen({
  lang, tk, habitCount, totalDone, maxStreak, friendCount, partnerTotalDone, onBack,
}: Props) {
  const isEn = lang === 'en';
  const L = (ru: string, en: string, uk?: string, be?: string, kk?: string) =>
    lang==='en' ? en : lang==='uk' ? (uk||ru) : lang==='be' ? (be||ru) : lang==='kk' ? (kk||ru) : ru;
  const [activeTab, setActiveTab] = useState<string>('start');
  const [newAch, setNewAch] = useState<Achievement | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const prevDone  = useRef(new Set<string>());
  const achMounted = useRef(false);
  const allAchs = buildAchievements({ habitCount, totalDone, maxStreak, friendCount, partnerTotalDone });
  const q = searchQ.toLowerCase();
  const achs = searchQ
    ? allAchs.filter(a => {
        const matchesSearch =
          a.label_ru.toLowerCase().includes(q) ||
          a.label_en.toLowerCase().includes(q) ||
          a.desc_ru.toLowerCase().includes(q) ||
          a.desc_en.toLowerCase().includes(q);
        const matchesTab = activeTab === 'all' || a.category === activeTab;
        return matchesSearch && matchesTab;
      })
    : allAchs;
  
  useEffect(() => {
    const justUnlocked = achs.filter(a => a.done && !prevDone.current.has(a.id));
    if (justUnlocked.length > 0 && achMounted.current) {
      setNewAch(justUnlocked[0]);
    }
    achs.filter(a => a.done).forEach(a => prevDone.current.add(a.id));
    achMounted.current = true;
  }, [totalDone, maxStreak, habitCount]);
  const done  = achs.filter(a => a.done).length;
  const total = achs.length;
  const pct   = Math.round(done / total * 100);

  const headerAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const categories: { key: Achievement['category']; label_ru: string; label_en: string; color: string }[] = [
    { key: 'start',  label_ru: 'Привычки', label_en: 'Habits',  color: tk.text },
    { key: 'streak', label_ru: 'Серии',     label_en: 'Streaks',  label_uk: 'Серії',   label_be: 'Серыі',   label_kk: 'Серия', color: tk.text2 },
    { key: 'done',   label_ru: 'Выполнено', label_en: 'Done',     label_uk: 'Виконано',label_be: 'Выканана',label_kk: 'Орындалды', color: tk.text },
    { key: 'social', label_ru: 'Вместе',    label_en: 'Together', label_uk: 'Разом',   label_be: 'Разам',   label_kk: 'Бірге', color: tk.text2 },
    { key: 'legend', label_ru: 'Легенды',   label_en: 'Legends',  label_uk: 'Легенди', label_be: 'Легенды', label_kk: 'Аңыздар', color: '#D4AF37' },
  ];

  let cardDelay = 0;

  return (
    <View style={{ flex: 1, backgroundColor: tk.bg }}>
      <AchUnlockModal ach={newAch} tk={tk} isEn={isEn} lang={lang} onClose={() => setNewAch(null)} />
      {/* Поиск */}
      <View style={{ paddingHorizontal: 18, paddingBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10,
          backgroundColor: tk.bg2, borderWidth: 1, borderColor: tk.border,
          borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 }}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              stroke={tk.text3} strokeWidth="1.8" strokeLinecap="round"/>
          </Svg>
          <TextInput value={searchQ} onChangeText={setSearchQ}
            placeholder={isEn ? 'Search achievements...' : 'Поиск достижений...'}
            placeholderTextColor={tk.text3}
            style={{ flex: 1, fontSize: 14, color: tk.text, padding: 0 }}/>
          {searchQ.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQ('')}>
              <Text style={{ fontSize: 16, color: tk.text3 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        removeClippedSubviews={true}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 100 }}>

        {/* Хедер */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12,
          paddingTop: 16, paddingBottom: 4 }}>
          <TouchableOpacity onPress={onBack}
            style={{ width: 36, height: 36, borderRadius: 10,
              backgroundColor: tk.bg2, borderWidth: 1, borderColor: tk.border,
              shadowColor: tk.cardShadowColor, shadowOpacity: tk.cardShadowOpacity,
              shadowRadius: tk.cardShadowRadius, shadowOffset: { width: 0, height: 3 }, elevation: 0,
              alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M19 12H5M5 12l7 7M5 12l7-7"
                stroke={tk.text2} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </Svg>
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '700', color: tk.text }}>
            {(lang === 'en' ? 'Achievements' : lang==='uk' ? 'Досягнення' : lang==='be' ? 'Дасягненні' : lang==='kk' ? 'Жетістіктер' : 'Достижения')}
          </Text>
        </View>

        {/* Большой прогресс-блок */}
        <Animated.View style={{ opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0,1], outputRange: [20,0] }) }] }}>
          <View style={{ backgroundColor: tk.bg2, borderRadius: 24, padding: 20, marginTop: 12, marginBottom: 6,
            borderWidth: 1, borderColor: tk.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
              <View>
                <Text style={{ fontSize: 40, fontWeight: '800', color: tk.text, lineHeight: 44 }}>{done}</Text>
                <Text style={{ fontSize: 13, color: tk.text2 }}>
                  {isEn ? `of ${total} unlocked` : lang==='uk' ? `з ${total} відкрито` : lang==='kk' ? `${total}-дан ашылды` : `из ${total} открыто`}
                </Text>
              </View>
              <Text style={{ fontSize: 32, fontWeight: '800', color: tk.text3 }}>{pct}%</Text>
            </View>
            {/* Общий прогресс-бар */}
            <View style={{ backgroundColor: tk.border, borderRadius: 6, height: 6, overflow: 'hidden' }}>
              <Animated.View style={{ width: `${pct}%`, height: 6, borderRadius: 6,
                backgroundColor: tk.text }} />
            </View>
            {/* Категорийные мини-статы */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              {categories.map(cat => {
                const catAchs = achs.filter(a => a.category === cat.key);
                const catDone = catAchs.filter(a => a.done).length;
                return (
                  <View key={cat.key} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                    <View style={{ width: '100%', backgroundColor: tk.border,
                      borderRadius: 4, height: 3, overflow: 'hidden' }}>
                      <View style={{ width: `${catAchs.length ? catDone/catAchs.length*100 : 0}%`,
                        height: 3, backgroundColor: cat.color, borderRadius: 4 }} />
                    </View>
                    <Text style={{ fontSize: 8, color: cat.color, fontWeight: '600', letterSpacing: 0.5 }}>
                      {isEn ? cat.label_en.toUpperCase() : cat.label_ru.toUpperCase()}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </Animated.View>

        {/* Достижения по категориям */}
        {categories.map(cat => {
          const catAchs = achs.filter(a => a.category === cat.key);
          return (
            <View key={cat.key} style={{ marginTop: 20 }}>
              {/* Заголовок категории */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: cat.color }} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: cat.color,
                  letterSpacing: 1.5, textTransform: 'uppercase' }}>
                  {isEn ? cat.label_en : cat.label_ru}
                </Text>
                <Text style={{ fontSize: 10, color: tk.text3 }}>
                  {catAchs.filter(a => a.done).length}/{catAchs.length}
                </Text>
              </View>
              {/* Сетка 2 колонки */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {catAchs.map((ach, i) => {
                  const delay = (cardDelay++ * 60);
                  return (
                    <AchCard key={ach.id} ach={ach} isEn={isEn} lang={lang} tk={tk} delay={delay} />
                  );
                })}
              </View>
            </View>
          );
        })}

      </ScrollView>
    </View>
  );
}
