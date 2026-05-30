// ─── Система переводов ───────────────────────────────────────────────────────

export type LangCode = 'ru' | 'en' | 'uk' | 'be' | 'kk';

export interface Translations {
  // Auth
  auth_title: string;
  auth_login: string;
  auth_register: string;
  auth_name: string;
  auth_email: string;
  auth_password: string;
  auth_enter: string;
  auth_create: string;
  auth_continue: string;
  auth_terms: string;

  // Home
  home_greeting: string;
  home_rooms: string;
  home_create: string;
  home_room_name: string;
  home_normal: string;
  home_love: string;
  home_friends: string;
  home_for_two: string;
  home_create_btn: string;
  home_creating: string;
  home_invited: string;
  home_accept: string;
  home_love_room: string;
  home_normal_room: string;

  // Today
  today_schedule: string;
  today_all: string;
  today_mine: string;
  today_others: string;
  today_empty_title: string;
  today_empty_sub: string;
  today_progress: string;

  // Add habit
  habit_new: string;
  habit_edit: string;
  habit_name: string;
  habit_name_placeholder: string;
  habit_time: string;
  habit_time_optional: string;
  habit_time_hint: string;
  habit_icon: string;
  habit_color: string;
  habit_days: string;
  habit_note_love: string;
  habit_note_normal: string;
  habit_add: string;
  habit_save: string;

  // Detail
  detail_title: string;
  detail_streak: string;
  detail_today: string;
  detail_7days: string;
  detail_delete: string;
  detail_only_owner: string;
  detail_by: string;

  // Friends
  friends_title: string;
  friends_us: string;
  friends_invite: string;
  friends_invite_partner: string;
  friends_create_link: string;
  friends_copy: string;
  friends_new_link: string;
  friends_hint: string;
  friends_creator: string;
  friends_member: string;
  friends_since: string;

  // Stats
  stats_title: string;
  stats_habits: string;
  stats_members: string;
  stats_done_today: string;
  stats_total: string;
  stats_all_habits: string;
  stats_add_first: string;
  stats_by: string;
  stats_days: string;

  // Profile
  profile_title: string;
  profile_account: string;
  profile_name: string;
  profile_email: string;
  profile_change_pass: string;
  profile_settings: string;
  profile_theme: string;
  profile_theme_dark: string;
  profile_theme_light: string;
  profile_language: string;
  profile_notifications: string;
  profile_help: string;
  profile_support: string;
  profile_rate: string;
  profile_rate_soon: string;
  profile_security: string;
  profile_logout: string;
  profile_delete: string;
  profile_rooms: string;
  profile_since: string;
  profile_save: string;
  profile_cancel: string;
  profile_delete_photo: string;
  profile_new_name: string;
  profile_new_pass: string;
  profile_old_pass: string;
  profile_pass_changed: string;
  profile_version: string;

  // Nav
  nav_today: string;
  nav_friends: string;
  nav_stats: string;
  nav_rooms: string;
  nav_profile: string;
  nav_us: string;

  // Room
  room_created: string;
  room_invite_hint: string;
  room_go: string;
  room_skip: string;
  room_invite_label: string;
  room_delete: string;
  room_delete_confirm: string;

  // Weekdays
  wd: string[];

  // Months / date
  with_us: string;

  // Notifications
  notif_all: string;
  notif_all_sub: string;
  notif_morning: string;
  notif_morning_sub: string;
  notif_evening: string;
  notif_evening_sub: string;
  notif_streak: string;
  notif_streak_sub: string;
  notif_partner: string;
  notif_partner_sub: string;

  // Errors
  err_enter_name: string;
  err_name_short: string;
  err_name_long: string;
  err_enter_email: string;
  err_email_long: string;
  err_email_chars: string;
  err_email_format: string;
  err_email_domain: string;
  err_enter_pass: string;
  err_pass_short: string;
  err_pass_long: string;
  err_pass_letters: string;
  err_pass_digits: string;
  err_enter_title: string;

  // Support
  support_title: string;
  support_sub: string;
  support_close: string;

  // Misc
  delete_confirm: string;
  irreversible: string;
  confirm_pass: string;
  error: string;
  wrong_pass: string;
}

