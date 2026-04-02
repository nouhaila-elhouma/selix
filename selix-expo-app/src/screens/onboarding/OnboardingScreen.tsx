import React, { useRef, useState } from 'react';
<<<<<<< HEAD
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
=======
import { Animated, Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
>>>>>>> 23a070d (Apply new design system across app)
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { BrandWordmark } from '../../components/BrandWordmark';

const { width: W, height: H } = Dimensions.get('window');

// Fallback property images (public, real-estate themed)
const PROPERTY_IMAGES = [
  'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
];

const SLIDES = [
  {
<<<<<<< HEAD
    imageUri: PROPERTY_IMAGES[0],
    propertyName: 'Linaz Living',
    standing: 'HAUT STANDING',
    availability: 'CFC 2 — disponible fin 2026',
    title: 'Une expérience\nimmobilière',
    accent: 'premium et intelligente',
    subtitle: 'Matching, suivi, CRM et validation dans une seule application mobile.',
  },
  {
    imageUri: PROPERTY_IMAGES[1],
    propertyName: 'Eden Résidences',
    standing: 'PRESTIGE',
    availability: 'Casablanca — disponible 2025',
    title: 'Swipez pour\ndécouvrir',
    accent: 'votre bien idéal',
    subtitle: 'Notre IA analyse votre profil et vous propose les projets qui vous correspondent.',
  },
  {
    imageUri: PROPERTY_IMAGES[2],
    propertyName: 'Côte Azur Maroc',
    standing: 'EXCLUSIF',
    availability: 'Rabat — disponible 2026',
    title: 'Un commercial\ndédié',
    accent: 'vous contacte en 24h',
    subtitle: 'Dès que vous likez un projet, le bon conseiller prend contact directement avec vous.',
=======
    eyebrow: 'Real estate matching',
    title: 'Une experience immobiliere premium et intelligente',
    subtitle: 'Matching, suivi, CRM et validation dans une seule application mobile.',
    image: require('../../../assets/selix-splash.png'),
  },
  {
    eyebrow: 'Real estate matching',
    title: 'Un parcours immobilier simple et fluide',
    subtitle: 'Selix cadre le besoin, filtre les bons projets et vous guide jusqu au closing.',
    image: require('../../../assets/selix-splash.png'),
  },
  {
    eyebrow: 'Swipe to like',
    title: 'Un commercial vas vous contacter',
    subtitle: 'Swipez, likez, matchez et ouvrez directement le chat commercial approprie.',
    image: require('../../../assets/selix-splash.png'),
>>>>>>> 23a070d (Apply new design system across app)
  },
];

export function OnboardingScreen() {
  const { setCurrentScreen, setHasSeenOnboarding } = useApp();
  const [step, setStep] = useState(0);
  const slideX = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const contentFade = useRef(new Animated.Value(1)).current;

  const finish = () => {
    setHasSeenOnboarding(true);
    setCurrentScreen('Questionnaire');
  };

  const next = () => {
    if (step < SLIDES.length - 1) {
<<<<<<< HEAD
      // Animate out
      Animated.parallel([
        Animated.timing(contentFade, { toValue: 0, duration: 160, useNativeDriver: false }),
        Animated.spring(cardScale, { toValue: 0.94, friction: 8, tension: 80, useNativeDriver: false }),
      ]).start(() => {
        // Move slider
        const nextStep = step + 1;
        slideX.setValue(-(nextStep * W));
        setStep(nextStep);
        // Animate in
        Animated.parallel([
          Animated.timing(contentFade, { toValue: 1, duration: 280, useNativeDriver: false }),
          Animated.spring(cardScale, { toValue: 1, friction: 7, tension: 60, useNativeDriver: false }),
        ]).start();
      });
    } else {
      finish();
=======
      Animated.spring(slideX, {
        toValue: -(step + 1) * W,
        useNativeDriver: false,
        friction: 9,
        tension: 64,
      }).start();
      setStep(step + 1);
      return;
>>>>>>> 23a070d (Apply new design system across app)
    }
  };

<<<<<<< HEAD
  const current = SLIDES[step];

  return (
    <LinearGradient
      colors={['#0A0618', '#130A28', '#1A0A35', '#0D0620']}
      locations={[0, 0.25, 0.6, 1]}
      style={styles.container}
    >
      {/* Ambient orbs */}
      <View style={styles.orbPurple} />
      <View style={styles.orbMagenta} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <BrandWordmark />
        <View style={styles.topRight}>
          <TouchableOpacity onPress={finish} style={styles.skipPill}>
            <Text style={styles.skipText}>Passer</Text>
          </TouchableOpacity>
          <View style={styles.menuGrid}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.menuDot} />
            ))}
          </View>
        </View>
      </View>

      {/* Property card (hero) */}
      <Animated.View style={[styles.cardWrap, { transform: [{ scale: cardScale }], opacity: contentFade }]}>
        <View style={styles.propertyCard}>
          <Image
            source={{ uri: current.imageUri }}
            style={styles.propertyImage}
            resizeMode="cover"
          />
          {/* Bottom gradient overlay */}
          <LinearGradient
            colors={['transparent', 'rgba(10,6,24,0.72)']}
            style={styles.cardGradient}
          />
          {/* Property info */}
          <View style={styles.cardInfo}>
            <Text style={styles.propName}>{current.propertyName}</Text>
            <Text style={styles.propStanding}>{current.standing}</Text>
            <Text style={styles.propAvail}>{current.availability}</Text>
          </View>
          {/* Score chip */}
          <View style={styles.scoreChip}>
            <Ionicons name="sparkles" size={11} color={Colors.accentMagenta} />
            <Text style={styles.scoreChipText}>Top Match</Text>
          </View>
        </View>
      </Animated.View>

      {/* Copy */}
      <Animated.View style={[styles.copy, { opacity: contentFade }]}>
        <Text style={styles.headline}>{current.title}</Text>
        <Text style={styles.accentLine}>{current.accent}</Text>
        <Text style={styles.subtitle}>{current.subtitle}</Text>
      </Animated.View>

      {/* Bottom controls */}
      <View style={styles.bottomRow}>
        {/* Pagination dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === step ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        {/* Next / Finish */}
        <TouchableOpacity onPress={next} activeOpacity={0.88} style={styles.arrowBtn}>
          <LinearGradient
            colors={[Colors.accentMagenta, '#C81A9C']}
            style={styles.arrowBtnInner}
          >
            <Ionicons
              name={step < SLIDES.length - 1 ? 'chevron-forward' : 'checkmark'}
              size={22}
              color={Colors.white}
            />
