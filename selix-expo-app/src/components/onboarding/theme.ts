import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const onboardingTheme = {
  // Outer shell: near-black with very subtle warm tint (matches reference screenshots)
  shellBackground: '#141218',
  // Card background: deep violet-indigo
  pageBackground: '#160A30',
  panelGradient: ['#160A30', '#1E0840', '#1A0638', '#140830'] as const,
  panelBorder: 'rgba(180,130,255,0.10)',
  glassStroke: 'rgba(255,255,255,0.18)',

  textPrimary: '#FFF9FF',
  textSecondary: 'rgba(220, 200, 255, 0.72)',
  textMuted: 'rgba(190, 170, 225, 0.52)',

  accentPink: '#F46DEB',
  accentPurple: '#8A3EFF',
  accentViolet: '#5A22C0',
  accentBlue: '#42B1FF',
  accentGreen: '#2FD17A',
  accentRed: '#FF6B68',
  accentOrange: '#FFB84D',
  accentRose: '#FF9A7C',

  imageOverlay: ['transparent', 'rgba(22, 8, 50, 0.30)', 'rgba(16, 5, 38, 0.90)'] as const,

  panelRadius: 34,
  contentHorizontal: 26,
  screenWidth: SCREEN_WIDTH,
  screenHeight: SCREEN_HEIGHT,
  panelWidth: Math.min(SCREEN_WIDTH - 32, 590),
  panelHeight: Math.min(SCREEN_HEIGHT - 56, 820),
} as const;

export type OnboardingTheme = typeof onboardingTheme;
