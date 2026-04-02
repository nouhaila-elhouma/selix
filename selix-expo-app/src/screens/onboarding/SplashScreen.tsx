import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/colors';
import { useApp } from '../../context/AppContext';

export function SplashScreen() {
  const { setCurrentScreen, hasSeenOnboarding } = useApp();

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.88)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineLift = useRef(new Animated.Value(12)).current;
  const orbOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(orbOpacity, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.spring(logoScale, { toValue: 1, friction: 7, tension: 55, useNativeDriver: false }),
      ]),
      Animated.parallel([
        Animated.timing(taglineOpacity, { toValue: 1, duration: 500, useNativeDriver: false }),
        Animated.spring(taglineLift, { toValue: 0, friction: 8, tension: 60, useNativeDriver: false }),
      ]),
    ]).start();

    const timer = setTimeout(() => {
      setCurrentScreen(hasSeenOnboarding ? 'Auth' : 'Onboarding');
    }, 2600);
    return () => clearTimeout(timer);
  }, [hasSeenOnboarding, logoOpacity, logoScale, orbOpacity, setCurrentScreen, taglineLift, taglineOpacity]);

  return (
    <LinearGradient
      colors={['#0A0618', '#130A28', '#1A0A35', '#0D0620']}
      locations={[0, 0.3, 0.65, 1]}
      style={styles.container}
    >
      {/* Ambient orbs */}
      <Animated.View style={[styles.orbPurple, { opacity: orbOpacity }]} />
      <Animated.View style={[styles.orbMagenta, { opacity: orbOpacity }]} />
      <Animated.View style={[styles.orbBlue, { opacity: orbOpacity }]} />

      {/* Center content */}
      <Animated.View style={[styles.center, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        <Image
          source={require('../../../assets/selix-logo-horizontal.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Tagline at bottom */}
      <Animated.View style={[styles.taglineWrap, { opacity: taglineOpacity, transform: [{ translateY: taglineLift }] }]}>
        <Text style={styles.tagline}>Real estate matching</Text>
        <View style={styles.loaderRow}>
          <View style={[styles.dot, styles.dotPurple]} />
          <View style={[styles.dot, styles.dotMagenta]} />
          <View style={[styles.dot, styles.dotBlue]} />
        </View>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  orbPurple: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(92,16,216,0.22)',
    top: -80,
    right: -100,
  },
  orbMagenta: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(227,22,140,0.14)',
    bottom: 80,
    left: -90,
  },
  orbBlue: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(104,180,255,0.08)',
    bottom: -40,
    right: -30,
  },

  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 220,
    height: 80,
  },

  taglineWrap: {
    position: 'absolute',
    bottom: 56,
    alignItems: 'center',
    gap: 16,
  },
  tagline: {
    color: Colors.accentMagenta,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  loaderRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotPurple: { backgroundColor: Colors.primary },
  dotMagenta: { backgroundColor: Colors.accentMagenta, width: 10, height: 10, borderRadius: 5 },
  dotBlue: { backgroundColor: Colors.info },
});
