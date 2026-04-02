import React from 'react';
import { StyleSheet, View } from 'react-native';
import { onboardingTheme } from './theme';

type OnboardingPaginationProps = {
  total: number;
  activeIndex: number;
};

export function OnboardingPagination({
  total,
  activeIndex,
}: OnboardingPaginationProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, index) => {
        const active = index === activeIndex;
        return (
          <View
            key={index}
            style={[
              styles.dot,
              active ? styles.activeDot : styles.inactiveDot,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dot: {
    borderRadius: 999,
  },
  activeDot: {
    width: 34,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  inactiveDot: {
    width: 12,
    height: 12,
    backgroundColor: onboardingTheme.accentViolet,
    opacity: 0.76,
  },
});
