import React, { useEffect, useRef, useState } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { Properties } from '../../lib/api';
import { BrandWordmark } from '../../components/BrandWordmark';

const { height: H } = Dimensions.get('window');

const HIGHLIGHTS = [
  { label: '60 sec', icon: 'flash-outline' },
  { label: 'Matching IA', icon: 'sparkles-outline' },
  { label: 'Agent dédié', icon: 'chatbubble-ellipses-outline' },
];

export function WelcomeScreen() {
  const { setCurrentScreen } = useApp();
  const [heroImageUri, setHeroImageUri] = useState<string | null>(null);
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroScale = useRef(new Animated.Value(1.04)).current;
  const contentLift = useRef(new Animated.Value(28)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const panelFade = useRef(new Animated.Value(0)).current;
  const panelLift = useRef(new Animated.Value(22)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(heroOpacity, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.timing(heroScale, { toValue: 1, duration: 1800, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      ]),
      Animated.parallel([
        Animated.timing(contentFade, { toValue: 1, duration: 480, useNativeDriver: false }),
        Animated.spring(contentLift, { toValue: 0, friction: 8, tension: 55, useNativeDriver: false }),
      ]),
      Animated.parallel([
        Animated.timing(panelFade, { toValue: 1, duration: 400, useNativeDriver: false }),
        Animated.spring(panelLift, { toValue: 0, friction: 8, tension: 55, useNativeDriver: false }),
      ]),
    ]).start();

    Properties.list({ limit: 1 })
      .then((response: any) => {
        const uri = response?.items?.find((item: any) => item?.image)?.image || null;
        if (uri) setHeroImageUri(uri);
      })
      .catch(() => {});
  }, [contentFade, contentLift, heroOpacity, heroScale, panelFade, panelLift]);

  return (
    <View style={styles.container}>
      {/* Hero image section */}
      <Animated.View style={[styles.heroWrap, { opacity: heroOpacity }]}>
        <Animated.Image
          source={
            heroImageUri
              ? { uri: heroImageUri }
              : require('../../../assets/selix-splash.png')
          }
          style={[styles.heroImage, { transform: [{ scale: heroScale }] }]}
          resizeMode="cover"
        />
        {/* Multi-layer overlay for premium depth */}
        <LinearGradient
          colors={['rgba(13,8,26,0.1)', 'rgba(13,8,26,0.55)', 'rgba(10,6,24,0.96)']}
          style={StyleSheet.absoluteFillObject}
        />
        <LinearGradient
          colors={['rgba(227,22,140,0.06)', 'transparent', 'rgba(92,16,216,0.12)']}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Orbs */}
        <View style={styles.orbA} />
        <View style={styles.orbB} />

        {/* Hero content */}
        <Animated.View style={[styles.heroContent, { opacity: contentFade, transform: [{ translateY: contentLift }] }]}>
          <BrandWordmark size="lg" />

          <View style={styles.aiPill}>
            <Ionicons name="diamond-outline" size={11} color={Colors.white} />
            <Text style={styles.aiPillText}>AI Real Estate Matching</Text>
          </View>

          <Text style={styles.heroTitle}>Trouvez plus vite{'\n'}le bon bien.</Text>
          <Text style={styles.heroSubtitle}>
            Qualification rapide, matching intelligent, puis mise en relation avec le bon conseiller.
          </Text>

          <View style={styles.pillRow}>
            {HIGHLIGHTS.map((h) => (
              <View key={h.label} style={styles.pill}>
                <Ionicons name={h.icon as any} size={12} color={Colors.white} />
                <Text style={styles.pillText}>{h.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.ctaGroup}>
            <TouchableOpacity
              onPress={() => setCurrentScreen('Questionnaire')}
              activeOpacity={0.9}
              style={styles.primaryBtnWrap}
            >
              <LinearGradient
                colors={Colors.gradientCta}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryBtnText}>Commencer maintenant</Text>
                <Ionicons name="arrow-forward" size={17} color={Colors.white} />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setCurrentScreen('Auth')}
              activeOpacity={0.88}
              style={styles.secondaryBtn}
            >
              <Text style={styles.secondaryBtnText}>J'ai déjà un compte</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Bottom feature panel */}
      <Animated.View style={[styles.panel, { opacity: panelFade, transform: [{ translateY: panelLift }] }]}>
        <LinearGradient colors={['rgba(20,13,38,0.98)', 'rgba(13,8,24,0.99)']} style={styles.panelCard}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelEyebrow}>Pourquoi Selix</Text>
            <View style={styles.panelDivider} />
          </View>
          <View style={styles.featuresRow}>
            {[
              { icon: 'sparkles-outline', label: 'Qualification\nexpress', color: Colors.accentMagenta },
              { icon: 'heart-circle-outline', label: 'Matching\nintelligent', color: Colors.primary },
              { icon: 'chatbubble-ellipses-outline', label: 'Agent\ndédié', color: Colors.success },
            ].map((f) => (
              <View key={f.label} style={styles.featureItem}>
                <View style={[styles.featureIconWrap, { backgroundColor: `${f.color}18` }]}>
                  <Ionicons name={f.icon as any} size={20} color={f.color} />
                </View>
                <Text style={styles.featureLabel}>{f.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
<<<<<<< HEAD
  container: { flex: 1, backgroundColor: '#0A0618' },

  // Hero
  heroWrap: {
    height: H * 0.70,
    position: 'relative',
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  orbA: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(92,16,216,0.14)',
    top: -80,
    right: -80,
  },
  orbB: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,138,30,0.08)',
    bottom: 60,
    left: -50,
  },
  heroContent: {
    position: 'absolute',
    left: 22,
    right: 22,
    bottom: 24,
  },

  aiPill: {
    marginTop: 14,
    marginBottom: 14,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.14)',
=======
  container: { flex: 1, backgroundColor: Colors.bgMain },
  hero: { height: H * 0.62, position: 'relative', overflow: 'hidden' },
  heroImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  heroOverlay: { position: 'absolute', inset: 0 },
  heroShade: { position: 'absolute', inset: 0 },
  orb: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)' },
  orbA: { width: 280, height: 280, top: -90, right: -110, backgroundColor: 'rgba(160,62,255,0.14)' },
  orbB: { width: 180, height: 180, bottom: 58, left: -62, backgroundColor: 'rgba(255,79,216,0.12)' },
  heroContent: { position: 'absolute', left: 22, right: 22, bottom: 28 },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.09)',