const ru: Translations = {
  auth_title: 'PathTogether', auth_login: 'Войти', auth_register: 'Регистрация',
  auth_name: 'Ваше имя', auth_email: 'Email', auth_password: 'Пароль',
  auth_enter: 'Войти →', auth_create: 'Создать аккаунт →', auth_continue: 'Продолжить →',
  auth_terms: 'Продолжая, вы соглашаетесь с условиями использования',
  home_greeting: 'Привет', home_rooms: 'Ваши комнаты', home_create: 'Создать комнату',
  home_room_name: 'Название комнаты', home_normal: 'Обычная', home_love: 'Love',
  home_friends: 'Друзья / команда', home_for_two: 'Для двоих',
  home_create_btn: 'Создать комнату →', home_creating: 'Создаём...',
  home_invited: 'Вас приглашают', home_accept: 'Принять',
  home_love_room: '💕 Love комната', home_normal_room: '👥 Обычная комната',
  today_schedule: '📅 Расписание', today_all: 'Все', today_mine: 'Мои', today_others: 'Друзей',
  today_empty_title: 'Нет привычек на сегодня', today_empty_sub: 'Нажмите + чтобы добавить',
  today_progress: 'Мой прогресс',
  habit_new: 'Новая привычка', habit_edit: 'Редактировать',
  habit_name: 'Название', habit_name_placeholder: 'Например: Пить воду',
  habit_time: 'Время', habit_time_optional: '(необязательно)',
  habit_time_hint: 'Привычка появится в расписании',
  habit_icon: 'Иконка', habit_color: 'Цвет', habit_days: 'Дни',
  habit_note_love: '💑 Каждый отмечает сам — видите прогресс друг друга',
  habit_note_normal: '👤 Привычка от вашего имени — каждый отмечает сам',
  habit_add: 'Добавить привычку', habit_save: 'Сохранить изменения',
  detail_title: 'Подробности', detail_streak: 'Мой стрик', detail_today: 'Сегодня',
  detail_7days: '7 дней — по участникам', detail_delete: '🗑 Удалить привычку',
  detail_only_owner: 'Только {name} может удалить эту привычку', detail_by: 'от',
  friends_title: 'Участники', friends_us: 'Нас двое 💑',
  friends_invite: 'Пригласить друга', friends_invite_partner: 'Пригласить партнёра',
  friends_create_link: '🔗 Создать ссылку-приглашение', friends_copy: '📋 Копировать ссылку',
  friends_new_link: 'Создать новую ссылку',
  friends_hint: 'Друг откроет ссылку — и сразу попадёт в комнату',
  friends_creator: 'Создатель', friends_member: 'Участник', friends_since: 'с',
  stats_title: 'Статистика', stats_habits: '🗂 Привычек', stats_members: '👥 Участников',
  stats_done_today: '✅ Выполнено сег.', stats_total: '🏆 Всего отметок',
  stats_all_habits: 'Все привычки', stats_add_first: 'Добавьте первую привычку →',
  stats_by: 'от', stats_days: 'дней',
  profile_title: 'Профиль', profile_account: 'Аккаунт', profile_name: 'Имя',
  profile_email: 'Email', profile_change_pass: 'Изменить пароль',
  profile_settings: 'Настройки', profile_theme: 'Тема',
  profile_theme_dark: 'Тёмная', profile_theme_light: 'Светлая',
  profile_language: 'Язык', profile_notifications: 'Уведомления',
  profile_help: 'Помощь', profile_support: 'Написать в поддержку',
  profile_rate: 'Оценить приложение', profile_rate_soon: 'Скоро в App Store',
  profile_security: 'Безопасность', profile_logout: 'Выйти из аккаунта',
  profile_delete: 'Удалить аккаунт', profile_rooms: 'Комнат', profile_since: 'С нами',
  profile_save: 'Сохранить', profile_cancel: 'Отмена',
  profile_delete_photo: 'Удалить фото', profile_new_name: 'Новое имя',
  profile_new_pass: 'Новый пароль', profile_old_pass: 'Текущий пароль',
  profile_pass_changed: '✓ Пароль изменён!', profile_version: 'PathTogether v1.0.0',
  nav_today: 'Сегодня', nav_friends: 'Друзья', nav_stats: 'Стата',
  nav_rooms: 'Комнаты', nav_profile: 'Профиль', nav_us: 'Мы',
  room_created: 'Комната создана!',
  room_invite_hint: 'Поделитесь ссылкой с друзьями — они сразу попадут в вашу комнату',
  room_go: 'Перейти в комнату →', room_skip: 'Пропустить',
  room_invite_label: 'Ссылка-приглашение',
  room_delete: 'Удалить комнату?', room_delete_confirm: 'будет удалена из вашего списка',
  wd: ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'], with_us: 'С нами',
  notif_all: 'Все уведомления', notif_all_sub: 'Главный переключатель',
  notif_morning: 'Утреннее напоминание', notif_morning_sub: '08:00 — начни день с привычек',
  notif_evening: 'Вечернее напоминание', notif_evening_sub: '20:00 — если не выполнил > 50%',
  notif_streak: 'Стрик под угрозой', notif_streak_sub: 'Не потеряй серию',
  notif_partner: 'Активность партнёра', notif_partner_sub: 'Когда партнёр выполнил привычку',
  err_enter_name: 'Введите имя', err_name_short: 'Минимум 2 символа',
  err_name_long: 'Максимум 30 символов', err_enter_email: 'Введите email',
  err_email_long: 'Email слишком длинный', err_email_chars: 'Email содержит недопустимые символы',
  err_email_format: 'Неверный формат email',
  err_email_domain: 'Используйте gmail.com, yandex.ru, mail.ru, outlook.com и др.',
  err_enter_pass: 'Введите пароль', err_pass_short: 'Минимум 6 символов',
  err_pass_long: 'Максимум 50 символов', err_pass_letters: 'Пароль должен содержать буквы',
  err_pass_digits: 'Пароль должен содержать цифры', err_enter_title: 'Введите название!',
  support_title: '💬 Поддержка',
  support_sub: 'Нашли баг или есть предложения? Напишите нам — ответим быстро!',
  support_close: 'Закрыть',
  delete_confirm: 'Удалить?', irreversible: 'Это действие нельзя отменить',
  confirm_pass: 'Введите пароль для подтверждения', error: 'Ошибка', wrong_pass: 'Неверный пароль',
};

