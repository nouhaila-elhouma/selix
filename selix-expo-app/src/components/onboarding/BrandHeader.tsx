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
      <View style={styles.row}>
        <BrandWordmark
          size="lg"
          textStyle={styles.brandText}
          iconStyle={styles.brandIcon}
        />
        <TopRightDotsIcon />
      </View>

      {title ? (
        <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
      ) : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandText: {
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: -1.2,
    fontWeight: '700',
  },
  brandIcon: {
    marginTop: -1,
  },
  title: {
    fontSize: 27,
    lineHeight: 31,
    fontWeight: '400',
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: -10,
    fontSize: 14,
    lineHeight: 20,
    color: onboardingTheme.textSecondary,
  },
});
