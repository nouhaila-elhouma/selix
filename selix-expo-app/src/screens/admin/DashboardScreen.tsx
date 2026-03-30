import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { Admin } from '../../lib/api';
import { AdminStats, PipelineStats } from '../../types';
import { SectionHeader, ScoreRing, ProgressBar, GradientCard } from '../../components/ui';
import { getTemperatureBgColor, getTemperatureEmoji } from '../../utils/scoring';
import { canAccessAdminCrm, canReadAdminReports, getAdminRoleLabel, normalizeAdminRole } from '../../utils/adminAccess';

const emptyStats: AdminStats = {
  totalLeads: 0,
  hotLeads: 0,
  signed: 0,
  conversionRate: 0,
  totalClients: 0,
  totalCommercials: 0,
  totalPromoters: 0,
  revenue: 0,
  visitsThisWeek: 0,
  newLeadsToday: 0,
  activeDeals: 0,
  pendingCommissions: 0,
};

const emptyPipeline: PipelineStats = {
  nouveau: 0,
  contacte: 0,
  visite: 0,
  offre: 0,
  signe: 0,
  perdu: 0,
};

export function DashboardScreen() {
  const { leads, realtimeVersion, currentUser, t } = useApp();
  const [stats, setStats] = useState<AdminStats>(emptyStats);
  const [pipelineStats, setPipelineStats] = useState<PipelineStats>(emptyPipeline);
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerLift = useRef(new Animated.Value(18)).current;
  const kpiAnims = useRef([0, 1, 2, 3, 4, 5].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      if (!canReadAdminReports(currentUser)) {
        setStats(emptyStats);
        setPipelineStats(emptyPipeline);
        return;
      }
      try {
        const [statsResponse, pipelineResponse] = await Promise.all([
          Admin.stats(),
          Admin.pipeline(),
        ]);
        if (!mounted) {
          return;
        }
        setStats(statsResponse as AdminStats);
        setPipelineStats(pipelineResponse as PipelineStats);
      } catch {
        if (!mounted) {
          return;
        }
        setStats(emptyStats);
        setPipelineStats(emptyPipeline);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [currentUser, realtimeVersion]);

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

  const kpiCards = [
    { label: 'Dossiers', value: String(stats.totalLeads), icon: 'people-outline', color: Colors.primary, bg: Colors.lavenderUltra },
    { label: 'Prioritaires', value: String(stats.hotLeads), icon: 'flame-outline', color: Colors.danger, bg: Colors.dangerLight },
    { label: 'Conclues', value: String(stats.signed), icon: 'checkmark-circle-outline', color: Colors.success, bg: Colors.successLight },
    { label: 'Transformation', value: `${stats.conversionRate}%`, icon: 'trending-up-outline', color: Colors.warning, bg: Colors.warningLight },
    { label: 'Clients', value: String(stats.totalClients), icon: 'person-outline', color: Colors.info, bg: Colors.infoLight },
    { label: 'Equipe', value: String(stats.totalCommercials), icon: 'briefcase-outline', color: Colors.primaryLight, bg: Colors.lavenderLight },
  ];

  const pipelineBars = [
    { label: 'Nouveau', count: pipelineStats.nouveau, color: Colors.statusNew },
    { label: 'Contacte', count: pipelineStats.contacte, color: Colors.statusContacted },
    { label: 'Visite', count: pipelineStats.visite, color: Colors.statusVisited },
    { label: 'Offre', count: pipelineStats.offre, color: Colors.statusOffer },
    { label: 'Signe', count: pipelineStats.signe, color: Colors.statusSigned },
    { label: 'Perdu', count: pipelineStats.perdu, color: Colors.statusLost },
  ];

  const pipelineTotal = Object.values(pipelineStats).reduce((sum, value) => sum + value, 0) || 1;
  const hotLeads = useMemo(
    () => (canAccessAdminCrm(currentUser) ? leads.filter((lead) => lead.temperature === 'hot') : []),
    [currentUser, leads],
  );
  const adminRole = normalizeAdminRole(currentUser?.adminRole);
  const headerLabel =
    adminRole === 'super_admin'
      ? 'Super administration'
      : adminRole === 'support_client'
        ? 'Support client'
        : adminRole === 'support_commercial'
          ? 'Support commercial'
          : adminRole === 'support_promoter'
            ? 'Support promoteur'
            : 'Intégration projet';
  const headerTitle = t('admin.dashboardTitle');
  const badgeLabel = getAdminRoleLabel(adminRole);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View style={{ opacity: headerFade, transform: [{ translateY: headerLift }] }}>
      <LinearGradient colors={Colors.gradientHero} style={styles.header}>
        <View style={[styles.deco, styles.decoA]} />
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.label}>{headerLabel}</Text>
            <Text style={styles.title}>{headerTitle}</Text>
          </View>
          <View style={styles.adminBadge}>
            <Ionicons name="shield-checkmark" size={16} color={Colors.white} />
            <Text style={styles.adminBadgeText}>{badgeLabel}</Text>
          </View>
        </View>

        <View style={styles.revenueCard}>
          <View>
            <Text style={styles.revenueLabel}>Ventes finalisees</Text>
            <Text style={styles.revenueValue}>{(stats.revenue / 1_000_000).toFixed(1)} M MAD</Text>
          </View>
          <View style={styles.growthChip}>
            <Ionicons name="wallet-outline" size={13} color={Colors.success} />
            <Text style={styles.growthText}>{stats.pendingCommissions.toLocaleString('fr-FR')} MAD en attente</Text>
          </View>
        </View>
      </LinearGradient>
      </Animated.View>

      <View style={styles.body}>
        <View style={styles.kpiGrid}>
          {kpiCards.map((item, index) => (
            <Animated.View
              key={item.label}
              style={[
                styles.kpiCard,
                {
                  opacity: kpiAnims[index] ?? 1,
                  transform: [{
                    translateY: (kpiAnims[index] ?? new Animated.Value(1)).interpolate({
                      inputRange: [0, 1],
                      outputRange: [16, 0],
                    }),
                  }],
                },
              ]}
            >
              <View style={[styles.kpiIcon, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon as any} size={18} color={item.color} />
              </View>
              <Text style={[styles.kpiValue, { color: item.color }]}>{item.value}</Text>
              <Text style={styles.kpiLabel}>{item.label}</Text>
            </Animated.View>
          ))}
        </View>

        <GradientCard style={{ padding: 16, marginBottom: 20 }}>
          <View style={styles.quickRow}>
            <QuickStat icon="calendar-outline" label="Visites en cours" value={String(stats.visitsThisWeek)} />
            <QuickStat icon="flash-outline" label="Nouveaux dossiers" value={String(stats.newLeadsToday)} />
            <QuickStat icon="document-text-outline" label="Ventes en attente" value={String(stats.activeDeals)} />
            <QuickStat icon="cash-outline" label="Versements a venir" value={`${Math.round(stats.pendingCommissions / 1000)}k`} />
          </View>
        </GradientCard>

        <SectionHeader title="Avancement des dossiers" />
        <View style={styles.pipelineCard}>
          {pipelineBars.map((item) => (
            <View key={item.label} style={styles.pipelineRow}>
              <View style={[styles.pipelineDot, { backgroundColor: item.color }]} />
              <Text style={styles.pipelineLabel}>{item.label}</Text>
              <ProgressBar value={item.count} max={pipelineTotal} color={item.color} height={6} style={{ flex: 1, marginHorizontal: 10 }} />
              <Text style={[styles.pipelineCount, { color: item.color }]}>{item.count}</Text>
            </View>
          ))}
        </View>

        {hotLeads.length > 0 && (
          <>
            <SectionHeader title="Leads chauds" style={{ marginTop: 20 }} />
            {hotLeads.slice(0, 5).map((lead) => (
              <View key={lead.id} style={styles.leadRow}>
                <ScoreRing score={lead.score} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.leadName}>{lead.clientName}</Text>
                  <Text style={styles.leadMeta}>{lead.answers.propertyType} · {lead.answers.budget}</Text>
                  <Text style={styles.leadAdvisor}>{lead.commercialName || 'Non attribue'}</Text>
                </View>
                <View style={[styles.tempBadge, { backgroundColor: getTemperatureBgColor(lead.temperature) }]}>
                  <Text style={{ fontSize: 14 }}>{getTemperatureEmoji(lead.temperature)}</Text>
                </View>
              </View>
            ))}
          </>
        )}
      </View>
    </ScrollView>
  );
}

