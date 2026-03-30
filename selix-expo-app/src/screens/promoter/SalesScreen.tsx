import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Deals, LeadTransfers } from '../../lib/api';
import { Deal, LeadTransfer } from '../../types';
import { SectionHeader } from '../../components/ui';
import { useApp } from '../../context/AppContext';

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function money(value: number) {
  return `${Number(value || 0).toLocaleString('fr-FR')} MAD`;
}

export function SalesScreen() {
  const { realtimeVersion, t } = useApp();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [transfers, setTransfers] = useState<LeadTransfer[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const loadDeals = async () => {
    try {
      const [items, transferItems] = await Promise.all([
        Deals.list(),
        LeadTransfers.list(),
      ]);
      setDeals(uniqueById(items as Deal[]));
      setTransfers(uniqueById(transferItems as LeadTransfer[]));
    } catch {
      setDeals([]);
      setTransfers([]);
    }
  };

  useEffect(() => {
    loadDeals();
  }, [realtimeVersion]);

  const pendingDeals = useMemo(() => deals.filter((deal) => deal.status === 'En cours'), [deals]);
  const signedDeals = useMemo(() => deals.filter((deal) => deal.status === 'Signé'), [deals]);

  const validateDeal = async (deal: Deal) => {
    try {
      setLoadingId(deal.id);
      await Deals.validate(deal.id);
      await loadDeals();
      Alert.alert('Validation', 'La vente a ete finalisee et la commission a ete declenchee.');
    } catch (error: any) {
      Alert.alert('Validation', error?.message || 'Impossible de valider cette vente.');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={Colors.gradientHero} style={styles.header}>
        <Text style={styles.headerTitle}>{t('sales.title')}</Text>
        <Text style={styles.headerSub}>{pendingDeals.length} {t('sales.pendingStatus').toLowerCase()}</Text>
      </LinearGradient>

      <View style={styles.body}>
        <SectionHeader title={t('sales.pending')} />
        {transfers.length ? (
          <>
            <SectionHeader title="Leads transmis" style={{ marginBottom: 10 }} />
            {transfers.map((transfer) => (
              <View key={transfer.id} style={styles.transferCard}>
                <View style={styles.cardTop}>
                  <View style={styles.iconWrap}>
                    <Ionicons name="people-outline" size={18} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{transfer.propertyTitle || 'Projet'}</Text>
                    <Text style={styles.meta}>{transfer.clientName} - {transfer.commercialName || 'Commercial'}</Text>
                  </View>
                  <View style={styles.pendingChip}>
                    <Text style={styles.pendingText}>
                      {transfer.transferStatus === 'signed' ? 'Signe' : transfer.transferStatus === 'deal_created' ? 'Offre' : 'Transmis'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.transferNote}>
                  {transfer.notes || 'Lead qualifie confirme par le client et transmis au promoteur.'}
                </Text>
              </View>
            ))}
          </>
        ) : null}

        {pendingDeals.length ? pendingDeals.map((deal) => (
          <View key={deal.id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.iconWrap}>
                <Ionicons name="document-text-outline" size={18} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{deal.propertyTitle}</Text>
                <Text style={styles.meta}>{deal.clientName} - {deal.commercialName || 'Commercial assigne'}</Text>
              </View>
              <View style={styles.pendingChip}>
                <Text style={styles.pendingText}>{t('sales.pendingStatus')}</Text>
              </View>
            </View>

            <View style={styles.detailsRow}>
              <Detail label="Montant" value={money(deal.salePrice)} />
              <Detail label="Soumis le" value={new Date(deal.createdAt).toLocaleDateString('fr-FR')} />
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.validateButton, loadingId === deal.id && styles.validateButtonDisabled]}
              onPress={() => validateDeal(deal)}
              disabled={loadingId === deal.id}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color={Colors.white} />
              <Text style={styles.validateButtonText}>
                {loadingId === deal.id ? t('sales.validating') : t('sales.validateCta')}
              </Text>
            </TouchableOpacity>
          </View>
        )) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{t('sales.emptyPending')}</Text>
            <Text style={styles.emptyText}>{t('sales.emptyPendingSub')}</Text>
          </View>
        )}

        <SectionHeader title={t('sales.validated')} style={{ marginTop: 20 }} />
        {signedDeals.length ? signedDeals.map((deal) => (
          <View key={deal.id} style={styles.signedRow}>
            <View style={styles.signedIcon}>
              <Ionicons name="checkmark-done-outline" size={16} color={Colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.signedTitle}>{deal.propertyTitle}</Text>
              <Text style={styles.signedMeta}>{deal.clientName} - {money(deal.salePrice)}</Text>
            </View>
            <Text style={styles.signedDate}>
              {deal.signedAt ? new Date(deal.signedAt).toLocaleDateString('fr-FR') : ''}
            </Text>
          </View>
        )) : (
          <View style={styles.emptySigned}>
            <Text style={styles.emptyText}>{t('sales.emptyValidated')}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgMain },
  header: { paddingTop: 20, paddingBottom: 28, paddingHorizontal: 20 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: Colors.white },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 6 },
  body: { padding: 20 },
  card: { backgroundColor: Colors.bgCard, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: Colors.borderSoft, marginBottom: 12 },
  transferCard: { backgroundColor: Colors.bgCard, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: Colors.borderSoft, marginBottom: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  iconWrap: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.lavenderUltra },
  title: { fontSize: 15, fontWeight: '800', color: Colors.textDark },
  meta: { fontSize: 12, color: Colors.textSoft, marginTop: 3 },
  pendingChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: Colors.warningLight },
  pendingText: { fontSize: 11, fontWeight: '700', color: Colors.warning },
  detailsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  detailItem: { flex: 1, backgroundColor: Colors.bgSoft, borderRadius: 12, padding: 12 },
  detailLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 3 },
  detailValue: { fontSize: 13, fontWeight: '700', color: Colors.textDark },
  validateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.accentMagenta, borderRadius: 14, paddingVertical: 13 },
  validateButtonDisabled: { opacity: 0.6 },
  validateButtonText: { fontSize: 14, fontWeight: '800', color: Colors.white },
  emptyCard: { backgroundColor: Colors.bgCard, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: Colors.borderSoft },
  transferNote: { fontSize: 13, lineHeight: 19, color: Colors.textSoft },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: Colors.textDark, marginBottom: 6 },
  emptyText: { fontSize: 13, lineHeight: 20, color: Colors.textSoft },
  signedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.bgCard, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.borderSoft },
  signedIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.successLight },
  signedTitle: { fontSize: 14, fontWeight: '700', color: Colors.textDark },
  signedMeta: { fontSize: 12, color: Colors.textSoft, marginTop: 2 },
  signedDate: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  emptySigned: { paddingVertical: 8 },
});
