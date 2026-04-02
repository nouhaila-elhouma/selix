import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useApp } from '../../context/AppContext';

export function SplashScreen() {
  const { hasSeenOnboarding, setCurrentScreen } = useApp();

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentScreen(hasSeenOnboarding ? 'Auth' : 'Onboarding');
    }, 80);

    return () => clearTimeout(timer);
  }, [hasSeenOnboarding, setCurrentScreen]);

  return <View style={styles.screen} />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#232120',
  },
});
