export const colors = {
  // Brand
  brand: {
    50:  '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
  },

  // Semantic
  success: '#10b981',
  warning: '#f59e0b',
  error:   '#ef4444',
  info:    '#3b82f6',

  // Neutral
  white:    '#ffffff',
  black:    '#000000',
  slate: {
    50:  '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },
} as const;

export const radii = {
  sm:   8,
  md:   12,
  lg:   14,
  xl:   18,
  full: 9999,
} as const;

export const spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  xxl: 32,
} as const;

export const fontSizes = {
  xs:  11,
  sm:  13,
  md:  15,
  lg:  17,
  xl:  20,
  xxl: 24,
  '3xl': 28,
} as const;
