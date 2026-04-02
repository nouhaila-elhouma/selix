import React from 'react';
import { StyleSheet, View } from 'react-native';

type TopRightDotsIconProps = {
  color?: string;
  size?: number;
};

export function TopRightDotsIcon({
  color = 'rgba(255,255,255,0.92)',
  size = 28,
}: TopRightDotsIconProps) {
  const dot = Math.round(size * 0.2);

  return (
    <View style={[styles.grid, { width: size, height: size }]}>
      {[0, 1, 2, 3].map((item) => (
        <View
          key={item}
          style={[
            styles.dot,
            {
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              backgroundColor: color,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'center',
    justifyContent: 'space-between',
  },
  dot: {},
});
