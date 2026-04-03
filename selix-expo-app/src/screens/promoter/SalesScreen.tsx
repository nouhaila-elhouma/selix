import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { LeadTransfers, Promoter } from '../../lib/api';
import { LeadTransfer, PromoterSubscriptionOverview } from '../../types';
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

function isActiveSubscription(subscription?: PromoterSubscriptionOverview | null) {
  return subscription?.subscriptionStatus === 'active' && subscription?.accountStatus === 'active';
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('fr-FR');
}

export function SalesScreen() {
  const { realtimeVersion } = useApp();
  const [subscription, setSubscription] = useState<PromoterSubscriptionOverview | null>(null);
  const [transfers, setTransfers] = useState<LeadTransfer[]>([]);

  useEffect(() => {
    Promoter.subscription().then((data) => setSubscription(data as PromoterSubscriptionOverview)).catch(() => setSubscription(null));
  }, [realtimeVersion]);

  useEffect(() => {
    if (!isActiveSubscription(subscription)) {
      setTransfers([]);
      return;
    }

    LeadTransfers.list()
      .then((items) => setTransfers(uniqueById(items as LeadTransfer[])))
      .catch(() => setTransfers([]));
  }, [realtimeVersion, subscription?.accountStatus, subscription?.subscriptionStatus]);

  const qualifiedLeads = useMemo(
    () => transfers.filter((item) => item.transferStatus && item.transferStatus !== 'cancelled'),
    [transfers],
  );
  const blockedReason = subscription?.restrictedReason || 'Un abonnement actif est obligatoire pour consulter les leads qualifies.';
  const isActive = isActiveSubscription(subscription);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={['#0F0822', '#180A30', '#1C0B38', '#0D0620']} locations={[0, 0.3, 0.65, 1]} style={styles.header}>
        <Text style={styles.headerTitle}>Leads qualifies</Text>
        <Text style={styles.headerSub}>
          {isActive ? `${qualifiedLeads.length} lead${qualifiedLeads.length > 1 ? 's' : ''} disponible${qualifiedLeads.length > 1 ? 's' : ''}` : 'Acces conditionne par abonnement'}
        </Text>
      </LinearGradient>

      <View style={styles.body}>
        {!isActive ? (
          <View style={styles.blockedCard}>
            <View style={styles.blockedIcon}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.warning} />
            </View>
            <Text style={styles.blockedTitle}>Acces indisponible</Text>
            <Text style={styles.blockedText}>{blockedReason}</Text>
            <View style={styles.blockedMetaRow}>
              <MetaCard label="Compte" value={subscription?.accountStatus || 'inconnu'} />
              <MetaCard label="Abonnement" value={subscription?.subscriptionStatus || 'pending'} />
              <MetaCard label="Expiration" value={formatDate(subscription?.endsAt)} />
            </View>
          </View>
        ) : (
          <>
            <SectionHeader title="Leads accessibles" />
            {qualifiedLeads.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Aucun lead qualifie</Text>
                <Text style={styles.emptyText}>Les leads qualifies lies a vos projets apparaitront ici une fois transmis.</Text>
              </View>
            ) : (
              qualifiedLeads.map((transfer) => (
                <View key={transfer.id} style={styles.transferCard}>
                  <View style={styles.cardTop}>
                    <View style={styles.iconWrap}>
                      <Ionicons name="checkmark-circle-outline" size={18} color={Colors.success} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.title}>{transfer.propertyTitle || 'Projet'}</Text>
                      <Text style={styles.meta}>{transfer.clientName}</Text>
                    </View>
                    <View style={styles.statusChip}>
                      <Text style={styles.statusText}>{transfer.transferStatus || 'qualifie'}</Text>
                    </View>
                  </View>

                  <View style={styles.infoGrid}>
                    <InfoItem label="Commercial" value={transfer.commercialName || 'Non renseigne'} />
                    <InfoItem label="Promoteur" value={transfer.promoterName || 'Votre compte'} />
                    <InfoItem label="Transmis le" value={formatDate(transfer.createdAt)} />
                  </View>

                  <Text style={styles.noteText}>
                    {transfer.notes || 'Lead qualifie transmis sur un projet appartenant a votre compte.'}
                  </Text>
                </View>
              ))
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaCard}>
      <Text style={styles.metaCardLabel}>{label}</Text>
      <Text style={styles.metaCardValue}>{value}</Text>
    </View>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgMain },
  header: { paddingTop: 20, paddingBottom: 28, paddingHorizontal: 20 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: Colors.white },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 6 },
  body: { padding: 20 },
  blockedCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    alignItems: 'center',
  },
  blockedIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.warningLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  blockedTitle: { fontSize: 18, fontWeight: '800', color: Colors.textDark, marginBottom: 8 },
  blockedText: { fontSize: 13, lineHeight: 20, color: Colors.textSoft, textAlign: 'center' },
  blockedMetaRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  metaCard: {
    flex: 1,
    backgroundColor: Colors.bgSoft,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  metaCardLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 4 },
  metaCardValue: { fontSize: 12, fontWeight: '800', color: Colors.textDark, textAlign: 'center' },
  transferCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    marginBottom: 12,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.successLight,
  },
  title: { fontSize: 15, fontWeight: '800', color: Colors.textDark },
  meta: { fontSize: 12, color: Colors.textSoft, marginTop: 3 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: Colors.lavenderUltra },
  statusText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  infoGrid: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  infoItem: { flex: 1, backgroundColor: Colors.bgSoft, borderRadius: 12, padding: 12 },
  infoLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 3 },
  infoValue: { fontSize: 12, fontWeight: '700', color: Colors.textDark },
  noteText: { fontSize: 13, lineHeight: 19, color: Colors.textSoft },
  emptyCard: { backgroundColor: Colors.bgCard, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: Colors.borderSoft },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: Colors.textDark, marginBottom: 6 },
  emptyText: { fontSize: 13, lineHeight: 20, color: Colors.textSoft },
});
