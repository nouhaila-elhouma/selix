import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabBar, TabItem } from '../components/TabBar';
import { Colors } from '../constants/colors';
import { useApp } from '../context/AppContext';
import { hasAdminPermission, normalizeAdminRole } from '../utils/adminAccess';

import { DashboardScreen } from '../screens/admin/DashboardScreen';
import { LeadsScreen } from '../screens/commercial/LeadsScreen';
import { ProjectsScreen } from '../screens/promoter/ProjectsScreen';
import { ReportsScreen } from '../screens/admin/ReportsScreen';
import { SettingsScreen } from '../screens/admin/SettingsScreen';

const TABS: TabItem[] = [
  { key: 'Dashboard', label: 'Dashboard', icon: 'grid-outline', iconActive: 'grid' },
  { key: 'Leads', label: 'Leads', icon: 'people-outline', iconActive: 'people' },
  { key: 'Projects', label: 'Projects', icon: 'business-outline', iconActive: 'business' },
  { key: 'Reports', label: 'Reports', icon: 'bar-chart-outline', iconActive: 'bar-chart' },
  { key: 'Settings', label: 'Settings', icon: 'settings-outline', iconActive: 'settings' },
];

export function AdminNavigator() {
  const { currentUser, t } = useApp();
  const [activeTab, setActiveTab] = useState('Dashboard');
  const insets = useSafeAreaInsets();
  const has = (permission: Parameters<typeof hasAdminPermission>[1]) => hasAdminPermission(currentUser, permission);
  const adminRole = normalizeAdminRole(currentUser?.adminRole);

  const tabs = TABS.filter((tab) => {
    if (tab.key === 'Dashboard' || tab.key === 'Reports') return has('reports.read');
    if (tab.key === 'Leads') return has('crm.read');
    if (tab.key === 'Projects') return has('projects.read') || has('projects.manage');
    return true;
  }).map((tab) => {
    if (tab.key === 'Settings') {
      return {
        ...tab,
        label: adminRole === 'super_admin' ? t('role.pilotage') : adminRole === 'project_integrator' ? t('role.integration') : t('role.support'),
      };
    }

    return {
      ...tab,
      label:
        tab.key === 'Dashboard' ? t('role.dashboard') :
        tab.key === 'Leads' ? t('role.leads') :
        tab.key === 'Projects' ? t('role.projects') :
        t('role.reports'),
    };
  });

  const safeActiveTab = tabs.some((tab) => tab.key === activeTab) ? activeTab : (tabs[0]?.key || 'Settings');

  const renderScreen = () => {
    switch (safeActiveTab) {
      case 'Dashboard': return <DashboardScreen />;
      case 'Leads': return <LeadsScreen />;
      case 'Projects': return <ProjectsScreen />;
      case 'Reports': return <ReportsScreen />;
      case 'Settings': return <SettingsScreen />;
      default: return <DashboardScreen />;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>{renderScreen()}</View>
      <TabBar tabs={tabs} activeKey={safeActiveTab} onPress={setActiveTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgMain },
  content: { flex: 1 },
});