const en: Translations = {
  auth_title: 'PathTogether', auth_login: 'Login', auth_register: 'Register',
  auth_name: 'Your name', auth_email: 'Email', auth_password: 'Password',
  auth_enter: 'Login →', auth_create: 'Create account →', auth_continue: 'Continue →',
  auth_terms: 'By continuing, you agree to the terms of use',
  home_greeting: 'Hello', home_rooms: 'Your rooms', home_create: 'Create room',
  home_room_name: 'Room name', home_normal: 'Regular', home_love: 'Love',
  home_friends: 'Friends / team', home_for_two: 'For two',
  home_create_btn: 'Create room →', home_creating: 'Creating...',
  home_invited: 'You are invited', home_accept: 'Accept',
  home_love_room: '💕 Love room', home_normal_room: '👥 Regular room',
  today_schedule: '📅 Schedule', today_all: 'All', today_mine: 'Mine', today_others: 'Friends',
  today_empty_title: 'No habits for today', today_empty_sub: 'Tap + to add',
  today_progress: 'My progress',
  habit_new: 'New habit', habit_edit: 'Edit',
  habit_name: 'Name', habit_name_placeholder: 'E.g.: Drink water',
  habit_time: 'Time', habit_time_optional: '(optional)',
  habit_time_hint: 'Habit will appear in schedule',
  habit_icon: 'Icon', habit_color: 'Color', habit_days: 'Days',
  habit_note_love: '💑 Each marks independently — see each other\'s progress',
  habit_note_normal: '👤 Habit from your name — each marks independently',
  habit_add: 'Add habit', habit_save: 'Save changes',
  detail_title: 'Details', detail_streak: 'My streak', detail_today: 'Today',
  detail_7days: '7 days — by member', detail_delete: '🗑 Delete habit',
  detail_only_owner: 'Only {name} can delete this habit', detail_by: 'by',
  friends_title: 'Members', friends_us: 'Just us two 💑',
  friends_invite: 'Invite friend', friends_invite_partner: 'Invite partner',
  friends_create_link: '🔗 Create invite link', friends_copy: '📋 Copy link',
  friends_new_link: 'Create new link',
  friends_hint: 'Friend opens the link — and joins instantly',
  friends_creator: 'Creator', friends_member: 'Member', friends_since: 'since',
  stats_title: 'Statistics', stats_habits: '🗂 Habits', stats_members: '👥 Members',
  stats_done_today: '✅ Done today', stats_total: '🏆 Total marks',
  stats_all_habits: 'All habits', stats_add_first: 'Add your first habit →',
  stats_by: 'by', stats_days: 'days',
  profile_title: 'Profile', profile_account: 'Account', profile_name: 'Name',
  profile_email: 'Email', profile_change_pass: 'Change password',
  profile_settings: 'Settings', profile_theme: 'Theme',
  profile_theme_dark: 'Dark', profile_theme_light: 'Light',
  profile_language: 'Language', profile_notifications: 'Notifications',
  profile_help: 'Help', profile_support: 'Contact support',
  profile_rate: 'Rate app', profile_rate_soon: 'Coming to App Store',
  profile_security: 'Security', profile_logout: 'Sign out',
  profile_delete: 'Delete account', profile_rooms: 'Rooms', profile_since: 'With us',
  profile_save: 'Save', profile_cancel: 'Cancel',
  profile_delete_photo: 'Remove photo', profile_new_name: 'New name',
  profile_new_pass: 'New password', profile_old_pass: 'Current password',
  profile_pass_changed: '✓ Password changed!', profile_version: 'PathTogether v1.0.0',
  nav_today: 'Today', nav_friends: 'Friends', nav_stats: 'Stats',
  nav_rooms: 'Rooms', nav_profile: 'Profile', nav_us: 'Us',
  room_created: 'Room created!',
  room_invite_hint: 'Share the link with friends — they\'ll join instantly',
  room_go: 'Go to room →', room_skip: 'Skip',
  room_invite_label: 'Invite link',
  room_delete: 'Delete room?', room_delete_confirm: 'will be removed from your list',
  wd: ['Mo','Tu','We','Th','Fr','Sa','Su'], with_us: 'With us',
  notif_all: 'All notifications', notif_all_sub: 'Master switch',
  notif_morning: 'Morning reminder', notif_morning_sub: '08:00 — start your day with habits',
  notif_evening: 'Evening reminder', notif_evening_sub: '20:00 — if less than 50% done',
  notif_streak: 'Streak at risk', notif_streak_sub: 'Don\'t lose your streak',
  notif_partner: 'Partner activity', notif_partner_sub: 'When partner completes a habit',
  err_enter_name: 'Enter name', err_name_short: 'Min 2 characters',
  err_name_long: 'Max 30 characters', err_enter_email: 'Enter email',
  err_email_long: 'Email too long', err_email_chars: 'Invalid characters in email',
  err_email_format: 'Invalid email format',
  err_email_domain: 'Use gmail.com, outlook.com, etc.',
  err_enter_pass: 'Enter password', err_pass_short: 'Min 6 characters',
  err_pass_long: 'Max 50 characters', err_pass_letters: 'Password must contain letters',
  err_pass_digits: 'Password must contain digits', err_enter_title: 'Enter a title!',
  support_title: '💬 Support',
  support_sub: 'Found a bug or have suggestions? Write to us!',
  support_close: 'Close',
  delete_confirm: 'Delete?', irreversible: 'This action cannot be undone',
  confirm_pass: 'Enter password to confirm', error: 'Error', wrong_pass: 'Wrong password',
};

