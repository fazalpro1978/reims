// ─────────────────────────────────────────────────────────────────────────────
// Vanguard REOS Theme Engine · PropertyScape
// Eight hot-swappable branding themes: 5 Corporate + 3 Motorsport
// ─────────────────────────────────────────────────────────────────────────────

export type ThemeId =
  | 'prive-group'
  | 'luxe-noir'
  | 'neo-graphite'
  | 'tech-amethyst'
  | 'metropolitan-bronze'
  | 'motorsport-bmw-i-blue'
  | 'motorsport-m-crimson'
  | 'motorsport-eco-teal'
  // Windows Core Standard
  | 'windows-light'
  | 'windows-dark'
  | 'windows-glow'
  | 'windows-captured-motion'
  | 'windows-sunrise'
  | 'windows-flow'
  // Windows High-Contrast Accessibility
  | 'hc-aquatic'
  | 'hc-desert'
  | 'hc-dusk'
  | 'hc-night-sky'
  // Cairo Shell / Unix Workstation
  | 'unix-gnome'
  | 'unix-kde';

export type ThemeCategory =
  | 'corporate'
  | 'motorsport'
  | 'windows-standard'
  | 'windows-hc'
  | 'unix';

export type LayoutMode = 'default' | 'gnome' | 'kde';

export interface ThemeTokens {
  // Primary brand accent
  accent: string;
  accentHover: string;
  accentText: string;        // foreground color when placed ON accent bg

  // Backgrounds — void → surface hierarchy
  bgVoid: string;            // deepest page background
  bgBase: string;            // primary content background
  bgSurface: string;         // panel / modal background
  bgElevated: string;        // hover / slightly elevated
  bgSubtle: string;          // chips, tags, subtle fills
  bgHeader: string;          // modal header / top navigation
  bgSubHeader: string;       // action bar / sub-navigation

  // Borders — faint → strong
  borderFaint: string;
  borderDefault: string;
  borderStrong: string;

  // Text — primary → dimmest
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textFaint: string;
  textDimmer: string;
  textDimmest: string;
}

export interface Theme {
  id: ThemeId;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  category: ThemeCategory;
  subCategory?: string;
  layoutMode?: LayoutMode;   // unix themes hot-swap the shell layout
  tokens: ThemeTokens;
}

