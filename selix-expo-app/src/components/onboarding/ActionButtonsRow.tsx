import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { onboardingTheme } from './theme';

type ActionButtonsRowProps = {
  onReject?: () => void;
  onFavorite?: () => void;
  onLike?: () => void;
};

function CircleButton({
  color,
  icon,
  size,
  onPress,
}: {
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  size: number;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
          shadowColor: color,
        },
      ]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.42)} color={color} />
    </Pressable>
  );
}

export function ActionButtonsRow({
  onReject,
  onFavorite,
  onLike,
}: ActionButtonsRowProps) {
  return (
    <View style={styles.row}>
      <CircleButton color={onboardingTheme.accentRed} icon="close" size={62} onPress={onReject} />
      <CircleButton color={onboardingTheme.accentBlue} icon="star" size={44} onPress={onFavorite} />
      <CircleButton color={onboardingTheme.accentGreen} icon="heart" size={62} onPress={onLike} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26, 7, 44, 0.5)',
    borderWidth: 2.5,
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
});
