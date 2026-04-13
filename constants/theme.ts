export const COLORS = {
  // Light Theme
  light: {
    primary: '#6366F1',
    primaryDark: '#4F46E5',
    secondary: '#EC4899',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceSecondary: '#F1F5F9',
    text: '#0F172A',
    textSecondary: '#64748B',
    textTertiary: '#94A3B8',
    border: '#E2E8F0',
    error: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    info: '#3B82F6',
    // Note colors
    noteRed: '#FEE2E2',
    noteOrange: '#FFEDD5',
    noteYellow: '#FEF3C7',
    noteGreen: '#D1FAE5',
    noteBlue: '#DBEAFE',
    notePurple: '#EDE9FE',
    notePink: '#FCE7F3',
    noteGray: '#F1F5F9',
    // Priority colors
    priorityHigh: '#EF4444',
    priorityMedium: '#F59E0B',
    priorityLow: '#10B981',
  },
  // Dark Theme
  dark: {
    primary: '#818CF8',
    primaryDark: '#6366F1',
    secondary: '#F472B6',
    background: '#0F172A',
    surface: '#1E293B',
    surfaceSecondary: '#334155',
    text: '#F1F5F9',
    textSecondary: '#CBD5E1',
    textTertiary: '#94A3B8',
    border: '#334155',
    error: '#F87171',
    success: '#34D399',
    warning: '#FBBF24',
    info: '#60A5FA',
    // Note colors (darker versions)
    noteRed: '#7F1D1D',
    noteOrange: '#7C2D12',
    noteYellow: '#713F12',
    noteGreen: '#064E3B',
    noteBlue: '#1E3A8A',
    notePurple: '#4C1D95',
    notePink: '#831843',
    noteGray: '#334155',
    // Priority colors
    priorityHigh: '#F87171',
    priorityMedium: '#FBBF24',
    priorityLow: '#34D399',
  },
};

export const NOTE_COLORS = [
  { id: 'default', label: 'Default' },
  { id: 'red', label: 'Red' },
  { id: 'orange', label: 'Orange' },
  { id: 'yellow', label: 'Yellow' },
  { id: 'green', label: 'Green' },
  { id: 'blue', label: 'Blue' },
  { id: 'purple', label: 'Purple' },
  { id: 'pink', label: 'Pink' },
  { id: 'gray', label: 'Gray' },
];

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const TYPOGRAPHY = {
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  lineHeights: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.6,
  },
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
};

export const PRIORITIES = [
  { id: 'high', label: 'High', color: '#EF4444' },
  { id: 'medium', label: 'Medium', color: '#F59E0B' },
  { id: 'low', label: 'Low', color: '#10B981' },
];

export const CATEGORIES = [
  { id: 'work', label: 'Work', icon: 'work' },
  { id: 'personal', label: 'Personal', icon: 'person' },
  { id: 'shopping', label: 'Shopping', icon: 'shopping-cart' },
  { id: 'health', label: 'Health', icon: 'favorite' },
  { id: 'finance', label: 'Finance', icon: 'attach-money' },
  { id: 'other', label: 'Other', icon: 'more-horiz' },
];

export const REMINDER_REPEAT_OPTIONS = [
  { id: 'none', label: 'Never' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
];
