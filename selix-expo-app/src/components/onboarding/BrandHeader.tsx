import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BrandWordmark } from '../BrandWordmark';
import { TopRightDotsIcon } from './TopRightDotsIcon';
import { onboardingTheme } from './theme';

type BrandHeaderProps = {
  title?: string;
  subtitle?: string;
  titleColor?: string;
  compact?: boolean;
};

export function BrandHeader({
  title,
  subtitle,
  titleColor = onboardingTheme.textPrimary,
  compact = false,
}: BrandHeaderProps) {
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      {/* Logo row */}
      <View style={styles.row}>
        <BrandWordmark
          size="lg"
          variant="white"
          iconStyle={[styles.brandIcon, compact && styles.brandIconCompact]}
        />
        <TopRightDotsIcon />
      </View>

      {/* Optional title / subtitle block */}
      {(title || subtitle) ? (
        <View style={[styles.textBlock, compact && styles.textBlockCompact]}>
          {title ? (
            <Text style={[styles.title, compact && styles.titleCompact, { color: titleColor }]}>{title}</Text>
          ) : null}
          {subtitle ? (
            <Text style={[styles.subtitle, compact && styles.subtitleCompact]}>{subtitle}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  wrapCompact: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandIcon: {
    width: 262,
    height: 78,
  },
  brandIconCompact: {
    width: 228,
    height: 68,
  },
  textBlock: {
    gap: 6,
  },
  textBlockCompact: {
    gap: 4,
  },
  title: {
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '400',
    letterSpacing: -0.3,
  },
  titleCompact: {
    fontSize: 24,
    lineHeight: 29,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: onboardingTheme.textSecondary,
    letterSpacing: 0.1,
  },
  subtitleCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
});
