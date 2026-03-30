import React, { useEffect, useState } from 'react';
import { Alert, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Colors } from '../../constants/colors';
import { Appointments } from '../../lib/api';
import { Appointment } from '../../types';
import { SectionHeader, EmptyState } from '../../components/ui';
import { useApp } from '../../context/AppContext';

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Planifié: { bg: Colors.warningLight, text: Colors.warning },
  Confirmé: { bg: Colors.successLight, text: Colors.success },
  Effectué: { bg: Colors.infoLight, text: Colors.info },
  Annulé: { bg: Colors.dangerLight, text: Colors.danger },
};

function normalizeStatus(status = '') {
  return status.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function formatVisitDate(value: Date) {
  return value.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatVisitTime(value: Date) {
  return value.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function VisitsScreen() {
  const { realtimeVersion } = useApp();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [editingVisit, setEditingVisit] = useState<Appointment | null>(null);
  const [visitDateTime, setVisitDateTime] = useState(new Date());
  const [submitting, setSubmitting] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);

  const loadAppointments = () => {
    Appointments.list()
      .then((items) => setAppointments(uniqueById(items as Appointment[])))
      .catch(() => setAppointments([]));
  };

  useEffect(() => {
    loadAppointments();
  }, [realtimeVersion]);

  const upcoming = appointments.filter((a) => {
    const normalized = normalizeStatus(a.status);
    return normalized === 'Planifie' || normalized === 'Confirme';
  });
  const past = appointments.filter((a) => {
    const normalized = normalizeStatus(a.status);
    return normalized === 'Effectue' || normalized === 'Annule';
  });

  const openEditModal = (appointment: Appointment) => {
    const current = new Date(`${appointment.date}T${appointment.time.length === 5 ? `${appointment.time}:00` : appointment.time}`);
    setEditingVisit(appointment);
    setVisitDateTime(Number.isNaN(current.getTime()) ? new Date() : current);
  };

  const closeEditModal = () => {
    setEditingVisit(null);
    setPickerMode(null);
  };

  const onPickerChange = (_event: DateTimePickerEvent, value?: Date) => {
    if (Platform.OS === 'android') setPickerMode(null);
    if (!value) return;
    setVisitDateTime((current) => {
      const next = new Date(current);
      if (pickerMode === 'date') {
        next.setFullYear(value.getFullYear(), value.getMonth(), value.getDate());
      } else {
        next.setHours(value.getHours(), value.getMinutes(), 0, 0);
      }
      return next;
    });
  };

  const submitEdit = async () => {
    if (!editingVisit) return;
    try {
      setSubmitting(true);
      await Appointments.update(editingVisit.id, { dateTime: visitDateTime.toISOString() });
      closeEditModal();
      loadAppointments();
      Alert.alert('Visite', 'La visite a ete modifiee avec succes.');
    } catch (error: any) {
      Alert.alert('Visite', error?.message || 'Impossible de modifier cette visite.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderVisit = (a: Appointment) => {
    const sc = STATUS_COLORS[a.status] || { bg: Colors.bgSoft, text: Colors.textSoft };
    const d = new Date(a.date);
    const canEdit = normalizeStatus(a.status) !== 'Effectue' && normalizeStatus(a.status) !== 'Annule';

    return (
      <View key={a.id} style={styles.visitCard}>
        <View style={styles.dateBox}>
          <Text style={styles.dateDay}>{String(d.getDate()).padStart(2, '0')}</Text>
          <Text style={styles.dateMonth}>{d.toLocaleDateString('fr-FR', { month: 'short' }).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.visitTitle} numberOfLines={1}>{a.propertyTitle}</Text>
          <Text style={styles.visitClient}>{a.clientName}</Text>
          <View style={styles.visitMeta}>
            <Ionicons name="time-outline" size={11} color={Colors.textSoft} />
            <Text style={styles.visitMetaText}>{a.time}</Text>
            <Ionicons name="location-outline" size={11} color={Colors.textSoft} />
            <Text style={styles.visitMetaText}>{a.city}</Text>
          </View>
          {a.notes ? <Text style={styles.visitNotes} numberOfLines={2}>{a.notes}</Text> : null}
          {canEdit ? (
            <TouchableOpacity style={styles.editBtn} onPress={() => openEditModal(a)}>
              <Ionicons name="create-outline" size={14} color={Colors.primary} />
              <Text style={styles.editBtnText}>Modifier</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
          <Text style={[styles.statusText, { color: sc.text }]}>{a.status}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={Colors.gradientPrimary} style={styles.header}>
        <Text style={styles.headerTitle}>Visites</Text>
        <Text style={styles.headerSub}>{upcoming.length} à venir · {past.length} passée{past.length !== 1 ? 's' : ''}</Text>
      </LinearGradient>

      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <SectionHeader title="À venir" />
        {upcoming.length === 0
          ? <EmptyState icon="calendar-outline" title="Aucune visite planifiée" subtitle="Les visites confirmées apparaîtront ici." />
          : upcoming.map(renderVisit)}

        {past.length > 0 ? (
          <>
            <View style={{ marginTop: 20 }}>
              <SectionHeader title="Passées" />
            </View>
            {past.map(renderVisit)}
          </>
        ) : null}
      </ScrollView>

      <Modal visible={!!editingVisit} transparent animationType="fade" onRequestClose={closeEditModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Modifier la visite</Text>
            <Text style={styles.modalSub}>Choisissez la nouvelle date et la nouvelle heure.</Text>

            <Text style={styles.fieldLabel}>Date</Text>
            <TouchableOpacity style={styles.pickerCard} onPress={() => setPickerMode('date')}>
              <Ionicons name="calendar-outline" size={22} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.pickerSummaryText}>{formatVisitDate(visitDateTime)}</Text>
                <Text style={styles.pickerHint}>Touchez pour choisir la date</Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>Heure</Text>
            <TouchableOpacity style={styles.pickerCard} onPress={() => setPickerMode('time')}>
              <Ionicons name="time-outline" size={22} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.pickerSummaryText}>{formatVisitTime(visitDateTime)}</Text>
                <Text style={styles.pickerHint}>Touchez pour choisir l heure</Text>
              </View>
            </TouchableOpacity>

            {pickerMode ? (
              <DateTimePicker
                value={visitDateTime}
                mode={pickerMode}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onPickerChange}
              />
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeEditModal} disabled={submitting}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, submitting && styles.disabledBtn]} onPress={submitEdit} disabled={submitting}>
                <Text style={styles.saveBtnText}>{submitting ? 'Modification...' : 'Enregistrer'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgMain },
  header: { paddingTop: 20, paddingBottom: 24, paddingHorizontal: 24, alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.white },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  scroll: { flex: 1 },
  visitCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: Colors.bgCard, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.borderSoft },
  dateBox: { width: 52, height: 52, borderRadius: 14, backgroundColor: Colors.lavenderUltra, alignItems: 'center', justifyContent: 'center' },
  dateDay: { fontSize: 20, fontWeight: '900', color: Colors.primary },
  dateMonth: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  visitTitle: { fontSize: 14, fontWeight: '700', color: Colors.textDark, marginBottom: 2 },
  visitClient: { fontSize: 12, color: Colors.textSoft, marginBottom: 5 },
  visitMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 },
  visitMetaText: { fontSize: 11, color: Colors.textSoft },
  visitNotes: { fontSize: 11, color: Colors.textMuted, fontStyle: 'italic', lineHeight: 16 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, flexShrink: 0 },
  statusText: { fontSize: 10, fontWeight: '700' },
  editBtn: { marginTop: 10, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.lavenderUltra, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  editBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(5,2,18,0.72)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: Colors.bgCard, borderRadius: 22, padding: 20, borderWidth: 1, borderColor: Colors.borderSoft },
  modalTitle: { fontSize: 28, fontWeight: '800', color: Colors.textDark, marginBottom: 8 },
  modalSub: { fontSize: 14, lineHeight: 24, color: Colors.textSoft, marginBottom: 16 },
  fieldLabel: { fontSize: 14, fontWeight: '700', color: Colors.textDark, marginBottom: 10, marginTop: 6 },
  pickerCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: Colors.borderSoft, backgroundColor: Colors.bgSoft, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 16, marginBottom: 12 },
  pickerSummaryText: { fontSize: 16, fontWeight: '800', color: Colors.textDark },
  pickerHint: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  modalActions: { flexDirection: 'row', gap: 14, marginTop: 12 },
  cancelBtn: { flex: 1, backgroundColor: Colors.bgSoft, borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
  cancelBtnText: { color: Colors.textSoft, fontSize: 15, fontWeight: '700' },
  saveBtn: { flex: 1, borderRadius: 18, paddingVertical: 16, alignItems: 'center', backgroundColor: Colors.accentMagenta },
  saveBtnText: { color: Colors.white, fontSize: 15, fontWeight: '800' },
  disabledBtn: { opacity: 0.6 },
});