const uk: Translations = {
  ...ru,
  // Основные строки приложения
  habit_new: 'Нова звичка', habit_edit: 'Редагувати', habit_save: 'Зберегти зміни',
  habit_add: 'Додати звичку', habit_name: 'Назва', habit_name_placeholder: 'Наприклад: Пити воду',
  profile_title: 'Профіль', profile_logout: 'Вийти з акаунту',
  auth_login: 'Увійти', auth_register: 'Реєстрація',
  auth_name: 'Ваше ім\'я', auth_enter: 'Увійти →', auth_create: 'Створити акаунт →',
  auth_continue: 'Продовжити →', auth_terms: 'Продовжуючи, ви погоджуєтесь з умовами використання',
  home_greeting: 'Привіт', home_rooms: 'Ваші кімнати', home_create: 'Створити кімнату',
  home_room_name: 'Назва кімнати', home_normal: 'Звичайна',
  home_create_btn: 'Створити кімнату →', home_creating: 'Створюємо...',
  home_invited: 'Вас запрошують', home_accept: 'Прийняти',
  home_love_room: '💕 Love кімната', home_normal_room: '👥 Звичайна кімната',
  today_schedule: '📅 Розклад', today_all: 'Всі', today_mine: 'Мої', today_others: 'Друзів',
  today_empty_title: 'Немає звичок на сьогодні', today_empty_sub: 'Натисніть + щоб додати',
  today_progress: 'Мій прогрес',
  habit_new: 'Нова звичка', habit_edit: 'Редагувати',
  habit_name: 'Назва', habit_name_placeholder: 'Наприклад: Пити воду',
  habit_add: 'Додати звичку', habit_save: 'Зберегти зміни',
  profile_title: 'Профіль', profile_logout: 'Вийти з акаунту',
  profile_delete: 'Видалити акаунт', profile_save: 'Зберегти', profile_cancel: 'Скасувати',
  nav_today: 'Сьогодні', nav_friends: 'Друзі', nav_stats: 'Стата',
  nav_rooms: 'Кімнати', nav_profile: 'Профіль',
  wd: ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'],
};

