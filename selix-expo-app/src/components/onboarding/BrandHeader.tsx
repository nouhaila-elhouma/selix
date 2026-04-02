import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BrandWordmark } from '../BrandWordmark';
import { TopRightDotsIcon } from './TopRightDotsIcon';
import { onboardingTheme } from './theme';

type BrandHeaderProps = {
  title?: string;
  subtitle?: string;
  titleColor?: string;
};

export function BrandHeader({
  title,
  subtitle,
  titleColor = onboardingTheme.textPrimary,
}: BrandHeaderProps) {
  return (
    <View style={styles.wrap}>
      {/* Logo row */}
      <View style={styles.row}>
        <BrandWordmark
          size="lg"
          textStyle={styles.brandText}
          iconStyle={styles.brandIcon}
        />
        <TopRightDotsIcon />
      </View>

      {/* Optional title / subtitle block */}
      {(title || subtitle) ? (
        <View style={styles.textBlock}>
          {title ? (
            <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
          ) : null}
          {subtitle ? (
            <Text style={styles.subtitle}>{subtitle}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandText: {
    fontSize: 33,
    lineHeight: 35,
    letterSpacing: -1.3,
    fontWeight: '700',
  },
  brandIcon: {
    marginTop: -1,
  },
  textBlock: {
    gap: 6,
  },
  title: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '400',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: onboardingTheme.textSecondary,
    letterSpacing: 0.1,
  },
});
