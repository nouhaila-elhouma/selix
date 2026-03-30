import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/colors';
import { useApp } from '../../context/AppContext';

export function SplashScreen() {
  const { setCurrentScreen, hasSeenOnboarding } = useApp();
  const logoScale = useRef(new Animated.Value(0.82)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const panelOpacity = useRef(new Animated.Value(0)).current;
  const panelLift = useRef(new Animated.Value(28)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale, { toValue: 1, friction: 7, tension: 60, useNativeDriver: false }),
      Animated.timing(logoOpacity, { toValue: 1, duration: 850, useNativeDriver: false }),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(panelOpacity, { toValue: 1, duration: 520, useNativeDriver: false }),
        Animated.spring(panelLift, { toValue: 0, friction: 8, tension: 58, useNativeDriver: false }),
      ]).start();
    }, 300);

    const timer = setTimeout(() => {
      setCurrentScreen(hasSeenOnboarding ? 'Auth' : 'Onboarding');
    }, 2400);

    return () => clearTimeout(timer);
  }, [hasSeenOnboarding, logoOpacity, logoScale, panelLift, panelOpacity, setCurrentScreen]);

  return (
    <LinearGradient colors={Colors.gradientHero} style={styles.container}>
      <View style={[styles.orb, styles.orbA]} />
      <View style={[styles.orb, styles.orbB]} />
      <View style={[styles.orb, styles.orbC]} />

      <Animated.View style={[styles.logoShell, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        <LinearGradient colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.04)']} style={styles.logoFrame}>
          <Image source={require('../../../assets/selix-logo-horizontal.png')} style={styles.wordmark} resizeMode="contain" />
        </LinearGradient>
      </Animated.View>

      <Animated.View style={[styles.panel, { opacity: panelOpacity, transform: [{ translateY: panelLift }] }]}>
        <Text style={styles.eyebrow}>Real estate matching</Text>
        <Text style={styles.tagline}>Une experience immobiliere premium et intelligente</Text>
        <Text style={styles.subtagline}>Matching, suivi, CRM et validation dans une seule application mobile.</Text>
        <View style={styles.loaderRow}>
          <View style={[styles.loaderDot, { backgroundColor: Colors.primary }]} />
          <View style={[styles.loaderDot, { backgroundColor: Colors.accentMagenta }]} />
          <View style={[styles.loaderDot, { backgroundColor: Colors.accentOrange }]} />
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
    paddingHorizontal: 24,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  orbA: { width: 280, height: 280, top: -80, right: -70 },
  orbB: { width: 220, height: 220, bottom: 110, left: -100, backgroundColor: 'rgba(227,22,140,0.1)' },
  orbC: { width: 180, height: 180, bottom: -40, right: -20, backgroundColor: 'rgba(255,138,30,0.08)' },
  logoShell: {
    width: '100%',
    alignItems: 'center',
  },
  logoFrame: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 34,
    paddingHorizontal: 24,
    paddingVertical: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 10,
  },
  wordmark: { width: '100%', height: 72 },
  panel: {
    marginTop: 32,
    alignItems: 'center',
    maxWidth: 320,
  },
  eyebrow: {
    color: Colors.accentOrange,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  tagline: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.white,
    textAlign: 'center',
    lineHeight: 34,
    letterSpacing: -0.6,
  },
  subtagline: {
    fontSize: 14,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginTop: 10,
  },
  loaderRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 24,
  },
  loaderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
