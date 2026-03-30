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
      <LinearGradient colors={Colors.gradientPrimary} style={styles.header}>
        <Text style={styles.headerTitle}>Favoris</Text>
        <Text style={styles.headerSub}>{favorites.length} bien{favorites.length !== 1 ? 's' : ''} sauvegardé{favorites.length !== 1 ? 's' : ''}</Text>
      </LinearGradient>

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
  header: { paddingTop: 20, paddingBottom: 24, paddingHorizontal: 24, alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.white },
  headerSub:   { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  empty:   { flex: 1, justifyContent: 'center' },
  scroll:  { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
});
