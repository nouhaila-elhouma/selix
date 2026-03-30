import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabBar, TabItem } from '../components/TabBar';
import { Colors } from '../constants/colors';
import { useApp } from '../context/AppContext';

import { DashboardScreen } from '../screens/promoter/DashboardScreen';
import { ProjectsScreen }  from '../screens/promoter/ProjectsScreen';
import { SalesScreen }     from '../screens/promoter/SalesScreen';
import { MessagesScreen }  from '../screens/client/MessagesScreen';
import { ProfileScreen }   from '../screens/commercial/ProfileScreen';

const TABS: TabItem[] = [
  { key: 'Dashboard', label: 'Dashboard', icon: 'grid-outline',    iconActive: 'grid' },
  { key: 'Projects',  label: 'Projets',   icon: 'business-outline', iconActive: 'business' },
  { key: 'Sales',     label: 'Ventes',    icon: 'checkmark-done-outline', iconActive: 'checkmark-done' },
  { key: 'Messages',  label: 'Messages',  icon: 'chatbubble-outline', iconActive: 'chatbubble' },
  { key: 'Profile',   label: 'Profil',    icon: 'person-outline',   iconActive: 'person' },
];

export function PromoterNavigator() {
  const { promoterActiveTab, setPromoterActiveTab, unreadMessages, unreadCount, t } = useApp();
  const insets = useSafeAreaInsets();

  const tabs = TABS.map((tab) => ({
    ...tab,
    label:
      tab.key === 'Dashboard' ? t('role.dashboard') :
      tab.key === 'Projects' ? t('role.projects') :
      tab.key === 'Sales' ? t('role.sales') :
      tab.key === 'Messages' ? t('nav.messages') :
      t('nav.profile'),
    badge:
      tab.key === 'Messages' && unreadMessages > 0
        ? unreadMessages
        : tab.key === 'Dashboard' && unreadCount > 0
          ? unreadCount
          : undefined,
  }));

  const renderScreen = () => {
    switch (promoterActiveTab) {
      case 'Dashboard': return <DashboardScreen />;
      case 'Projects':  return <ProjectsScreen />;
      case 'Sales':     return <SalesScreen />;
      case 'Messages':  return <MessagesScreen />;
      case 'Profile':   return <ProfileScreen />;
      default:          return <DashboardScreen />;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>{renderScreen()}</View>
      <TabBar tabs={tabs} activeKey={promoterActiveTab} onPress={setPromoterActiveTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgMain },
  content:   { flex: 1 },
});
