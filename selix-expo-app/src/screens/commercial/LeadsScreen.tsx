import React, { useMemo, useState } from 'react';
import {
  Alert, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Colors } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { Admin, Conversations, Deals, InterestConfirmations } from '../../lib/api';
import { Lead, LeadStatus, Property } from '../../types';
import { ScoreRing } from '../../components/ui';
import {
  getTemperatureBgColor,
  getTemperatureColor,
  getTemperatureEmoji,
  getTemperatureLabel,
} from '../../utils/scoring';

type Filter = 'all' | 'matching' | 'hot' | 'warm' | 'cold';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'matching', label: 'Matching' },
  { key: 'hot', label: 'Chauds' },
  { key: 'warm', label: 'Tiedes' },
  { key: 'cold', label: 'Froids' },
];

const PIPELINE_ACTIONS: LeadStatus[] = ['Contacté', 'Visité', 'Offre', 'Perdu'];
const STATUS_COLORS: Record<LeadStatus, string> = {
  Nouveau: Colors.statusNew,
  'Contacté': Colors.statusContacted,
  'Visité': Colors.statusVisited,
  Offre: Colors.statusOffer,
  'Signé': Colors.statusSigned,
  Perdu: Colors.statusLost,
};

const PIPELINE_ACTIONS_DISPLAY: LeadStatus[] = ['Contacté', 'Visité', 'Offre', 'Perdu'];
const STATUS_COLORS_DISPLAY: Record<string, string> = {
  Nouveau: Colors.statusNew,
  Contacté: Colors.statusContacted,
  Visité: Colors.statusVisited,
  Offre: Colors.statusOffer,
  Signé: Colors.statusSigned,
  Perdu: Colors.statusLost,
};

function validationLabel(status?: string) {
  if (status === 'validated') return 'Valide';
  if (status === 'rejected') return 'A revoir';
  if (status === 'pending_review') return 'En attente';
  return 'Brouillon';
}

function validationButtonColors(status: 'validated' | 'pending_review' | 'rejected') {
  if (status === 'validated') return { bg: Colors.successLight, border: Colors.success, text: Colors.success };
  if (status === 'rejected') return { bg: Colors.dangerLight, border: Colors.danger, text: Colors.danger };
  return { bg: Colors.warningLight, border: Colors.warning, text: Colors.warning };
}

function leadOriginLabel(lead: Lead) {
  return lead.source === 'matching' ? 'Matching client' : 'Questionnaire';
}

function displayValue(value?: string | number | null, fallback = '-') {
  if (value == null) return fallback;
  const normalized = String(value).trim();
  return normalized ? normalized : fallback;
}

function yesNoValue(value?: boolean) {
  if (value === true) return 'Oui';
  if (value === false) return 'Non';
  return '-';
}

function listValue(items?: string[]) {
  return items && items.length ? items.join(', ') : '-';
}

function isProperty(item: Property | string): item is Property {
  return typeof item !== 'string' && !!item?.id;
}

function getPrimaryMatchedProperty(lead: Lead): Property | null {
  return (lead.matchedProperties ?? []).find(isProperty) ?? null;
}

function isVisitedAction(action: LeadStatus) {
  return String(action).toLowerCase().includes('visit');
}