=======
  return (
    <View style={styles.screen}>
      <Animated.View style={[styles.slider, { transform: [{ translateX: slideX }] }]}>
        {SLIDES.map((slide, index) => (
          <LinearGradient key={slide.title} colors={Colors.gradientHero} style={styles.slide}>
            <View style={[styles.orb, styles.orbA]} />
            <View style={[styles.orb, styles.orbB]} />

            <View style={styles.topBar}>
              <BrandWordmark size="md" />
              {index === 0 ? (
                <TouchableOpacity style={styles.gridBtn} activeOpacity={0.9} onPress={finish}>
                  <Ionicons name="grid" size={18} color={Colors.white} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.gridBtn} activeOpacity={0.9} onPress={finish}>
                  <Text style={styles.skipText}>Passer</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.eyebrow}>{slide.eyebrow}</Text>

            <View style={styles.visualBlock}>
              <View style={[styles.backPlate, index === 1 ? styles.backPlateTilt : index === 2 ? styles.backPlateMatch : null]} />
              <Image source={slide.image} style={styles.heroImage} />
              <LinearGradient colors={Colors.gradientDark} style={styles.imageOverlay} />

              {index === 2 ? (
                <>
                  <View style={[styles.sideArrow, styles.sideArrowLeft]}>
                    <Ionicons name="arrow-back" size={54} color="rgba(255,91,115,0.9)" />
                  </View>
                  <View style={[styles.sideArrow, styles.sideArrowRight]}>
                    <Ionicons name="arrow-forward" size={54} color="rgba(76,255,143,0.9)" />
                  </View>
                </>
              ) : null}

              <View style={styles.imageCaption}>
                <Text style={styles.captionTitle}>Linaz Living</Text>
                <Text style={styles.captionBadge}>HAUT STANDING</Text>
                <Text style={styles.captionMeta}>CFC 2 - disponible fin 2026</Text>
              </View>
            </View>

            <View style={styles.copyBlock}>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.subtitle}>{slide.subtitle}</Text>
            </View>

            <View style={styles.footer}>
              <View style={styles.progressRow}>
                {SLIDES.map((_, dotIndex) => (
                  <View
                    key={String(dotIndex)}
                    style={[styles.progressDot, dotIndex === step && styles.progressDotActive]}
                  />
                ))}
              </View>

              {index === 2 ? (
                <View style={styles.actionRow}>
                  <TouchableOpacity style={[styles.roundAction, styles.rejectAction]} activeOpacity={0.9}>
                    <Ionicons name="close" size={28} color={Colors.accentRed} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.roundAction, styles.infoAction]} activeOpacity={0.9}>
                    <Ionicons name="star" size={24} color={Colors.accentBlue} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.roundAction, styles.likeAction]} activeOpacity={0.9}>
                    <Ionicons name="heart" size={26} color={Colors.accentGreen} />
                  </TouchableOpacity>
                </View>
              ) : null}

              <TouchableOpacity onPress={next} activeOpacity={0.92} style={styles.nextBtn}>
                <Ionicons name={step < SLIDES.length - 1 ? 'chevron-forward' : 'checkmark'} size={30} color={Colors.accentMagenta} />
              </TouchableOpacity>
            </View>
>>>>>>> 23a070d (Apply new design system across app)
          </LinearGradient>
        ))}
      </Animated.View>
    </View>
  );
}

const CARD_H = H * 0.38;

