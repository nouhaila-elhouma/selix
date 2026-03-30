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
const CARD_W = SCREEN_W - 30;
const CARD_H = CARD_W * 1.42;
const SWIPE_THRESHOLD = SCREEN_W * 0.24;

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
  const scale = useRef(new Animated.Value(0.96)).current;

  const current = properties[index];
  const next = properties[index + 1];

  const rotate = pan.x.interpolate({
    inputRange: [-SCREEN_W, 0, SCREEN_W],
    outputRange: ['-13deg', '0deg', '13deg'],
    extrapolate: 'clamp',
  });

  const likeOpacity = pan.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const passOpacity = pan.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const likeScale = pan.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0.72, 1.1],
    extrapolate: 'clamp',
  });

  const passScale = pan.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1.1, 0.72],
    extrapolate: 'clamp',
  });

  const nextScale = pan.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD],
    outputRange: [1, 0.97, 1],
    extrapolate: 'clamp',
  });

  const nextLift = pan.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD],
    outputRange: [0, 14, 0],
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
          Animated.spring(scale, { toValue: 0.96, useNativeDriver: false, friction: 7 }),
        ]).start();
      }
    },
  });

  const swipe = (dir: 'left' | 'right') => {
    Haptics.impactAsync(
      dir === 'right' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
    ).catch(() => {});

    const targetX = dir === 'right' ? SCREEN_W * 1.5 : -SCREEN_W * 1.5;
    Animated.timing(pan, {
      toValue: { x: targetX, y: 0 },
      duration: 250,
      useNativeDriver: false,
    }).start(() => {
      if (current) {
        if (dir === 'right') onLike(current);
        else onPass(current);
      }
      pan.setValue({ x: 0, y: 0 });
      scale.setValue(0.96);
      const nextIndex = index + 1;
      if (nextIndex >= properties.length) onEmpty?.();
      setIndex(nextIndex);
    });
  };

  if (index >= properties.length) {
    return (
      <View style={styles.emptyContainer}>
        <LinearGradient colors={Colors.gradientCard} style={styles.emptyGradient}>
          <View style={styles.emptyHeartShell}>
            <LinearGradient colors={Colors.gradientCta} style={styles.emptyHeart}>
              <Ionicons name="heart" size={34} color={Colors.white} />
            </LinearGradient>
          </View>
          <Text style={styles.emptyTitle}>Tous vos matchs ont ete explores</Text>
          <Text style={styles.emptySubtitle}>
            Revenez bientot pour de nouvelles opportunites selectionnees selon votre profil.
          </Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {next ? (
        <Animated.View
          style={[
            styles.card,
            styles.nextCard,
            {
              transform: [
                { scale: nextScale },
                { translateY: nextLift },
              ],
            },
          ]}
        >
          <Image source={{ uri: next.image }} style={styles.cardImage} />
          <LinearGradient colors={Colors.gradientDark} style={styles.cardOverlay} />
        </Animated.View>
      ) : null}

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

        <Animated.View style={[styles.reactionBubble, styles.reactionLike, { opacity: likeOpacity, transform: [{ scale: likeScale }] }]}>
          <LinearGradient colors={Colors.gradientCta} style={styles.reactionIcon}>
            <Ionicons name="heart" size={36} color={Colors.white} />
          </LinearGradient>
          <Text style={styles.reactionLabel}>LIKE</Text>
        </Animated.View>

        <Animated.View style={[styles.reactionBubble, styles.reactionPass, { opacity: passOpacity, transform: [{ scale: passScale }] }]}>
          <View style={styles.reactionIconGhost}>
            <Ionicons name="close" size={34} color={Colors.white} />
          </View>
          <Text style={styles.reactionLabel}>PASS</Text>
        </Animated.View>

        <View style={styles.badgeRow}>
          <View style={styles.matchBadge}>
            <Ionicons name="sparkles" size={12} color={Colors.primarySoft} />
            <Text style={styles.matchBadgeText}>{current.badge}</Text>
          </View>
          <View style={styles.scoreBubble}>
            <Text style={styles.scoreBubbleText}>{current.score}</Text>
          </View>
        </View>

        <View style={styles.availabilityBadge}>
          <View style={styles.availabilityDot} />
          <Text style={styles.availabilityText}>{current.availability}</Text>
        </View>

        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={2}>{current.title}</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={13} color={Colors.primarySoft} />
            <Text style={styles.locationText}>{current.district}, {current.city}</Text>
          </View>
          <View style={styles.specRow}>
            {current.areaRaw > 0 ? (
              <View style={styles.specPill}>
                <Ionicons name="resize-outline" size={11} color={Colors.white} />
                <Text style={styles.specPillText}>{current.area}</Text>
              </View>
            ) : null}
            {current.rooms > 0 ? (
              <View style={styles.specPill}>
                <Ionicons name="bed-outline" size={11} color={Colors.white} />
                <Text style={styles.specPillText}>{current.rooms} pieces</Text>
              </View>
            ) : null}
            <View style={styles.specPill}>
              <Ionicons name="calendar-outline" size={11} color={Colors.white} />
              <Text style={styles.specPillText}>{current.delivery}</Text>
            </View>
          </View>
          <Text style={styles.cardPrice}>{current.price}</Text>
          <Text style={styles.cardMonthly}>{current.monthlyEstimate}</Text>
        </View>
      </Animated.View>

      <View style={styles.actions}>
        <TouchableOpacity onPress={() => swipe('left')} style={[styles.actionBtn, styles.passBtn]}>
          <Ionicons name="close" size={26} color={Colors.white} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onOpen(current);
          }}
          style={styles.detailBtn}
        >
          <LinearGradient colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.06)']} style={styles.detailBtnGradient}>
            <Ionicons name="information-circle-outline" size={22} color={Colors.white} />
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => swipe('right')} style={[styles.actionBtn, styles.likeBtn]}>
          <LinearGradient colors={Colors.gradientCta} style={styles.likeBtnGradient}>
            <Ionicons name="heart" size={26} color={Colors.white} />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <Text style={styles.counter}>{index + 1} / {properties.length}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingTop: 10 },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 32,
    overflow: 'hidden',
    position: 'absolute',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.34,
    shadowRadius: 32,
    elevation: 12,
  },
  nextCard: {
    position: 'relative',
    marginBottom: -CARD_H + 28,
    opacity: 0.72,
  },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  cardOverlay: { position: 'absolute', inset: 0 },
  badgeRow: {
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
    backgroundColor: 'rgba(9,6,17,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  matchBadgeText: { color: Colors.white, fontSize: 12, fontWeight: '800', marginLeft: 6 },
  scoreBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  scoreBubbleText: { fontSize: 13, fontWeight: '900', color: Colors.primary },
  availabilityBadge: {
    position: 'absolute',
    top: 76,
    left: 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(9,6,17,0.52)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
  },
  availabilityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.success,
    marginRight: 7,
  },
  availabilityText: { color: Colors.white, fontSize: 11, fontWeight: '800' },
  cardContent: { position: 'absolute', left: 20, right: 20, bottom: 22 },
  cardTitle: { fontSize: 30, fontWeight: '900', color: Colors.white, letterSpacing: -0.6 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  locationText: { fontSize: 13, color: 'rgba(255,255,255,0.82)', marginLeft: 4 },
  specRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14, marginBottom: 14 },
  specPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
  },
  specPillText: { fontSize: 11, color: Colors.white, fontWeight: '700', marginLeft: 5 },
  cardPrice: { fontSize: 28, fontWeight: '900', color: Colors.white },
  cardMonthly: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  reactionBubble: {
    position: 'absolute',
    top: CARD_H * 0.32,
    zIndex: 10,
    alignItems: 'center',
  },
  reactionLike: { right: 24 },
  reactionPass: { left: 24 },
  reactionIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8E35FF',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.34,
    shadowRadius: 24,
    elevation: 8,
  },
  reactionIconGhost: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(9,6,17,0.55)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  reactionLabel: { marginTop: 10, color: Colors.white, fontSize: 12, fontWeight: '900', letterSpacing: 1.8 },

  actions: {
    marginTop: CARD_H + 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    width: '100%',
    paddingHorizontal: 20,
  },
  actionBtn: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 6,
  },
  passBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  likeBtn: {
    overflow: 'hidden',
  },
  likeBtnGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailBtn: {
    width: 78,
    height: 78,
    borderRadius: 39,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  detailBtnGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  counter: { marginTop: 14, fontSize: 12, color: Colors.textMuted, fontWeight: '700' },

  emptyContainer: { flex: 1, marginHorizontal: 6, borderRadius: 30, overflow: 'hidden' },
  emptyGradient: {
    borderRadius: 30,
    paddingHorizontal: 28,
    paddingVertical: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyHeartShell: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyHeart: {
    width: 86,
    height: 86,
    borderRadius: 43,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 22, fontWeight: '900', color: Colors.textDark, textAlign: 'center', marginBottom: 10 },
  emptySubtitle: { fontSize: 14, lineHeight: 22, color: Colors.textSoft, textAlign: 'center' },
});
