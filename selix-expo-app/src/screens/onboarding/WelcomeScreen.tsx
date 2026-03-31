import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  { label: 'Agent dedie', icon: 'chatbubble-ellipses-outline' },
];

const FEATURES = [
  {
    icon: 'sparkles-outline',
    title: 'Qualification express',
    text: 'Quelques questions fluides pour cadrer votre projet rapidement.',
  },
  {
    icon: 'heart-circle-outline',
    title: 'Matching intelligent',
    text: 'Selix croise votre besoin, votre budget et le marche pour proposer les bons projets.',
  },
];

export function WelcomeScreen() {
  const { setCurrentScreen } = useApp();
  const [heroImageUri, setHeroImageUri] = useState<string | null>(null);
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroLift = useRef(new Animated.Value(24)).current;
  const panelOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(heroOpacity, { toValue: 1, duration: 620, useNativeDriver: false }),
        Animated.spring(heroLift, { toValue: 0, friction: 8, tension: 56, useNativeDriver: false }),
      ]),
      Animated.timing(panelOpacity, { toValue: 1, duration: 420, useNativeDriver: false }),
    ]).start();

    Properties.list({ limit: 1 })
      .then((response: any) => {
        const nextImage = response?.items?.find((item: any) => item?.image)?.image || null;
        if (nextImage) setHeroImageUri(nextImage);
      })
      .catch(() => {});
  }, [heroLift, heroOpacity, panelOpacity]);

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Image source={heroImageUri ? { uri: heroImageUri } : require('../../../assets/selix-splash.png')} style={styles.heroImage} />
        <LinearGradient colors={Colors.gradientOverlay} style={styles.heroOverlay} />
        <LinearGradient colors={['rgba(8,6,17,0.16)', 'rgba(8,6,17,0.56)', 'rgba(8,6,17,0.94)']} style={styles.heroShade} />
        <View style={[styles.orb, styles.orbA]} />
        <View style={[styles.orb, styles.orbB]} />

        <Animated.View style={[styles.heroContent, { opacity: heroOpacity, transform: [{ translateY: heroLift }] }]}>
          <BrandWordmark size="lg" />

          <View style={styles.badge}>
            <Ionicons name="diamond-outline" size={12} color={Colors.white} />
            <Text style={styles.badgeText}>AI Real Estate Matching</Text>
          </View>

          <Text style={styles.heroTitle}>Trouvez plus vite le bon bien.</Text>
          <Text style={styles.heroSubtitle}>
            Qualification rapide, matching intelligent, puis mise en relation avec le bon conseiller.
          </Text>

          <View style={styles.highlightRow}>
            {HIGHLIGHTS.map((item) => (
              <View key={item.label} style={styles.highlightPill}>
                <Ionicons name={item.icon as any} size={13} color={Colors.white} />
                <Text style={styles.highlightText}>{item.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.ctaStack}>
            <TouchableOpacity onPress={() => setCurrentScreen('Questionnaire')} activeOpacity={0.92} style={styles.primaryButton}>
              <LinearGradient colors={Colors.gradientCta} style={styles.primaryButtonInner}>
                <Text style={styles.primaryButtonText}>Commencer maintenant</Text>
                <Ionicons name="arrow-forward" size={18} color={Colors.white} />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setCurrentScreen('Auth')} activeOpacity={0.88} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Se connecter</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>

      <Animated.View style={[styles.panel, { opacity: panelOpacity }]}>
        <LinearGradient colors={Colors.gradientCard} style={styles.panelCard}>
          <Text style={styles.panelEyebrow}>Pourquoi Selix</Text>
          {FEATURES.map((feature) => (
            <View key={feature.title} style={styles.featureRow}>
              <LinearGradient colors={Colors.gradientCta} style={styles.featureIcon}>
                <Ionicons name={feature.icon as any} size={18} color={Colors.white} />
              </LinearGradient>
              <View style={styles.featureBody}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureText}>{feature.text}</Text>
              </View>
            </View>
          ))}
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgMain },
  hero: { height: H * 0.58, position: 'relative', overflow: 'hidden' },
  heroImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  heroOverlay: { position: 'absolute', inset: 0 },
  heroShade: { position: 'absolute', inset: 0 },
  orb: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)' },
  orbA: { width: 220, height: 220, top: -74, right: -96 },
  orbB: { width: 150, height: 150, bottom: 48, left: -52, backgroundColor: 'rgba(255,138,30,0.1)' },
  heroContent: { position: 'absolute', left: 22, right: 22, bottom: 22 },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 10,
    marginBottom: 12,
  },
  badgeText: { color: Colors.white, fontSize: 11, fontWeight: '800', marginLeft: 6, letterSpacing: 0.5 },
  heroTitle: { fontSize: 30, fontWeight: '900', color: Colors.white, lineHeight: 33, letterSpacing: -0.9, maxWidth: 320 },
  heroSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.82)', lineHeight: 21, marginTop: 10, maxWidth: 320 },
  highlightRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  highlightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  highlightText: { color: Colors.white, fontSize: 11, fontWeight: '800' },
  ctaStack: { gap: 10, marginTop: 16 },
  primaryButton: { borderRadius: 22, overflow: 'hidden' },
  primaryButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    shadowColor: '#EA4C89',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 10,
  },
  primaryButtonText: { color: Colors.white, fontSize: 15, fontWeight: '900' },
  secondaryButton: {
    height: 48,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(13,10,24,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: Colors.white, fontSize: 14, fontWeight: '800' },
  panel: { flex: 1, marginTop: -18, paddingHorizontal: 20, paddingBottom: 20 },
  panelCard: {
    borderRadius: 30,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  panelEyebrow: { color: Colors.accentOrange, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.1, marginBottom: 4 },
  featureRow: { flexDirection: 'row', gap: 12, paddingVertical: 10 },
  featureIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  featureBody: { flex: 1 },
  featureTitle: { color: Colors.textDark, fontSize: 15, fontWeight: '900', marginBottom: 2 },
  featureText: { color: Colors.textSoft, fontSize: 12, lineHeight: 18 },
});
