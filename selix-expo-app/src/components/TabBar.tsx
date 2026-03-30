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
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 8) }]}>
      <LinearGradient colors={Colors.gradientCard} style={styles.container}>
        <View style={styles.topGlow} />
        <View style={styles.inner}>
          {tabs.map((tab) => {
            const active = tab.key === activeKey;
            return (
              <TouchableOpacity key={tab.key} onPress={() => onPress(tab.key)} activeOpacity={0.92} style={styles.tab}>
                <LinearGradient
                  colors={active ? Colors.gradientCta : ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.02)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.iconWrapper, active && styles.iconWrapperActive]}
                >
                  <Ionicons
                    name={(tab.iconActive && active ? tab.iconActive : tab.icon) as any}
                    size={21}
                    color={active ? Colors.white : Colors.textMuted}
                  />
                  {!!tab.badge && tab.badge > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{tab.badge > 99 ? '99+' : tab.badge}</Text>
                    </View>
                  ) : null}
                </LinearGradient>
                <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
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
    paddingHorizontal: 14,
    backgroundColor: 'transparent',
  },
  container: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.32,
    shadowRadius: 24,
    elevation: 18,
  },
  topGlow: {
    position: 'absolute',
    top: -22,
    left: 30,
    right: 30,
    height: 64,
    borderRadius: 64,
    backgroundColor: 'rgba(198,135,255,0.08)',
  },
  inner: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  iconWrapper: {
    width: 46,
    height: 38,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  iconWrapperActive: {
    shadowColor: '#8E35FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.34,
    shadowRadius: 16,
    elevation: 7,
  },
  label: {
    fontSize: 9,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  labelActive: {
    color: Colors.white,
    fontWeight: '800',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: Colors.accentOrange,
    borderWidth: 1.5,
    borderColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: '900',
  },
});
