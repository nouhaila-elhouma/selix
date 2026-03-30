import React, { useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Appointments, InterestConfirmations } from '../../lib/api';
import { Appointment, InterestConfirmation } from '../../types';
import { Colors } from '../../constants/colors';
import { EmptyState, SectionHeader } from '../../components/ui';
import { useApp } from '../../context/AppContext';

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

const STATUS_LABELS: Record<string, string> = {
  Planifie: 'En attente',
  'Planifié': 'En attente',
  Confirme: 'Confirmé',
  'Confirmé': 'Confirmé',
  Effectue: 'Effectué',
  'Effectué': 'Effectué',
  Annule: 'Annulé',
  'Annulé': 'Annulé',
};

const UPCOMING_STATUSES = new Set(['En attente', 'Confirmé']);

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'En attente': { bg: Colors.warningLight, text: Colors.warning },
  Confirmé: { bg: Colors.successLight, text: Colors.success },
  Effectué: { bg: Colors.infoLight, text: Colors.info },
  Annulé: { bg: Colors.dangerLight, text: Colors.danger },
};

function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' });
}

function formatDayLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return String(date.getDate()).padStart(2, '0');
}

function formatMonthLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR', { month: 'short' }).toUpperCase();
}

function getDisplayStatus(status: string) {
  return STATUS_LABELS[status] || status;
}

function isUpcomingStatus(status: string) {
  return UPCOMING_STATUSES.has(getDisplayStatus(status));
}

