import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { Admin } from '../../lib/api';
import { AdminStats, Commission, PipelineStats } from '../../types';
import { SectionHeader, ProgressBar } from '../../components/ui';
import { canReadAdminReports } from '../../utils/adminAccess';

const PERIODS = ['7j', '30j', '3m', '12m'] as const;
type Period = typeof PERIODS[number];

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

function uniqueById<T extends { id: string }>(items: T[]): T[] {
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

export function ReportsScreen() {
  const { leads, realtimeVersion, currentUser, t } = useApp();
  const [period, setPeriod] = useState<Period>('30j');
  const [stats, setStats] = useState<AdminStats>(emptyStats);
  const [pipeline, setPipeline] = useState<PipelineStats>(emptyPipeline);
  const [commissions, setCommissions] = useState<Commission[]>([]);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      if (!canReadAdminReports(currentUser)) {
        setStats(emptyStats);
        setPipeline(emptyPipeline);
        setCommissions([]);
        return;
      }
      try {
        const [statsResponse, pipelineResponse, commissionResponse] = await Promise.all([
          Admin.stats(),
          Admin.pipeline(),
          Admin.commissions(),
        ]);
        if (!mounted) {
          return;
        }
        setStats(statsResponse as AdminStats);
        setPipeline(pipelineResponse as PipelineStats);
        setCommissions(uniqueById(((commissionResponse as { items?: Commission[] }).items ?? []) as Commission[]));
      } catch {
        if (!mounted) {
          return;
        }
        setStats(emptyStats);
        setPipeline(emptyPipeline);
        setCommissions([]);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [currentUser, realtimeVersion]);

  const totalComm = commissions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const paidComm = commissions
    .filter((item) => normalizeStatus(item.status) === 'Payee')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const hotCount = leads.filter((lead) => lead.temperature === 'hot').length;
  const warmCount = leads.filter((lead) => lead.temperature === 'warm').length;
  const coldCount = leads.filter((lead) => lead.temperature === 'cold').length;
  const pipelineRows = [
    { label: 'Nouveau', count: pipeline.nouveau, color: Colors.statusNew },
    { label: 'Contacte', count: pipeline.contacte, color: Colors.statusContacted },
    { label: 'Visite', count: pipeline.visite, color: Colors.statusVisited },
    { label: 'Offre', count: pipeline.offre, color: Colors.statusOffer },
    { label: 'Signe', count: pipeline.signe, color: Colors.statusSigned },
    { label: 'Perdu', count: pipeline.perdu, color: Colors.statusLost },
  ];
  const pipelineTotal = Object.values(pipeline).reduce((sum, value) => sum + value, 0) || 1;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient colors={Colors.gradientHero} style={styles.header}>
        <View style={[styles.deco, styles.decoA]} />
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.label}>Administration</Text>
            <Text style={styles.title}>{t('reports.title')}</Text>
          </View>
          <View style={styles.exportBtn}>
            <Ionicons name="download-outline" size={16} color={Colors.white} />
            <Text style={styles.exportText}>Export</Text>
          </View>
        </View>

        <View style={styles.periodRow}>
          {PERIODS.map((item) => (
            <TouchableOpacity
              key={item}
              onPress={() => setPeriod(item)}
              style={[styles.periodChip, period === item && styles.periodChipActive]}
            >
              <Text style={[styles.periodText, period === item && styles.periodTextActive]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.revenueCard}>
          <View style={styles.revenueLeft}>
            <Text style={styles.revenueLabel}>Ventes finalisees</Text>
            <Text style={styles.revenueValue}>{(stats.revenue / 1_000_000).toFixed(1)} M MAD</Text>
            <View style={styles.growthRow}>
              <Ionicons name="wallet-outline" size={13} color={Colors.success} />
              <Text style={styles.growthText}>{stats.pendingCommissions.toLocaleString('fr-FR')} MAD en attente de versement</Text>
            </View>
          </View>
          <View style={styles.revenueRight}>
            <View style={styles.revenueRing}>
              <Ionicons name="bar-chart-outline" size={28} color={Colors.primary} />
            </View>
          </View>
        </View>

        <View style={styles.kpiRow}>
          <KpiBox label="Transformation" value={`${stats.conversionRate}%`} icon="trending-up-outline" color={Colors.success} bg={Colors.successLight} />
          <KpiBox label="Nouveaux dossiers" value={String(stats.newLeadsToday)} icon="flash-outline" color={Colors.warning} bg={Colors.warningLight} />
          <KpiBox label="Ventes en attente" value={String(stats.activeDeals)} icon="document-text-outline" color={Colors.primary} bg={Colors.lavenderUltra} />
        </View>

        <SectionHeader title="Repartition des dossiers" />
        <View style={styles.card}>
          <TempRow label="Chauds" count={hotCount} total={leads.length || 1} color={Colors.danger} bg={Colors.dangerLight} />
          <TempRow label="Tiedes" count={warmCount} total={leads.length || 1} color={Colors.warning} bg={Colors.warningLight} />
          <TempRow label="Froids" count={coldCount} total={leads.length || 1} color={Colors.info} bg={Colors.infoLight} />
          <View style={styles.tempFooter}>
            <Text style={styles.tempTotal}>Total: {leads.length} dossiers suivis</Text>
          </View>
        </View>

        <SectionHeader title="Parcours de traitement" style={{ marginTop: 20 }} />
        <View style={styles.card}>
          {pipelineRows.map((row) => (
            <View key={row.label} style={styles.pipelineRow}>
              <View style={[styles.pipelineDot, { backgroundColor: row.color }]} />
              <Text style={styles.pipelineLabel}>{row.label}</Text>
              <ProgressBar value={row.count} max={pipelineTotal} color={row.color} height={6} style={{ flex: 1, marginHorizontal: 10 }} />
              <Text style={[styles.pipelineCount, { color: row.color }]}>{row.count}</Text>
              <Text style={styles.pipelinePct}>{Math.round((row.count / pipelineTotal) * 100)}%</Text>
            </View>
          ))}
        </View>

        <SectionHeader title="Commissions" style={{ marginTop: 20 }} />
        <View style={styles.card}>
          <View style={styles.commHeader}>
            <View>
              <Text style={styles.commTitle}>Total genere</Text>
              <Text style={styles.commValue}>{totalComm.toLocaleString('fr-FR')} MAD</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.commTitle}>Paye</Text>
              <Text style={[styles.commValue, { color: Colors.success }]}>{paidComm.toLocaleString('fr-FR')} MAD</Text>
            </View>
          </View>
          <ProgressBar value={paidComm} max={totalComm || 1} height={7} style={{ marginTop: 12, marginBottom: 8 }} />
          <Text style={styles.commSub}>
            {totalComm ? Math.round((paidComm / totalComm) * 100) : 0}% des commissions versees
          </Text>

          {commissions.map((item) => (
            <View key={item.id} style={styles.commRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.commProp} numberOfLines={1}>{item.propertyTitle}</Text>
                <Text style={styles.commMeta}>{item.rate}% · {item.dueDate}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.commAmount}>{Number(item.amount || 0).toLocaleString('fr-FR')} MAD</Text>
                <View style={[styles.commStatus, { backgroundColor: getCommBg(item.status) }]}>
                  <Text style={[styles.commStatusText, { color: getCommColor(item.status) }]}>{item.status}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <SectionHeader title="Points de suivi" style={{ marginTop: 20 }} />
        <View style={styles.metricsGrid}>
          <MetricCard icon="calendar-outline" label="Visites en cours" value={String(stats.visitsThisWeek)} color={Colors.primary} />
          <MetricCard icon="cash-outline" label="Versements a venir" value={`${Math.round(stats.pendingCommissions / 1000)}k`} color={Colors.warning} />
          <MetricCard icon="people-outline" label="Equipe terrain" value={String(stats.totalCommercials)} color={Colors.info} />
          <MetricCard icon="person-outline" label="Clients suivis" value={String(stats.totalClients)} color={Colors.success} />
        </View>
      </View>
    </ScrollView>
  );
}

function KpiBox({ label, value, icon, color, bg }: { label: string; value: string; icon: string; color: string; bg: string }) {
  return (
    <View style={[styles.kpiBox, { backgroundColor: bg }]}>
      <Ionicons name={icon as any} size={18} color={color} />
      <Text style={[styles.kpiBoxValue, { color }]}>{value}</Text>
      <Text style={styles.kpiBoxLabel}>{label}</Text>
    </View>
  );
}

function TempRow({ label, count, total, color, bg }: { label: string; count: number; total: number; color: string; bg: string }) {
  const pct = Math.round((count / total) * 100);
  return (
    <View style={styles.tempRow}>
      <Text style={styles.tempLabel}>{label}</Text>
      <ProgressBar value={count} max={total} color={color} height={6} style={{ flex: 1, marginHorizontal: 10 }} />
      <View style={[styles.tempBadge, { backgroundColor: bg }]}>
        <Text style={[styles.tempBadgeText, { color }]}>{count} ({pct}%)</Text>
      </View>
    </View>
  );
}

function MetricCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: Colors.lavenderUltra }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function getCommBg(status: string): string {
  switch (normalizeStatus(status)) {
    case 'Payee':
      return Colors.successLight;
    case 'En attente':
      return Colors.warningLight;
    case 'Disputee':
      return Colors.dangerLight;
    default:
      return Colors.bgSoft;
  }
}

function getCommColor(status: string): string {
  switch (normalizeStatus(status)) {
    case 'Payee':
      return Colors.success;
    case 'En attente':
      return Colors.warning;
    case 'Disputee':
      return Colors.danger;
    default:
      return Colors.textSoft;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgMain },
  header: { paddingTop: 20, paddingBottom: 28, paddingHorizontal: 20, position: 'relative', overflow: 'hidden' },
  deco: { position: 'absolute', borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.07)' },
  decoA: { width: 240, height: 240, top: -80, right: -60 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  label: { fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: '500', marginBottom: 2 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.white, letterSpacing: -0.3 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  exportText: { fontSize: 12, fontWeight: '700', color: Colors.white },
  periodRow: { flexDirection: 'row', gap: 8 },
  periodChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  periodChipActive: { backgroundColor: Colors.white },
  periodText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
  periodTextActive: { color: Colors.primary },
  body: { padding: 20 },
  revenueCard: { flexDirection: 'row', backgroundColor: Colors.bgCard, borderRadius: 18, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: Colors.borderSoft, justifyContent: 'space-between', alignItems: 'center' },
  revenueLeft: {},
  revenueLabel: { fontSize: 12, color: Colors.textSoft, fontWeight: '500', marginBottom: 4 },
  revenueValue: { fontSize: 30, fontWeight: '900', color: Colors.textDark, letterSpacing: -0.5 },
  growthRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  growthText: { fontSize: 12, color: Colors.success, fontWeight: '600' },
  revenueRight: {},
  revenueRing: { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.lavenderUltra, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.lavenderLight },
  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  kpiBox: { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center', gap: 4 },
  kpiBoxValue: { fontSize: 20, fontWeight: '900' },
  kpiBoxLabel: { fontSize: 10, color: Colors.textSoft, textAlign: 'center' },
  card: { backgroundColor: Colors.bgCard, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.borderSoft, marginBottom: 8 },
  tempRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  tempLabel: { width: 80, fontSize: 12, fontWeight: '600', color: Colors.textDark },
  tempBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  tempBadgeText: { fontSize: 11, fontWeight: '700' },
  tempFooter: { marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.borderSoft },
  tempTotal: { fontSize: 12, color: Colors.textSoft, textAlign: 'center', fontWeight: '500' },
  pipelineRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  pipelineDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  pipelineLabel: { width: 64, fontSize: 12, fontWeight: '500', color: Colors.textSoft },
  pipelineCount: { fontSize: 13, fontWeight: '800', width: 24, textAlign: 'right' },
  pipelinePct: { fontSize: 11, color: Colors.textMuted, width: 32, textAlign: 'right' },
  commHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  commTitle: { fontSize: 11, fontWeight: '600', color: Colors.textSoft, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  commValue: { fontSize: 20, fontWeight: '900', color: Colors.textDark },
  commSub: { fontSize: 11, color: Colors.textMuted, marginBottom: 12 },
  commRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.borderSoft },
  commProp: { fontSize: 13, fontWeight: '700', color: Colors.textDark, maxWidth: 180, marginBottom: 3 },
  commMeta: { fontSize: 11, color: Colors.textMuted },
  commAmount: { fontSize: 13, fontWeight: '800', color: Colors.textDark, textAlign: 'right', marginBottom: 4 },
  commStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-end' },
  commStatusText: { fontSize: 10, fontWeight: '700' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { width: '47%', flex: 1, backgroundColor: Colors.bgCard, borderRadius: 14, padding: 16, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.borderSoft },
  metricIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  metricValue: { fontSize: 22, fontWeight: '900' },
  metricLabel: { fontSize: 10, color: Colors.textSoft, textAlign: 'center' },
});
