import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { Colors } from '../constants/colors';

type BrandWordmarkProps = {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  style?: StyleProp<ViewStyle>;
  iconStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

const SIZE_MAP = {
  sm: { icon: 24, fontSize: 27, gap: 8 },
  md: { icon: 28, fontSize: 31, gap: 9 },
  lg: { icon: 32, fontSize: 37, gap: 10 },
  xl: { icon: 64, fontSize: 68, gap: 15 },
} as const;

type BrandIconProps = {
  size: number;
  color: string;
  style?: StyleProp<ViewStyle>;
};

function BrandIcon({ size, color, style }: BrandIconProps) {
  const lobe = size * 0.48;
  const stroke = Math.max(4, Math.round(size * 0.12));
  const side = size * 0.42;
  const square = Math.max(4, Math.round(size * 0.13));
  const gap = Math.max(2, Math.round(size * 0.045));

  return (
    <View style={[styles.iconRoot, { width: size, height: size }, style]}>
      <View
        style={[
          styles.lobe,
          {
            width: lobe,
            height: lobe,
            borderRadius: lobe / 2,
            backgroundColor: color,
            left: size * 0.06,
            top: size * 0.02,
          },
        ]}
      />
      <View
        style={[
          styles.lobe,
          {
            width: lobe,
            height: lobe,
            borderRadius: lobe / 2,
            backgroundColor: color,
            right: size * 0.06,
            top: size * 0.02,
          },
        ]}
      />

      <View
        style={[
          styles.diagonal,
          {
            width: side,
            height: stroke,
            borderRadius: stroke / 2,
            backgroundColor: color,
            left: size * 0.14,
            top: size * 0.56,
            transform: [{ rotate: '45deg' }],
          },
        ]}
      />
      <View
        style={[
          styles.diagonal,
          {
            width: side,
            height: stroke,
            borderRadius: stroke / 2,
            backgroundColor: color,
            right: size * 0.14,
            top: size * 0.56,
            transform: [{ rotate: '-45deg' }],
          },
        ]}
      />

      <View
        style={[
          styles.diagonal,
          {
            width: side * 0.7,
            height: stroke,
            borderRadius: stroke / 2,
            backgroundColor: color,
            left: size * 0.22,
            top: size * 0.34,
            transform: [{ rotate: '-45deg' }],
          },
        ]}
      />
      <View
        style={[
          styles.diagonal,
          {
            width: side * 0.7,
            height: stroke,
            borderRadius: stroke / 2,
            backgroundColor: color,
            right: size * 0.22,
            top: size * 0.34,
            transform: [{ rotate: '45deg' }],
          },
        ]}
      />

      <View style={[styles.windowsWrap, { top: size * 0.38 }]}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.window,
              {
                width: square,
                height: square,
                borderRadius: Math.max(1, square * 0.15),
                backgroundColor: color,
                marginRight: i % 2 === 0 ? gap : 0,
                marginBottom: i < 2 ? gap : 0,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

export function BrandWordmark({
  size = 'md',
  color = Colors.white,
  style,
  iconStyle,
  textStyle,
}: BrandWordmarkProps) {
  const config = SIZE_MAP[size];

  return (
    <View style={[styles.row, { columnGap: config.gap }, style]}>
      <BrandIcon size={config.icon} color={color} style={iconStyle} />
      <Text
        style={[
          styles.text,
          {
            color,
            fontSize: config.fontSize,
            lineHeight: Math.round(config.fontSize * 1.02),
          },
          textStyle,
        ]}
      >
        Selix
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '700',
    letterSpacing: -1.2,
  },
  iconRoot: {
    position: 'relative',
  },
  lobe: {
    position: 'absolute',
  },
  diagonal: {
    position: 'absolute',
  },
  windowsWrap: {
    position: 'absolute',
    left: '50%',
    width: '28%',
    marginLeft: '-14%',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  window: {},
});
