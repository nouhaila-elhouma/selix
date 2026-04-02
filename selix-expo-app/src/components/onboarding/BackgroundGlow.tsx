import React from 'react';
import { StyleSheet, View } from 'react-native';
import { onboardingTheme } from './theme';

type GlowTone = 'pink' | 'violet' | 'blue' | 'rose';

type BackgroundGlowProps = {
  tone?: GlowTone;
  size: number;
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
  opacity?: number;
};

const TONES: Record<GlowTone, string> = {
  pink: 'rgba(244, 85, 234, 0.18)',
  violet: 'rgba(125, 54, 244, 0.16)',
  blue: 'rgba(92, 143, 255, 0.12)',
  rose: 'rgba(255, 154, 124, 0.13)',
};

export function BackgroundGlow({
  tone = 'violet',
  size,
  opacity = 1,
  ...position
}: BackgroundGlowProps) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: TONES[tone],
          opacity,
        },
        position,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'absolute',
    shadowColor: onboardingTheme.accentPurple,
    shadowOpacity: 0.12,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 12 },
  },
});
