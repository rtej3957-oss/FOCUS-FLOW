import { AccentPreset, TaskPriority } from '../types';

export const PRIORITY_CONFIG: Record<
  TaskPriority,
  {
    label: string;
    dotColor: string;
    textColor: string;
    badgeBg: string;
    rank: number;
  }
> = {
  urgent: {
    label: 'Urgent',
    dotColor: '#DC2626',
    textColor: 'text-red-600 dark:text-red-400',
    badgeBg: 'bg-red-500/10',
    rank: 4,
  },
  high: {
    label: 'High',
    dotColor: '#EA580C',
    textColor: 'text-orange-600 dark:text-orange-400',
    badgeBg: 'bg-orange-500/10',
    rank: 3,
  },
  medium: {
    label: 'Medium',
    dotColor: '#CA8A04',
    textColor: 'text-amber-600 dark:text-amber-400',
    badgeBg: 'bg-amber-500/10',
    rank: 2,
  },
  low: {
    label: 'Low',
    dotColor: '#16A34A',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    badgeBg: 'bg-emerald-500/10',
    rank: 1,
  },
};

export const ACCENT_PRESETS: Record<
  AccentPreset,
  {
    label: string;
    hex: string;
    hoverHex: string;
    softLight: string;
    softDark: string;
  }
> = {
  indigo: {
    label: 'Indigo',
    hex: '#5E6AD2',
    hoverHex: '#4E5AC2',
    softLight: 'rgba(94, 106, 210, 0.11)',
    softDark: 'rgba(124, 134, 245, 0.16)',
  },
  violet: {
    label: 'Violet',
    hex: '#7C3AED',
    hoverHex: '#6D28D9',
    softLight: 'rgba(124, 58, 237, 0.11)',
    softDark: 'rgba(167, 139, 250, 0.16)',
  },
  cobalt: {
    label: 'Cobalt',
    hex: '#2563EB',
    hoverHex: '#1D4ED8',
    softLight: 'rgba(37, 99, 235, 0.11)',
    softDark: 'rgba(96, 165, 250, 0.16)',
  },
  emerald: {
    label: 'Emerald',
    hex: '#0D9488',
    hoverHex: '#0F766E',
    softLight: 'rgba(13, 148, 136, 0.11)',
    softDark: 'rgba(45, 212, 191, 0.16)',
  },
  rose: {
    label: 'Rose',
    hex: '#E11D48',
    hoverHex: '#BE123C',
    softLight: 'rgba(225, 29, 72, 0.11)',
    softDark: 'rgba(251, 113, 133, 0.16)',
  },
};

export const CATEGORY_ICON_OPTIONS = [
  'User',
  'GraduationCap',
  'Briefcase',
  'Dumbbell',
  'Wallet',
  'Laptop',
  'BookOpen',
  'Code2',
  'Heart',
  'Compass',
  'Sparkles',
  'Layers',
] as const;

export const COLOR_PALETTE = [
  '#5E6AD2',
  '#7C3AED',
  '#2563EB',
  '#0D9488',
  '#16A34A',
  '#D97706',
  '#EA580C',
  '#E11D48',
  '#64748B',
];
