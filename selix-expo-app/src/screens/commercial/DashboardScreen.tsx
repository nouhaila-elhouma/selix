import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { Appointments } from '../../lib/api';
import { Appointment } from '../../types';
import { ScoreRing, SectionHeader, GradientCard, ProgressBar } from '../../components/ui';
import {
  getTemperatureBgColor,
  getTemperatureColor,
  getTemperatureEmoji,
  getTemperatureLabel,
} from '../../utils/scoring';

const PIPELINE_ORDER = [
  { key: 'Nouveau', color: Colors.statusNew },
  { key: 'Contacte', color: Colors.statusContacted },
  { key: 'Visite', color: Colors.statusVisited },
  { key: 'Offre', color: Colors.statusOffer },
  { key: 'Signe', color: Colors.statusSigned },
  { key: 'Perdu', color: Colors.statusLost },
] as const;

const UPCOMING_STATUSES = new Set(['Planifie', 'Confirme', 'Planifiee', 'Confirmee']);

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function normalizeStatus(status?: string) {
  return (status ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function DashboardScreen() {
  const { currentUser, leads, realtimeVersion, t } = useApp();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerLift = useRef(new Animated.Value(18)).current;
  const kpiAnims = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        const response = await Appointments.list();
        if (mounted) {
          setAppointments(uniqueById(response as Appointment[]));
        }
      } catch {
        if (mounted) {
          setAppointments([]);
        }
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [realtimeVersion]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(headerLift, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();

    kpiAnims.forEach((anim) => anim.setValue(0));
    Animated.stagger(
      75,
      kpiAnims.map((anim) => Animated.timing(anim, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: false })),
    ).start();
  }, [headerFade, headerLift, kpiAnims]);

  const hotLeads = leads.filter((lead) => lead.temperature === 'hot');
  const warmLeads = leads.filter((lead) => lead.temperature === 'warm');
  const signedLeads = leads.filter((lead) => normalizeStatus(lead.status) === 'Signe');
  const matchingLeads = useMemo(
    () => leads.filter((lead) => lead.source === 'matching').sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)),
    [leads],
  );

  const pipeline = useMemo(() => {
    const counts = new Map<string, number>();
    for (const lead of leads) {
      const status = normalizeStatus(lead.status) || 'Nouveau';
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }
    return PIPELINE_ORDER.map((item) => ({
      label: item.key,
      count: counts.get(item.key) ?? 0,
      color: item.color,
    }));
  }, [leads]);

  const totalPipeline = pipeline.reduce((sum, item) => sum + item.count, 0) || 1;
  const upcoming = appointments.filter((appointment) => UPCOMING_STATUSES.has(normalizeStatus(appointment.status)));
  const nextVisit = upcoming[0];
  const reactivity = leads.length ? Math.min(98, 65 + hotLeads.length * 6 + warmLeads.length * 3) : 0;

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
            <Text style={styles.greeting}>{t('commercial.greeting')}</Text>
            <Text style={styles.userName}>{currentUser?.name?.split(' ')[0] || 'Commercial'}</Text>
          </View>
          <View style={styles.activeBadge}>
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>Actif</Text>
          </View>
        </View>

        <View style={styles.kpiRow}>
          <Animated.View style={[styles.kpiItem, { opacity: kpiAnims[0], transform: [{ translateY: kpiAnims[0].interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
            <Text style={styles.kpiValue}>{leads.length}</Text>
            <Text style={styles.kpiLabel}>Leads</Text>
          </Animated.View>
          <View style={styles.kpiDivider} />
          <Animated.View style={[styles.kpiItem, { opacity: kpiAnims[1], transform: [{ translateY: kpiAnims[1].interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
            <Text style={[styles.kpiValue, { color: Colors.danger }]}>{hotLeads.length}</Text>
            <Text style={styles.kpiLabel}>Chauds</Text>
          </Animated.View>
          <View style={styles.kpiDivider} />
          <Animated.View style={[styles.kpiItem, { opacity: kpiAnims[2], transform: [{ translateY: kpiAnims[2].interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
            <Text style={styles.kpiValue}>{reactivity}%</Text>
            <Text style={styles.kpiLabel}>Reactivite</Text>
          </Animated.View>
          <View style={styles.kpiDivider} />
          <Animated.View style={[styles.kpiItem, { opacity: kpiAnims[3], transform: [{ translateY: kpiAnims[3].interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
            <Text style={styles.kpiValue}>{signedLeads.length}</Text>
            <Text style={styles.kpiLabel}>Signes</Text>
          </Animated.View>
        </View>
      </LinearGradient>
      </Animated.View>

      <View style={styles.body}>
        {hotLeads.length > 0 && (
          <GradientCard style={{ padding: 16, marginBottom: 20 }}>
            <View style={styles.alertRow}>
              <View style={styles.alertIcon}>
                <Text style={{ fontSize: 22 }}>!</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.alertTitle}>{hotLeads.length} lead chaud a traiter</Text>
                <Text style={styles.alertSub}>Priorise une reponse rapide sur les dossiers les plus qualifies.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.white} />
            </View>
          </GradientCard>
        )}

        {matchingLeads.length > 0 && (
          <>
            <SectionHeader title="Nouveaux leads du matching" />
            <View style={styles.matchingCard}>
              <View style={styles.matchingHeader}>
                <View style={styles.matchingCount}>
                  <Text style={styles.matchingCountValue}>{matchingLeads.length}</Text>
                  <Text style={styles.matchingCountLabel}>interets clients recents</Text>
                </View>
                <View style={styles.matchingBadge}>
                  <Ionicons name="sparkles-outline" size={14} color={Colors.primary} />
                  <Text style={styles.matchingBadgeText}>Auto assigne</Text>
                </View>
              </View>

              {matchingLeads.slice(0, 3).map((lead) => (
                <View key={lead.id} style={styles.matchingLeadRow}>
                  <View style={styles.matchingLeadIcon}>
                    <Ionicons name="heart-outline" size={16} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.matchingLeadName}>{lead.clientName}</Text>
                    <Text style={styles.matchingLeadMeta} numberOfLines={2}>
                      {lead.notes.split('\n').filter(Boolean).slice(-1)[0] || 'Interet detecte sur un projet'}
                    </Text>
                  </View>
                  <View style={[styles.tempChip, { backgroundColor: getTemperatureBgColor(lead.temperature) }]}>
                    <Text style={{ fontSize: 12 }}>{getTemperatureEmoji(lead.temperature)}</Text>
                    <Text style={[styles.tempText, { color: getTemperatureColor(lead.temperature) }]}>
                      {getTemperatureLabel(lead.temperature)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        <SectionHeader title="Pipeline commercial" />
        <View style={styles.pipelineCard}>
          {pipeline.map((item) => (
            <View key={item.label} style={styles.pipelineRow}>
              <View style={[styles.pipelineDot, { backgroundColor: item.color }]} />
              <Text style={styles.pipelineLabel}>{item.label}</Text>
              <ProgressBar
                value={item.count}
                max={totalPipeline}
                color={item.color}
                height={6}
                style={{ flex: 1, marginHorizontal: 12 }}
              />
              <Text style={[styles.pipelineCount, { color: item.color }]}>{item.count}</Text>
            </View>
          ))}
        </View>

        <SectionHeader title="Leads recents" action="Voir tout" style={{ marginTop: 20 }} />
        {leads.slice(0, 4).map((lead) => (
          <View key={lead.id} style={styles.leadRow}>
            <ScoreRing score={lead.score} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={styles.leadName}>{lead.clientName}</Text>
              <Text style={styles.leadMeta}>{lead.answers.propertyType} · {lead.answers.targetZone || lead.answers.city}</Text>
              <Text style={styles.leadBudget}>{lead.answers.budget}</Text>
            </View>
            <View style={[styles.tempChip, { backgroundColor: getTemperatureBgColor(lead.temperature) }]}>
              <Text style={{ fontSize: 12 }}>{getTemperatureEmoji(lead.temperature)}</Text>
              <Text style={[styles.tempText, { color: getTemperatureColor(lead.temperature) }]}>
                {getTemperatureLabel(lead.temperature)}
              </Text>
            </View>
          </View>
        ))}

        {nextVisit && (
          <>
            <SectionHeader title="Prochaine visite" style={{ marginTop: 20 }} />
            <View style={styles.visitCard}>
              <View style={styles.visitDate}>
                <Text style={styles.visitDay}>{nextVisit.date.split('-')[2]}</Text>
                <Text style={styles.visitMonth}>
                  {new Date(nextVisit.date).toLocaleDateString('fr-FR', { month: 'short' }).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.visitProperty}>{nextVisit.propertyTitle}</Text>
                <Text style={styles.visitClient}>{nextVisit.clientName}</Text>
                <View style={styles.visitMeta}>
                  <Ionicons name="time-outline" size={12} color={Colors.textSoft} />
                  <Text style={styles.visitMetaText}>{nextVisit.time}</Text>
                  <Ionicons name="location-outline" size={12} color={Colors.textSoft} />
                  <Text style={styles.visitMetaText}>{nextVisit.city}</Text>
                </View>
              </View>
              <View
                style={[
                  styles.visitStatus,
                  {
                    backgroundColor: normalizeStatus(nextVisit.status) === 'Confirme'
                      ? Colors.successLight
                      : Colors.warningLight,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: normalizeStatus(nextVisit.status) === 'Confirme' ? Colors.success : Colors.warning,
                  }}
                >
                  {nextVisit.status}
                </Text>
              </View>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgMain },
  header: { paddingTop: 20, paddingBottom: 28, paddingHorizontal: 20, position: 'relative', overflow: 'hidden' },
  deco: { position: 'absolute', borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.07)' },
  decoA: { width: 240, height: 240, top: -80, right: -60 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting: { fontSize: 14, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  userName: { fontSize: 26, fontWeight: '800', color: Colors.white, letterSpacing: -0.3 },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(16,185,129,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)' },
  activeDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.success },
  activeText: { fontSize: 12, fontWeight: '700', color: Colors.success },
  kpiRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  kpiItem: { flex: 1, alignItems: 'center' },
  kpiValue: { fontSize: 20, fontWeight: '800', color: Colors.white },
  kpiLabel: { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  kpiDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  body: { padding: 20 },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  alertIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  alertTitle: { fontSize: 15, fontWeight: '800', color: Colors.white, marginBottom: 3 },
  alertSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  matchingCard: { backgroundColor: Colors.bgCard, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.borderSoft, gap: 12, marginBottom: 20 },
  matchingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  matchingCount: { flex: 1 },
  matchingCountValue: { fontSize: 24, fontWeight: '900', color: Colors.textDark },
  matchingCountLabel: { fontSize: 12, color: Colors.textSoft, marginTop: 2 },
  matchingBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.lavenderUltra },
  matchingBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  matchingLeadRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 4 },
  matchingLeadIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.lavenderUltra },
  matchingLeadName: { fontSize: 13, fontWeight: '800', color: Colors.textDark, marginBottom: 2 },
  matchingLeadMeta: { fontSize: 12, color: Colors.textSoft },
  pipelineCard: { backgroundColor: Colors.bgCard, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.borderSoft, gap: 12 },
  pipelineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pipelineDot: { width: 10, height: 10, borderRadius: 5 },
  pipelineLabel: { width: 72, fontSize: 12, fontWeight: '500', color: Colors.textSoft },
  pipelineCount: { fontSize: 13, fontWeight: '800', width: 24, textAlign: 'right' },
  leadRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: Colors.bgCard, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.borderSoft },
  leadName: { fontSize: 14, fontWeight: '700', color: Colors.textDark, marginBottom: 2 },
  leadMeta: { fontSize: 12, color: Colors.textSoft },
  leadBudget: { fontSize: 12, fontWeight: '600', color: Colors.primary, marginTop: 2 },
  tempChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  tempText: { fontSize: 11, fontWeight: '700' },
  visitCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.bgCard, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.borderSoft },
  visitDate: { width: 50, alignItems: 'center', backgroundColor: Colors.lavenderUltra, padding: 8, borderRadius: 12 },
  visitDay: { fontSize: 22, fontWeight: '900', color: Colors.primary },
  visitMonth: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  visitProperty: { fontSize: 14, fontWeight: '700', color: Colors.textDark, marginBottom: 2 },
  visitClient: { fontSize: 12, color: Colors.textSoft, marginBottom: 5 },
  visitMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  visitMetaText: { fontSize: 11, color: Colors.textSoft },
  visitStatus: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
});