function QuickStat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Ionicons name={icon as any} size={18} color="rgba(255,255,255,0.8)" style={{ marginBottom: 5 }} />
      <Text style={{ fontSize: 14, fontWeight: '800', color: Colors.white }}>{value}</Text>
      <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', textAlign: 'center', marginTop: 2 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgMain },
  header: { paddingTop: 20, paddingBottom: 28, paddingHorizontal: 20, position: 'relative', overflow: 'hidden' },
  deco: { position: 'absolute', borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.07)' },
  decoA: { width: 240, height: 240, top: -80, right: -60 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  label: { fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: '500', marginBottom: 2 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.white, letterSpacing: -0.3 },
  adminBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  adminBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.white },
  revenueCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  revenueLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 3 },
  revenueValue: { fontSize: 26, fontWeight: '900', color: Colors.white, letterSpacing: -0.5 },
  growthChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.successLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  growthText: { fontSize: 13, fontWeight: '800', color: Colors.success },
  body: { padding: 20 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  kpiCard: { width: '30%', flex: 1, backgroundColor: Colors.bgCard, borderRadius: 14, padding: 14, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.borderSoft },
  kpiIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontSize: 20, fontWeight: '900' },
  kpiLabel: { fontSize: 10, color: Colors.textSoft, textAlign: 'center' },
  quickRow: { flexDirection: 'row', justifyContent: 'space-around' },
  pipelineCard: { backgroundColor: Colors.bgCard, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.borderSoft, gap: 10, marginBottom: 8 },
  pipelineRow: { flexDirection: 'row', alignItems: 'center' },
  pipelineDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  pipelineLabel: { width: 68, fontSize: 12, fontWeight: '500', color: Colors.textSoft },
  pipelineCount: { fontSize: 13, fontWeight: '800', width: 28, textAlign: 'right' },
  leadRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.bgCard, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.borderSoft },
  leadName: { fontSize: 14, fontWeight: '700', color: Colors.textDark, marginBottom: 2 },
  leadMeta: { fontSize: 12, color: Colors.textSoft },
  leadAdvisor: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  tempBadge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
