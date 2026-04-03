import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BrandWordmark } from '../../components/BrandWordmark';
import { useApp } from '../../context/AppContext';

export function SplashScreen() {
  const { hasSeenOnboarding, setCurrentScreen } = useApp();

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentScreen(hasSeenOnboarding ? 'Auth' : 'Onboarding');
    }, 350);

    return () => clearTimeout(timer);
  }, [hasSeenOnboarding, setCurrentScreen]);

  return (
    <LinearGradient colors={['#0D0620', '#160A30', '#1A0840', '#0F0428']} locations={[0, 0.35, 0.7, 1]} style={styles.screen}>
      {/* Ambient orbs */}
      <View style={[styles.orb, styles.orbA]} />
      <View style={[styles.orb, styles.orbB]} />

      {/* Subtle geometric background art */}
      <View style={styles.artWrap} pointerEvents="none">
        {/* House / heart outline */}
        <View style={styles.heartOutline} />
        {/* Diamond outline */}
        <View style={styles.diamondOutline} />
        {/* Window grid */}
        <View style={styles.windowGrid}>
          <View style={styles.window} />
          <View style={styles.window} />
          <View style={styles.window} />
          <View style={styles.window} />
        </View>
      </View>

      {/* Centered logo */}
      <BrandWordmark size="xl" variant="white" iconStyle={styles.logo} />

      {/* Tagline */}
      <Text style={styles.tagline}>Real estate matching</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbA: {
    width: 320,
    height: 320,
    top: -80,
    right: -100,
    backgroundColor: 'rgba(138,62,255,0.12)',
  },
  orbB: {
    width: 260,
    height: 260,
    bottom: 80,
    left: -110,
    backgroundColor: 'rgba(244,109,235,0.10)',
  },
  artWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartOutline: {
    position: 'absolute',
    top: '12%',
    width: 480,
    height: 360,
    borderWidth: 1,
    borderColor: 'rgba(103,63,183,0.18)',
    borderBottomWidth: 0,
    borderTopLeftRadius: 240,
    borderTopRightRadius: 240,
    transform: [{ scaleY: 0.84 }],
  },
  diamondOutline: {
    position: 'absolute',
    width: 380,
    height: 380,
    borderWidth: 1,
    borderColor: 'rgba(103,63,183,0.12)',
    borderRadius: 28,
    transform: [{ rotate: '45deg' }],
  },
  windowGrid: {
    position: 'absolute',
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 118,
    gap: 10,
  },
  window: {
    width: 54,
    height: 54,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(103,63,183,0.10)',
  },
  logo: {
    width: 280,
    height: 84,
  },
  tagline: {
    marginTop: 52,
    color: '#F46DEB',
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 1.8,
    fontWeight: '400',
  },
});
