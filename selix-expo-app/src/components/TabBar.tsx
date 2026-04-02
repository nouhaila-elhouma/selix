import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';

export interface TabItem {
  key: string;
  label: string;
  icon: string;
  iconActive?: string;
  badge?: number;
}

interface TabBarProps {
  tabs: TabItem[];
  activeKey: string;
  onPress: (key: string) => void;
}

export function TabBar({ tabs, activeKey, onPress }: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 10 : 6) }]}>
      <LinearGradient
        colors={['rgba(18,10,32,0.99)', 'rgba(13,8,24,1)']}
        style={styles.container}
      >
        {/* Top glow line */}
        <View style={styles.topLine} />
        {/* Subtle top ambient glow */}
        <View style={styles.topGlow} />

        <View style={styles.inner}>
          {tabs.map((tab) => {
            const active = tab.key === activeKey;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => onPress(tab.key)}
                activeOpacity={0.88}
                style={styles.tab}
              >
                <View style={styles.tabInner}>
                  {active ? (
                    <LinearGradient
                      colors={[Colors.accentMagenta, Colors.primary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.activeIconBg}
                    >
                      <Ionicons
                        name={(tab.iconActive ?? tab.icon) as any}
                        size={20}
                        color={Colors.white}
                      />
                    </LinearGradient>
                  ) : (
                    <View style={styles.inactiveIconBg}>
                      <Ionicons
                        name={tab.icon as any}
                        size={20}
                        color={Colors.textMuted}
                      />
                    </View>
                  )}

                  {!!tab.badge && tab.badge > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{tab.badge > 99 ? '99+' : tab.badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.label, active && styles.labelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
<<<<<<< HEAD
    paddingHorizontal: 12,
    backgroundColor: 'transparent',
  },
  container: {
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  topLine: {
    position: 'absolute',
    top: 0,
    left: 30,
    right: 30,
    height: 1,
    backgroundColor: 'rgba(198,135,255,0.18)',
    borderRadius: 1,
  },
  topGlow: {
    position: 'absolute',
    top: -16,
    left: 40,
    right: 40,
    height: 50,
    borderRadius: 50,
    backgroundColor: 'rgba(142,53,255,0.07)',
  },
  inner: {
    flexDirection: 'row',
    paddingHorizontal: 6,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 8 : 6,
=======
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  container: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.36,
    shadowRadius: 28,
    elevation: 20,
  },
  topGlow: {
    position: 'absolute',
    top: -26,
    left: 26,
    right: 26,
    height: 72,
    borderRadius: 72,
    backgroundColor: 'rgba(255,79,216,0.12)',
  },
  inner: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 12 : 10,
>>>>>>> 23a070d (Apply new design system across app)
  },
  tab: {
    flex: 1,
    alignItems: 'center',
<<<<<<< HEAD
    gap: 3,
  },
  tabInner: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIconBg: {
    width: 48,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accentMagenta,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  inactiveIconBg: {
    width: 48,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
=======
    gap: 6,
  },
  iconWrapper: {
    width: 50,
    height: 42,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  iconWrapperActive: {
    shadowColor: '#A03EFF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.38,
    shadowRadius: 18,
    elevation: 8,
>>>>>>> 23a070d (Apply new design system across app)
  },
  label: {
    fontSize: 9,
    color: Colors.textMuted,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  labelActive: {
    color: Colors.white,
    fontWeight: '800',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: 2,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: Colors.accentOrange,
    borderWidth: 1.5,
    borderColor: 'rgba(13,8,24,1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: Colors.white,
    fontSize: 8,
    fontWeight: '900',
  },
});
