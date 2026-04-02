import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/colors';
import { Property } from '../types';

interface PropertyCardProps {
  property: Property;
  onPress?: () => void;
  onFavorite?: () => void;
  isFavorite?: boolean;
  compact?: boolean;
}

export function PropertyCard({
  property, onPress, onFavorite, isFavorite = false, compact = false,
}: PropertyCardProps) {
  const badgeColor =
    property.badge === 'Top Match' ? Colors.badgeTop :
    property.badge === 'Excellent Match' ? Colors.badgeExcellent :
    property.badge === 'Bon potentiel' ? Colors.badgeGood :
    Colors.badgeExplore;

  const availabilityColor =
    property.availability === 'Disponible' ? Colors.success :
    property.availability === 'Réservé' ? Colors.warning :
    Colors.danger;

  if (compact) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.92} style={styles.compactCard}>
        <Image source={{ uri: property.image }} style={styles.compactImage} />
        <LinearGradient colors={Colors.gradientDark} style={styles.compactOverlay} />

        <View style={styles.compactTopRow}>
          <View style={styles.compactBadge}>
            <Ionicons name="sparkles" size={10} color={badgeColor} />
            <Text style={[styles.compactBadgeText, { color: badgeColor }]}>{property.badge}</Text>
          </View>
          <View style={styles.compactScoreChip}>
            <Text style={styles.compactScoreText}>{property.score}</Text>
          </View>
        </View>

        <View style={styles.compactInfo}>
          <Text style={styles.compactTitle} numberOfLines={2}>{property.title}</Text>
          <Text style={styles.compactPrice}>{property.price}</Text>
          <View style={styles.compactMeta}>
            <Ionicons name="location-outline" size={11} color={Colors.primarySoft} />
            <Text style={styles.compactMetaText}>{property.district}, {property.city}</Text>
          </View>
          <View style={styles.compactFooter}>
            {property.areaRaw > 0 ? <Text style={styles.compactMetaText}>{property.area}</Text> : null}
            {property.rooms > 0 ? <Text style={styles.compactMetaText}>{property.rooms}P</Text> : null}
          </View>
        </View>

        {onFavorite ? (
          <TouchableOpacity onPress={onFavorite} style={styles.compactFavBtn}>
            <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={18} color={isFavorite ? Colors.danger : Colors.white} />
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.92} style={styles.card}>
      <View style={styles.imageContainer}>
        <Image source={{ uri: property.image }} style={styles.image} />
        <LinearGradient colors={Colors.gradientDark} style={styles.imageOverlay} />

        <View style={styles.topRow}>
          <View style={[styles.availBadge, { backgroundColor: `${availabilityColor}24` }]}>
            <View style={[styles.availDot, { backgroundColor: availabilityColor }]} />
            <Text style={[styles.availText, { color: availabilityColor }]}>{property.availability}</Text>
          </View>

          <View style={styles.topActions}>
            <View style={styles.scoreCircle}>
              <Text style={styles.scoreCircleText}>{property.score}</Text>
            </View>
            {onFavorite ? (
              <TouchableOpacity onPress={onFavorite} style={styles.favBtn}>
                <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={20} color={isFavorite ? Colors.danger : Colors.white} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={styles.heroInfo}>
          <View style={styles.matchBadge}>
            <Ionicons name="sparkles" size={10} color={badgeColor} />
            <Text style={[styles.matchBadgeText, { color: badgeColor }]}>{property.badge}</Text>
          </View>
          <Text style={styles.heroTitle} numberOfLines={2}>{property.title}</Text>
          <View style={styles.heroMetaRow}>
            <Ionicons name="location-outline" size={13} color={Colors.primarySoft} />
            <Text style={styles.heroMetaText}>{property.district}, {property.city}</Text>
          </View>
        </View>
      </View>

      <LinearGradient colors={Colors.gradientCard} style={styles.content}>
        <View style={styles.specsRow}>
          {property.areaRaw > 0 ? (
            <View style={styles.specItem}>
              <Ionicons name="resize-outline" size={13} color={Colors.primarySoft} />
              <Text style={styles.specText}>{property.area}</Text>
            </View>
          ) : null}
          {property.rooms > 0 ? (
            <View style={styles.specItem}>
              <Ionicons name="bed-outline" size={13} color={Colors.primarySoft} />
              <Text style={styles.specText}>{property.rooms} pieces</Text>
            </View>
          ) : null}
          {property.floor != null && property.floor >= 0 ? (
            <View style={styles.specItem}>
              <Ionicons name="layers-outline" size={13} color={Colors.primarySoft} />
              <Text style={styles.specText}>{property.floor === 0 ? 'RDC' : `Etage ${property.floor}`}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.footer}>
          <View style={{ flex: 1 }}>
            <Text style={styles.price}>{property.price}</Text>
            <Text style={styles.monthly}>{property.monthlyEstimate}</Text>
          </View>
          <View style={styles.deliveryChip}>
            <Ionicons name="calendar-outline" size={11} color={Colors.accentOrange} />
            <Text style={styles.deliveryText}>{property.delivery}</Text>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 32,
    overflow: 'hidden',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.3,
    shadowRadius: 28,
    elevation: 12,
  },
  imageContainer: { position: 'relative', height: 260 },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  imageOverlay: { position: 'absolute', inset: 0 },
  topRow: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  availBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  availDot: { width: 7, height: 7, borderRadius: 4, marginRight: 7 },
  availText: { fontSize: 11, fontWeight: '800' },
  scoreCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  scoreCircleText: { fontSize: 12, fontWeight: '900', color: Colors.primary },
  favBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroInfo: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
  },
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(12,8,22,0.68)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 10,
  },
  matchBadgeText: { fontSize: 11, fontWeight: '800', marginLeft: 5 },
  heroTitle: { fontSize: 24, fontWeight: '300', color: Colors.white, letterSpacing: -0.4 },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 7 },
  heroMetaText: { fontSize: 13, color: 'rgba(255,255,255,0.84)', marginLeft: 4 },
  content: { padding: 18 },
  specsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  specItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  specText: { fontSize: 12, color: Colors.textSoft, fontWeight: '700', marginLeft: 5 },
  footer: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  price: { fontSize: 22, fontWeight: '900', color: Colors.textDark },
  monthly: { fontSize: 11, color: Colors.textMuted, marginTop: 3 },
  deliveryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,138,30,0.14)',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  deliveryText: { fontSize: 11, color: Colors.accentOrange, fontWeight: '800', marginLeft: 4 },

  compactCard: {
    width: 224,
    height: 280,
    borderRadius: 28,
    overflow: 'hidden',
    marginRight: 14,
    position: 'relative',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.24,
    shadowRadius: 20,
    elevation: 8,
  },
  compactImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  compactOverlay: { position: 'absolute', inset: 0 },
  compactTopRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(12,8,22,0.68)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  compactBadgeText: { fontSize: 10, fontWeight: '800', marginLeft: 4 },
  compactScoreChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  compactScoreText: { fontSize: 10, fontWeight: '900', color: Colors.primary },
  compactInfo: { position: 'absolute', left: 14, right: 14, bottom: 14 },
  compactTitle: { fontSize: 16, fontWeight: '900', color: Colors.white, marginBottom: 4 },
  compactPrice: { fontSize: 15, fontWeight: '800', color: Colors.white, marginBottom: 6 },
  compactMeta: { flexDirection: 'row', alignItems: 'center' },
  compactMetaText: { fontSize: 11, color: 'rgba(255,255,255,0.82)', marginLeft: 4, marginRight: 8 },
  compactFooter: { flexDirection: 'row', gap: 10, marginTop: 8 },
  compactFavBtn: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
