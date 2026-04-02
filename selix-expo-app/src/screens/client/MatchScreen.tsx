import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated, Easing, Image, Modal, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { SwipeDeck } from '../../components/SwipeDeck';
import { Property } from '../../types';

export function MatchScreen() {
  const {
    matchedProperties,
    ignoredProperties,
    likedProperties,
    matchingBlockedReason,
    registerSwipe,
    toggleFavorite,
    isFavorite,
    likedIds,
    contactCommercialForProperty,
    t,
  } = useApp();
  const [selected, setSelected] = useState<Property | null>(null);
  const [contacting, setContacting] = useState(false);
  const [view, setView] = useState<'feed' | 'matched' | 'passed'>('feed');
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerLift = useRef(new Animated.Value(16)).current;
  const deckFade = useRef(new Animated.Value(0)).current;
  const deckScale = useRef(new Animated.Value(0.97)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  const actualMatches = matchedProperties.filter((property) => !!property?.id && property.score > 0);
  const remaining = actualMatches.filter((property) => !likedIds.includes(property.id));
  const matchedList = likedProperties.filter((property) => !!property?.id);
  const passedList = ignoredProperties.filter((property) => !!property?.id);

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(headerFade, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.timing(headerLift, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      ]),
      Animated.parallel([
        Animated.timing(deckFade, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.spring(deckScale, { toValue: 1, friction: 9, tension: 65, useNativeDriver: false }),
      ]),
    ]).start();
  }, [deckFade, deckScale, headerFade, headerLift]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]),
    ).start();
  }, [pulseAnim]);

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05],
  });

  const handleContactCommercial = async () => {
    if (!selected) return;

    try {
      Haptics.selectionAsync().catch(() => {});
      setContacting(true);
      await contactCommercialForProperty(selected);
      setSelected(null);
    } catch (error: any) {
      Alert.alert(t('messages.title'), error?.message || 'Impossible de contacter le commercial.');
    } finally {
      setContacting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity: headerFade, transform: [{ translateY: headerLift }] }}>
        <View style={styles.header}>
          {/* Background gradient */}
          <LinearGradient
            colors={['#120A28', '#1A0A35', '#0D0620']}
            style={StyleSheet.absoluteFillObject}
          />
          {/* Ambient orbs */}
          <View style={[styles.deco, styles.decoA]} />
          <View style={[styles.deco, styles.decoB]} />

          {/* Header content */}
          <View style={styles.headerInner}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Swipe to like</Text>
              <Text style={styles.headerSub}>Un commercial vas vous contacter</Text>
            </View>
            <Animated.View style={[
              styles.counterChip,
              { transform: [{ scale: likedIds.length > 0 ? pulseScale : 1 }] },
            ]}>
              <Ionicons name="heart" size={13} color="#3ADC6E" />
              <Text style={styles.counterText}>{likedIds.length}</Text>
            </Animated.View>
          </View>
        </View>
      </Animated.View>

      <View style={styles.switcher}>
        {[
          { key: 'feed', label: t('match.feed'), icon: 'layers-outline' },
          { key: 'matched', label: t('match.matched'), icon: 'heart-outline' },
          { key: 'passed', label: t('match.passed'), icon: 'play-forward-outline' },
        ].map((item) => (
          <TouchableOpacity
            key={item.key}
            onPress={() => setView(item.key as 'feed' | 'matched' | 'passed')}
            style={[styles.switchChip, view === item.key && styles.switchChipActive]}
          >
            <Ionicons
              name={item.icon as any}
              size={14}
              color={view === item.key ? Colors.white : Colors.textMuted}
            />
            <Text style={[styles.switchChipText, view === item.key && styles.switchChipTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {matchingBlockedReason && view === 'feed' ? (
        <Animated.View style={[styles.emptyContainer, { opacity: deckFade, transform: [{ scale: deckScale }] }]}>
          <View style={styles.emptyIcon}>
            <Ionicons name="shield-checkmark-outline" size={46} color={Colors.lavender} />
          </View>
          <Text style={styles.emptyTitle}>{t('match.validationRequired')}</Text>
          <Text style={styles.emptySub}>{matchingBlockedReason}</Text>
        </Animated.View>
      ) : view === 'feed' && actualMatches.length === 0 ? (
        <Animated.View style={[styles.emptyContainer, { opacity: deckFade, transform: [{ scale: deckScale }] }]}>
          <View style={styles.emptyIcon}>
            <Ionicons name="search-outline" size={48} color={Colors.lavender} />
          </View>
          <Text style={styles.emptyTitle}>{t('match.noAvailable')}</Text>
          <Text style={styles.emptySub}>{t('match.noAvailableSub')}</Text>
        </Animated.View>
      ) : view === 'feed' ? (
        <Animated.ScrollView
          contentContainerStyle={styles.deckContainer}
          showsVerticalScrollIndicator={false}
          style={{ opacity: deckFade, transform: [{ scale: deckScale }] }}
        >
          <SwipeDeck
            properties={remaining}
            onLike={(p) => { toggleFavorite(p); void registerSwipe(p.id, true); }}
            onPass={(p) => { void registerSwipe(p.id, false); }}
            onOpen={(p) => setSelected(p)}
          />
        </Animated.ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {(view === 'matched' ? matchedList : passedList).map((property) => (
            <TouchableOpacity key={property.id} style={styles.listCard} activeOpacity={0.85} onPress={() => setSelected(property)}>
              <Image source={{ uri: property.image }} style={styles.listImage} />
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle}>{property.title}</Text>
                <Text style={styles.listMeta}>{property.district}, {property.city}</Text>
                <Text style={styles.listPrice}>{property.price}</Text>
              </View>
              <Ionicons
                name={view === 'matched' ? 'heart' : 'play-forward-outline'}
                size={20}
                color={view === 'matched' ? Colors.danger : Colors.textMuted}
              />
            </TouchableOpacity>
          ))}
          {(view === 'matched' ? matchedList : passedList).length === 0 ? (
            <View style={styles.emptyListCard}>
              <Text style={styles.emptySub}>{view === 'matched' ? t('match.noneMatched') : t('match.nonePassed')}</Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet">
        {selected && (
          <View style={styles.modal}>
            <View style={styles.modalImageContainer}>
              <Image source={{ uri: selected.image }} style={styles.modalImage} />
              <LinearGradient colors={Colors.gradientDark} style={styles.modalImageOverlay} />
              <TouchableOpacity onPress={() => setSelected(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={Colors.white} />
              </TouchableOpacity>
              <View style={styles.modalBadgeRow}>
                <View style={styles.modalMatchBadge}>
                  <Ionicons name="sparkles" size={12} color={Colors.primary} />
                  <Text style={styles.modalMatchText}>{selected.badge}</Text>
                </View>
                <View style={styles.modalScore}>
                  <Text style={styles.modalScoreText}>{selected.score}</Text>
                </View>
              </View>
              <View style={styles.modalImageInfo}>
                <Text style={styles.modalTitle}>{selected.title}</Text>
                <View style={styles.modalLocation}>
                  <Ionicons name="location-outline" size={13} color={Colors.lavender} />
                  <Text style={styles.modalLocationText}>{selected.district}, {selected.city}</Text>
                </View>
              </View>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.priceRow}>
                <View>
                  <Text style={styles.modalPrice}>{selected.price}</Text>
                  <Text style={styles.modalMonthly}>{selected.monthlyEstimate}</Text>
                </View>
                <View style={[styles.availBadge, {
                  backgroundColor: selected.availability === 'Disponible' ? Colors.successLight : Colors.warningLight,
                }]}>
                  <Text style={{
                    fontSize: 12, fontWeight: '700',
                    color: selected.availability === 'Disponible' ? Colors.success : Colors.warning,
                  }}>
                    {selected.availability}
                  </Text>
                </View>
              </View>

              <View style={styles.specsRow}>
                {selected.areaRaw > 0 && (
                  <View style={styles.specChip}>
                    <Ionicons name="resize-outline" size={14} color={Colors.primary} />
                    <Text style={styles.specText}>{selected.area}</Text>
                  </View>
                )}
                {selected.rooms > 0 && (
                  <View style={styles.specChip}>
                    <Ionicons name="bed-outline" size={14} color={Colors.primary} />
                    <Text style={styles.specText}>{selected.rooms} pieces</Text>
                  </View>
                )}
                {selected.floor != null && (
                  <View style={styles.specChip}>
                    <Ionicons name="layers-outline" size={14} color={Colors.primary} />
                    <Text style={styles.specText}>{selected.floor === 0 ? 'RDC' : `Etage ${selected.floor}`}</Text>
                  </View>
                )}
                <View style={styles.specChip}>
                  <Ionicons name="calendar-outline" size={14} color={Colors.primary} />
                  <Text style={styles.specText}>{selected.delivery}</Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>{t('match.description')}</Text>
              <Text style={styles.description}>{selected.description}</Text>

              <Text style={styles.sectionTitle}>{t('match.highlights')}</Text>
              <View style={styles.highlightsRow}>
                {selected.highlights.map((h, i) => (
                  <View key={i} style={styles.highlightChip}>
                    <Ionicons name="checkmark-circle" size={14} color={Colors.primary} />
                    <Text style={styles.highlightText}>{h}</Text>
                  </View>
                ))}
              </View>

              {selected.options.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>{t('match.options')}</Text>
                  {selected.options.map((o) => (
                    <View key={o.id} style={[styles.optionRow, !o.available && styles.optionDisabled]}>
                      <View style={styles.optionDot}>
                        <Ionicons name={o.available ? 'checkmark' : 'close'} size={12} color={o.available ? Colors.success : Colors.textMuted} />
                      </View>
                      <Text style={styles.optionLabel}>{o.label}</Text>
                      <Text style={styles.optionPrice}>{o.price}</Text>
                    </View>
                  ))}
                </>
              )}

              {selected.investment && (
                <>
                  <Text style={styles.sectionTitle}>{t('match.investment')}</Text>
                  <View style={styles.investRow}>
                    <View style={styles.investItem}>
                      <Text style={styles.investValue}>{selected.investment.rentalYield}</Text>
                      <Text style={styles.investLabel}>{t('match.yield')}</Text>
                    </View>
                    <View style={styles.investItem}>
                      <Text style={styles.investValue}>{selected.investment.occupancyRate}</Text>
                      <Text style={styles.investLabel}>{t('match.occupancy')}</Text>
                    </View>
                    <View style={styles.investItem}>
                      <Text style={styles.investValue}>{selected.investment.furnished ? 'Oui' : 'Non'}</Text>
                      <Text style={styles.investLabel}>{t('match.furnished')}</Text>
                    </View>
                  </View>
                </>
              )}

              <View style={{ height: 20 }} />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={() => toggleFavorite(selected)}
                style={[styles.footerBtn, isFavorite(selected.id) && styles.footerBtnActive]}
              >
                <Ionicons name={isFavorite(selected.id) ? 'heart' : 'heart-outline'} size={20} color={isFavorite(selected.id) ? Colors.danger : Colors.textSoft} />
                <Text style={[styles.footerBtnText, isFavorite(selected.id) && { color: Colors.danger }]}>
                  {isFavorite(selected.id) ? t('match.saved') : t('match.save')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.footerBtnPrimary} onPress={handleContactCommercial} disabled={contacting}>
                <LinearGradient colors={Colors.gradientPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.footerBtnGradient}>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={Colors.white} />
                  <Text style={styles.footerBtnPrimaryText}>{contacting ? t('match.opening') : t('match.contactCommercial')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgMain },
  header: {
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  deco: { position: 'absolute', borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.06)' },
  decoA: { width: 220, height: 220, top: -70, right: -70 },
  decoB: { width: 140, height: 140, bottom: -40, left: -30, backgroundColor: 'rgba(227,22,140,0.1)' },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flex: 1 },
  headerTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: Colors.accentMagenta,
    letterSpacing: -0.4,
  },
  headerSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.72)',
    marginTop: 4,
    fontWeight: '500',
  },
  counterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(58,220,110,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(58,220,110,0.3)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  counterText: { fontSize: 14, fontWeight: '800', color: '#3ADC6E' },
  switcher: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  switchChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  switchChipActive: {
    backgroundColor: 'rgba(142,53,255,0.2)',
    borderColor: Colors.primary,
  },
  switchChipText: { fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  switchChipTextActive: { color: Colors.white },
  deckContainer: { paddingTop: 16, paddingBottom: 60 },
  listContent: { paddingHorizontal: 16, paddingBottom: 120, gap: 12 },
  listCard: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: Colors.bgCard, borderRadius: 18, padding: 12, borderWidth: 1, borderColor: Colors.borderSoft },
  listImage: { width: 86, height: 86, borderRadius: 14 },
  listTitle: { fontSize: 15, fontWeight: '800', color: Colors.textDark, marginBottom: 4 },
  listMeta: { fontSize: 12, color: Colors.textSoft, marginBottom: 6 },
  listPrice: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  emptyListCard: { backgroundColor: Colors.bgCard, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: Colors.borderSoft },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 },
  emptyIcon: { width: 96, height: 96, borderRadius: 28, backgroundColor: Colors.lavenderUltra, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.textDark, textAlign: 'center' },
  emptySub: { fontSize: 14, color: Colors.textSoft, textAlign: 'center', lineHeight: 21 },
  modal: { flex: 1, backgroundColor: Colors.bgMain },
  modalImageContainer: { height: 280, position: 'relative' },
  modalImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  modalImageOverlay: { position: 'absolute', inset: 0 },
  closeBtn: {
    position: 'absolute', top: 16, right: 16,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  modalBadgeRow: { position: 'absolute', top: 16, left: 16, flexDirection: 'row', gap: 8 },
  modalMatchBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.lavenderLight,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20,
  },
  modalMatchText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  modalScore: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.primary,
  },
  modalScoreText: { fontSize: 11, fontWeight: '900', color: Colors.primary },
  modalImageInfo: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: Colors.white, letterSpacing: -0.3, marginBottom: 4 },
  modalLocation: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  modalLocationText: { fontSize: 13, color: 'rgba(255,255,255,0.82)' },
  modalContent: { flex: 1, padding: 20 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  modalPrice: { fontSize: 24, fontWeight: '900', color: Colors.textDark },
  modalMonthly: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  availBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  specsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  specChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.lavenderUltra,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20,
  },
  specText: { fontSize: 12, fontWeight: '600', color: Colors.textDark },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.textDark, marginBottom: 10, marginTop: 4 },
  description: { fontSize: 14, color: Colors.textSoft, lineHeight: 22, marginBottom: 20 },
  highlightsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  highlightChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.bgSoft,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.borderSoft,
  },
  highlightText: { fontSize: 12, color: Colors.textBody, fontWeight: '500' },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderSoft,
  },
  optionDisabled: { opacity: 0.4 },
  optionDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.bgSoft, alignItems: 'center', justifyContent: 'center' },
  optionLabel: { flex: 1, fontSize: 14, color: Colors.textDark, fontWeight: '500' },
  optionPrice: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  investRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  investItem: { flex: 1, backgroundColor: Colors.lavenderUltra, borderRadius: 12, padding: 14, alignItems: 'center' },
  investValue: { fontSize: 18, fontWeight: '800', color: Colors.primary },
  investLabel: { fontSize: 11, color: Colors.textSoft, marginTop: 2 },
  modalFooter: {
    flexDirection: 'row', gap: 12,
    padding: 20, paddingBottom: 36,
    backgroundColor: Colors.bgCard,
    borderTopWidth: 1, borderTopColor: Colors.borderSoft,
  },
  footerBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  footerBtnActive: { borderColor: Colors.danger, backgroundColor: Colors.dangerLight },
  footerBtnText: { fontSize: 13, fontWeight: '600', color: Colors.textSoft },
  footerBtnPrimary: { flex: 2, borderRadius: 14, overflow: 'hidden' },
  footerBtnGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
  footerBtnPrimaryText: { fontSize: 14, fontWeight: '700', color: Colors.white },
});
