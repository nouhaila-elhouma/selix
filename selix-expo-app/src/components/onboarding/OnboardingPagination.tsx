import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { onboardingTheme } from './theme';

const ACTIVE_WIDTH = 20;
const DOT_SIZE = 10;

type OnboardingPaginationProps = {
  total: number;
  activeIndex: number;
};

function PaginationDot({ active }: { active: boolean }) {
  const width = useSharedValue(active ? ACTIVE_WIDTH : DOT_SIZE);
  const bgOpacity = useSharedValue(active ? 1 : 0.55);

  useEffect(() => {
    width.value = withTiming(active ? ACTIVE_WIDTH : DOT_SIZE, {
      duration: 340,
      easing: Easing.out(Easing.cubic),
    });
    bgOpacity.value = withTiming(active ? 1 : 0.55, { duration: 280 });
  }, [active]);

  const dotStyle = useAnimatedStyle(() => ({
    width: width.value,
    opacity: bgOpacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        active ? styles.activeDot : styles.inactiveDot,
        dotStyle,
      ]}
    />
  );
}

export function OnboardingPagination({
  total,
  activeIndex,
}: OnboardingPaginationProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, index) => (
        <PaginationDot key={index} active={index === activeIndex} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: DOT_SIZE,
    borderRadius: 999,
  },
  activeDot: {
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  inactiveDot: {
    width: DOT_SIZE,
    backgroundColor: onboardingTheme.accentViolet,
  },
});