>>>>>>> 23a070d (Apply new design system across app)
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
<<<<<<< HEAD
  aiPillText: { color: Colors.white, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  heroTitle: {
    fontSize: 34,
    fontWeight: '900',
    color: Colors.white,
    lineHeight: 40,
    letterSpacing: -1,
    marginBottom: 10,
  },
  heroSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 20,
    maxWidth: 320,
    marginBottom: 16,
  },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  pill: {
=======
  badgeText: { color: Colors.white, fontSize: 11, fontWeight: '800', marginLeft: 6, letterSpacing: 0.5 },
  heroTitle: { fontSize: 34, fontWeight: '300', color: Colors.white, lineHeight: 38, letterSpacing: -0.9, maxWidth: 320 },
  heroSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.82)', lineHeight: 22, marginTop: 10, maxWidth: 330 },
  highlightRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  highlightPill: {
>>>>>>> 23a070d (Apply new design system across app)
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
<<<<<<< HEAD
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  pillText: { color: Colors.white, fontSize: 11, fontWeight: '700' },

  ctaGroup: { gap: 10 },
  primaryBtnWrap: { borderRadius: 22, overflow: 'hidden' },
  primaryBtn: {
=======
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  highlightText: { color: Colors.white, fontSize: 11, fontWeight: '800' },
  ctaStack: { gap: 10, marginTop: 16 },
  primaryButton: { borderRadius: 24, overflow: 'hidden' },
  primaryButtonInner: {
>>>>>>> 23a070d (Apply new design system across app)
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
<<<<<<< HEAD
    paddingVertical: 16,
    shadowColor: Colors.accentMagenta,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.32,
    shadowRadius: 22,
    elevation: 10,
  },
  primaryBtnText: { color: Colors.white, fontSize: 15, fontWeight: '900', letterSpacing: 0.2 },
  secondaryBtn: {
    height: 50,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
=======
    paddingVertical: 17,
    shadowColor: '#FF4FD8',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.32,
    shadowRadius: 24,
    elevation: 12,
  },
  primaryButtonText: { color: Colors.white, fontSize: 15, fontWeight: '900' },
  secondaryButton: {
    height: 52,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
>>>>>>> 23a070d (Apply new design system across app)
    backgroundColor: 'rgba(13,10,24,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
  },
<<<<<<< HEAD
  secondaryBtnText: { color: Colors.white, fontSize: 14, fontWeight: '800' },

  // Panel
  panel: {
    flex: 1,
    marginTop: -20,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  panelCard: {
    flex: 1,
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
=======
  secondaryButtonText: { color: Colors.white, fontSize: 14, fontWeight: '800' },
  panel: { flex: 1, marginTop: -24, paddingHorizontal: 20, paddingBottom: 20 },
  panelCard: {
    borderRadius: 34,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
>>>>>>> 23a070d (Apply new design system across app)
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  panelEyebrow: {
    color: Colors.accentOrange,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  panelDivider: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  featuresRow: { flexDirection: 'row', justifyContent: 'space-around' },
  featureItem: { alignItems: 'center', gap: 8, flex: 1 },
  featureIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  featureLabel: { color: Colors.textSoft, fontSize: 12, fontWeight: '700', textAlign: 'center', lineHeight: 17 },
});