export const THEMES: Theme[] = [

  // ── Corporate Tiers ─────────────────────────────────────────────────────────

  {
    id: 'prive-group',
    name: 'Privé Group',
    shortName: 'Privé Group',
    tagline: 'Signature Gold · Void Black',
    description: 'The classic Privé Group brand identity — champagne gold on pure void black.',
    category: 'corporate',
    tokens: {
      accent:        '#c9a84c',
      accentHover:   '#dfc070',
      accentText:    '#0f0f0f',
      bgVoid:        '#0f0f0f',
      bgBase:        '#111111',
      bgSurface:     '#181818',
      bgElevated:    '#1e1e1e',
      bgSubtle:      '#2a2a2a',
      bgHeader:      '#0f172a',
      bgSubHeader:   '#1e293b',
      borderFaint:   '#1a1a1a',
      borderDefault: '#2a2a2a',
      borderStrong:  '#333333',
      textPrimary:   '#e0e0e0',
      textSecondary: '#d0d0d0',
      textMuted:     '#888888',
      textFaint:     '#666666',
      textDimmer:    '#555555',
      textDimmest:   '#444444',
    },
  },

  {
    id: 'luxe-noir',
    name: 'Luxe Noir',
    shortName: 'Luxe Noir',
    tagline: 'Champagne Gold · Pure Black',
    description: 'Maximum luxury contrast — champagne gold on absolute black.',
    category: 'corporate',
    tokens: {
      accent:        '#e8c97a',
      accentHover:   '#f0dc92',
      accentText:    '#070707',
      bgVoid:        '#000000',
      bgBase:        '#070707',
      bgSurface:     '#0d0d0d',
      bgElevated:    '#131313',
      bgSubtle:      '#1c1c1c',
      bgHeader:      '#08080f',
      bgSubHeader:   '#0f0f1c',
      borderFaint:   '#111111',
      borderDefault: '#1e1e1e',
      borderStrong:  '#282828',
      textPrimary:   '#f5f0e8',
      textSecondary: '#e8e0d0',
      textMuted:     '#9a8a70',
      textFaint:     '#706050',
      textDimmer:    '#504030',
      textDimmest:   '#3a2e20',
    },
  },

  {
    id: 'neo-graphite',
    name: 'Neo-Graphite',
    shortName: 'Graphite',
    tagline: 'Steel Blue · Graphite Slate',
    description: 'Precision technology aesthetic — steel blue on cool graphite.',
    category: 'corporate',
    tokens: {
      accent:        '#5b9bd5',
      accentHover:   '#72aee0',
      accentText:    '#0d0f12',
      bgVoid:        '#0d0f12',
      bgBase:        '#13161c',
      bgSurface:     '#191e26',
      bgElevated:    '#1f2530',
      bgSubtle:      '#282f3c',
      bgHeader:      '#0e1520',
      bgSubHeader:   '#15202e',
      borderFaint:   '#182028',
      borderDefault: '#222c38',
      borderStrong:  '#2c3848',
      textPrimary:   '#d8e2ec',
      textSecondary: '#b8c8d8',
      textMuted:     '#5878a0',
      textFaint:     '#3c5878',
      textDimmer:    '#2a4060',
      textDimmest:   '#1e3050',
    },
  },

  {
    id: 'tech-amethyst',
    name: 'Tech Amethyst',
    shortName: 'Amethyst',
    tagline: 'Amethyst Violet · Deep Indigo',
    description: 'Digital intelligence aesthetic — amethyst on deep indigo void.',
    category: 'corporate',
    tokens: {
      accent:        '#9b7cde',
      accentHover:   '#b09ae8',
      accentText:    '#0a0812',
      bgVoid:        '#0a0812',
      bgBase:        '#10091c',
      bgSurface:     '#160c28',
      bgElevated:    '#1c1032',
      bgSubtle:      '#261840',
      bgHeader:      '#0e0818',
      bgSubHeader:   '#180f28',
      borderFaint:   '#1a1030',
      borderDefault: '#261840',
      borderStrong:  '#322050',
      textPrimary:   '#e0d8f4',
      textSecondary: '#c8c0e8',
      textMuted:     '#7060b0',
      textFaint:     '#503880',
      textDimmer:    '#3c2860',
      textDimmest:   '#2a1848',
    },
  },

  {
    id: 'metropolitan-bronze',
    name: 'Metropolitan Bronze',
    shortName: 'Metro Bronze',
    tagline: 'Warm Copper · Urban Dark',
    description: 'Sophisticated urban grid — warm copper bronze on dark earth tones.',
    category: 'corporate',
    tokens: {
      accent:        '#c8844a',
      accentHover:   '#de9e62',
      accentText:    '#0f0a06',
      bgVoid:        '#0f0a06',
      bgBase:        '#170e08',
      bgSurface:     '#1e1208',
      bgElevated:    '#27180c',
      bgSubtle:      '#351f10',
      bgHeader:      '#16100a',
      bgSubHeader:   '#221810',
      borderFaint:   '#221608',
      borderDefault: '#321e10',
      borderStrong:  '#402818',
      textPrimary:   '#ecd8c0',
      textSecondary: '#d8c0a0',
      textMuted:     '#907040',
      textFaint:     '#6a5030',
      textDimmer:    '#503c22',
      textDimmest:   '#382814',
    },
  },

  // ── Motorsport Dashboard ─────────────────────────────────────────────────────

  {
    id: 'motorsport-bmw-i-blue',
    name: 'Comfort Mode',
    shortName: 'BMW i Blue',
    tagline: 'BMW i Blue · Deep Navy',
    description: 'Efficient EV performance — BMW i Blue on deep navy slate.',
    category: 'motorsport',
    subCategory: 'Motorsport Dashboard',
    tokens: {
      accent:        '#1e88e5',
      accentHover:   '#42a5f5',
      accentText:    '#060b14',
      bgVoid:        '#060b14',
      bgBase:        '#0a1220',
      bgSurface:     '#0e1828',
      bgElevated:    '#132030',
      bgSubtle:      '#1a2c40',
      bgHeader:      '#071020',
      bgSubHeader:   '#0f1e32',
      borderFaint:   '#0e1c2c',
      borderDefault: '#182840',
      borderStrong:  '#223454',
      textPrimary:   '#d4e8f8',
      textSecondary: '#b0cce4',
      textMuted:     '#3a70a8',
      textFaint:     '#284e7a',
      textDimmer:    '#1c3858',
      textDimmest:   '#142840',
    },
  },

  {
    id: 'motorsport-m-crimson',
    name: 'Sport M Mode',
    shortName: 'M Crimson',
    tagline: 'M Power Crimson · Track Black',
    description: 'Maximum aggression, pure track performance — M Crimson on deep black.',
    category: 'motorsport',
    subCategory: 'Motorsport Dashboard',
    tokens: {
      accent:        '#e53935',
      accentHover:   '#f05853',
      accentText:    '#100808',
      bgVoid:        '#100808',
      bgBase:        '#180b0b',
      bgSurface:     '#200e0e',
      bgElevated:    '#2a1010',
      bgSubtle:      '#381818',
      bgHeader:      '#150808',
      bgSubHeader:   '#220c0c',
      borderFaint:   '#1e0e0e',
      borderDefault: '#2e1414',
      borderStrong:  '#3c1c1c',
      textPrimary:   '#f0d8d8',
      textSecondary: '#e0c0c0',
      textMuted:     '#a04040',
      textFaint:     '#6a2828',
      textDimmer:    '#4e1c1c',
      textDimmest:   '#380f0f',
    },
  },

  {
    id: 'motorsport-eco-teal',
    name: 'Eco Pro Mode',
    shortName: 'Eco Green',
    tagline: 'Teal Eco Green · Dark Forest',
    description: 'Regenerative intelligence — teal eco green on deep forest dark.',
    category: 'motorsport',
    subCategory: 'Motorsport Dashboard',
    tokens: {
      accent:        '#26a69a',
      accentHover:   '#42c4b8',
      accentText:    '#040d0b',
      bgVoid:        '#040d0b',
      bgBase:        '#081410',
      bgSurface:     '#0c1c16',
      bgElevated:    '#10241c',
      bgSubtle:      '#162e24',
      bgHeader:      '#061210',
      bgSubHeader:   '#0e1e18',
      borderFaint:   '#0c1e18',
      borderDefault: '#162c22',
      borderStrong:  '#203c2e',
      textPrimary:   '#d0eae4',
      textSecondary: '#b0d0c8',
      textMuted:     '#3a7a70',
      textFaint:     '#285a52',
      textDimmer:    '#1c4038',
      textDimmest:   '#123028',
    },
  },

  // ── Windows Core Standard ────────────────────────────────────────────────────

  {
    id: 'windows-light',
    name: 'Windows Light',
    shortName: 'Win Light',
    tagline: 'Fluent Blue · Mica White',
    description: 'Windows 11 Fluent Design — accent blue on luminous Mica white.',
    category: 'windows-standard',
    tokens: {
      accent:        '#0078D4',
      accentHover:   '#106EBE',
      accentText:    '#ffffff',
      bgVoid:        '#f3f3f3',
      bgBase:        '#ffffff',
      bgSurface:     '#f9f9f9',
      bgElevated:    '#f0f0f0',
      bgSubtle:      '#e8e8e8',
      bgHeader:      '#e8ecf0',
      bgSubHeader:   '#dde3ea',
      borderFaint:   '#e0e0e0',
      borderDefault: '#c8c8c8',
      borderStrong:  '#ababab',
      textPrimary:   '#1e1e1e',
      textSecondary: '#3c3c3c',
      textMuted:     '#616161',
      textFaint:     '#767676',
      textDimmer:    '#8a8a8a',
      textDimmest:   '#a0a0a0',
    },
  },

  {
    id: 'windows-dark',
    name: 'Windows Dark',
    shortName: 'Win Dark',
    tagline: 'Fluent Sky Blue · Mica Dark',
    description: 'Windows 11 dark Mica — sky-blue on layered dark acrylic.',
    category: 'windows-standard',
    tokens: {
      accent:        '#60CDFF',
      accentHover:   '#82D8FF',
      accentText:    '#003652',
      bgVoid:        '#1c1c1c',
      bgBase:        '#202020',
      bgSurface:     '#272727',
      bgElevated:    '#2d2d2d',
      bgSubtle:      '#3a3a3a',
      bgHeader:      '#1a1a1a',
      bgSubHeader:   '#242424',
      borderFaint:   '#282828',
      borderDefault: '#383838',
      borderStrong:  '#484848',
      textPrimary:   '#ffffff',
      textSecondary: '#d0d0d0',
      textMuted:     '#9d9d9d',
      textFaint:     '#707070',
      textDimmer:    '#555555',
      textDimmest:   '#404040',
    },
  },

  {
    id: 'windows-glow',
    name: 'Glow',
    shortName: 'Glow',
    tagline: 'Luminous Violet · Cosmic Dark',
    description: 'Windows Glow theme — radiant violet on deep cosmic darkness.',
    category: 'windows-standard',
    tokens: {
      accent:        '#B39DDB',
      accentHover:   '#CE93D8',
      accentText:    '#12001e',
      bgVoid:        '#12001e',
      bgBase:        '#190530',
      bgSurface:     '#200840',
      bgElevated:    '#2a1050',
      bgSubtle:      '#361860',
      bgHeader:      '#160330',
      bgSubHeader:   '#220840',
      borderFaint:   '#221040',
      borderDefault: '#301850',
      borderStrong:  '#402060',
      textPrimary:   '#ede7f6',
      textSecondary: '#d1c4e9',
      textMuted:     '#9575cd',
      textFaint:     '#673ab7',
      textDimmer:    '#4a2880',
      textDimmest:   '#311860',
    },
  },

  {
    id: 'windows-captured-motion',
    name: 'Captured Motion',
    shortName: 'C. Motion',
    tagline: 'Kinetic Teal · Dusk Slate',
    description: 'Windows Captured Motion — kinetic teal on twilight dusk slate.',
    category: 'windows-standard',
    tokens: {
      accent:        '#00B7C3',
      accentHover:   '#00D4E0',
      accentText:    '#001820',
      bgVoid:        '#0a1520',
      bgBase:        '#0f1e2a',
      bgSurface:     '#152535',
      bgElevated:    '#1c2e40',
      bgSubtle:      '#253848',
      bgHeader:      '#0c1c2c',
      bgSubHeader:   '#162535',
      borderFaint:   '#152030',
      borderDefault: '#1e2e40',
      borderStrong:  '#283c50',
      textPrimary:   '#cce8ef',
      textSecondary: '#a8ccd8',
      textMuted:     '#3a8a96',
      textFaint:     '#286878',
      textDimmer:    '#1c4858',
      textDimmest:   '#123040',
    },
  },

  {
    id: 'windows-sunrise',
    name: 'Sunrise',
    shortName: 'Sunrise',
    tagline: 'Solar Amber · Dusk Plum',
    description: 'Windows Sunrise — warm solar amber on deep twilight plum.',
    category: 'windows-standard',
    tokens: {
      accent:        '#FF8C00',
      accentHover:   '#FFA827',
      accentText:    '#1a0800',
      bgVoid:        '#150a18',
      bgBase:        '#1e0f22',
      bgSurface:     '#28152e',
      bgElevated:    '#341c3a',
      bgSubtle:      '#422448',
      bgHeader:      '#1c0c20',
      bgSubHeader:   '#2a1530',
      borderFaint:   '#261630',
      borderDefault: '#362040',
      borderStrong:  '#482c52',
      textPrimary:   '#f5e8d5',
      textSecondary: '#e8cfb0',
      textMuted:     '#b07040',
      textFaint:     '#7a4a20',
      textDimmer:    '#583214',
      textDimmest:   '#3a1e0a',
    },
  },

  {
    id: 'windows-flow',
    name: 'Flow',
    shortName: 'Flow',
    tagline: 'Iris Purple · Indigo Mist',
    description: 'Windows Flow — soft iris on flowing indigo mist.',
    category: 'windows-standard',
    tokens: {
      accent:        '#8764B8',
      accentHover:   '#A080D0',
      accentText:    '#0e0820',
      bgVoid:        '#0e0820',
      bgBase:        '#160e2c',
      bgSurface:     '#1e1438',
      bgElevated:    '#261a44',
      bgSubtle:      '#322254',
      bgHeader:      '#140a28',
      bgSubHeader:   '#1e1038',
      borderFaint:   '#201440',
      borderDefault: '#2e1e52',
      borderStrong:  '#3c2864',
      textPrimary:   '#e8e0f4',
      textSecondary: '#d0c4e8',
      textMuted:     '#7858b0',
      textFaint:     '#503c80',
      textDimmer:    '#3a2860',
      textDimmest:   '#281848',
    },
  },

  // ── Windows High-Contrast Accessibility ─────────────────────────────────────

  {
    id: 'hc-aquatic',
    name: 'Aquatic',
    shortName: 'Aquatic',
    tagline: 'Cyan · Pure Black',
    description: 'High-contrast accessibility — vivid cyan on absolute black.',
    category: 'windows-hc',
    tokens: {
      accent:        '#00FFFF',
      accentHover:   '#80FFFF',
      accentText:    '#000000',
      bgVoid:        '#000000',
      bgBase:        '#000000',
      bgSurface:     '#0a0a0a',
      bgElevated:    '#141414',
      bgSubtle:      '#1e1e1e',
      bgHeader:      '#000000',
      bgSubHeader:   '#0a0a0a',
      borderFaint:   '#00FFFF',
      borderDefault: '#00FFFF',
      borderStrong:  '#ffffff',
      textPrimary:   '#ffffff',
      textSecondary: '#00FFFF',
      textMuted:     '#00CCCC',
      textFaint:     '#009999',
      textDimmer:    '#006666',
      textDimmest:   '#003333',
    },
  },

  {
    id: 'hc-desert',
    name: 'Desert',
    shortName: 'Desert',
    tagline: 'Solar Gold · Sand Dark',
    description: 'High-contrast accessibility — solar gold on scorched sand dark.',
    category: 'windows-hc',
    tokens: {
      accent:        '#FFD700',
      accentHover:   '#FFE44D',
      accentText:    '#000000',
      bgVoid:        '#1c1200',
      bgBase:        '#241800',
      bgSurface:     '#2e2000',
      bgElevated:    '#3a2800',
      bgSubtle:      '#483200',
      bgHeader:      '#201600',
      bgSubHeader:   '#2c1e00',
      borderFaint:   '#FFD700',
      borderDefault: '#FFD700',
      borderStrong:  '#ffffff',
      textPrimary:   '#ffffff',
      textSecondary: '#FFD700',
      textMuted:     '#ccaa00',
      textFaint:     '#997f00',
      textDimmer:    '#665400',
      textDimmest:   '#332a00',
    },
  },

  {
    id: 'hc-dusk',
    name: 'Dusk',
    shortName: 'Dusk',
    tagline: 'Fuchsia · Twilight Black',
    description: 'High-contrast accessibility — electric fuchsia on twilight black.',
    category: 'windows-hc',
    tokens: {
      accent:        '#E040FB',
      accentHover:   '#EA80FC',
      accentText:    '#000000',
      bgVoid:        '#100020',
      bgBase:        '#180030',
      bgSurface:     '#200038',
      bgElevated:    '#2a0048',
      bgSubtle:      '#380058',
      bgHeader:      '#140028',
      bgSubHeader:   '#1e0038',
      borderFaint:   '#E040FB',
      borderDefault: '#E040FB',
      borderStrong:  '#ffffff',
      textPrimary:   '#ffffff',
      textSecondary: '#E040FB',
      textMuted:     '#b030c8',
      textFaint:     '#802090',
      textDimmer:    '#501060',
      textDimmest:   '#280030',
    },
  },

  {
    id: 'hc-night-sky',
    name: 'Night Sky',
    shortName: 'Night Sky',
    tagline: 'Stellar Blue · Void Night',
    description: 'High-contrast accessibility — stellar blue on absolute void night.',
    category: 'windows-hc',
    tokens: {
      accent:        '#00B4FF',
      accentHover:   '#4DCCFF',
      accentText:    '#000000',
      bgVoid:        '#000814',
      bgBase:        '#000c1e',
      bgSurface:     '#001028',
      bgElevated:    '#001530',
      bgSubtle:      '#001c3e',
      bgHeader:      '#000a18',
      bgSubHeader:   '#000f22',
      borderFaint:   '#00B4FF',
      borderDefault: '#00B4FF',
      borderStrong:  '#ffffff',
      textPrimary:   '#ffffff',
      textSecondary: '#00B4FF',
      textMuted:     '#0088cc',
      textFaint:     '#005c99',
      textDimmer:    '#003366',
      textDimmest:   '#001133',
    },
  },

  // ── Cairo Shell — Unix Workstation Simulation ────────────────────────────────

  {
    id: 'unix-gnome',
    name: 'GNOME Shell',
    shortName: 'GNOME',
    tagline: 'Adwaita Orange · GNOME Dark',
    description: 'Cairo Shell GNOME simulation — Adwaita orange on GNOME dark desktop.',
    category: 'unix',
    layoutMode: 'gnome',
    tokens: {
      accent:        '#FF7800',
      accentHover:   '#FF9B2D',
      accentText:    '#1a0900',
      bgVoid:        '#1e1e1e',
      bgBase:        '#242424',
      bgSurface:     '#303030',
      bgElevated:    '#383838',
      bgSubtle:      '#424242',
      bgHeader:      '#1c1c1c',
      bgSubHeader:   '#2a2a2a',
      borderFaint:   '#2e2e2e',
      borderDefault: '#3c3c3c',
      borderStrong:  '#4a4a4a',
      textPrimary:   '#ffffff',
      textSecondary: '#d4d4d4',
      textMuted:     '#a0a0a0',
      textFaint:     '#787878',
      textDimmer:    '#585858',
      textDimmest:   '#404040',
    },
  },

  {
    id: 'unix-kde',
    name: 'KDE Plasma',
    shortName: 'KDE',
    tagline: 'Breeze Blue · Plasma Dark',
    description: 'Cairo Shell KDE simulation — Breeze blue on Plasma dark desktop.',
    category: 'unix',
    layoutMode: 'kde',
    tokens: {
      accent:        '#3DAEE9',
      accentHover:   '#62C0EF',
      accentText:    '#001830',
      bgVoid:        '#1b1e20',
      bgBase:        '#232629',
      bgSurface:     '#2a2e32',
      bgElevated:    '#31363b',
      bgSubtle:      '#3c4045',
      bgHeader:      '#1d2023',
      bgSubHeader:   '#272b2f',
      borderFaint:   '#2d3136',
      borderDefault: '#3b4045',
      borderStrong:  '#4a5058',
      textPrimary:   '#eff0f1',
      textSecondary: '#bdc3c7',
      textMuted:     '#7f8c8d',
      textFaint:     '#5a6066',
      textDimmer:    '#424849',
      textDimmest:   '#303435',
    },
  },
];

export const DEFAULT_THEME_ID: ThemeId = 'prive-group';

export function getTheme(id: ThemeId): Theme {
  return THEMES.find(t => t.id === id) ?? THEMES[0];
}

export const CORPORATE_THEMES        = THEMES.filter(t => t.category === 'corporate');
export const MOTORSPORT_THEMES       = THEMES.filter(t => t.category === 'motorsport');
export const WINDOWS_STANDARD_THEMES = THEMES.filter(t => t.category === 'windows-standard');
export const WINDOWS_HC_THEMES       = THEMES.filter(t => t.category === 'windows-hc');
export const UNIX_THEMES             = THEMES.filter(t => t.category === 'unix');
