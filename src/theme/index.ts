export interface Theme {
  bg:     string;
  bg2:    string;
  bg3:    string;
  border: string;
  text:   string;
  text2:  string;
  text3:  string;
  inp:    string;
  // Primary accent colour — used for active states, progress bars, checkboxes
  accent: string;
  // Свечение карточек
  cardShadowColor:   string;
  cardShadowOpacity: number;
  cardShadowRadius:  number;
  cardElevation:     number;
  // Свечение активных элементов (кнопки, выбранный день и т.д.)
  glowColor:         string;
  glowOpacity:       number;
  glowRadius:        number;
  glowElevation:     number;
  cardBorder:        string;
}

const dark: Theme = {
  bg: '#0c0c0c', bg2: '#111111', bg3: '#181818',
  border: '#1e1e1e', text: '#ffffff', text2: '#888888', text3: '#3a3a3a',
  inp: '#111111',
  accent: '#7c3aed',
  cardShadowColor:   '#000000',
  cardShadowOpacity: 0,
  cardShadowRadius:  0,
  cardElevation:     0,
  glowColor:         '#7c3aed',
  glowOpacity:       0.15,
  glowRadius:        12,
  glowElevation:     0,
  cardBorder: '#1e1e1e',
};

const light: Theme = {
  bg: '#f5f5f5', bg2: '#ffffff', bg3: '#eeeeee',
  border: '#e5e5e5', text: '#111111', text2: '#666666', text3: '#bbbbbb',
  inp: '#ffffff',
  accent: '#7c3aed',
  cardShadowColor:   '#000000',
  cardShadowOpacity: 0,
  cardShadowRadius:  0,
  cardElevation:     0,
  glowColor:         '#7c3aed',
  glowOpacity:       0.1,
  glowRadius:        10,
  glowElevation:     0,
  cardBorder: '#e5e5e5',
};

export const getTK = (t: 'dark' | 'light') => t === 'dark' ? dark : light;

export const ICONS = [
  'exercise','read','water','meditate','walk','nosocial',
];

export const WD_RU = ['пн','вт','ср','чт','пт','сб','вс'];
export const WD_EN = ['Mo','Tu','We','Th','Fr','Sa','Su'];

export const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
export const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export const MON_GENITIVE_RU = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

// ─── Готовые стили свечения ───────────────────────────────────────────────────
export const cardShadow = (tk: Theme) => ({
  shadowColor:   tk.cardShadowColor,
  shadowOpacity: tk.cardShadowOpacity,
  shadowRadius:  tk.cardShadowRadius,
  shadowOffset:  { width: 0 as const, height: 3 as const },
  elevation:     tk.cardElevation,
});

export const glowShadow = (tk: Theme) => ({
  shadowColor:   tk.glowColor,
  shadowOpacity: tk.glowOpacity,
  shadowRadius:  tk.glowRadius,
  shadowOffset:  { width: 0 as const, height: 0 as const },
  elevation:     tk.glowElevation,
});
