import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { onboardingTheme } from './theme';

type PropertyShowcaseCardProps = {
  imageUri: string;
  propertyName: string;
  standing: string;
  availability: string;
  mode?: 'stacked' | 'swipe';
  badgeText?: string;
};

export function PropertyShowcaseCard({
  imageUri,
  propertyName,
  standing,
  availability,
  mode = 'stacked',
  badgeText = 'Top Match',
}: PropertyShowcaseCardProps) {
  if (mode === 'swipe') {
    return (
      <View style={styles.swipeStage}>
        <LinearGradient colors={['rgba(255,115,105,0.54)', 'rgba(255,115,105,0.08)']} style={[styles.swipeCue, styles.swipeCueLeft]} />
        <LinearGradient colors={['rgba(50,217,124,0.08)', 'rgba(50,217,124,0.54)']} style={[styles.swipeCue, styles.swipeCueRight]} />

        <View style={[styles.cueArrowWrap, styles.cueArrowLeft]}>
          <Ionicons name="arrow-back" size={62} color="rgba(255,118,94,0.86)" />
        </View>
        <View style={[styles.cueArrowWrap, styles.cueArrowRight]}>
          <Ionicons name="arrow-forward" size={62} color="rgba(50,217,124,0.86)" />
        </View>

        <View style={styles.swipeCard}>
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
          <LinearGradient colors={onboardingTheme.imageOverlay} style={styles.imageOverlay} />
          <View style={styles.info}>
            <Text style={styles.name}>{propertyName}</Text>
            <Text style={styles.standing}>{standing}</Text>
            <Text style={styles.availability}>{availability}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.stackWrap}>
      <LinearGradient colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)']} style={styles.backPlate} />
      <View style={styles.frontCard}>
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
        <LinearGradient colors={onboardingTheme.imageOverlay} style={styles.imageOverlay} />
        <View style={styles.badge}>
          <Ionicons name="sparkles" size={11} color={onboardingTheme.accentPink} />
          <Text style={styles.badgeText}>{badgeText}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{propertyName}</Text>
          <Text style={styles.standing}>{standing}</Text>
          <Text style={styles.availability}>{availability}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stackWrap: {
    position: 'relative',
    height: 378,
    justifyContent: 'flex-end',
  },
  backPlate: {
    position: 'absolute',
    width: '74%',
    height: 286,
    right: -2,
    top: 6,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: onboardingTheme.glassStroke,
    transform: [{ rotate: '-1.6deg' }],
  },
  frontCard: {
    height: 316,
    borderRadius: 38,
    overflow: 'hidden',
    backgroundColor: '#25124E',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#020104',
    shadowOpacity: 0.42,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 14,
  },
  swipeStage: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    height: 500,
  },
  swipeCue: {
    position: 'absolute',
    top: 68,
    width: '33%',
    height: 314,
    borderRadius: 40,
    opacity: 0.95,
  },
  swipeCueLeft: {
    left: 0,
  },
  swipeCueRight: {
    right: 0,
  },
  cueArrowWrap: {
    position: 'absolute',
    top: 194,
    zIndex: 3,
  },
  cueArrowLeft: {
    left: 8,
  },
  cueArrowRight: {
    right: 8,
  },
  swipeCard: {
    width: '72%',
    height: 412,
    borderRadius: 42,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#21103C',
    shadowColor: '#020104',
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
    elevation: 18,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '52%',
  },
  info: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 20,
  },
  name: {
    color: onboardingTheme.textPrimary,
    fontSize: 27,
    lineHeight: 31,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  standing: {
    marginTop: 6,
    color: onboardingTheme.accentOrange,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  availability: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    lineHeight: 18,
  },
  badge: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(28, 25, 43, 0.74)',
  },
  badgeText: {
    color: onboardingTheme.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
});
