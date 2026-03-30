import React from 'react';
import { Image, ImageStyle, StyleProp, StyleSheet, View } from 'react-native';

type BrandWordmarkProps = {
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ImageStyle>;
};

const SIZE_MAP = {
  sm: { width: 108, height: 30 },
  md: { width: 132, height: 38 },
  lg: { width: 156, height: 44 },
} as const;

export function BrandWordmark({ size = 'md', style }: BrandWordmarkProps) {
  return (
    <View>
      <Image
        source={require('../../assets/selix-logo-horizontal.png')}
        style={[styles.wordmark, SIZE_MAP[size], style]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wordmark: {
    maxWidth: '100%',
  },
});
