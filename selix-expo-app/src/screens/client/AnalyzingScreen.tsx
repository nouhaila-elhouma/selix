import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useApp } from '../../context/AppContext';

const STEPS = [
  { icon: 'person-outline',    label: 'Analyse de votre profil...' },
  { icon: 'calculator-outline', label: 'Calcul de votre scoring...' },
  { icon: 'search-outline',    label: 'Recherche des biens...' },
  { icon: 'heart-circle-outline', label: 'Sélection de vos matchs...' },
];

export function AnalyzingScreen() {
  const { setCurrentScreen } = useApp();
  const progress = useRef(new Animated.Value(0)).current;
  const step     = useRef(new Animated.Value(0)).current;
  const opacity  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: false }).start();

    Animated.timing(progress, {
      toValue: 1,
      duration: 3000,
      useNativeDriver: false,
    }).start();

    const timer = setTimeout(() => {
      setCurrentScreen('ClientApp');
    }, 3500);

    return () => clearTimeout(timer);
  }, []);

  const barWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <LinearGradient colors={Colors.gradientHero} style={styles.container}>
      <View style={[styles.circle, styles.circleA]} />
      <View style={[styles.circle, styles.circleB]} />

      <Animated.View style={[styles.content, { opacity }]}>
        {/* Animated icon */}
        <View style={styles.iconRing}>
          <View style={styles.iconInner}>
            <Ionicons name="sparkles" size={48} color={Colors.primary} />
          </View>
        </View>

        <Text style={styles.title}>Analyse en cours…</Text>
        <Text style={styles.subtitle}>
          Nous identifions les biens les plus adaptés{'\n'}à votre profil unique.
        </Text>

        {/* Steps */}
        <View style={styles.steps}>
          {STEPS.map((s, i) => (
            <View key={i} style={styles.stepItem}>
              <View style={styles.stepIcon}>
                <Ionicons name={s.icon as any} size={18} color="rgba(255,255,255,0.8)" />
              </View>
              <Text style={styles.stepLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: barWidth as any }]} />
        </View>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  circle: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  circleA: { width: 300, height: 300, top: -80, right: -80 },
  circleB: { width: 220, height: 220, bottom: -50, left: -50 },

  content: { alignItems: 'center', paddingHorizontal: 36, gap: 20, width: '100%' },

  iconRing: {
    width: 120, height: 120, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)',
  },
  iconInner: {
    width: 88, height: 88, borderRadius: 26,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.78)',
    textAlign: 'center',
    lineHeight: 23,
  },

  steps: {
    width: '100%',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  stepLabel: { fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },

  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 99,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    backgroundColor: Colors.white,
    borderRadius: 99,
  },
});
