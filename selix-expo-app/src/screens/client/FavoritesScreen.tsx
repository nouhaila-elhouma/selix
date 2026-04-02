import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { PropertyCard } from '../../components/PropertyCard';
import { EmptyState } from '../../components/ui';

export function FavoritesScreen() {
  const { favorites, toggleFavorite, isFavorite } = useApp();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <LinearGradient colors={['#120A28', '#1A0A35', '#0D0620']} style={StyleSheet.absoluteFillObject} />
        <View style={styles.orbA} />
        <Text style={styles.headerTitle}>Favoris</Text>
        <Text style={styles.headerSub}>{favorites.length} bien{favorites.length !== 1 ? 's' : ''} sauvegardé{favorites.length !== 1 ? 's' : ''}</Text>
      </View>

      {favorites.length === 0 ? (
        <View style={styles.empty}>
          <EmptyState
            icon="bookmark-outline"
            title="Aucun favori encore"
            subtitle="Swipez à droite ou touchez le cœur sur un bien pour le sauvegarder ici."
          />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {favorites.map(p => (
            <PropertyCard
              key={p.id}
              property={p}
              onPress={() => {}}
              isFavorite={isFavorite(p.id)}
              onFavorite={() => toggleFavorite(p)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgMain },
  header: {
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 22,
    position: 'relative',
    overflow: 'hidden',
  },
  orbA: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(227,22,140,0.12)',
    top: -60,
    right: -60,
  },
  headerTitle: { fontSize: 26, fontWeight: '900', color: Colors.white, letterSpacing: -0.4 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.62)', marginTop: 4, fontWeight: '500' },
  empty: { flex: 1, justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 110 },
});
