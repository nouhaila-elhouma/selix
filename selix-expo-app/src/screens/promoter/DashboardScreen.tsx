import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { Promoter } from '../../lib/api';
import { PromoterSubscriptionOverview, PromoterSummary } from '../../types';
import { SectionHeader } from '../../components/ui';

const emptySummary: PromoterSummary = {
  teamSize: 0,
  projectCount: 0,
  soldUnits: 0,
  availableUnits: 0,
  teamLeads: 0,
  teamHotLeads: 0,
  totalMatches: 0,
  totalVisits: 0,
  qualifiedTransfers: 0,
  totalDeals: 0,
  signedRevenue: 0,
};

function isActiveSubscription(subscription?: PromoterSubscriptionOverview | PromoterSummary['subscription'] | null) {
  return subscription?.subscriptionStatus === 'active' && subscription?.accountStatus === 'active';
}

function formatDate(value?: string | null) {
  if (!value) return 'Non definie';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Non definie';
  return date.toLocaleDateString('fr-FR');
}

export function DashboardScreen() {
  const { currentUser, realtimeVersion, t } = useApp();
  const [summary, setSummary] = useState<PromoterSummary>(emptySummary);
  const [subscription, setSubscription] = useState<PromoterSubscriptionOverview | null>(null);
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerLift = useRef(new Animated.Value(18)).current;
  const cardAnims = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Promoter.summary().then((data) => setSummary(data as PromoterSummary)).catch(() => setSummary(emptySummary));
    Promoter.subscription().then((data) => setSubscription(data as PromoterSubscriptionOverview)).catch(() => setSubscription(null));
  }, [realtimeVersion]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(headerLift, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();

    cardAnims.forEach((anim) => anim.setValue(0));
    Animated.stagger(
      80,
      cardAnims.map((anim) => Animated.timing(anim, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: false })),
    ).start();
  }, [cardAnims, headerFade, headerLift]);

  const currentSubscription = subscription ?? summary.subscription ?? null;
  const hasActiveSubscription = isActiveSubscription(currentSubscription);
  const restrictionReason = subscription?.restrictedReason || summary.subscription?.restrictedReason || null;
  const performanceCards = [
    { label: 'Likes', value: summary.teamLeads, icon: 'heart-outline', color: Colors.accentMagenta, bg: 'rgba(216,14,140,0.12)' },
    { label: 'Matchs', value: summary.totalMatches || 0, icon: 'sparkles-outline', color: Colors.primary, bg: Colors.lavenderUltra },
    { label: 'Visites', value: summary.totalVisits || 0, icon: 'calendar-outline', color: Colors.accentOrange, bg: Colors.warningLight },
    { label: 'Leads qualifies', value: summary.qualifiedTransfers || 0, icon: 'checkmark-circle-outline', color: Colors.success, bg: Colors.successLight },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
      <Animated.View style={{ opacity: headerFade, transform: [{ translateY: headerLift }] }}>
        <LinearGradient colors={['#0F0822', '#180A30', '#1C0B38', '#0D0620']} locations={[0, 0.3, 0.65, 1]} style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>{t('promoter.space')}</Text>
              <Text style={styles.company}>{currentUser?.name || 'Promoteur'}</Text>
            </View>
            <View style={[styles.statusBadge, hasActiveSubscription ? styles.statusBadgeActive : styles.statusBadgeRestricted]}>
              <Ionicons name={hasActiveSubscription ? 'shield-checkmark-outline' : 'alert-circle-outline'} size={14} color={hasActiveSubscription ? Colors.success : Colors.warning} />
              <Text style={[styles.statusBadgeText, { color: hasActiveSubscription ? Colors.success : Colors.warning }]}>
                {hasActiveSubscription ? 'Actif' : 'Restreint'}
              </Text>
            </View>
          </View>

          <View style={styles.heroCard}>
            <View style={styles.heroMetric}>
              <Text style={styles.heroValue}>{summary.projectCount}</Text>
              <Text style={styles.heroLabel}>Projets visibles</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroMetric}>
              <Text style={styles.heroValue}>{summary.soldUnits + summary.availableUnits}</Text>
              <Text style={styles.heroLabel}>Unites suivies</Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      <View style={styles.body}>
        {!hasActiveSubscription ? (
          <View style={styles.alertCard}>
            <Ionicons name="lock-closed-outline" size={18} color={Colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>Acces metier bloque</Text>
              <Text style={styles.alertText}>
                {restrictionReason || 'Un abonnement actif est requis pour ouvrir les leads qualifies et les donnees metier avancees.'}
              </Text>
            </View>
          </View>
        ) : null}

        <SectionHeader title="Performance projet" />
        <View style={styles.grid}>
          {performanceCards.map((item, index) => (
            <Animated.View
              key={item.label}
              style={[
                styles.metricCard,
                {
                  opacity: cardAnims[index],
                  transform: [{
                    translateY: cardAnims[index].interpolate({ inputRange: [0, 1], outputRange: [14, 0] }),
                  }],
                },
              ]}
            >
              <View style={[styles.metricIcon, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon as any} size={18} color={item.color} />
              </View>
              <Text style={[styles.metricValue, { color: item.color }]}>{item.value}</Text>
              <Text style={styles.metricLabel}>{item.label}</Text>
            </Animated.View>
          ))}
        </View>

        <SectionHeader title="Abonnement" style={{ marginTop: 20 }} />
        <View style={styles.card}>
          <View style={styles.subscriptionTop}>
            <View>
              <Text style={styles.cardTitle}>{currentSubscription?.planKey ? `Plan ${currentSubscription.planKey}` : 'Aucun plan actif'}</Text>
              <Text style={styles.cardMeta}>Statut abonnement: {currentSubscription?.subscriptionStatus || 'pending'}</Text>
              <Text style={styles.cardMeta}>Statut compte: {currentSubscription?.accountStatus || 'inconnu'}</Text>
            </View>
            <View style={[styles.subscriptionChip, hasActiveSubscription ? styles.subscriptionChipActive : styles.subscriptionChipRestricted]}>
              <Text style={[styles.subscriptionChipText, { color: hasActiveSubscription ? Colors.success : Colors.warning }]}>
                {hasActiveSubscription ? 'Actif' : 'Inactif'}
              </Text>
            </View>
          </View>

          <View style={styles.datesRow}>
            <View style={styles.dateBox}>
              <Text style={styles.dateLabel}>Debut</Text>
              <Text style={styles.dateValue}>{formatDate(currentSubscription?.startsAt)}</Text>
            </View>
            <View style={styles.dateBox}>
              <Text style={styles.dateLabel}>Expiration</Text>
              <Text style={styles.dateValue}>{formatDate(currentSubscription?.endsAt)}</Text>
            </View>
          </View>

          {restrictionReason ? (
            <Text style={styles.restrictionText}>{restrictionReason}</Text>
          ) : null}
        </View>

        <SectionHeader title="Historique de paiement" style={{ marginTop: 20 }} />
        <View style={styles.card}>
          {subscription?.paymentRequests?.length ? (
            subscription.paymentRequests.map((item) => (
              <View key={item.id} style={styles.paymentRow}>
                <View style={styles.paymentIcon}>
                  <Ionicons name="receipt-outline" size={16} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.paymentTitle}>{item.planKey}</Text>
                  <Text style={styles.paymentMeta}>
                    {Number(item.amountMad || 0).toLocaleString('fr-FR')} MAD
                    {item.paymentMethod ? ` · ${item.paymentMethod}` : ''}
                  </Text>
                  <Text style={styles.paymentMeta}>Demande le {formatDate(item.requestedAt || item.createdAt)}</Text>
                </View>
                <View style={[styles.paymentStatus, item.status === 'validated' ? styles.paymentStatusOk : styles.paymentStatusPending]}>
                  <Text style={[styles.paymentStatusText, { color: item.status === 'validated' ? Colors.success : Colors.warning }]}>
                    {item.status}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Aucun paiement enregistre pour le moment.</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgMain },
  header: { paddingTop: 20, paddingBottom: 28, paddingHorizontal: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  company: { fontSize: 22, fontWeight: '800', color: Colors.white },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusBadgeActive: { backgroundColor: Colors.successLight },
  statusBadgeRestricted: { backgroundColor: Colors.warningLight },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroMetric: { flex: 1, alignItems: 'center' },
  heroValue: { fontSize: 28, fontWeight: '900', color: Colors.white },
  heroLabel: { fontSize: 11, color: 'rgba(255,255,255,0.72)', marginTop: 4 },
  heroDivider: { width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.14)' },
  body: { padding: 20 },
  alertCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    padding: 16,
    marginBottom: 20,
  },
  alertTitle: { fontSize: 14, fontWeight: '800', color: Colors.textDark, marginBottom: 4 },
  alertText: { fontSize: 12, lineHeight: 18, color: Colors.textSoft },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: {
    width: '47%',
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    padding: 16,
    alignItems: 'center',
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  metricValue: { fontSize: 24, fontWeight: '900' },
  metricLabel: { fontSize: 11, color: Colors.textSoft, marginTop: 4, textAlign: 'center' },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    padding: 16,
  },
  subscriptionTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: Colors.textDark },
  cardMeta: { fontSize: 12, color: Colors.textSoft, marginTop: 4 },
  subscriptionChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, alignSelf: 'flex-start' },
  subscriptionChipActive: { backgroundColor: Colors.successLight },
  subscriptionChipRestricted: { backgroundColor: Colors.warningLight },
  subscriptionChipText: { fontSize: 11, fontWeight: '800' },
  datesRow: { flexDirection: 'row', gap: 10 },
  dateBox: { flex: 1, backgroundColor: Colors.bgSoft, borderRadius: 12, padding: 12 },
  dateLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 3 },
  dateValue: { fontSize: 13, fontWeight: '700', color: Colors.textDark },
  restrictionText: { fontSize: 12, lineHeight: 18, color: Colors.warning, marginTop: 12 },
  paymentRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSoft,
  },
  paymentIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.lavenderUltra,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentTitle: { fontSize: 13, fontWeight: '800', color: Colors.textDark },
  paymentMeta: { fontSize: 11, color: Colors.textSoft, marginTop: 3 },
  paymentStatus: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  paymentStatusOk: { backgroundColor: Colors.successLight },
  paymentStatusPending: { backgroundColor: Colors.warningLight },
  paymentStatusText: { fontSize: 10, fontWeight: '800' },
  emptyText: { fontSize: 13, color: Colors.textSoft },
});
