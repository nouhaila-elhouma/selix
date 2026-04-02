import React from 'react';
import { StyleSheet, View } from 'react-native';

type GlowTone = 'pink' | 'violet' | 'blue' | 'rose' | 'purple';

type BackgroundGlowProps = {
  tone?: GlowTone;
  size: number;
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
  opacity?: number;
};

const TONES: Record<GlowTone, { fill: string; shadow: string }> = {
  pink:   { fill: 'rgba(244, 85, 234, 0.22)',  shadow: '#F455EA' },
  violet: { fill: 'rgba(138, 62, 255, 0.20)',  shadow: '#8A3EFF' },
  purple: { fill: 'rgba(90, 34, 192, 0.24)',   shadow: '#5A22C0' },
  blue:   { fill: 'rgba(66, 177, 255, 0.15)',  shadow: '#42B1FF' },
  rose:   { fill: 'rgba(255, 154, 124, 0.16)', shadow: '#FF9A7C' },
};

export function BackgroundGlow({
  tone = 'violet',
  size,
  opacity = 1,
  ...position
}: BackgroundGlowProps) {
  const { fill, shadow } = TONES[tone];

  return (
    <View
      pointerEvents="none"
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: fill,
          shadowColor: shadow,
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
    shadowOpacity: 0.55,
    shadowRadius: 60,
    shadowOffset: { width: 0, height: 0 },
  },
});