const styles = StyleSheet.create({
<<<<<<< HEAD
  container: {
    flex: 1,
    paddingTop: 52,
    paddingBottom: 36,
  },

  orbPurple: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(92,16,216,0.18)',
    top: -60,
    right: -80,
  },
  orbMagenta: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(227,22,140,0.12)',
    bottom: 100,
    left: -80,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    marginBottom: 24,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  skipPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  skipText: { color: Colors.textSoft, fontSize: 12, fontWeight: '700' },
  menuGrid: {
    width: 20,
    height: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },

  // Property card
  cardWrap: {
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  propertyCard: {
    height: CARD_H,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.5,
    shadowRadius: 32,
    elevation: 14,
    position: 'relative',
  },
  propertyImage: {
    width: '100%',
    height: '100%',
  },
  cardGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
  },
  cardInfo: {
    position: 'absolute',
    left: 18,
    bottom: 18,
  },
  propName: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  propStanding: {
    color: Colors.accentOrange,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 2,
  },
  propAvail: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  scoreChip: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(9,6,17,0.62)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  scoreChipText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '800',
  },

  // Copy
  copy: {
    flex: 1,
    paddingHorizontal: 22,
    justifyContent: 'center',
  },
  headline: {
    color: Colors.white,
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 42,
    letterSpacing: -0.8,
    marginBottom: 6,
  },
  accentLine: {
    color: Colors.accentMagenta,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 12,
  },
  subtitle: {
    color: Colors.textSoft,
    fontSize: 14,
    lineHeight: 22,
    maxWidth: 320,
  },

  // Bottom controls
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 28,
    backgroundColor: Colors.accentMagenta,
  },
  dotInactive: {
    width: 8,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  arrowBtn: {
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: Colors.accentMagenta,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.38,
    shadowRadius: 16,
    elevation: 8,
  },
  arrowBtnInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
=======
  screen: { flex: 1, backgroundColor: '#201C1C', overflow: 'hidden' },
  slider: { flexDirection: 'row', width: W * SLIDES.length, flex: 1 },
  slide: {
    width: W,
    paddingTop: 54,
    paddingHorizontal: 26,
    paddingBottom: 28,
  },
  orb: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.05)' },
  orbA: { width: 250, height: 250, top: 90, right: -120, backgroundColor: 'rgba(160,62,255,0.12)' },
  orbB: { width: 180, height: 180, bottom: 200, left: -70, backgroundColor: 'rgba(255,79,216,0.12)' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  gridBtn: {
    minWidth: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  skipText: { color: Colors.textSoft, fontSize: 12, fontWeight: '800' },
  eyebrow: {
    color: Colors.accentMagenta,
    fontSize: 18,
    lineHeight: 24,
    marginBottom: 24,
    letterSpacing: 0.6,
  },
  visualBlock: {
    height: 420,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  backPlate: {
    position: 'absolute',
    width: '78%',
    height: '78%',
    borderRadius: 42,
    backgroundColor: 'rgba(232,225,238,0.85)',
    transform: [{ rotate: '-8deg' }],
  },
  backPlateTilt: {
    backgroundColor: 'rgba(238,232,242,0.82)',
    transform: [{ rotate: '8deg' }],
  },
  backPlateMatch: {
    backgroundColor: 'rgba(104,43,162,0.28)',
    transform: [{ rotate: '0deg' }],
  },
  heroImage: {
    width: '74%',
    height: '82%',
    borderRadius: 42,
    resizeMode: 'cover',
  },
  imageOverlay: {
    position: 'absolute',
    width: '74%',
    height: '82%',
    borderRadius: 42,
  },
  sideArrow: {
    position: 'absolute',
    top: '36%',
  },
  sideArrowLeft: { left: -2 },
  sideArrowRight: { right: -2 },
  imageCaption: {
    position: 'absolute',
    bottom: 58,
    width: '66%',
    alignSelf: 'center',
    paddingHorizontal: 18,
  },
  captionTitle: { color: Colors.white, fontSize: 26, fontWeight: '300' },
  captionBadge: { color: Colors.accentOrange, fontSize: 13, fontWeight: '800', letterSpacing: 1.2, marginTop: 2 },
  captionMeta: { color: 'rgba(255,255,255,0.82)', fontSize: 12, marginTop: 4 },
  copyBlock: { minHeight: 138 },
  title: {
    color: Colors.white,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '300',
    letterSpacing: -0.4,
    marginBottom: 10,
  },
  subtitle: {
    color: Colors.textSoft,
    fontSize: 16,
    lineHeight: 24,
  },
  footer: {
    marginTop: 'auto',
    minHeight: 98,
    justifyContent: 'flex-end',
  },
  progressRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(160,62,255,0.45)',
  },
  progressDotActive: {
    width: 24,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    marginBottom: 16,
  },
  roundAction: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    backgroundColor: 'rgba(17,6,30,0.54)',
  },
  rejectAction: { borderColor: 'rgba(255,91,115,0.9)' },
  infoAction: { borderColor: 'rgba(36,168,255,0.9)' },
  likeAction: { borderColor: 'rgba(76,255,143,0.9)' },
  nextBtn: {
    position: 'absolute',
    right: 4,
    bottom: 0,
    width: 56,
    height: 56,
    borderRadius: 28,
>>>>>>> 23a070d (Apply new design system across app)
    alignItems: 'center',
    justifyContent: 'center',
  },
});
