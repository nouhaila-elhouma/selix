import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useApp } from '../../context/AppContext';

const SELIX_PICTO = require('../../../assets/selix-picto.png');

export function SplashScreen() {
  const { hasSeenOnboarding, setCurrentScreen } = useApp();

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentScreen(hasSeenOnboarding ? 'Auth' : 'Onboarding');
    }, 350);

    return () => clearTimeout(timer);
  }, [hasSeenOnboarding, setCurrentScreen]);

  return (
    <View style={styles.screen}>
      <Image source={SELIX_PICTO} resizeMode="contain" style={styles.logo} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#07111F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 180,
    height: 180,
  },
});
