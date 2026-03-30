import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { Conversations, Promoter } from '../../lib/api';
import { PromoterSubscriptionOverview, PromoterSummary, PromoterTeamMember } from '../../types';
import { SectionHeader, GradientCard } from '../../components/ui';

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

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function DashboardScreen() {
  const {
    currentUser,
    realtimeVersion,
    conversations,
    notifications,
    unreadCount,
    markNotificationRead,
    loadConversations,
    focusConversation,
    setPromoterActiveTab,
    t,
  } = useApp();
  const [summary, setSummary] = useState<PromoterSummary>(emptySummary);
  const [team, setTeam] = useState<PromoterTeamMember[]>([]);
  const [subscription, setSubscription] = useState<PromoterSubscriptionOverview | null>(null);
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerLift = useRef(new Animated.Value(18)).current;
  const kpiAnims = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Promoter.summary().then((data) => setSummary(data as PromoterSummary)).catch(() => setSummary(emptySummary));
    Promoter.team().then((items) => setTeam(uniqueById(items as PromoterTeamMember[]))).catch(() => setTeam([]));
    Promoter.subscription().then((data) => setSubscription(data as PromoterSubscriptionOverview)).catch(() => setSubscription(null));
  }, [realtimeVersion]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(headerLift, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();

    kpiAnims.forEach((anim) => anim.setValue(0));
    Animated.stagger(
      80,
      kpiAnims.map((anim) => Animated.timing(anim, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: false })),
    ).start();
  }, [headerFade, headerLift, kpiAnims]);

  const promoterNotifications = notifications.slice(0, 6);

  const handleCallCommercial = async (phone?: string) => {
    const value = String(phone || '').trim();
    if (!value) {
      Alert.alert('Contact', 'Aucun numero commercial disponible.');
      return;
    }
    const url = `tel:${value}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Contact', 'Impossible d ouvrir l application telephone.');
      return;
    }
    await Linking.openURL(url);
  };

  const handleOpenChat = async (member: PromoterTeamMember) => {
    if (!currentUser?.id) return;
    try {
      const existingConversation = conversations.find((conversation) => (
        conversation.participantIds.includes(currentUser.id) && conversation.participantIds.includes(member.id)
      ));

      let conversationId = existingConversation?.id;
      if (!conversationId) {
        const created = await Conversations.create({ participantIds: [currentUser.id, member.id] }) as { id?: string };
        conversationId = created?.id;
        await loadConversations();
      }

      if (conversationId) {
        focusConversation(conversationId);
        setPromoterActiveTab('Messages');
      }
    } catch (error: any) {
      Alert.alert('Chat', error?.message || 'Impossible d ouvrir la conversation.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
      <Animated.View style={{ opacity: headerFade, transform: [{ translateY: headerLift }] }}>
      <LinearGradient colors={Colors.gradientHero} style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>{t('promoter.space')}</Text>
            <Text style={styles.company}>{currentUser?.name || 'Promoteur'}</Text>
          </View>
          <View style={styles.badge}>
            <Ionicons name="people-outline" size={14} color={Colors.white} />
            <Text style={styles.badgeText}>{summary.teamSize} commerciaux</Text>
          </View>
        </View>

        <View style={styles.kpiRow}>
          <Animated.View style={{ flex: 1, opacity: kpiAnims[0], transform: [{ translateY: kpiAnims[0].interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
            <Kpi label="Projets" value={summary.projectCount} />
          </Animated.View>
          <Animated.View style={{ flex: 1, opacity: kpiAnims[1], transform: [{ translateY: kpiAnims[1].interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
            <Kpi label="Vendues" value={summary.soldUnits} highlight />
          </Animated.View>
          <Animated.View style={{ flex: 1, opacity: kpiAnims[2], transform: [{ translateY: kpiAnims[2].interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
            <Kpi label="Disponibles" value={summary.availableUnits} />
          </Animated.View>
        </View>
      </LinearGradient>
      </Animated.View>

      <View style={styles.body}>
        <GradientCard style={{ padding: 18, marginBottom: 20 }}>
          <View style={styles.moneyRow}>
            <Ionicons name="cash-outline" size={22} color={Colors.white} />
            <View style={{ flex: 1 }}>
              <Text style={styles.moneyLabel}>Revenus signes</Text>
              <Text style={styles.moneyValue}>{summary.signedRevenue.toLocaleString('fr-FR')} MAD</Text>
            </View>
          </View>
        </GradientCard>

        <SectionHeader title="Abonnement" />
        <View style={styles.card}>
          <View style={styles.teamHeader}>
            <View>
              <Text style={styles.teamName}>{subscription?.planKey ? `Plan ${subscription.planKey}` : 'Aucun plan actif'}</Text>
              <Text style={styles.teamMeta}>
                Statut compte: {subscription?.accountStatus || summary.subscription?.accountStatus || 'inconnu'}
              </Text>
            </View>
            <View style={[styles.hotBadge, { backgroundColor: (subscription?.subscriptionStatus || summary.subscription?.subscriptionStatus) === 'active' ? Colors.successLight : Colors.warningLight }]}>
              <Text style={[styles.hotBadgeText, { color: (subscription?.subscriptionStatus || summary.subscription?.subscriptionStatus) === 'active' ? Colors.success : Colors.warning }]}>
                {subscription?.subscriptionStatus || summary.subscription?.subscriptionStatus || 'pending'}
              </Text>
            </View>
          </View>
          <Text style={styles.teamMeta}>
            Fin: {subscription?.endsAt || summary.subscription?.endsAt ? new Date(subscription?.endsAt || summary.subscription?.endsAt || '').toLocaleDateString('fr-FR') : 'non definie'}
          </Text>
          {(subscription?.restrictedReason || summary.subscription?.restrictedReason) ? (
            <Text style={[styles.teamMeta, { color: Colors.warning, marginTop: 8 }]}>
              {subscription?.restrictedReason || summary.subscription?.restrictedReason}
            </Text>
          ) : null}
        </View>

        <SectionHeader title="Supervision commerciale" />
        <View style={styles.grid}>
          <MiniCard label="Equipe" value={summary.teamSize} />
          <MiniCard label="Leads" value={summary.teamLeads} />
          <MiniCard label="Leads chauds" value={summary.teamHotLeads} />
          <MiniCard label="Matches" value={summary.totalMatches || 0} />
          <MiniCard label="Visites" value={summary.totalVisits || 0} />
          <MiniCard label="Leads qualifies" value={summary.qualifiedTransfers || 0} />
          <MiniCard label="Dossiers" value={summary.totalDeals} />
        </View>

        <SectionHeader title="Notifications projet" style={{ marginTop: 20 }} />
        {promoterNotifications.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>Aucune notification projet pour le moment.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.notificationsHeader}>
              <Text style={styles.notificationsSubtitle}>
                {unreadCount > 0 ? `${unreadCount} nouvelle(s)` : 'Tout est à jour'}
              </Text>
            </View>
            {promoterNotifications.map((item) => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.85}
                onPress={() => !item.read && markNotificationRead(item.id)}
                style={[styles.notificationRow, !item.read && styles.notificationRowUnread]}
              >
                <View style={styles.notificationIcon}>
                  <Ionicons
                    name={item.type === 'visit' ? 'calendar-outline' : item.type === 'match' ? 'heart-outline' : item.type === 'offer' ? 'briefcase-outline' : 'notifications-outline'}
                    size={16}
                    color={Colors.primarySoft}
                  />
                </View>
                <View style={styles.notificationCopy}>
                  <View style={styles.notificationTitleRow}>
                    <Text style={styles.notificationTitle} numberOfLines={1}>{item.title}</Text>
                    {!item.read ? <View style={styles.notificationDot} /> : null}
                  </View>
                  <Text style={styles.notificationBody} numberOfLines={3}>{item.body}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <SectionHeader title="Commerciaux affectes" style={{ marginTop: 20 }} />
        {team.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>Aucun commercial affecte pour le moment.</Text>
          </View>
        ) : (
          team.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.teamHeader}>
                <View>
                  <Text style={styles.teamName}>{item.name}</Text>
                  <Text style={styles.teamMeta}>{item.email}</Text>
                </View>
                <View style={styles.hotBadge}>
                  <Text style={styles.hotBadgeText}>{item.hotLeads} chauds</Text>
                </View>
              </View>
              <View style={styles.teamStats}>
                <Stat label="Leads" value={item.totalLeads} />
                <Stat label="Visites" value={item.totalVisits || 0} />
                <Stat label="Qualifies" value={item.qualifiedTransfers || 0} />
                <Stat label="Ventes" value={item.totalDeals} />
                <Stat label="CA signe" value={`${Math.round(item.signedRevenue / 1000)}k`} />
              </View>
              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.contactBtn} onPress={() => handleCallCommercial(item.phone)}>
                  <Ionicons name="call-outline" size={16} color={Colors.primary} />
                  <Text style={styles.contactBtnText}>Contacter</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.chatBtn} onPress={() => handleOpenChat(item)}>
                  <Ionicons name="chatbubble-outline" size={16} color={Colors.success} />
                  <Text style={styles.chatBtnText}>Chat</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <View style={styles.kpiItem}>
      <Text style={[styles.kpiValue, highlight && { color: Colors.success }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function MiniCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.miniCard}>
      <Text style={styles.miniValue}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgMain },
  header: { paddingTop: 20, paddingBottom: 28, paddingHorizontal: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  company: { fontSize: 22, fontWeight: '800', color: Colors.white },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '700', color: Colors.white },
  kpiRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 16, padding: 16 },
  kpiItem: { flex: 1, alignItems: 'center' },
  kpiValue: { fontSize: 22, fontWeight: '800', color: Colors.white },
  kpiLabel: { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  body: { padding: 20 },
  moneyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  moneyLabel: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 2 },
  moneyValue: { fontSize: 20, fontWeight: '900', color: Colors.white },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  miniCard: { width: '48%', backgroundColor: Colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: Colors.borderSoft, padding: 16 },
  miniValue: { fontSize: 20, fontWeight: '900', color: Colors.primary },
  miniLabel: { fontSize: 11, color: Colors.textSoft, marginTop: 4 },
  card: { backgroundColor: Colors.bgCard, borderRadius: 16, borderWidth: 1, borderColor: Colors.borderSoft, padding: 16, marginBottom: 12 },
  emptyText: { fontSize: 13, color: Colors.textSoft },
  notificationsHeader: { marginBottom: 10 },
  notificationsSubtitle: { fontSize: 12, color: Colors.textSoft },
  notificationRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSoft,
  },
  notificationRowUnread: {
    backgroundColor: 'rgba(142,53,255,0.05)',
    marginHorizontal: -6,
    paddingHorizontal: 6,
    borderRadius: 12,
  },
  notificationIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: Colors.lavenderUltra,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  notificationCopy: { flex: 1 },
  notificationTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  notificationTitle: { flex: 1, fontSize: 13, fontWeight: '800', color: Colors.textDark },
  notificationBody: { fontSize: 12, lineHeight: 18, color: Colors.textSoft },
  notificationDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accentMagenta },
  teamHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  teamName: { fontSize: 15, fontWeight: '700', color: Colors.textDark },
  teamMeta: { fontSize: 12, color: Colors.textSoft, marginTop: 2 },
  hotBadge: { backgroundColor: Colors.dangerLight, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  hotBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.danger },
  teamStats: { flexDirection: 'row', justifyContent: 'space-between' },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  contactBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.lavenderUltra, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  contactBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  chatBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.successLight, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  chatBtnText: { fontSize: 12, fontWeight: '700', color: Colors.success },
  statValue: { fontSize: 16, fontWeight: '800', color: Colors.textDark },
  statLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
});
