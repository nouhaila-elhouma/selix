import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabBar, TabItem } from '../components/TabBar';
import { useApp } from '../context/AppContext';
import { Colors } from '../constants/colors';

import { HomeScreen }      from '../screens/client/HomeScreen';
import { MatchScreen }     from '../screens/client/MatchScreen';
import { FavoritesScreen } from '../screens/client/FavoritesScreen';
import { VisitsScreen }    from '../screens/client/VisitsScreen';
import { MessagesScreen }  from '../screens/client/MessagesScreen';
import { ProfileScreen }   from '../screens/client/ProfileScreen';

const TABS: TabItem[] = [
  { key: 'Home',      label: 'Accueil',    icon: 'home-outline',       iconActive: 'home' },
  { key: 'Match',     label: 'Matchs',     icon: 'heart-circle-outline', iconActive: 'heart-circle' },
  { key: 'Favorites', label: 'Favoris',    icon: 'bookmark-outline',   iconActive: 'bookmark' },
  { key: 'Visits',    label: 'Visites',    icon: 'calendar-outline',   iconActive: 'calendar' },
  { key: 'Messages',  label: 'Messages',   icon: 'chatbubble-outline',  iconActive: 'chatbubble' },
  { key: 'Profile',   label: 'Profil',     icon: 'person-outline',      iconActive: 'person' },
];

export function ClientNavigator() {
  const { unreadMessages, clientActiveTab, setClientActiveTab, t } = useApp();
  const insets = useSafeAreaInsets();

  const tabs = TABS.map(tab => ({
    ...tab,
    label:
      tab.key === 'Home' ? t('nav.home') :
      tab.key === 'Match' ? t('nav.match') :
      tab.key === 'Favorites' ? t('nav.favorites') :
      tab.key === 'Visits' ? t('nav.visits') :
      tab.key === 'Messages' ? t('nav.messages') :
      t('nav.profile'),
    badge:
      tab.key === 'Messages'  ? (unreadMessages > 0 ? unreadMessages : undefined) :
      undefined,
  }));

  const renderScreen = () => {
    switch (clientActiveTab) {
      case 'Home':      return <HomeScreen />;
      case 'Match':     return <MatchScreen />;
      case 'Favorites': return <FavoritesScreen />;
      case 'Visits':    return <VisitsScreen />;
      case 'Messages':  return <MessagesScreen />;
      case 'Profile':   return <ProfileScreen />;
      default:          return <HomeScreen />;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        {renderScreen()}
      </View>
      <TabBar tabs={tabs} activeKey={clientActiveTab} onPress={setClientActiveTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgMain },
  content:   { flex: 1 },
});
