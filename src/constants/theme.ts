/**
 * Blinkr design tokens.
 *
 * Look: editorial. Ivory paper, fine rules, a serif masthead and headings (Newsreader)
 * with a clean sans for reading (Manrope), one deep green accent, and a slim colored
 * edge on every Blink so each author is recognisable at a glance.
 * Learn more about color schemes: https://docs.expo.dev/guides/color-schemes/
 */

export const Colors = {
  light: {
    text: '#15171A',
    textSecondary: '#5F646B',
    background: '#F6F3EC',
    surface: '#FFFFFF',
    border: '#E3DED3',
    tint: '#17594A',
    tintSoft: '#E3EEE9',
    onTint: '#FFFFFF',
    like: '#B4233C',
    danger: '#B42318',
    skeleton: '#ECE7DC',
    /** "Active now" dot. */
    online: '#1E9E57',
  },
  dark: {
    text: '#ECE8E0',
    textSecondary: '#A1A5AB',
    background: '#111314',
    surface: '#1A1D1F',
    border: '#2C3033',
    tint: '#6DBFA6',
    tintSoft: '#1D2D28',
    onTint: '#0E1512',
    like: '#F07A8C',
    danger: '#F2877B',
    skeleton: '#23272A',
    online: '#4ADE80',
  },
} as const;

export type ThemeColors = { [K in keyof typeof Colors.light]: string };
export type ThemeColor = keyof ThemeColors;

// --- Personal accent: your avatar color becomes the app’s accent -------------------------

type Rgb = [number, number, number];

function toRgb(hex: string): Rgb | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const n = parseInt(match[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** `amount` of `a`, the rest `b`. */
function mix(a: Rgb, b: Rgb, amount: number): Rgb {
  return [0, 1, 2].map((i) => a[i] * amount + b[i] * (1 - amount)) as Rgb;
}

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const WHITE: Rgb = [255, 255, 255];

/**
 * The palette with `accent` as the accent color. Backgrounds, text and borders stay as they
 * are for light and dark mode; only tint, tintSoft and onTint change. The accent is darkened
 * (light mode) or lightened (dark mode) as far as needed to stay readable.
 */
function accentTheme(scheme: 'light' | 'dark', accent: string): ThemeColors {
  const base = Colors[scheme];
  const color = toRgb(accent);
  if (!color) return base;
  const background = toRgb(base.background)!;

  let tint = color;
  if (scheme === 'light') {
    // White text sits on the accent (buttons, sent messages), so it needs AA contrast.
    const black: Rgb = [0, 0, 0];
    for (let step = 1; contrast(tint, WHITE) < 4.5 && step <= 10; step++) tint = mix(color, black, 1 - step * 0.06);
  } else {
    // In the dark the accent is used as text and icons on the dark background.
    for (let step = 1; contrast(tint, background) < 6.5 && step <= 12; step++) tint = mix(color, WHITE, 1 - step * 0.06);
  }

  return {
    ...base,
    tint: toHex(tint),
    tintSoft: toHex(scheme === 'light' ? mix(tint, WHITE, 0.12) : mix(tint, background, 0.14)),
    onTint: scheme === 'light' ? '#FFFFFF' : base.onTint,
  };
}

const themeCache = new Map<string, ThemeColors>();

/** The colors for this mode, with your avatar color as the accent (the default green when there’s none). */
export function getTheme(scheme: 'light' | 'dark', accent?: string | null): ThemeColors {
  if (!accent) return Colors[scheme];
  const key = `${scheme}|${accent}`;
  let theme = themeCache.get(key);
  if (!theme) {
    theme = accentTheme(scheme, accent);
    themeCache.set(key, theme);
  }
  return theme;
}

/**
 * Author accent colors, used for the slim edge on each Blink card and unread markers.
 * Muted, print-like hues; dark mode uses lighter versions for contrast.
 */
export const CardTones = {
  light: ['#A15C1B', '#1F6F66', '#9A2F4A', '#2F5597', '#5E4A9A', '#7A6A1F'],
  dark: ['#E0A36B', '#6CC2B6', '#E68AA0', '#86A9E8', '#B3A2EA', '#D2C06E'],
} as const;

/**
 * Newsreader (serif) for the masthead and headings, Manrope (sans) for everything else.
 * Loaded in the root layout. Custom fonts need one family per weight.
 */
export const Fonts = {
  serif: 'Newsreader_600SemiBold',
  serifBold: 'Newsreader_700Bold',
  serifItalic: 'Newsreader_400Regular_Italic',
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  heavy: 'Manrope_800ExtraBold',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

/** Content never grows wider than this, so large phones and tablets stay readable. */
export const MaxContentWidth = 640;

export const MaxBlinkLength = 280;