function formatVisitDate(date: Date) {
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatVisitTime(date: Date) {
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function LeadsScreen() {
  const {
    leads,
    conversations,
    currentUser,
    updateLeadStatus,
    loadLeads,
    loadConversations,
    setCommercialActiveTab,
    focusConversation,
    realtimeVersion,
    t,
  } = useApp();
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<Lead | null>(null);
  const [offerLead, setOfferLead] = useState<Lead | null>(null);
  const [visitLead, setVisitLead] = useState<Lead | null>(null);
  const [visitDateTime, setVisitDateTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(Platform.OS === 'ios');
  const [showTimePicker, setShowTimePicker] = useState(Platform.OS === 'ios');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [salePrice, setSalePrice] = useState('');
  const [submittingOffer, setSubmittingOffer] = useState(false);
  const [submittingVisit, setSubmittingVisit] = useState(false);
  const [interestLead, setInterestLead] = useState<Lead | null>(null);
  const [interestMessage, setInterestMessage] = useState('');
  const [submittingInterest, setSubmittingInterest] = useState(false);

  const matchingCount = useMemo(() => leads.filter((lead) => lead.source === 'matching').length, [leads]);
  const filtered = useMemo(() => {
    if (filter === 'all') return leads;
    if (filter === 'matching') return leads.filter((lead) => lead.source === 'matching');
    return leads.filter((lead) => lead.temperature === filter);
  }, [filter, leads, realtimeVersion]);

  const offerProperties = useMemo(
    () => (offerLead?.matchedProperties ?? []).filter(isProperty),
    [offerLead],
  );

  const submitOffer = async () => {
    if (!offerLead) return;
    if (!selectedPropertyId) {
      Alert.alert('Offre', 'Choisis un projet ou un bien avant d envoyer au promoteur.');
      return;
    }
    const parsedPrice = Number(String(salePrice).replace(/[^\d]/g, ''));
    if (!parsedPrice) {
      Alert.alert('Offre', 'Saisis un prix de vente valide.');
      return;
    }

    try {
      setSubmittingOffer(true);
      await Deals.create({ leadId: offerLead.id, propertyId: selectedPropertyId, salePrice: parsedPrice });
      await updateLeadStatus(offerLead.id, 'Offre', `Offre soumise au promoteur pour validation finale. Prix: ${parsedPrice} MAD`);
      setOfferLead(null);
      setSelectedPropertyId('');
      setSalePrice('');
      setSelected(null);
      Alert.alert('Offre', 'Le dossier a ete envoye au promoteur pour validation finale.');
    } catch (error: any) {
      Alert.alert('Offre', error?.message || 'Impossible de creer cette offre.');
    } finally {
      setSubmittingOffer(false);
    }
  };

  const openOfferModal = (lead: Lead) => {
    const firstProperty = (lead.matchedProperties ?? []).find(isProperty);
    setOfferLead(lead);
    setSelectedPropertyId(firstProperty?.id || '');
    setSalePrice(firstProperty?.priceRaw ? String(firstProperty.priceRaw) : '');
  };

  const openVisitModal = (lead: Lead) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(11, 0, 0, 0);
    setVisitLead(lead);
    setVisitDateTime(tomorrow);
    setShowDatePicker(Platform.OS === 'ios');
    setShowTimePicker(Platform.OS === 'ios');
  };

  const openInterestModal = (lead: Lead) => {
    const property = getPrimaryMatchedProperty(lead);
    setInterestLead(lead);
    setInterestMessage(
      lead.latestInterestConfirmation?.status === 'pending'
        ? (lead.latestInterestConfirmation.requestMessage || '')
        : `Suite a votre visite, merci de confirmer si vous souhaitez avancer sur ${property?.title || 'ce projet'}.`,
    );
  };

  const submitInterestConfirmation = async () => {
    if (!interestLead) return;
    try {
      setSubmittingInterest(true);
      await InterestConfirmations.create({
        leadId: interestLead.id,
        requestMessage: interestMessage.trim() || undefined,
      });
      await loadLeads();
      setInterestLead(null);
      setInterestMessage('');
      Alert.alert('Confirmation', 'La demande de confirmation a ete envoyee au client.');
    } catch (error: any) {
      Alert.alert('Confirmation', error?.message || 'Impossible d envoyer cette demande.');
    } finally {
      setSubmittingInterest(false);
    }
  };

  const closeVisitModal = () => {
    setVisitLead(null);
    setVisitDateTime(new Date());
    setShowDatePicker(Platform.OS === 'ios');
    setShowTimePicker(Platform.OS === 'ios');
  };

  const handleVisitPickerChange = (mode: 'date' | 'time') => (event: DateTimePickerEvent, value?: Date) => {
    if (Platform.OS === 'android') {
      if (mode === 'date') setShowDatePicker(false);
      if (mode === 'time') setShowTimePicker(false);
    }
    if (!value || event.type === 'dismissed') return;
    setVisitDateTime((current) => {
      const next = new Date(current);
      if (mode === 'date') {
        next.setFullYear(value.getFullYear(), value.getMonth(), value.getDate());
      } else {
        next.setHours(value.getHours(), value.getMinutes(), 0, 0);
      }
      return next;
    });
  };

  const submitVisit = async () => {
    if (!visitLead) return;
    if (Number.isNaN(visitDateTime.getTime())) {
      Alert.alert('Visite', 'Selectionne une date et une heure valides.');
      return;
    }

    try {
      setSubmittingVisit(true);
      await updateLeadStatus(
        visitLead.id,
        PIPELINE_ACTIONS.find(isVisitedAction) ?? 'Nouveau',
        `Visite planifiee le ${formatVisitDate(visitDateTime)} a ${formatVisitTime(visitDateTime)}.`,
        visitDateTime.toISOString(),
      );
      closeVisitModal();
      setSelected(null);
      setCommercialActiveTab('Visits');
    } catch (error: any) {
      Alert.alert('Visite', error?.message || 'Impossible de planifier cette visite.');
    } finally {
      setSubmittingVisit(false);
    }
  };

  const handlePipelineAction = async (lead: Lead, action: LeadStatus) => {
    try {
      if (action === 'Offre') {
        openOfferModal(lead);
        return;
      }
      if (isVisitedAction(action)) {
        openVisitModal(lead);
        return;
      }

      await updateLeadStatus(lead.id, action);
      setSelected(null);
      Alert.alert('Lead', `Le statut du dossier est maintenant "${action}".`);
    } catch (error: any) {
      Alert.alert('Lead', error?.message || 'Impossible de mettre a jour ce dossier.');
    }
  };

  const handleOpenConversation = async (lead: Lead) => {
    if (!lead.clientId || !currentUser?.id) {
      Alert.alert('Messages', 'Impossible d ouvrir la conversation pour ce lead.');
      return;
    }

    try {
      const existingConversation = conversations.find((conversation) => (
        conversation.participantIds.includes(currentUser.id)
        && conversation.participantIds.includes(lead.clientId)
      ));

      let conversationId = existingConversation?.id || null;
      if (!conversationId) {
        const relatedProperty = (lead.matchedProperties ?? []).find(isProperty);
        const created = await Conversations.create({
          participantIds: [lead.clientId],
          relatedPropertyId: relatedProperty?.id,
          relatedPropertyTitle: relatedProperty?.title,
        }) as { id: string };
        conversationId = created?.id || null;
        await loadConversations();
      }

      if (!conversationId) {
        Alert.alert('Messages', 'Impossible d ouvrir la conversation pour ce lead.');
        return;
      }

      focusConversation(conversationId);
      setCommercialActiveTab('Messages');
      setSelected(null);
    } catch (error: any) {
      Alert.alert('Messages', error?.message || 'Impossible d ouvrir la conversation.');
    }
  };

  const updateClientValidation = async (lead: Lead, status: 'validated' | 'pending_review' | 'rejected') => {
    if (!lead.clientId || currentUser?.role !== 'admin') return;
    try {
      await Admin.updateClientValidation(lead.clientId, status);
      setSelected((prev) => (prev && prev.id === lead.id ? { ...prev, accountValidationStatus: status } : prev));
      await loadLeads();
      Alert.alert('Validation', 'Le statut de validation du compte client a ete mis a jour.');
    } catch (error: any) {
      Alert.alert('Validation', error?.message || 'Impossible de mettre a jour la validation.');
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={Colors.gradientPrimary} style={styles.header}>
        <Text style={styles.headerTitle}>{t('leads.title')}</Text>
        <Text style={styles.headerSub}>{leads.length} leads - {matchingCount} {t('leads.matchingSource').toLowerCase()}</Text>
      </LinearGradient>

      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {FILTERS.map((item) => (
            <TouchableOpacity
              key={item.key}
              onPress={() => setFilter(item.key)}
              style={[styles.filterChip, filter === item.key && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, filter === item.key && styles.filterTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 10 }}
        showsVerticalScrollIndicator={false}
      >
        {filtered.map((lead) => (
          <TouchableOpacity
            key={lead.id}
            onPress={() => setSelected(lead)}
            activeOpacity={0.85}
            style={styles.leadCard}
          >
            <ScoreRing score={lead.score} size={48} />

            <View style={{ flex: 1 }}>
              <View style={styles.leadTop}>
                <Text style={styles.leadName}>{lead.clientName}</Text>
                <View style={[styles.statusPill, { backgroundColor: `${STATUS_COLORS[lead.status]}1A` }]}>
                  <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[lead.status] }]} />
                  <Text style={[styles.statusText, { color: STATUS_COLORS[lead.status] }]}>{lead.status}</Text>
                </View>
              </View>

              {lead.source === 'matching' && (
                <View style={styles.matchingPill}>
                  <Ionicons name="sparkles-outline" size={11} color={Colors.primary} />
                  <Text style={styles.matchingPillText}>{t('leads.matchingSource')}</Text>
                </View>
              )}

              <Text style={styles.leadMeta}>
                {displayValue(lead.answers.propertyType)} - {displayValue(lead.answers.objective)} - {displayValue(lead.answers.budget)}
              </Text>
              <Text style={styles.leadZone} numberOfLines={1}>
                <Ionicons name="location-outline" size={11} color={Colors.textMuted} /> {displayValue(lead.answers.targetZone || lead.answers.city)}
              </Text>
            </View>

            <View style={[styles.tempBadge, { backgroundColor: getTemperatureBgColor(lead.temperature) }]}>
              <Text style={{ fontSize: 14 }}>{getTemperatureEmoji(lead.temperature)}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet">
        {selected && (
          <View style={styles.modal}>
            <LinearGradient colors={Colors.gradientPrimary} style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelected(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={Colors.white} />
              </TouchableOpacity>
              <View style={styles.modalHeaderContent}>
                <Text style={styles.modalName}>{selected.clientName}</Text>
                <View style={[styles.tempChip, { backgroundColor: getTemperatureBgColor(selected.temperature) }]}>
                  <Text style={{ fontSize: 13 }}>{getTemperatureEmoji(selected.temperature)}</Text>
                  <Text style={[styles.tempChipText, { color: getTemperatureColor(selected.temperature) }]}>
                    {getTemperatureLabel(selected.temperature)}
                  </Text>
                </View>
              </View>
              <View style={styles.scoreRow}>
                <View style={styles.scoreBox}>
                  <Text style={styles.scoreValue}>{selected.score}</Text>
                  <Text style={styles.scoreLabel}>Score</Text>
                </View>
              </View>
            </LinearGradient>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('leads.contact')}</Text>
                <InfoRow icon="call-outline" label="Telephone" value={displayValue(selected.clientPhone)} />
                <InfoRow icon="mail-outline" label="Email" value={displayValue(selected.clientEmail)} />
                <InfoRow icon="location-outline" label="Ville ciblee" value={displayValue(selected.answers.city || selected.answers.searchedCity)} />
                <InfoRow icon="compass-outline" label="Zone ciblee" value={displayValue(selected.answers.targetZone)} />
                <InfoRow icon="home-outline" label="Ville actuelle" value={displayValue(selected.answers.currentCity)} />
                <InfoRow icon="chatbubble-ellipses-outline" label="Contact prefere" value={displayValue(selected.answers.contactPreference)} />
                <InfoRow icon="language-outline" label="Langue" value={displayValue(selected.answers.preferredLanguage)} />
                <InfoRow icon="airplane-outline" label="MRE" value={selected.answers.isMRE ? `Oui${selected.answers.country ? ` (${selected.answers.country})` : ''}` : 'Non'} />
                <InfoRow
                  icon="shield-checkmark-outline"
                  label="Validation"
                  value={selected.accountValidationStatus === 'validated' ? 'Validé' : selected.accountValidationStatus === 'rejected' ? 'À revoir' : selected.accountValidationStatus === 'pending_review' ? 'En attente' : 'Brouillon'}
                />
                <View style={styles.contactActions}>
                  <TouchableOpacity style={styles.contactBtn} onPress={() => handleOpenConversation(selected)}>
                    <Ionicons name="chatbubble-outline" size={16} color={Colors.primary} />
                    <Text style={styles.contactBtnText}>Ouvrir le chat</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {currentUser?.role === 'admin' ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{t('leads.accountValidation')}</Text>
                  <View style={styles.actionsGrid}>
                    {[
                      { key: 'validated', label: 'Valider' },
                      { key: 'pending_review', label: 'En attente' },
                      { key: 'rejected', label: 'A revoir' },
                    ].map((item) => (
                      (() => {
                        const palette = validationButtonColors(item.key as 'validated' | 'pending_review' | 'rejected');
                        const isActive = selected.accountValidationStatus === item.key;
                        return (
                      <TouchableOpacity
                        key={item.key}
                        onPress={() => updateClientValidation(selected, item.key as 'validated' | 'pending_review' | 'rejected')}
                        style={[
                          styles.actionBtn,
                          {
                            backgroundColor: isActive ? palette.bg : Colors.bgSoft,
                            borderColor: isActive ? palette.border : Colors.border,
                          },
                        ]}
                      >
                        <Text style={[styles.actionBtnText, { color: isActive ? palette.text : Colors.textBody }]}>{item.label}</Text>
                      </TouchableOpacity>
                        );
                      })()
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('leads.project')}</Text>
                {(() => {
                  const primaryMatch = getPrimaryMatchedProperty(selected);
                  return (
                    <>
                      <InfoRow icon="business-outline" label="Projet matché" value={primaryMatch?.project || primaryMatch?.title || '-'} />
                      <InfoRow icon="home-outline" label="Promoteur matché" value={primaryMatch?.promoter || '-'} />
                      <InfoRow icon="person-outline" label="Commercial affecté" value={selected.commercialName || '-'} />
                    </>
                  );
                })()}
                <InfoRow icon="sparkles-outline" label="Origine" value={leadOriginLabel(selected)} />
                <InfoRow icon="home-outline" label="Type" value={displayValue(selected.answers.propertyType)} />
                <InfoRow icon="flag-outline" label="Objectif" value={displayValue(selected.answers.objective || selected.answers.clientGoal)} />
                <InfoRow icon="git-compare-outline" label="Marche" value={displayValue(selected.answers.purchaseStage)} />
                <InfoRow icon="construct-outline" label="Etat recherche" value={displayValue(selected.answers.projectStage)} />
                <InfoRow icon="people-outline" label="Contexte d achat" value={displayValue(selected.answers.ownershipContext)} />
                <InfoRow icon="map-outline" label="Zone" value={displayValue(selected.answers.targetZone)} />
                <InfoRow icon="cash-outline" label="Budget max" value={displayValue(selected.answers.budget)} />
                <InfoRow icon="wallet-outline" label="Budget min" value={displayValue(selected.answers.budgetMin)} />
                <InfoRow icon="card-outline" label="Financement" value={displayValue(selected.answers.financing)} />
                <InfoRow icon="time-outline" label="Delai" value={displayValue(selected.answers.purchaseDeadline)} />
                <InfoRow icon="resize-outline" label="Surface ideale" value={selected.answers.desiredAreaRaw ? `${selected.answers.desiredAreaRaw} m2` : '-'} />
                <InfoRow icon="scan-outline" label="Surface min" value={selected.answers.desiredAreaMinRaw ? `${selected.answers.desiredAreaMinRaw} m2` : '-'} />
                <InfoRow icon="bed-outline" label="Pieces" value={selected.answers.rooms ? `${selected.answers.rooms} piece(s)` : '-'} />
                <InfoRow icon="water-outline" label="Salles de bain" value={selected.answers.bathrooms ? `${selected.answers.bathrooms}` : '-'} />
                <InfoRow icon="car-outline" label="Parking requis" value={yesNoValue(selected.answers.parkingRequired)} />
                <InfoRow icon="sunny-outline" label="Terrasse requise" value={yesNoValue(selected.answers.terraceRequired)} />
                <InfoRow icon="ban-outline" label="Zones exclues" value={listValue(selected.answers.excludedZones)} />
              </View>

              {selected.notes ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Derniere interaction</Text>
                  <Text style={styles.notesText}>{selected.notes.split('\n').filter(Boolean).slice(-1)[0]}</Text>
                </View>
              ) : null}

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Apres visite</Text>
                <InfoRow
                  icon="checkmark-done-outline"
                  label="Confirmation d interet"
                  value={
                    selected.latestInterestConfirmation?.status === 'confirmed'
                      ? 'Confirmee'
                      : selected.latestInterestConfirmation?.status === 'declined'
                        ? 'Refusee'
                        : selected.latestInterestConfirmation?.status === 'needs_followup'
                          ? 'Suivi demande'
                          : selected.latestInterestConfirmation?.status === 'pending'
                            ? 'En attente client'
                            : 'Aucune'
                  }
                />
                <InfoRow
                  icon="share-social-outline"
                  label="Transmission promoteur"
                  value={selected.latestTransfer ? 'Transmis' : 'Pas encore'}
                />
                <Text style={styles.helperText}>
                  Envoie cette demande apres la visite pour qualifier le lead avant transmission au promoteur.
                </Text>
                <TouchableOpacity
                  style={styles.contactBtn}
                  onPress={() => openInterestModal(selected)}
                >
                  <Ionicons name="paper-plane-outline" size={16} color={Colors.primary} />
                  <Text style={styles.contactBtnText}>Demander la confirmation</Text>
                </TouchableOpacity>
              </View>

              {selected.answers.mustHave?.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Criteres indispensables</Text>
                  <View style={styles.tagsRow}>
                    {selected.answers.mustHave.map((item) => (
                      <View key={item} style={styles.tag}>
                        <Text style={styles.tagText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {!!selected.answers.optionalCriteria?.length && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Criteres souhaites</Text>
                  <View style={styles.tagsRow}>
                    {(selected.answers.optionalCriteria || []).map((item) => (
                      <View key={item} style={styles.tag}>
                        <Text style={styles.tagText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Qualification</Text>
                <InfoRow icon="speedometer-outline" label="Urgence" value={selected.answers.urgencyLevel ? `${selected.answers.urgencyLevel}/100` : '-'} />
                <InfoRow icon="checkmark-circle-outline" label="Serieux projet" value={selected.answers.projectSeriousness ? `${selected.answers.projectSeriousness}/100` : '-'} />
                <InfoRow icon="cash-outline" label="Maturite financement" value={selected.answers.financingReadiness ? `${selected.answers.financingReadiness}/100` : '-'} />
                <InfoRow icon="sparkles-outline" label="Compatibilite" value={selected.answers.compatibilityScore ? `${selected.answers.compatibilityScore}/100` : '-'} />
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Historique</Text>
                {selected.statusHistory.map((entry, index) => (
                  <View key={`${entry.status}-${index}`} style={styles.historyItem}>
                    <View style={[styles.historyDot, { backgroundColor: STATUS_COLORS[entry.status] }]} />
                    <View>
                      <Text style={styles.historyStatus}>{entry.status}</Text>
                      <Text style={styles.historyDate}>{entry.date}{entry.note ? ` - ${entry.note}` : ''}</Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('leads.advance')}</Text>
                <Text style={styles.helperText}>Le passage en offre envoie le dossier au promoteur pour validation finale.</Text>
                <View style={styles.actionsGrid}>
                  {PIPELINE_ACTIONS.map((action) => (
                    <TouchableOpacity
                      key={action}
                      onPress={() => {
                        handlePipelineAction(selected, action);
                      }}
                      style={[
                        styles.actionBtn,
                        { borderColor: `${STATUS_COLORS[action]}60`, backgroundColor: `${STATUS_COLORS[action]}12` },
                      ]}
                    >
                      <Text style={[styles.actionBtnText, { color: STATUS_COLORS[action] }]}>{action}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        )}
      </Modal>

      <Modal visible={!!interestLead} transparent animationType="fade">
        <View style={styles.offerOverlay}>
          <View style={styles.offerModal}>
            <Text style={styles.offerTitle}>Confirmer l interet</Text>
            <Text style={styles.offerText}>
              Cette demande sera envoyee au client apres la visite. Si le client confirme, le lead sera transmis au promoteur.
            </Text>

            <Text style={styles.offerLabel}>Message</Text>
            <TextInput
              value={interestMessage}
              onChangeText={setInterestMessage}
              multiline
              numberOfLines={4}
              placeholder="Ajoute un message court pour le client"
              placeholderTextColor={Colors.textMuted}
              style={[styles.offerInput, styles.offerTextarea]}
            />

            <View style={styles.offerActions}>
              <TouchableOpacity
                style={styles.offerCancel}
                onPress={() => {
                  setInterestLead(null);
                  setInterestMessage('');
                }}
              >
                <Text style={styles.offerCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.offerSubmit, submittingInterest && styles.offerSubmitDisabled]}
                disabled={submittingInterest}
                onPress={submitInterestConfirmation}
              >
                <Text style={styles.offerSubmitText}>{submittingInterest ? 'Envoi...' : 'Envoyer'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!offerLead} transparent animationType="fade">
        <View style={styles.offerOverlay}>
          <View style={styles.offerModal}>
            <Text style={styles.offerTitle}>Soumettre une offre</Text>
            <Text style={styles.offerText}>
              Choisis le bien concerne et le prix de vente avant l envoi au promoteur.
            </Text>

            <Text style={styles.offerLabel}>Projet / bien</Text>
            <View style={styles.offerOptions}>
              {offerProperties.map((property) => (
                <TouchableOpacity
                  key={property.id}
                  style={[
                    styles.offerOption,
                    selectedPropertyId === property.id && styles.offerOptionActive,
                  ]}
                  onPress={() => {
                    setSelectedPropertyId(property.id);
                    setSalePrice(String(property.priceRaw || ''));
                  }}
                >
                  <Text style={styles.offerOptionTitle}>{property.title}</Text>
                  <Text style={styles.offerOptionMeta}>{property.district}, {property.city} - {property.price}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.offerLabel}>Prix de vente</Text>
            <TextInput
              value={salePrice}
              onChangeText={setSalePrice}
              keyboardType="numeric"
              placeholder="Ex: 2450000"
              placeholderTextColor={Colors.textMuted}
              style={styles.offerInput}
            />

            <View style={styles.offerActions}>
              <TouchableOpacity
                style={styles.offerCancel}
                onPress={() => {
                  setOfferLead(null);
                  setSelectedPropertyId('');
                  setSalePrice('');
                }}
              >
                <Text style={styles.offerCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.offerSubmit, submittingOffer && styles.offerSubmitDisabled]}
                disabled={submittingOffer}
                onPress={submitOffer}
              >
                <Text style={styles.offerSubmitText}>{submittingOffer ? 'Envoi...' : 'Envoyer'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!visitLead} transparent animationType="fade">
        <View style={styles.offerOverlay}>
          <View style={styles.offerModal}>
            <Text style={styles.offerTitle}>Planifier une visite</Text>
            <Text style={styles.offerText}>
              Choisis la date et l heure. Le client recevra une notification et la visite sera visible dans Visites.
            </Text>

            <Text style={styles.offerLabel}>Date</Text>
            <TouchableOpacity
              activeOpacity={Platform.OS === 'ios' ? 1 : 0.85}
              style={styles.pickerCard}
              onPress={() => {
                if (Platform.OS === 'android') setShowDatePicker(true);
              }}
            >
              <View style={styles.pickerSummary}>
                <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
                <Text style={styles.pickerSummaryText}>{formatVisitDate(visitDateTime)}</Text>
              </View>
              {showDatePicker ? (
                <DateTimePicker
                  value={visitDateTime}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  minimumDate={new Date()}
                  onChange={handleVisitPickerChange('date')}
                />
              ) : (
                <Text style={styles.pickerHint}>Touchez pour choisir la date</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.offerLabel}>Heure</Text>
            <TouchableOpacity
              activeOpacity={Platform.OS === 'ios' ? 1 : 0.85}
              style={styles.pickerCard}
              onPress={() => {
                if (Platform.OS === 'android') setShowTimePicker(true);
              }}
            >
              <View style={styles.pickerSummary}>
                <Ionicons name="time-outline" size={18} color={Colors.primary} />
                <Text style={styles.pickerSummaryText}>{formatVisitTime(visitDateTime)}</Text>
              </View>
              {showTimePicker ? (
                <DateTimePicker
                  value={visitDateTime}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleVisitPickerChange('time')}
                />
              ) : (
                <Text style={styles.pickerHint}>Touchez pour choisir l heure</Text>
              )}
            </TouchableOpacity>

            <View style={styles.offerActions}>
              <TouchableOpacity style={styles.offerCancel} onPress={closeVisitModal}>
                <Text style={styles.offerCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.offerSubmit, submittingVisit && styles.offerSubmitDisabled]}
                disabled={submittingVisit}
                onPress={submitVisit}
              >
                <Text style={styles.offerSubmitText}>{submittingVisit ? 'Validation...' : 'Confirmer'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={infoStyles.row}>
      <Ionicons name={icon as any} size={14} color={Colors.primary} style={infoStyles.icon} />
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={infoStyles.value}>{value}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.borderSoft },
  icon: { width: 22 },
  label: { flex: 1, fontSize: 13, color: Colors.textSoft, fontWeight: '500' },
  value: { fontSize: 13, fontWeight: '700', color: Colors.textDark, maxWidth: '55%', textAlign: 'right' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgMain },
  header: { paddingTop: 20, paddingBottom: 24, paddingHorizontal: 24, alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.white },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  filterBar: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.bgCard, borderBottomWidth: 1, borderBottomColor: Colors.borderSoft },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.bgSoft, borderWidth: 1.5, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.lavenderUltra, borderColor: Colors.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: Colors.textSoft },
  filterTextActive: { color: Colors.primary, fontWeight: '700' },
  scroll: { flex: 1 },
  leadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  leadTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  leadName: { fontSize: 15, fontWeight: '700', color: Colors.textDark, flex: 1 },
  leadMeta: { fontSize: 12, color: Colors.textSoft, marginBottom: 2, marginTop: 6 },
  leadZone: { fontSize: 11, color: Colors.textMuted },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusDot: { width: 5, height: 5, borderRadius: 2.5 },
  statusText: { fontSize: 10, fontWeight: '700' },
  matchingPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, backgroundColor: Colors.lavenderUltra, marginTop: 6 },
  matchingPillText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  tempBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  offerOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  offerModal: { width: '100%', backgroundColor: Colors.bgCard, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: Colors.borderSoft },
  offerTitle: { fontSize: 18, fontWeight: '800', color: Colors.textDark, marginBottom: 6 },
  offerText: { fontSize: 13, color: Colors.textSoft, lineHeight: 20, marginBottom: 16 },
  offerLabel: { fontSize: 12, fontWeight: '700', color: Colors.textDark, marginBottom: 8 },
  offerOptions: { gap: 8, marginBottom: 16 },
  offerOption: { borderWidth: 1, borderColor: Colors.borderSoft, borderRadius: 14, padding: 12, backgroundColor: Colors.bgSoft },
  offerOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.lavenderUltra },
  offerOptionTitle: { fontSize: 13, fontWeight: '800', color: Colors.textDark, marginBottom: 2 },
  offerOptionMeta: { fontSize: 12, color: Colors.textSoft },
  offerInput: { borderWidth: 1, borderColor: Colors.borderSoft, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontWeight: '600', color: Colors.textDark, backgroundColor: Colors.bgSoft, marginBottom: 16 },
  offerTextarea: { minHeight: 108, textAlignVertical: 'top', fontWeight: '500' },
  pickerCard: { borderWidth: 1, borderColor: Colors.borderSoft, borderRadius: 16, backgroundColor: Colors.bgSoft, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 6, marginBottom: 16 },
  pickerSummary: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6, paddingBottom: 6 },
  pickerSummaryText: { fontSize: 14, fontWeight: '700', color: Colors.textDark },
  pickerHint: { fontSize: 12, color: Colors.textSoft, paddingHorizontal: 6, paddingBottom: 8 },
  offerActions: { flexDirection: 'row', gap: 10 },
  offerCancel: { flex: 1, borderRadius: 14, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgSoft },
  offerCancelText: { fontSize: 14, fontWeight: '700', color: Colors.textSoft },
  offerSubmit: { flex: 1, borderRadius: 14, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accentMagenta },
  offerSubmitDisabled: { opacity: 0.65 },
  offerSubmitText: { fontSize: 14, fontWeight: '800', color: Colors.white },
  modal: { flex: 1, backgroundColor: Colors.bgMain },
  modalHeader: { paddingTop: 52, paddingBottom: 20, paddingHorizontal: 20 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  modalHeaderContent: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  modalName: { fontSize: 22, fontWeight: '800', color: Colors.white, flex: 1 },
  tempChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  tempChipText: { fontSize: 12, fontWeight: '700' },
  scoreRow: { flexDirection: 'row' },
  scoreBox: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  scoreValue: { fontSize: 20, fontWeight: '900', color: Colors.white },
  scoreLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  modalScroll: { flex: 1 },
  section: { padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.borderSoft },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: Colors.textDark, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  contactActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  contactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    backgroundColor: Colors.lavenderUltra,
    paddingVertical: 12,
  },
  contactBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  helperText: { fontSize: 12, color: Colors.textSoft, marginBottom: 12, lineHeight: 18 },
  notesText: { fontSize: 13, lineHeight: 20, color: Colors.textSoft },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: Colors.lavenderUltra, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: Colors.lavenderLight },
  tagText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  historyItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  historyDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  historyStatus: { fontSize: 13, fontWeight: '700', color: Colors.textDark },
  historyDate: { fontSize: 12, color: Colors.textSoft, marginTop: 1 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: { minWidth: 104, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { fontSize: 13, fontWeight: '800' },
});