export function VisitsScreen() {
  const { realtimeVersion, t } = useApp();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [confirmations, setConfirmations] = useState<InterestConfirmation[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const loadAppointments = async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      const [items, confirmationItems] = await Promise.all([
        Appointments.list(),
        InterestConfirmations.list(),
      ]);
      setAppointments(uniqueById(items as Appointment[]));
      setConfirmations(uniqueById(confirmationItems as InterestConfirmation[]));
    } catch {
      setAppointments([]);
      setConfirmations([]);
    } finally {
      if (showRefresh) setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAppointments();
  }, [realtimeVersion]);

  const { upcoming, past } = useMemo(() => ({
    upcoming: appointments.filter((item) => isUpcomingStatus(item.status)),
    past: appointments.filter((item) => !isUpcomingStatus(item.status)),
  }), [appointments]);
  const pendingConfirmations = useMemo(
    () => confirmations.filter((item) => item.status === 'pending'),
    [confirmations],
  );
  const answeredConfirmations = useMemo(
    () => confirmations.filter((item) => item.status !== 'pending'),
    [confirmations],
  );

  const renderVisit = (appointment: Appointment) => {
    const displayStatus = getDisplayStatus(appointment.status);
    const statusColors = STATUS_COLORS[displayStatus] || { bg: Colors.bgSoft, text: Colors.textSoft };
    const canConfirmPresence = displayStatus === 'En attente';
    const canRequestReschedule = isUpcomingStatus(appointment.status);

    return (
      <View key={appointment.id} style={styles.card}>
        <View style={styles.dateColumn}>
          <View style={styles.dateBadge}>
            <Text style={styles.dateDay}>{formatDayLabel(appointment.date)}</Text>
            <Text style={styles.dateMonth}>{formatMonthLabel(appointment.date)}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.propertyTitle}>{appointment.propertyTitle}</Text>
              {appointment.projectTitle ? <Text style={styles.projectTitle}>{appointment.projectTitle}</Text> : null}
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
              <Text style={[styles.statusText, { color: statusColors.text }]}>{displayStatus}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={13} color={Colors.textSoft} />
            <Text style={styles.metaText}>{formatDateLabel(appointment.date)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={13} color={Colors.textSoft} />
            <Text style={styles.metaText}>{appointment.time}</Text>
            <Ionicons name="location-outline" size={13} color={Colors.textSoft} />
            <Text style={styles.metaText}>{appointment.city || t('visits.cityPending')}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="person-outline" size={13} color={Colors.textSoft} />
            <Text style={styles.metaText}>{appointment.commercialName || t('visits.commercialPending')}</Text>
          </View>

          {appointment.notes ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesText}>{appointment.notes}</Text>
            </View>
          ) : null}

          {canConfirmPresence || canRequestReschedule ? (
            <View style={styles.actionsRow}>
              {canConfirmPresence ? (
                <TouchableOpacity
                  style={[styles.confirmBtn, confirmingId === appointment.id && styles.confirmBtnDisabled]}
                  disabled={confirmingId === appointment.id || reschedulingId === appointment.id}
                  onPress={async () => {
                    try {
                      setConfirmingId(appointment.id);
                      await Appointments.updateStatus(appointment.id, 'Confirmé');
                      await loadAppointments();
                      Alert.alert(t('visits.title'), 'Votre presence a ete confirmee.');
                    } catch (error: any) {
                      Alert.alert(t('visits.title'), error?.message || 'Impossible de confirmer votre presence.');
                    } finally {
                      setConfirmingId(null);
                    }
                  }}
                >
                  <Ionicons name="checkmark-circle-outline" size={16} color={Colors.white} />
                  <Text style={styles.confirmBtnText}>
                    {confirmingId === appointment.id ? t('visits.confirming') : t('visits.confirmPresence')}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {canRequestReschedule ? (
                <TouchableOpacity
                  style={[styles.rescheduleBtn, reschedulingId === appointment.id && styles.confirmBtnDisabled]}
                  disabled={reschedulingId === appointment.id || confirmingId === appointment.id}
                  onPress={async () => {
                    try {
                      setReschedulingId(appointment.id);
                      await Appointments.requestReschedule(appointment.id);
                      await loadAppointments();
                      Alert.alert(t('visits.title'), 'Votre demande de report a ete envoyee au commercial.');
                    } catch (error: any) {
                      Alert.alert(t('visits.title'), error?.message || 'Impossible d envoyer cette demande de report.');
                    } finally {
                      setReschedulingId(null);
                    }
                  }}
                >
                  <Ionicons name="calendar-outline" size={16} color={Colors.accentOrange} />
                  <Text style={styles.rescheduleBtnText}>
                    {reschedulingId === appointment.id ? t('visits.sending') : t('visits.reschedule')}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={Colors.gradientHero} style={styles.header}>
        <Text style={styles.headerTitle}>{t('visits.title')}</Text>
        <Text style={styles.headerSub}>
          {t('visits.subtitle', { upcoming: upcoming.length, past: past.length, suffix: past.length > 1 ? 's' : '' })}
        </Text>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAppointments(true)} tintColor={Colors.white} />}
      >
        <View style={styles.helperCard}>
          <Ionicons name="notifications-outline" size={18} color={Colors.accentOrange} />
          <Text style={styles.helperText}>{t('visits.helper')}</Text>
        </View>

        <SectionHeader title="Confirmation d interet" />
        {pendingConfirmations.length ? pendingConfirmations.map((item) => (
          <View key={item.id} style={styles.confirmationCard}>
            <View style={styles.confirmationTop}>
              <View style={styles.confirmationIcon}>
                <Ionicons name="sparkles-outline" size={18} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.confirmationTitle}>{item.propertyTitle || 'Projet immobilier'}</Text>
                <Text style={styles.confirmationMeta}>{item.commercialName || 'Votre commercial'} attend votre retour</Text>
              </View>
            </View>

            {item.requestMessage ? <Text style={styles.confirmationText}>{item.requestMessage}</Text> : null}

            <View style={styles.confirmationActions}>
              <TouchableOpacity
                style={[styles.confirmBtn, respondingId === item.id && styles.confirmBtnDisabled]}
                disabled={!!respondingId}
                onPress={async () => {
                  try {
                    setRespondingId(item.id);
                    await InterestConfirmations.respond(item.id, { status: 'confirmed' });
                    await loadAppointments();
                    Alert.alert('Confirmation', 'Votre interet a ete confirme.');
                  } catch (error: any) {
                    Alert.alert('Confirmation', error?.message || 'Impossible de confirmer votre interet.');
                  } finally {
                    setRespondingId(null);
                  }
                }}
              >
                <Ionicons name="checkmark-circle-outline" size={16} color={Colors.white} />
                <Text style={styles.confirmBtnText}>{respondingId === item.id ? 'Envoi...' : 'Je suis interesse'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.followupBtn}
                disabled={!!respondingId}
                onPress={async () => {
                  try {
                    setRespondingId(item.id);
                    await InterestConfirmations.respond(item.id, { status: 'needs_followup' });
                    await loadAppointments();
                    Alert.alert('Confirmation', 'Votre demande de suivi a ete envoyee.');
                  } catch (error: any) {
                    Alert.alert('Confirmation', error?.message || 'Impossible d envoyer cette demande.');
                  } finally {
                    setRespondingId(null);
                  }
                }}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={Colors.primary} />
                <Text style={styles.followupBtnText}>J ai des questions</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.rescheduleBtn}
                disabled={!!respondingId}
                onPress={async () => {
                  try {
                    setRespondingId(item.id);
                    await InterestConfirmations.respond(item.id, { status: 'declined' });
                    await loadAppointments();
                    Alert.alert('Confirmation', 'Votre reponse a ete envoyee.');
                  } catch (error: any) {
                    Alert.alert('Confirmation', error?.message || 'Impossible d envoyer cette reponse.');
                  } finally {
                    setRespondingId(null);
                  }
                }}
              >
                <Ionicons name="close-circle-outline" size={16} color={Colors.accentOrange} />
                <Text style={styles.rescheduleBtnText}>Pas interesse</Text>
              </TouchableOpacity>
            </View>
          </View>
        )) : (
          <EmptyState
            icon="sparkles-outline"
            title="Aucune confirmation en attente"
            subtitle="Les demandes de confirmation d interet apparaitront ici apres vos visites."
          />
        )}

        <SectionHeader title={t('visits.upcoming')} />
        {upcoming.length ? upcoming.map(renderVisit) : (
          <EmptyState
            icon="calendar-outline"
            title={t('visits.empty')}
            subtitle={t('visits.emptySub')}
          />
        )}

        {past.length ? (
          <>
            <View style={styles.sectionGap}>
              <SectionHeader title={t('visits.past')} />
            </View>
            {past.map(renderVisit)}
          </>
        ) : null}

        {answeredConfirmations.length ? (
          <>
            <View style={styles.sectionGap}>
              <SectionHeader title="Historique des retours" />
            </View>
            {answeredConfirmations.map((item) => (
              <View key={item.id} style={styles.historyCard}>
                <Text style={styles.historyTitle}>{item.propertyTitle || 'Projet immobilier'}</Text>
                <Text style={styles.historyMeta}>
                  {item.status === 'confirmed' ? 'Interet confirme' : item.status === 'declined' ? 'Interet refuse' : 'Suivi demande'}
                </Text>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgMain },
  header: { paddingTop: 20, paddingBottom: 24, paddingHorizontal: 24, alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.white },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.72)', marginTop: 4 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  helperCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  helperText: { flex: 1, fontSize: 13, lineHeight: 18, color: Colors.textSoft },
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: Colors.bgCard,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  dateColumn: { justifyContent: 'flex-start' },
  dateBadge: {
    width: 56,
    height: 60,
    borderRadius: 16,
    backgroundColor: Colors.lavenderUltra,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: { fontSize: 22, fontWeight: '900', color: Colors.accentMagenta, lineHeight: 24 },
  dateMonth: { fontSize: 10, fontWeight: '800', color: Colors.accentOrange, marginTop: 2 },
  cardBody: { flex: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  propertyTitle: { fontSize: 15, fontWeight: '800', color: Colors.textDark },
  projectTitle: { fontSize: 12, color: Colors.textSoft, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  statusText: { fontSize: 10, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' },
  metaText: { fontSize: 12, color: Colors.textSoft },
  notesBox: { marginTop: 6, backgroundColor: Colors.lavenderUltra, borderRadius: 12, padding: 10 },
  notesText: { fontSize: 12, lineHeight: 18, color: Colors.textBody },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  confirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accentMagenta,
    borderRadius: 12,
    paddingVertical: 12,
  },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmBtnText: { fontSize: 13, fontWeight: '800', color: Colors.white },
  rescheduleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.lavenderUltra,
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  rescheduleBtnText: { fontSize: 13, fontWeight: '800', color: Colors.accentOrange },
  sectionGap: { marginTop: 12 },
  confirmationCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  confirmationTop: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 10 },
  confirmationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.lavenderUltra,
  },
  confirmationTitle: { fontSize: 15, fontWeight: '800', color: Colors.textDark },
  confirmationMeta: { fontSize: 12, color: Colors.textSoft, marginTop: 2 },
  confirmationText: { fontSize: 13, lineHeight: 19, color: Colors.textBody, marginBottom: 12 },
  confirmationActions: { gap: 10 },
  followupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.lavenderUltra,
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  followupBtnText: { fontSize: 13, fontWeight: '800', color: Colors.primary },
  historyCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  historyTitle: { fontSize: 14, fontWeight: '800', color: Colors.textDark },
  historyMeta: { fontSize: 12, color: Colors.textSoft, marginTop: 4 },
});
