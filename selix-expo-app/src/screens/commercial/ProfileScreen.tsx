import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { Commissions, Projects } from '../../lib/api';
import { Commission, Project, Property } from '../../types';
import { Divider, ProgressBar } from '../../components/ui';

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function normalizeCommissionStatus(status: string) {
  const value = (status || '').toLowerCase();
  if (value.includes('pay')) return 'Payée';
  if (value.includes('attente')) return 'En attente';
  if (value.includes('disput')) return 'Disputée';
  return status || 'En attente';
}

function isSignedLeadStatus(status: string) {
  return String(status || '').toLowerCase().includes('sign');
}

const COMMISSION_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'Payée': { bg: Colors.successLight, text: Colors.success },
  'En attente': { bg: Colors.warningLight, text: Colors.warning },
  'Disputée': { bg: Colors.dangerLight, text: Colors.danger },
};

export function ProfileScreen() {
  const { currentUser, leads, logout, realtimeVersion, t } = useApp();
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const isPromoterProfile = currentUser?.role === 'promoter';

  useEffect(() => {
    Commissions.list()
      .then((items) => setCommissions(uniqueById(items as Commission[])))
      .catch(() => setCommissions([]));

    Projects.list()
      .then((items) => setProjects(uniqueById(items as Project[])))
      .catch(() => setProjects([]));
  }, [realtimeVersion]);

  const trackedProjects = useMemo(() => {
    if (isPromoterProfile) {
      return uniqueById([...projects])
        .sort((a, b) => b.completionPercent - a.completionPercent)
        .slice(0, 4);
    }

    const relatedProjectNames = new Set<string>();
    const relatedPromoterIds = new Set<string>();

    leads.forEach((lead) => {
      lead.matchedProperties.forEach((property) => {
        if (typeof property === 'string') return;
        const typedProperty = property as Property;
        if (typedProperty.project) relatedProjectNames.add(typedProperty.project.toLowerCase());
        if (typedProperty.promoterId) relatedPromoterIds.add(typedProperty.promoterId);
      });
    });

    return uniqueById(projects)
      .filter((project) => (
        relatedProjectNames.has(project.name.toLowerCase()) || relatedPromoterIds.has(project.promoterId)
      ))
      .sort((a, b) => b.completionPercent - a.completionPercent)
      .slice(0, 4);
  }, [isPromoterProfile, leads, projects]);

  const totalComm = commissions.reduce((sum, item) => sum + item.amount, 0);
  const paidComm = commissions
    .filter((item) => normalizeCommissionStatus(item.status) === 'Payée')
    .reduce((sum, item) => sum + item.amount, 0);
  const signedDeals = leads.filter((lead) => isSignedLeadStatus(String(lead.status))).length;
  const conversionRate = leads.length ? Math.round((signedDeals / leads.length) * 100) : 0;
  const averageProjectProgress = trackedProjects.length
    ? Math.round(trackedProjects.reduce((sum, project) => sum + project.completionPercent, 0) / trackedProjects.length)
    : 0;
  const badgeMetric = isPromoterProfile
    ? `${projects.length} projet${projects.length > 1 ? 's' : ''}`
    : leads.length
      ? `${conversionRate}% conv.`
      : 'Nouveau';

  const kpis = isPromoterProfile
    ? [
        { label: 'Projets', value: String(projects.length) },
        { label: 'Suivis', value: String(trackedProjects.length) },
        { label: 'Avancement', value: `${averageProjectProgress}%` },
        { label: 'Commissions', value: commissions.length ? String(commissions.length) : '0' },
      ]
    : [
        { label: 'Leads', value: String(leads.length) },
        { label: 'Signés', value: String(signedDeals) },
        { label: 'Conversion', value: `${conversionRate}%` },
        { label: 'Projets', value: String(trackedProjects.length) },
      ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={Colors.gradientHero} style={styles.header}>
        <View style={[styles.deco, styles.decoA]} />
        <View style={styles.avatarRing}>
          <View style={styles.avatar}>
            <Text style={styles.initials}>
              {currentUser?.name?.split(' ').map((word) => word[0]).slice(0, 2).join('') || 'U'}
            </Text>
          </View>
        </View>
        <Text style={styles.name}>{currentUser?.name || (isPromoterProfile ? 'Promoteur' : 'Commercial')}</Text>
        <Text style={styles.role}>{isPromoterProfile ? t('profile.promoterRole') : t('profile.commercialRole')}</Text>
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <View style={styles.activeDot} />
            <Text style={styles.badgeText}>Actif</Text>
          </View>
          <View style={styles.badge}>
            <Ionicons name="star" size={12} color={Colors.warning} />
            <Text style={styles.badgeText}>{badgeMetric}</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.kpiRow}>
          {kpis.map((item) => (
            <View key={item.label} style={styles.kpiItem}>
              <Text style={styles.kpiValue}>{item.value}</Text>
              <Text style={styles.kpiLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.projectsCard}>
          <View style={styles.projectsHeader}>
            <View>
              <Text style={styles.sectionLabel}>Avancement des projets</Text>
              <Text style={styles.projectsHeadline}>
                {trackedProjects.length ? `${averageProjectProgress}% moyen` : 'Aucun projet suivi'}
              </Text>
            </View>
            <View style={styles.projectsSummaryBadge}>
              <Ionicons name="business-outline" size={14} color={Colors.primarySoft} />
              <Text style={styles.projectsSummaryText}>{trackedProjects.length}</Text>
            </View>
          </View>

          {trackedProjects.length ? (
            trackedProjects.map((project) => (
              <View key={project.id} style={styles.projectRow}>
                <View style={styles.projectTopRow}>
                  <View style={styles.projectTopCopy}>
                    <Text style={styles.projectName} numberOfLines={1}>{project.name}</Text>
                    <Text style={styles.projectMeta} numberOfLines={1}>
                      {project.city} · {project.status}
                    </Text>
                  </View>
                  <Text style={styles.projectPercent}>{project.completionPercent}%</Text>
                </View>
                <ProgressBar value={project.completionPercent} max={100} height={8} style={styles.projectProgress} />
                <View style={styles.projectFooter}>
                  <Text style={styles.projectFooterText}>
                    {project.soldUnits}/{project.totalUnits} unités vendues
                  </Text>
                  <Text style={styles.projectFooterText}>
                    Livraison {project.delivery}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.projectsEmpty}>
              {isPromoterProfile
                ? 'Vos projets apparaîtront ici avec leur niveau d’avancement.'
                : 'Les projets liés à vos leads apparaîtront ici avec leur niveau d’avancement.'}
            </Text>
          )}
        </View>

        <View style={styles.commCard}>
          <View style={styles.commHeader}>
            <View>
              <Text style={styles.sectionLabel}>Commissions</Text>
              <Text style={styles.commTotal}>{totalComm.toLocaleString('fr-FR')} MAD</Text>
            </View>
            <View style={styles.commPaid}>
              <Text style={styles.commPaidLabel}>Payé</Text>
              <Text style={styles.commPaidValue}>{paidComm.toLocaleString('fr-FR')} MAD</Text>
            </View>
          </View>
          <ProgressBar value={paidComm} max={Math.max(1, totalComm)} height={6} style={styles.commProgress} />

          <Divider style={styles.commDivider} />

          {commissions.map((commission) => {
            const normalizedStatus = normalizeCommissionStatus(commission.status);
            const palette = COMMISSION_STATUS_COLORS[normalizedStatus] || { bg: Colors.bgSoft, text: Colors.textSoft };

            return (
              <View key={commission.id} style={styles.commRow}>
                <View style={styles.commCopy}>
                  <Text style={styles.commProp} numberOfLines={1}>{commission.propertyTitle}</Text>
                  <Text style={styles.commRate}>{commission.rate}% · Echéance {commission.dueDate}</Text>
                </View>
                <View>
                  <Text style={styles.commAmount}>{commission.amount.toLocaleString('fr-FR')} MAD</Text>
                  <View style={[styles.commStatus, { backgroundColor: palette.bg }]}>
                    <Text style={[styles.commStatusText, { color: palette.text }]}>{normalizedStatus}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgMain },
  content: { paddingBottom: 100 },
  header: { paddingTop: 24, paddingBottom: 32, alignItems: 'center', position: 'relative', overflow: 'hidden' },
  deco: { position: 'absolute', borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.07)' },
  decoA: { width: 220, height: 220, top: -60, right: -60 },
  avatarRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 26, fontWeight: '800', color: Colors.primary },
  name: { fontSize: 20, fontWeight: '800', color: Colors.white, marginBottom: 2 },
  role: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 12 },
  badgeRow: { flexDirection: 'row', gap: 10 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  activeDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.success },
  badgeText: { fontSize: 12, fontWeight: '700', color: Colors.white },
  body: { padding: 20, gap: 16 },
  kpiRow: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  kpiItem: { flex: 1, alignItems: 'center' },
  kpiValue: { fontSize: 20, fontWeight: '800', color: Colors.textDark },
  kpiLabel: { fontSize: 11, color: Colors.textSoft, marginTop: 2 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  projectsCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    gap: 12,
  },
  projectsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  projectsHeadline: { fontSize: 22, fontWeight: '900', color: Colors.textDark },
  projectsSummaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(142,53,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(142,53,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  projectsSummaryText: { fontSize: 12, fontWeight: '800', color: Colors.primarySoft },
  projectRow: { paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.borderSoft },
  projectTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  projectTopCopy: { flex: 1 },
  projectName: { fontSize: 14, fontWeight: '800', color: Colors.textDark, marginBottom: 4 },
  projectMeta: { fontSize: 12, color: Colors.textSoft },
  projectPercent: { fontSize: 16, fontWeight: '900', color: Colors.primarySoft },
  projectProgress: { marginTop: 10 },
  projectFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 10 },
  projectFooterText: { flex: 1, fontSize: 11, color: Colors.textMuted },
  projectsEmpty: { fontSize: 13, lineHeight: 20, color: Colors.textSoft },
  commCard: { backgroundColor: Colors.bgCard, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.borderSoft },
  commHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  commTotal: { fontSize: 22, fontWeight: '900', color: Colors.textDark },
  commPaid: { alignItems: 'flex-end' },
  commPaidLabel: { fontSize: 11, color: Colors.textSoft },
  commPaidValue: { fontSize: 16, fontWeight: '800', color: Colors.success },
  commProgress: { marginTop: 12 },
  commDivider: { marginVertical: 12 },
  commRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSoft,
  },
  commCopy: { flex: 1 },
  commProp: { fontSize: 13, fontWeight: '700', color: Colors.textDark, marginBottom: 3, maxWidth: 180 },
  commRate: { fontSize: 11, color: Colors.textMuted },
  commAmount: { fontSize: 14, fontWeight: '800', color: Colors.textDark, textAlign: 'right', marginBottom: 4 },
  commStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-end' },
  commStatusText: { fontSize: 10, fontWeight: '700' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.dangerLight,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.danger,
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: Colors.danger },
});
