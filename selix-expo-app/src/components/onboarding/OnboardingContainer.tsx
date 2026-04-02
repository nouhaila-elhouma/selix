import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackgroundGlow } from './BackgroundGlow';
import { onboardingTheme } from './theme';

type OnboardingContainerProps = {
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

export function OnboardingContainer({
  children,
  contentStyle,
}: OnboardingContainerProps) {
  return (
    <View style={styles.shell}>
      <View style={styles.panelShadow}>
        <LinearGradient colors={onboardingTheme.panelGradient} style={styles.panel}>
          <BackgroundGlow tone="violet" size={210} top={24} right={-46} opacity={0.78} />
          <BackgroundGlow tone="rose" size={226} top={176} left={-90} opacity={0.95} />
          <BackgroundGlow tone="blue" size={184} bottom={200} left={-54} opacity={0.88} />
          <BackgroundGlow tone="pink" size={236} bottom={92} right={44} opacity={0.7} />
          <BackgroundGlow tone="violet" size={190} bottom={-30} right={70} opacity={0.52} />

          <SafeAreaView style={[styles.content, contentStyle]}>{children}</SafeAreaView>
        </LinearGradient>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: onboardingTheme.shellBackground,
    paddingHorizontal: 18,
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelShadow: {
    width: onboardingTheme.panelWidth,
    height: onboardingTheme.panelHeight,
    shadowColor: '#07030E',
    shadowOpacity: 0.48,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  panel: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: onboardingTheme.panelRadius,
    borderWidth: 1,
    borderColor: onboardingTheme.panelBorder,
    backgroundColor: onboardingTheme.pageBackground,
  },
  content: {
    flex: 1,
    paddingHorizontal: onboardingTheme.contentHorizontal,
  },
});
