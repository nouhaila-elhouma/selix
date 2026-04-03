import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useApp } from '../../context/AppContext';

export function WelcomeScreen() {
  const { setCurrentScreen } = useApp();

  useEffect(() => {
    setCurrentScreen('Onboarding');
  }, [setCurrentScreen]);

  return <View style={{ flex: 1, backgroundColor: '#0D0620' }} />;
}
