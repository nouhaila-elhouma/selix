import React, { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { onboardingTheme } from './theme';

type PropertyShowcaseCardProps = {
  imageUri: string;
  propertyName: string;
  standing: string;
  availability: string;
  mode?: 'stacked' | 'swipe';
  badgeText?: string;
};

function useCardEnter(delay = 0) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(18);
  const scale = useSharedValue(0.97);

  useEffect(() => {
    const t = setTimeout(() => {
      opacity.value = withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) });
      translateY.value = withSpring(0, { damping: 20, stiffness: 140 });
      scale.value = withSpring(1, { damping: 20, stiffness: 140 });
    }, delay);
    return () => clearTimeout(t);
  }, []);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));
}

// ─── Swipe mode ──────────────────────────────────────────────────────────────

function SwipeShowcase({
  imageUri,
  propertyName,
  standing,
  availability,
}: Omit<PropertyShowcaseCardProps, 'mode' | 'badgeText'>) {
  const cardAnim = useCardEnter(80);

  return (
    <View style={styles.swipeStage}>
      {/* Red cue — left */}
      <LinearGradient
        colors={['rgba(255,107,104,0.70)', 'rgba(255,107,104,0.08)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.swipeCue, styles.swipeCueLeft]}
      />
      {/* Green cue — right */}
      <LinearGradient
        colors={['rgba(47,209,122,0.08)', 'rgba(47,209,122,0.70)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.swipeCue, styles.swipeCueRight]}
      />

      {/* Curved reject arrow */}
      <View style={[styles.cueArrowWrap, styles.cueArrowLeft]}>
        <Ionicons name="arrow-undo" size={66} color="rgba(255,107,104,0.90)" />
      </View>
      {/* Curved like arrow */}
      <View style={[styles.cueArrowWrap, styles.cueArrowRight]}>
        <Ionicons name="arrow-redo" size={66} color="rgba(47,209,122,0.90)" />
      </View>

      <Animated.View style={[styles.swipeCard, cardAnim]}>
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
        <LinearGradient colors={onboardingTheme.imageOverlay} style={styles.imageOverlay} />
        <View style={styles.info}>
          <Text style={styles.name}>{propertyName}</Text>
          <Text style={styles.standing}>{standing}</Text>
          <Text style={styles.availability}>{availability}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

// ─── Stacked mode ─────────────────────────────────────────────────────────────

function StackedShowcase({
  imageUri,
  propertyName,
  standing,
  availability,
  badgeText = 'Top Match',
}: Omit<PropertyShowcaseCardProps, 'mode'>) {
  const cardAnim = useCardEnter(60);
  const backAnim = useCardEnter(0);

  return (
    <View style={styles.stackWrap}>
      {/* Back decorative plate */}
      <Animated.View style={backAnim}>
        <LinearGradient
          colors={['rgba(255,255,255,0.20)', 'rgba(160,100,255,0.08)']}
          style={styles.backPlate}
        />
      </Animated.View>

      {/* Front card */}
      <Animated.View style={[styles.frontCard, cardAnim]}>
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
      </Animated.View>
    </View>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

export function PropertyShowcaseCard({
  mode = 'stacked',
  ...props
}: PropertyShowcaseCardProps) {
  if (mode === 'swipe') return <SwipeShowcase {...props} />;
  return <StackedShowcase {...props} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Stacked
  stackWrap: {
    position: 'relative',
    height: 278,
    justifyContent: 'flex-end',
  },
  backPlate: {
    position: 'absolute',
    width: '94%',
    height: 216,
    left: -18,
    top: 4,
    borderRadius: 38,
    backgroundColor: 'rgba(211, 204, 223, 0.82)',
    transform: [{ rotate: '-11deg' }],
  },
  frontCard: {
    alignSelf: 'flex-end',
    width: '86%',
    height: 214,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#22104A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    shadowColor: '#020106',
    shadowOpacity: 0.50,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 20 },
    elevation: 16,
  },

  // Swipe
  swipeStage: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    height: 478,
  },
  swipeCue: {
    position: 'absolute',
    top: 88,
    width: '31%',
    height: 348,
    borderRadius: 32,
    opacity: 1,
  },
  swipeCueLeft: {
    left: -6,
  },
  swipeCueRight: {
    right: -6,
  },
  cueArrowWrap: {
    position: 'absolute',
    top: 302,
    zIndex: 3,
  },
  cueArrowLeft: {
    left: -12,
  },
  cueArrowRight: {
    right: -12,
  },
  swipeCard: {
    width: '74%',
    height: 398,
    borderRadius: 34,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: '#1E0E38',
    shadowColor: '#020106',
    shadowOpacity: 0.55,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 20 },
    elevation: 20,
  },

  // Shared image / overlay / info
  image: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '38%',
  },
  info: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 14,
  },
  name: {
    color: onboardingTheme.textPrimary,
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '700',
    letterSpacing: -0.9,
  },
  standing: {
    marginTop: 4,
    color: onboardingTheme.accentOrange,
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  availability: {
    marginTop: 3,
    color: 'rgba(255,255,255,0.80)',
    fontSize: 10,
    lineHeight: 12,
  },

  // Badge (stacked only)
  badge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(24, 20, 40, 0.78)',
  },
  badgeText: {
    color: onboardingTheme.textPrimary,
    fontSize: 10,
    fontWeight: '800',
  },
});