const be: Translations = {
  ...ru,
  auth_login: 'Увайсці', auth_register: 'Рэгістрацыя',
  auth_name: 'Ваша імя', auth_enter: 'Увайсці →', auth_create: 'Стварыць акаўнт →',
  auth_continue: 'Працягнуць →',
  home_greeting: 'Прывіт', home_rooms: 'Вашы пакоі', home_create: 'Стварыць пакой',
  home_room_name: 'Назва пакоя', home_normal: 'Звычайны',
  home_create_btn: 'Стварыць пакой →', home_creating: 'Ствараем...',
  home_invited: 'Вас запрашаюць', home_accept: 'Прыняць',
  today_empty_title: 'Няма звычак на сёння', today_empty_sub: 'Націсніце + каб дадаць',
  nav_today: 'Сёння', nav_friends: 'Сябры', nav_profile: 'Профіль',
  wd: ['Пн','Аў','Ср','Чц','Пт','Сб','Нд'],
};

const kk: Translations = {
  ...ru,
  auth_login: 'Кіру', auth_register: 'Тіркелу',
  auth_name: 'Сіздің атыңыз', auth_enter: 'Кіру →', auth_create: 'Аккаунт жасау →',
  auth_continue: 'Жалғастыру →',
  home_greeting: 'Сәлем', home_rooms: 'Сіздің бөлмелер', home_create: 'Бөлме жасау',
  home_room_name: 'Бөлме атауы', home_normal: 'Қарапайым',
  home_create_btn: 'Бөлме жасау →', home_creating: 'Жасалуда...',
  home_invited: 'Сізді шақырып жатыр', home_accept: 'Қабылдау',
  today_empty_title: 'Бүгін әдеттер жоқ', today_empty_sub: '+ басыңыз',
  nav_today: 'Бүгін', nav_friends: 'Достар', nav_profile: 'Профиль',
  wd: ['Дс','Сс','Ср','Бс','Жм','Сн','Жк'],
};

export const TRANSLATIONS: Record<LangCode, Translations> = { ru, en, uk, be, kk };

export const t = (lang: string, key: keyof Translations): string => {
  const code = (lang as LangCode) in TRANSLATIONS ? (lang as LangCode) : 'ru';
  const val = TRANSLATIONS[code][key];
  return Array.isArray(val) ? val.join(',') : (val as string);
};

export const tArr = (lang: string, key: keyof Translations): string[] => {
  const code = (lang as LangCode) in TRANSLATIONS ? (lang as LangCode) : 'ru';
  const val = TRANSLATIONS[code][key];
  return Array.isArray(val) ? val : [val as string];
};

// ── Мультиязычность ──────────────────────────────────────────────────────────
// Вместо `isEn ? 'English' : 'Русский'` используй `tr(lang, 'Русский', 'English')`
// Для uk/be/kk добавь 3-й аргумент или они унаследуют ru
export function tr(
  lang: string,
  ru: string,
  en: string,
  uk?: string,
  be?: string,
  kk?: string,
): string {
  switch (lang) {
    case 'en': return en;
    case 'uk': return uk || ru;
    case 'be': return be || ru;
    case 'kk': return kk || ru;
    default:   return ru;
  }
}

// Сокращённая версия для компонентов: получает функцию локализации
export function makeTr(lang: string) {
  return (ru: string, en: string, uk?: string, be?: string, kk?: string) =>
    tr(lang, ru, en, uk, be, kk);
}
