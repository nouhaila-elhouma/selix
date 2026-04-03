import React, { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Property } from '../types';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = SCREEN_W - 32;
const CARD_H = CARD_W * 1.35;
const SWIPE_THRESHOLD = SCREEN_W * 0.26;

interface SwipeDeckProps {
  properties: Property[];
  onLike: (p: Property) => void;
  onPass: (p: Property) => void;
  onOpen: (p: Property) => void;
  onEmpty?: () => void;
}

export function SwipeDeck({ properties, onLike, onPass, onOpen, onEmpty }: SwipeDeckProps) {
  const [index, setIndex] = useState(0);
  const pan = useRef(new Animated.ValueXY()).current;
  const scale = useRef(new Animated.Value(0.97)).current;

  const current = properties[index];
  const next = properties[index + 1];

  const rotate = pan.x.interpolate({
    inputRange: [-SCREEN_W, 0, SCREEN_W],
    outputRange: ['-12deg', '0deg', '12deg'],
    extrapolate: 'clamp',
  });

  // Like overlay (swiping right)
  const likeOpacity = pan.x.interpolate({
    inputRange: [20, SWIPE_THRESHOLD * 0.7],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Pass overlay (swiping left)
  const passOpacity = pan.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD * 0.7, -20],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Next card scale up as current is dragged
  const nextScale = pan.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD],
    outputRange: [1, 0.96, 1],
    extrapolate: 'clamp',
  });

  const nextTranslateY = pan.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD],
    outputRange: [0, 12, 0],
    extrapolate: 'clamp',
  });

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
    onPanResponderGrant: () => {
      Animated.spring(scale, { toValue: 1, friction: 8, tension: 80, useNativeDriver: false }).start();
    },
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx > SWIPE_THRESHOLD) swipe('right');
      else if (gesture.dx < -SWIPE_THRESHOLD) swipe('left');
      else {
        Animated.parallel([
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 7 }),
          Animated.spring(scale, { toValue: 0.97, useNativeDriver: false, friction: 7 }),
        ]).start();
      }
    },
  });

  const swipe = (dir: 'left' | 'right') => {
    Haptics.impactAsync(
      dir === 'right' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
    ).catch(() => {});
    const targetX = dir === 'right' ? SCREEN_W * 1.6 : -SCREEN_W * 1.6;
    Animated.timing(pan, { toValue: { x: targetX, y: 0 }, duration: 240, useNativeDriver: false }).start(() => {
      if (current) {
        if (dir === 'right') onLike(current);
        else onPass(current);
      }
      pan.setValue({ x: 0, y: 0 });
      scale.setValue(0.97);
      const nextIndex = index + 1;
      if (nextIndex >= properties.length) onEmpty?.();
      setIndex(nextIndex);
    });
  };

  if (index >= properties.length) {
    return (
      <View style={styles.emptyContainer}>
        <LinearGradient colors={Colors.gradientCard} style={styles.emptyGradient}>
          <LinearGradient colors={Colors.gradientCta} style={styles.emptyHeartCircle}>
            <Ionicons name="heart" size={38} color={Colors.white} />
          </LinearGradient>
          <Text style={styles.emptyTitle}>Tous vos matchs explorés</Text>
          <Text style={styles.emptySubtitle}>
            Revenez bientôt pour de nouvelles opportunités sélectionnées selon votre profil.
          </Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Next card (behind) */}
      {next ? (
        <Animated.View
          style={[
            styles.card,
            styles.nextCard,
            { transform: [{ scale: nextScale }, { translateY: nextTranslateY }] },
          ]}
        >
          <View style={styles.nextCardPlate} />
          <Image source={{ uri: next.image }} style={styles.cardImage} />
          <LinearGradient colors={Colors.gradientDark} style={styles.cardOverlay} />
        </Animated.View>
      ) : null}

      {/* Current swipeable card */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.card,
          {
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
              { rotate },
              { scale },
            ],
          },
        ]}
      >
        <Image source={{ uri: current.image }} style={styles.cardImage} />
        <LinearGradient colors={Colors.gradientDark} style={styles.cardOverlay} />

        {/* PASS overlay (left swipe) — red curved arrow style */}
        <Animated.View style={[styles.swipeOverlay, styles.passOverlay, { opacity: passOpacity }]}>
          <View style={styles.passArrowWrap}>
            <Ionicons name="arrow-back-circle" size={72} color="rgba(255,80,80,0.92)" />
          </View>
          <LinearGradient
            colors={['rgba(220,40,40,0.28)', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>

        {/* LIKE overlay (right swipe) — green curved arrow style */}
        <Animated.View style={[styles.swipeOverlay, styles.likeOverlay, { opacity: likeOpacity }]}>
          <View style={styles.likeArrowWrap}>
            <Ionicons name="arrow-forward-circle" size={72} color="rgba(60,220,100,0.92)" />
          </View>
          <LinearGradient
            colors={['transparent', 'rgba(30,200,80,0.28)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>

        {/* Top badges */}
        <View style={styles.topRow}>
          <View style={styles.matchBadge}>
            <Ionicons name="sparkles" size={11} color={Colors.accentMagenta} />
            <Text style={styles.matchBadgeText}>{current.badge}</Text>
          </View>
          <View style={styles.scoreBubble}>
            <Text style={styles.scoreBubbleText}>{current.score}</Text>
          </View>
        </View>

        {/* Availability */}
        <View style={styles.availBadge}>
          <View style={styles.availDot} />
          <Text style={styles.availText}>{current.availability}</Text>
        </View>

        {/* Property info */}
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={2}>{current.title}</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={13} color={Colors.primarySoft} />
            <Text style={styles.locationText}>{current.district}, {current.city}</Text>
          </View>
          <View style={styles.specRow}>
            {current.areaRaw > 0 && (
              <View style={styles.specPill}>
                <Ionicons name="resize-outline" size={11} color={Colors.white} />
                <Text style={styles.specText}>{current.area}</Text>
              </View>
            )}
            {current.rooms > 0 && (
              <View style={styles.specPill}>
                <Ionicons name="bed-outline" size={11} color={Colors.white} />
                <Text style={styles.specText}>{current.rooms} pièces</Text>
              </View>
            )}
            <View style={styles.specPill}>
              <Ionicons name="calendar-outline" size={11} color={Colors.white} />
              <Text style={styles.specText}>{current.delivery}</Text>
            </View>
          </View>
          <Text style={styles.cardPrice}>{current.price}</Text>
        </View>

        {/* Drag hint dot */}
        <View style={styles.dragDot} />
      </Animated.View>

      {/* Action buttons */}
      <View style={styles.actions}>
        {/* PASS button — red circle X */}
        <TouchableOpacity
          onPress={() => swipe('left')}
          activeOpacity={0.88}
          style={[styles.actionBtn, styles.passBtn]}
        >
          <Ionicons name="close" size={28} color="#FF5050" />
        </TouchableOpacity>

        {/* DETAIL / STAR button — blue circle */}
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onOpen(current);
          }}
          activeOpacity={0.88}
          style={[styles.actionBtn, styles.starBtn]}
        >
          <Ionicons name="star" size={22} color="#5BADFF" />
        </TouchableOpacity>

        {/* LIKE button — green circle heart */}
        <TouchableOpacity
          onPress={() => swipe('right')}
          activeOpacity={0.88}
          style={[styles.actionBtn, styles.likeBtn]}
        >
          <Ionicons name="heart" size={26} color="#3ADC6E" />
        </TouchableOpacity>
      </View>

      {/* Counter */}
      <Text style={styles.counter}>{index + 1} / {properties.length}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingTop: 8 },

  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 40,
    overflow: 'hidden',
    position: 'absolute',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 28 },
    shadowOpacity: 0.5,
    shadowRadius: 36,
    elevation: 16,
  },
  nextCard: {
    position: 'relative',
    marginBottom: -CARD_H + 24,
    opacity: 0.68,
  },
  nextCardPlate: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 5, 18, 0.16)',
    zIndex: 1,
  },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  cardOverlay: { position: 'absolute', inset: 0 },

  // Swipe overlays
  swipeOverlay: {
    position: 'absolute',
    inset: 0,
    justifyContent: 'center',
  },
  passOverlay: { alignItems: 'flex-start' },
  likeOverlay: { alignItems: 'flex-end' },
  passArrowWrap: { marginLeft: 20 },
  likeArrowWrap: { marginRight: 20 },

  // Top badges
  topRow: {
    position: 'absolute',
    top: 18,
    left: 18,
    right: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(9,6,17,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    gap: 6,
  },
  matchBadgeText: { color: Colors.white, fontSize: 11, fontWeight: '800' },
  scoreBubble: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  scoreBubbleText: { fontSize: 13, fontWeight: '900', color: Colors.primary },

  // Availability badge
  availBadge: {
    position: 'absolute',
    top: 80,
    left: 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(9,6,17,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  availDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.success, marginRight: 7 },
  availText: { color: Colors.white, fontSize: 11, fontWeight: '700' },

  // Card content (bottom)
  cardContent: { position: 'absolute', left: 20, right: 20, bottom: 24 },
  cardTitle: { fontSize: 28, fontWeight: '900', color: Colors.white, letterSpacing: -0.5, marginBottom: 8 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 4 },
  locationText: { fontSize: 13, color: 'rgba(255,255,255,0.82)' },
  specRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 },
  specPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    gap: 5,
  },
  specText: { fontSize: 11, color: Colors.white, fontWeight: '700' },
  cardPrice: { fontSize: 26, fontWeight: '900', color: Colors.white },

  // Drag hint
  dragDot: {
    position: 'absolute',
    bottom: CARD_H * 0.5,
    left: '50%',
    marginLeft: -6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
  },

  // Action buttons
  actions: {
    marginTop: CARD_H + 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    width: '100%',
    paddingHorizontal: 30,
  },
  actionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
  },
  passBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderColor: '#FF5050',
    backgroundColor: 'rgba(255,80,80,0.08)',
    shadowColor: '#FF5050',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 6,
  },
  starBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderColor: '#5BADFF',
    backgroundColor: 'rgba(91,173,255,0.1)',
    shadowColor: '#5BADFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 4,
  },
  likeBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderColor: '#3ADC6E',
    backgroundColor: 'rgba(58,220,110,0.1)',
    shadowColor: '#3ADC6E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 6,
  },

  // Counter
  counter: {
    marginTop: 16,
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Empty state
  emptyContainer: { flex: 1, marginHorizontal: 8, borderRadius: 30, overflow: 'hidden' },
  emptyGradient: {
    borderRadius: 30,
    paddingHorizontal: 28,
    paddingVertical: 48,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyHeartCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
    shadowColor: Colors.accentMagenta,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  emptyTitle: { fontSize: 22, fontWeight: '900', color: Colors.textDark, textAlign: 'center', marginBottom: 10 },
  emptySubtitle: { fontSize: 14, lineHeight: 22, color: Colors.textSoft, textAlign: 'center' },
});
