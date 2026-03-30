import 'react-native-gesture-handler';
import React from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppProvider, useApp } from './src/context/AppContext';

// Onboarding
import { SplashScreen }     from './src/screens/onboarding/SplashScreen';
import { WelcomeScreen }    from './src/screens/onboarding/WelcomeScreen';
import { OnboardingScreen } from './src/screens/onboarding/OnboardingScreen';
import { AuthScreen }       from './src/screens/onboarding/AuthScreen';

// Client mandatory tunnel
import { QuestionnaireScreen } from './src/screens/client/QuestionnaireScreen';
import { AnalyzingScreen }     from './src/screens/client/AnalyzingScreen';

// Role navigators
import { ClientNavigator }     from './src/navigation/ClientNavigator';
import { CommercialNavigator } from './src/navigation/CommercialNavigator';
import { PromoterNavigator }   from './src/navigation/PromoterNavigator';
import { AdminNavigator }      from './src/navigation/AdminNavigator';

const appOwnership = (Constants as any)?.appOwnership;
const executionEnvironment = String((Constants as any)?.executionEnvironment || '').toLowerCase();
const isExpoGoAndroid = Platform.OS === 'android'
  && (appOwnership === 'expo' || executionEnvironment.includes('storeclient'));

if (!isExpoGoAndroid) {
  const Notifications = require('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// ── Router ─────────────────────────────────────────────────
function AppRouter() {
  const { currentScreen } = useApp();

  switch (currentScreen) {
    // Onboarding
    case 'Splash':      return <SplashScreen />;
    case 'Welcome':     return <WelcomeScreen />;
    case 'Onboarding':  return <OnboardingScreen />;
    case 'Auth':        return <AuthScreen />;
    // Client tunnel (mandatory before ClientApp)
    case 'Questionnaire': return <QuestionnaireScreen />;
    case 'Analyzing':     return <AnalyzingScreen />;
    // Role apps
    case 'ClientApp':     return <ClientNavigator />;
    case 'CommercialApp': return <CommercialNavigator />;
    case 'PromoterApp':   return <PromoterNavigator />;
    case 'AdminApp':      return <AdminNavigator />;
    default:              return <SplashScreen />;
  }
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <StatusBar style="light" />
          <AppRouter />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
