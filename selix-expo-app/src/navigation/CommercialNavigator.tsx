import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabBar, TabItem } from '../components/TabBar';
import { useApp } from '../context/AppContext';
import { Colors } from '../constants/colors';

import { DashboardScreen } from '../screens/commercial/DashboardScreen';
import { LeadsScreen }     from '../screens/commercial/LeadsScreen';
import { VisitsScreen }    from '../screens/commercial/VisitsScreen';
import { MessagesScreen }  from '../screens/client/MessagesScreen';
import { ProfileScreen }   from '../screens/commercial/ProfileScreen';

const TABS: TabItem[] = [
  { key: 'Dashboard', label: 'Dashboard',  icon: 'grid-outline',          iconActive: 'grid' },
  { key: 'Leads',     label: 'Leads',      icon: 'people-outline',         iconActive: 'people' },
  { key: 'Visits',    label: 'Visites',    icon: 'calendar-outline',       iconActive: 'calendar' },
  { key: 'Messages',  label: 'Messages',   icon: 'chatbubble-outline',     iconActive: 'chatbubble' },
  { key: 'Profile',   label: 'Profil',     icon: 'person-outline',         iconActive: 'person' },
];

function normalizeStatus(status = '') {
  return status.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function CommercialNavigator() {
  const { leads, unreadMessages, commercialActiveTab, setCommercialActiveTab, t } = useApp();
  const insets = useSafeAreaInsets();

  const newLeadCount = leads.filter((lead) => normalizeStatus(lead.status) === 'Nouveau').length;

  const tabs = TABS.map(tab => ({
    ...tab,
    label:
      tab.key === 'Dashboard' ? t('role.dashboard') :
      tab.key === 'Leads' ? t('role.leads') :
      tab.key === 'Visits' ? t('nav.visits') :
      tab.key === 'Messages' ? t('nav.messages') :
      t('nav.profile'),
    badge:
      tab.key === 'Leads'    ? (newLeadCount > 0 ? newLeadCount : undefined) :
      tab.key === 'Messages' ? (unreadMessages > 0 ? unreadMessages : undefined) :
      undefined,
  }));

  const renderScreen = () => {
    switch (commercialActiveTab) {
      case 'Dashboard': return <DashboardScreen />;
      case 'Leads':     return <LeadsScreen />;
      case 'Visits':    return <VisitsScreen />;
      case 'Messages':  return <MessagesScreen />;
      case 'Profile':   return <ProfileScreen />;
      default:          return <DashboardScreen />;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>{renderScreen()}</View>
      <TabBar tabs={tabs} activeKey={commercialActiveTab} onPress={setCommercialActiveTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgMain },
  content:   { flex: 1 },
});
