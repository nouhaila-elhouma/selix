import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: 4,
          duration: 900,
          useNativeDriver: false,
        }),
        Animated.timing(translateX, {
          toValue: 0,
          duration: 900,
          useNativeDriver: false,
        }),
      ]),
    ).start();
  }, [translateX]);

  return (
    <Pressable onPress={onPress} hitSlop={14} style={[styles.button, style]}>
      <Animated.View style={{ transform: [{ translateX }] }}>
        <Ionicons
          name="chevron-forward"
          size={42}
          color={color}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
