import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const onboardingTheme = {
  shellBackground: '#232120',
  pageBackground: '#1A0A35',
  panelGradient: ['#1A0434', '#25074A', '#230642', '#1A0434'] as const,
  panelBorder: 'rgba(255,255,255,0.06)',
  glassStroke: 'rgba(255,255,255,0.16)',
  textPrimary: '#FFF9FF',
  textSecondary: 'rgba(225, 210, 255, 0.74)',
  textMuted: 'rgba(198, 182, 232, 0.56)',
  accentPink: '#F46DEB',
  accentPurple: '#7D36F4',
  accentViolet: '#5A22C0',
  accentBlue: '#42B1FF',
  accentGreen: '#32D97C',
  accentRed: '#FF6D68',
  accentOrange: '#FFBF59',
  accentRose: '#FF9A7C',
  imageOverlay: ['transparent', 'rgba(29, 9, 60, 0.28)', 'rgba(21, 6, 42, 0.88)'] as const,
  panelRadius: 32,
  contentHorizontal: 26,
  screenWidth: SCREEN_WIDTH,
  screenHeight: SCREEN_HEIGHT,
  panelWidth: Math.min(SCREEN_WIDTH - 36, 590),
  panelHeight: Math.min(SCREEN_HEIGHT - 64, 820),
} as const;

export type OnboardingTheme = typeof onboardingTheme;
