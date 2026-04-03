import React from 'react';
import {
  Image,
  ImageStyle,
  StyleProp,
  StyleSheet,
  View
} from 'react-native';
import { Colors } from '../constants/colors';

type BrandWordmarkProps = {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  variant?: 'auto' | 'white' | 'dark' | 'gradient';
  style?: StyleProp<ImageStyle>;
  iconStyle?: StyleProp<ImageStyle>;
  textStyle?: StyleProp<ImageStyle>;
};

const SIZE_MAP = {
  sm: { width: 96, height: 28 },
  md: { width: 116, height: 34 },
  lg: { width: 142, height: 42 },
  xl: { width: 258, height: 76 },
} as const;

const WORDMARK_DARK = require('../../assets/selix-logo-dark.png');
const WORDMARK_GRADIENT = require('../../assets/selix-logo-gradient.png');
const WORDMARK_WHITE = require('../../assets/selix-logo-white.png');

export function BrandWordmark({
  size = 'md',
  color = Colors.white,
  variant = 'auto',
  style,
  iconStyle,
  textStyle,
}: BrandWordmarkProps) {
  const config = SIZE_MAP[size];
  const source = variant === 'gradient'
    ? WORDMARK_GRADIENT
    : variant === 'white'
      ? WORDMARK_WHITE
      : variant === 'dark'
        ? WORDMARK_DARK
        : color === Colors.white || color === '#FFFFFF' || color === '#fff'
          ? WORDMARK_WHITE
          : WORDMARK_DARK;

  return (
    <View style={styles.row}>
      <Image
        source={source}
        resizeMode="contain"
        style={[
          styles.image,
          { width: config.width, height: config.height },
          iconStyle,
          textStyle,
          style,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  image: {},
});
