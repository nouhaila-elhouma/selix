import React, { useEffect } from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { onboardingTheme } from './theme';

type OnboardingNextButtonProps = {
  onPress: () => void;
  style?: ViewStyle;
  color?: string;
};

export function OnboardingNextButton({
  onPress,
  style,
  color = onboardingTheme.accentPink,
}: OnboardingNextButtonProps) {
  const translateX = useSharedValue(0);
  const pressScale = useSharedValue(1);

  useEffect(() => {
    translateX.value = withRepeat(
      withSequence(
        withTiming(5, { duration: 800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, []);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const handlePressIn = () => {
    pressScale.value = withSpring(0.88, { damping: 14, stiffness: 260 });
  };
  const handlePressOut = () => {
    pressScale.value = withSpring(1, { damping: 14, stiffness: 260 });
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={16}
      style={[styles.button, style]}
    >
      <Animated.View style={buttonStyle}>
        <Animated.View style={iconStyle}>
          <Ionicons name="chevron-forward" size={44} color={color} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
