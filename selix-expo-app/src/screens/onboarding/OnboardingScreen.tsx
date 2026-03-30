import React, { useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { BrandWordmark } from '../../components/BrandWordmark';

const { width: W } = Dimensions.get('window');

const SLIDES = [
  {
    icon: 'document-text-outline',
    title: 'Expliquez votre projet',
    subtitle: 'Selix vous guide et construit votre profil immobilier question apres question.',
  },
  {
    icon: 'sparkles-outline',
    title: 'Qualification intelligente',
    subtitle: 'Budget, maturite et priorites sont analyses avant de vous montrer les bons projets.',
  },
  {
    icon: 'chatbubble-ellipses-outline',
    title: 'Passez au bon commercial',
    subtitle: 'Des qu un projet est like, la conversation avec le conseiller approprie s ouvre.',
  },
  {
    icon: 'diamond-outline',
    title: 'Creez votre compte a la fin',
    subtitle: 'Vos resultats sont prets, vous ne creez votre compte qu au dernier ecran.',
  },
];

export function OnboardingScreen() {
  const { setCurrentScreen, setHasSeenOnboarding } = useApp();
  const [step, setStep] = useState(0);
  const slideX = useRef(new Animated.Value(0)).current;

  const finish = () => {
    setHasSeenOnboarding(true);
    setCurrentScreen('Questionnaire');
  };

  const next = () => {
    if (step < SLIDES.length - 1) {
      Animated.spring(slideX, { toValue: -(step + 1) * W, useNativeDriver: false, friction: 8, tension: 60 }).start();
      setStep(step + 1);
      return;
    }
    finish();
  };

  return (
    <LinearGradient colors={Colors.gradientHero} style={styles.container}>
      <View style={[styles.orb, styles.orbA]} />
      <View style={[styles.orb, styles.orbB]} />

      <View style={styles.topBar}>
        <BrandWordmark />
        <TouchableOpacity onPress={finish} style={styles.skipPill}>
          <Text style={styles.skipText}>Passer</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.hero}>
        <Animated.View style={[styles.slider, { transform: [{ translateX: slideX }] }]}>
          {SLIDES.map((slide) => (
            <View key={slide.title} style={styles.slide}>
              <LinearGradient colors={Colors.gradientCta} style={styles.iconShell}>
                <Ionicons name={slide.icon as any} size={44} color={Colors.white} />
              </LinearGradient>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.subtitle}>{slide.subtitle}</Text>
            </View>
          ))}
        </Animated.View>
      </View>

      <View style={styles.bottomPanel}>
        <View style={styles.progressBar}>
          {SLIDES.map((_, index) => (
            <View key={String(index)} style={[styles.progressDot, index === step && styles.progressDotActive]} />
          ))}
        </View>
        <Text style={styles.stepInfo}>{step + 1} / {SLIDES.length}</Text>

        <TouchableOpacity onPress={next} activeOpacity={0.92} style={styles.ctaWrap}>
          <LinearGradient colors={Colors.gradientCta} style={styles.cta}>
            <Text style={styles.ctaText}>{step < SLIDES.length - 1 ? 'Continuer' : 'Commencer'}</Text>
            <Ionicons name={step < SLIDES.length - 1 ? 'arrow-forward' : 'checkmark'} size={18} color={Colors.white} />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 56 },
  orb: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.05)' },
  orbA: { width: 260, height: 260, top: -90, right: -90 },
  orbB: { width: 220, height: 220, bottom: 120, left: -90, backgroundColor: 'rgba(255,138,30,0.08)' },
  topBar: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skipPill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  skipText: { color: Colors.textSoft, fontSize: 12, fontWeight: '800' },
  hero: { flex: 1, overflow: 'hidden' },
  slider: { flexDirection: 'row', width: W * SLIDES.length, flex: 1 },
  slide: {
    width: W,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  iconShell: {
    width: 122,
    height: 122,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    shadowColor: '#8E35FF',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 10,
  },
  title: {
    color: Colors.white,
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 36,
    letterSpacing: -0.6,
  },
  subtitle: {
    marginTop: 12,
    color: Colors.textSoft,
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 320,
  },
  bottomPanel: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    alignItems: 'center',
  },
  progressBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  progressDotActive: {
    width: 28,
    backgroundColor: Colors.accentOrange,
  },
  stepInfo: { color: Colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 16 },
  ctaWrap: { width: '100%', borderRadius: 22, overflow: 'hidden' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
  },
  ctaText: { color: Colors.white, fontSize: 16, fontWeight: '800' },
});
