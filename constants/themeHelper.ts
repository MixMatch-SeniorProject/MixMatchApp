import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';

export type RGB = {
  r: number;
  g: number;
  b: number;
};

export type ProfileTheme = {
  rawColor: string;
  backgroundColor: string;
  accentColor: string;
  textColor: string;
  overlayColor: string;
};

const FALLBACK_COLOR = '#8d78b7';

export const useTheme = () => {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? Colors.dark : Colors.light;

  return {
    isDark: scheme === 'dark',
    colors: theme,
  };
};

export const parseHex = (hex: string): RGB => {
  if (!hex) return { r: 141, g: 120, b: 183 };

  const cleanHex = hex.replace('#', '').trim();

  if (cleanHex.length !== 6) {
    return { r: 141, g: 120, b: 183 };
  }

  return {
    r: parseInt(cleanHex.slice(0, 2), 16),
    g: parseInt(cleanHex.slice(2, 4), 16),
    b: parseInt(cleanHex.slice(4, 6), 16),
  };
};

export const mixColors = (
  color: RGB,
  target: RGB,
  weight: number
): RGB => {
  return {
    r: Math.round(color.r * (1 - weight) + target.r * weight),
    g: Math.round(color.g * (1 - weight) + target.g * weight),
    b: Math.round(color.b * (1 - weight) + target.b * weight),
  };
};

export const getContrastTextColor = (rgb: RGB) => {
  const yiq = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return yiq >= 150 ? '#1A1A1A' : '#FFFFFF';
};

export const rgbToString = (rgb: RGB) => {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
};

export const buildProfileTheme = (hex?: string): ProfileTheme => {
  const safeHex = hex || FALLBACK_COLOR;
  const base = parseHex(safeHex);

  // soft background
  const softBackground = mixColors(base, { r: 255, g: 255, b: 255 }, 0.78);

  // button color
  const softAccent = mixColors(base, { r: 255, g: 255, b: 255 }, 0.2);

  // overlay
  const overlay = mixColors(base, { r: 255, g: 255, b: 255 }, 0.55);

  const textColor = getContrastTextColor(softBackground);

  return {
    rawColor: safeHex,
    backgroundColor: rgbToString(softBackground),
    accentColor: rgbToString(softAccent),
    textColor,
    overlayColor: rgbToString(overlay),
  };
};