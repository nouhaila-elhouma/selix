import React, { useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
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
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.96);
  const translateY = useSharedValue(14);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });
    scale.value = withSpring(1, { damping: 22, stiffness: 130 });
    translateY.value = withTiming(0, { duration: 480, easing: Easing.out(Easing.quad) });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <View style={styles.shell}>
      <Animated.View style={[styles.panelShadow, animStyle]}>
        <LinearGradient colors={onboardingTheme.panelGradient} style={styles.panel}>
          {/* Glow blobs — top half */}
          <BackgroundGlow tone="violet"  size={260} top={-30}  right={-60}   opacity={0.72} />
          <BackgroundGlow tone="rose"    size={240} top={140}  left={-100}   opacity={0.88} />
          <BackgroundGlow tone="pink"    size={200} top={80}   right={40}    opacity={0.50} />

          {/* Glow blobs — bottom half */}
          <BackgroundGlow tone="blue"    size={200} bottom={220} left={-60}  opacity={0.80} />
          <BackgroundGlow tone="purple"  size={260} bottom={60}  right={30}  opacity={0.62} />
          <BackgroundGlow tone="violet"  size={200} bottom={-20} left={60}   opacity={0.44} />

          <SafeAreaView style={[styles.content, contentStyle]}>{children}</SafeAreaView>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: onboardingTheme.shellBackground,
    paddingHorizontal: 16,
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelShadow: {
    width: onboardingTheme.panelWidth,
    height: onboardingTheme.panelHeight,
    shadowColor: '#05010E',
    shadowOpacity: 0.60,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 16 },
    elevation: 20,
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
