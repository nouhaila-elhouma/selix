import React, { useEffect, useState } from 'react';
import {
  Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { SupportRequests, Timeline } from '../../lib/api';
import { AppLanguage, SupportRequest, TimelineEvent } from '../../types';
import { getScoreColor, getTemperatureColor, getTemperatureLabel } from '../../utils/scoring';
import { Divider } from '../../components/ui';

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

const LANGUAGE_OPTIONS: Array<{ key: AppLanguage; label: string }> = [
  { key: 'fr', label: 'profile.language.fr' },
  { key: 'en', label: 'profile.language.en' },
  { key: 'ar', label: 'profile.language.ar' },
];

const TIMELINE_LABELS: Record<string, string> = {
  match_created: 'Match cree',
  project_liked: 'Projet like',
  project_passed: 'Projet ignore',
  lead_submitted: 'Demande envoyee',
  profile_updated: 'Profil mis a jour',
  lead_status_updated: 'Statut du dossier',
  visit_scheduled: 'Visite planifiee',
  visit_confirmed: 'Presence confirmee',
  visit_reschedule_requested: 'Demande de report',
  interest_confirmation_requested: 'Confirmation demandee',
  interest_confirmed: 'Interet confirme',
  interest_declined: 'Interet refuse',
  interest_followup_requested: 'Suivi complementaire',
  message: 'Message',
  document_shared: 'Document partage',
  offer_sent: 'Offre envoyee',
  offer_validated: 'Offre validee',
};

function formatTimelineDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString('fr-FR')} a ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
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

export function ProfileScreen() {
  const {
    currentUser,
    leads,
    favorites,
    notifications,
    appConfig,
    appLanguage,
    t,
    realtimeVersion,
    logout,
    startQuestionnaireEdit,
    updateMyProfile,
    setAppLanguage,
    setClientActiveTab,
    focusConversation,
    markNotificationRead,
    markAllNotificationsRead,
  } = useApp();

  const myLead = leads.find((lead) => lead.clientEmail === currentUser?.email) || leads[0];
  const [editVisible, setEditVisible] = useState(false);
  const [languageVisible, setLanguageVisible] = useState(false);
  const [notificationsView, setNotificationsView] = useState(false);
  const [timelineView, setTimelineView] = useState(false);
  const [infoVisible, setInfoVisible] = useState<null | 'support' | 'security' | 'terms'>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([]);
  const [name, setName] = useState(currentUser?.name || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [supportCategory, setSupportCategory] = useState<SupportRequest['category']>('question');
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [supportSaving, setSupportSaving] = useState(false);

  useEffect(() => {
    setName(currentUser?.name || '');
    setPhone(currentUser?.phone || '');
  }, [currentUser?.name, currentUser?.phone]);

  useEffect(() => {
    if (!timelineView) return undefined;

    let mounted = true;
    const loadTimeline = () => {
      Timeline.list()
        .then((items) => {
          if (mounted) setTimelineEvents(uniqueById(items as TimelineEvent[]));
        })
        .catch(() => {
          if (mounted) setTimelineEvents([]);
        });
    };

    loadTimeline();

    return () => {
      mounted = false;
    };
  }, [timelineView, realtimeVersion]);

  const safeTimelineEvents = uniqueById(timelineEvents);
  const safeNotifications = uniqueById(notifications);
  const safeSupportRequests = uniqueById(supportRequests);

  const handleMenuPress = (label: string) => {
    if (label === 'edit-profile') {
      setEditVisible(true);
      return;
    }
    if (label === 'real-estate-project') {
      startQuestionnaireEdit();
      return;
    }
    if (label === 'language') {
      setLanguageVisible(true);
      return;
    }
    if (label === 'followup') {
      setTimelineView(true);
      return;
    }
    if (label === 'notifications') {
      setNotificationsView(true);
      return;
    }
    if (label === 'support') {
      openSupportConversation();
      return;
    }
    if (label === 'security') {
      setInfoVisible('security');
      return;
    }
    if (label === 'terms') {
      setInfoVisible('terms');
    }
  };

  const saveProfile = async () => {
    try {
      setSaving(true);
      await updateMyProfile({ name: name.trim(), phone: phone.trim() });
      setEditVisible(false);
      Alert.alert('Profil', 'Ton profil a ete mis a jour.');
    } catch (error: any) {
      Alert.alert('Profil', error?.message || 'Impossible de mettre a jour le profil.');
    } finally {
      setSaving(false);
    }
  };

  const submitSupportRequest = async () => {
    const subject = supportSubject.trim();
    const message = supportMessage.trim();
    if (subject.length < 4 || message.length < 10) {
      Alert.alert('Support', 'Ajoute un sujet clair et decris le probleme en detail.');
      return;
    }
    try {
      setSupportSaving(true);
      await SupportRequests.create({ category: supportCategory, subject, message });
      setSupportSubject('');
      setSupportMessage('');
      setSupportCategory('question');
      const items = await SupportRequests.mine();
      setSupportRequests(uniqueById(items as SupportRequest[]));
      Alert.alert('Support', 'Votre demande a bien ete envoyee.');
    } catch (error: any) {
      Alert.alert('Support', error?.message || 'Impossible d envoyer la demande.');
    } finally {
      setSupportSaving(false);
    }
  };

  const openSupportConversation = async () => {
    try {
      const response = await SupportRequests.openConversation();
      focusConversation(response.id);
      setClientActiveTab('Messages');
    } catch (error: any) {
      Alert.alert('Support', error?.message || "Impossible d'ouvrir la discussion support.");
    }
  };

  const saveLanguage = async (language: AppLanguage) => {
    await setAppLanguage(language);
    setLanguageVisible(false);
    Alert.alert(t('common.language'), t('profile.languageUpdated'));
  };

  const menuItems = [
    { key: 'edit-profile', icon: 'person-outline', label: t('profile.editProfile'), color: Colors.accentMagenta },
    { key: 'real-estate-project', icon: 'home-outline', label: t('profile.realEstateProject'), color: Colors.accentMagenta },
    { key: 'language', icon: 'language-outline', label: t('common.language'), color: Colors.primaryLight },
    { key: 'followup', icon: 'time-outline', label: t('profile.followup'), color: Colors.accentOrange },
    { key: 'notifications', icon: 'notifications-outline', label: t('profile.notifications'), color: Colors.accentOrange },
    { key: 'security', icon: 'lock-closed-outline', label: t('profile.security'), color: Colors.primaryLight },
    { key: 'support', icon: 'headset-outline', label: t('profile.support'), color: Colors.accentOrange },
    { key: 'terms', icon: 'document-text-outline', label: t('profile.terms'), color: Colors.primaryLight },
  ];

  return (
    timelineView ? (
      <View style={styles.container}>
        <LinearGradient colors={Colors.gradientHero} style={styles.subpageHeader}>
          <TouchableOpacity onPress={() => setTimelineView(false)} style={styles.subpageBack}>
            <Ionicons name="arrow-back" size={20} color={Colors.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.subpageTitle}>Suivi dossier</Text>
            <Text style={styles.subpageSub}>{safeTimelineEvents.length} evenement{safeTimelineEvents.length > 1 ? 's' : ''}</Text>
          </View>
        </LinearGradient>

        <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {safeTimelineEvents.length ? safeTimelineEvents.map((item, index) => (
            <View key={item.id} style={styles.timelineRow}>
              <View style={styles.timelineRail}>
                <View style={styles.timelineDot} />
                {index < safeTimelineEvents.length - 1 ? <View style={styles.timelineLine} /> : null}
              </View>
              <View style={styles.timelineCard}>
                <View style={styles.timelineTop}>
                  <Text style={styles.timelineType}>{TIMELINE_LABELS[item.actionType] || item.actionType}</Text>
                  <Text style={styles.timelineDate}>{formatTimelineDate(item.createdAt)}</Text>
                </View>
                <Text style={styles.timelineActor}>
                  {item.actorRole === 'client' ? 'Client' : item.actorRole === 'commercial' ? 'Commercial' : item.actorRole === 'promoter' ? 'Promoteur' : 'Systeme'}
                  {item.actorName ? ` · ${item.actorName}` : ''}
                </Text>
                <Text style={styles.timelineDescription}>{item.description}</Text>
              </View>
            </View>
          )) : (
            <View style={styles.emptyPage}>
              <Ionicons name="time-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyPageTitle}>Aucun historique</Text>
              <Text style={styles.emptyText}>Les actions importantes de votre dossier apparaitront ici.</Text>
            </View>
          )}
        </ScrollView>
      </View>
    ) : notificationsView ? (
      <View style={styles.container}>
        <LinearGradient colors={Colors.gradientHero} style={styles.subpageHeader}>
          <TouchableOpacity onPress={() => setNotificationsView(false)} style={styles.subpageBack}>
            <Ionicons name="arrow-back" size={20} color={Colors.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.subpageTitle}>Notifications</Text>
            <Text style={styles.subpageSub}>{safeNotifications.length} notification{safeNotifications.length > 1 ? 's' : ''}</Text>
          </View>
          <TouchableOpacity onPress={markAllNotificationsRead}>
            <Text style={styles.subpageAction}>Tout lire</Text>
          </TouchableOpacity>
        </LinearGradient>

        <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {safeNotifications.length ? safeNotifications.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.notificationPageItem, !item.read && styles.notificationUnread]}
              onPress={() => markNotificationRead(item.id)}
            >
              <View style={styles.notificationPageTop}>
                <Text style={styles.notificationTitle}>{item.title}</Text>
                {!item.read ? <View style={styles.unreadDot} /> : null}
              </View>
              <Text style={styles.notificationBody}>{item.body}</Text>
            </TouchableOpacity>
          )) : (
            <View style={styles.emptyPage}>
              <Ionicons name="notifications-off-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyPageTitle}>Aucune notification</Text>
              <Text style={styles.emptyText}>Les nouvelles activites de ton dossier apparaitront ici.</Text>
            </View>
          )}
        </ScrollView>
      </View>
    ) : (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient colors={Colors.gradientHero} style={styles.header}>
        <View style={[styles.deco, styles.decoA]} />
        <View style={[styles.deco, styles.decoB]} />
        <View style={styles.avatarRing}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitials}>
              {currentUser?.name?.split(' ').map((word) => word[0]).slice(0, 2).join('') || 'U'}
            </Text>
          </View>
        </View>
        <Text style={styles.name}>{currentUser?.name || 'Mon Profil'}</Text>

        <View style={styles.badgesRow}>
          <View style={styles.chip}>
            <Ionicons name="person-circle-outline" size={13} color={Colors.white} />
            <Text style={styles.chipText}>Client</Text>
          </View>
          {myLead?.answers.isMRE && (
            <View style={[styles.chip, styles.chipMRE]}>
              <Ionicons name="earth-outline" size={13} color={Colors.white} />
              <Text style={styles.chipText}>MRE</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      <View style={styles.body}>
        {myLead && (
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: getScoreColor(myLead.score) }]}>{myLead.score}</Text>
              <Text style={styles.statLabel}>Score</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{favorites.length}</Text>
              <Text style={styles.statLabel}>Favoris</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: getTemperatureColor(myLead.temperature) }]}>
                {getTemperatureLabel(myLead.temperature)}
              </Text>
              <Text style={styles.statLabel}>Profil</Text>
            </View>
          </View>
        )}

        {myLead && (
          <View style={styles.projectCard}>
            <View style={styles.projectHeader}>
              <Ionicons name="home-outline" size={18} color={Colors.accentMagenta} />
              <Text style={styles.projectTitle}>Mon projet</Text>
              <View style={styles.statusChip}>
                <Text style={styles.statusChipText}>{myLead.status}</Text>
              </View>
            </View>
            <Divider style={{ marginVertical: 12 }} />
            <View style={styles.validationRow}>
              <Text style={styles.projectItemLabel}>Validation compte</Text>
              <Text style={styles.validationValue}>{currentUser?.accountValidationStatus === 'validated' ? 'Validé' : currentUser?.accountValidationStatus === 'rejected' ? 'À revoir' : currentUser?.accountValidationStatus === 'pending_review' ? 'En attente' : 'Brouillon'}</Text>
            </View>
              <View style={styles.projectGrid}>
              <View style={styles.projectItem}>
                <Text style={styles.projectItemLabel}>Type</Text>
                <Text style={styles.projectItemValue}>{displayValue(myLead.answers.propertyType)}</Text>
              </View>
              <View style={styles.projectItem}>
                <Text style={styles.projectItemLabel}>Objectif</Text>
                <Text style={styles.projectItemValue}>{displayValue(myLead.answers.objective || myLead.answers.clientGoal)}</Text>
              </View>
              <View style={styles.projectItem}>
                <Text style={styles.projectItemLabel}>Budget max</Text>
                <Text style={styles.projectItemValue}>{displayValue(myLead.answers.budget)}</Text>
              </View>
              <View style={styles.projectItem}>
                <Text style={styles.projectItemLabel}>Zone</Text>
                <Text style={styles.projectItemValue} numberOfLines={1}>{displayValue(myLead.answers.targetZone)}</Text>
              </View>
              <View style={styles.projectItem}>
                <Text style={styles.projectItemLabel}>Ville ciblee</Text>
                <Text style={styles.projectItemValue}>{displayValue(myLead.answers.city || myLead.answers.searchedCity)}</Text>
              </View>
              <View style={styles.projectItem}>
                <Text style={styles.projectItemLabel}>Budget min</Text>
                <Text style={styles.projectItemValue}>{displayValue(myLead.answers.budgetMin)}</Text>
              </View>
              <View style={styles.projectItem}>
                <Text style={styles.projectItemLabel}>Financement</Text>
                <Text style={styles.projectItemValue}>{displayValue(myLead.answers.financing)}</Text>
              </View>
              <View style={styles.projectItem}>
                <Text style={styles.projectItemLabel}>Delai</Text>
                <Text style={styles.projectItemValue}>{displayValue(myLead.answers.purchaseDeadline)}</Text>
              </View>
              <View style={styles.projectItem}>
                <Text style={styles.projectItemLabel}>Etat recherche</Text>
                <Text style={styles.projectItemValue}>{displayValue(myLead.answers.projectStage)}</Text>
              </View>
              <View style={styles.projectItem}>
                <Text style={styles.projectItemLabel}>Marche</Text>
                <Text style={styles.projectItemValue}>{displayValue(myLead.answers.purchaseStage)}</Text>
              </View>
              <View style={styles.projectItem}>
                <Text style={styles.projectItemLabel}>Contexte d achat</Text>
                <Text style={styles.projectItemValue}>{displayValue(myLead.answers.ownershipContext)}</Text>
              </View>
              <View style={styles.projectItem}>
                <Text style={styles.projectItemLabel}>Contact prefere</Text>
                <Text style={styles.projectItemValue}>{displayValue(myLead.answers.contactPreference)}</Text>
              </View>
              <View style={styles.projectItem}>
                <Text style={styles.projectItemLabel}>Langue</Text>
                <Text style={styles.projectItemValue}>{displayValue(myLead.answers.preferredLanguage)}</Text>
              </View>
              <View style={styles.projectItem}>
                <Text style={styles.projectItemLabel}>Surface ideale</Text>
                <Text style={styles.projectItemValue}>{myLead.answers.desiredAreaRaw ? `${myLead.answers.desiredAreaRaw} m2` : '-'}</Text>
              </View>
              <View style={styles.projectItem}>
                <Text style={styles.projectItemLabel}>Surface min</Text>
                <Text style={styles.projectItemValue}>{myLead.answers.desiredAreaMinRaw ? `${myLead.answers.desiredAreaMinRaw} m2` : '-'}</Text>
              </View>
              <View style={styles.projectItem}>
                <Text style={styles.projectItemLabel}>Pieces</Text>
                <Text style={styles.projectItemValue}>{myLead.answers.rooms ? `${myLead.answers.rooms}` : '-'}</Text>
              </View>
              <View style={styles.projectItem}>
                <Text style={styles.projectItemLabel}>Salles de bain</Text>
                <Text style={styles.projectItemValue}>{myLead.answers.bathrooms ? `${myLead.answers.bathrooms}` : '-'}</Text>
              </View>
              <View style={styles.projectItem}>
                <Text style={styles.projectItemLabel}>Parking requis</Text>
                <Text style={styles.projectItemValue}>{yesNoValue(myLead.answers.parkingRequired)}</Text>
              </View>
              <View style={styles.projectItem}>
                <Text style={styles.projectItemLabel}>Terrasse requise</Text>
                <Text style={styles.projectItemValue}>{yesNoValue(myLead.answers.terraceRequired)}</Text>
              </View>
              <View style={styles.projectItemWide}>
                <Text style={styles.projectItemLabel}>Criteres indispensables</Text>
                <Text style={styles.projectItemValue}>{listValue(myLead.answers.mustHave)}</Text>
              </View>
              <View style={styles.projectItemWide}>
                <Text style={styles.projectItemLabel}>Criteres souhaites</Text>
                <Text style={styles.projectItemValue}>{listValue(myLead.answers.optionalCriteria)}</Text>
              </View>
              <View style={styles.projectItemWide}>
                <Text style={styles.projectItemLabel}>Zones exclues</Text>
                <Text style={styles.projectItemValue}>{listValue(myLead.answers.excludedZones)}</Text>
              </View>
              <View style={styles.projectItem}>
                <Text style={styles.projectItemLabel}>Urgence</Text>
                <Text style={styles.projectItemValue}>{myLead.answers.urgencyLevel ? `${myLead.answers.urgencyLevel}/100` : '-'}</Text>
              </View>
              <View style={styles.projectItem}>
                <Text style={styles.projectItemLabel}>Compatibilite</Text>
                <Text style={styles.projectItemValue}>{myLead.answers.compatibilityScore ? `${myLead.answers.compatibilityScore}/100` : '-'}</Text>
              </View>
              <View style={styles.projectItem}>
                <Text style={styles.projectItemLabel}>Confirmation d interet</Text>
                <Text style={styles.projectItemValue}>
                  {myLead.latestInterestConfirmation?.status === 'confirmed'
                    ? 'Confirmee'
                    : myLead.latestInterestConfirmation?.status === 'declined'
                      ? 'Refusee'
                      : myLead.latestInterestConfirmation?.status === 'needs_followup'
                        ? 'Suivi demande'
                        : myLead.latestInterestConfirmation?.status === 'pending'
                          ? 'En attente'
                          : '-'}
                </Text>
              </View>
              <View style={styles.projectItem}>
                <Text style={styles.projectItemLabel}>Transmission promoteur</Text>
                <Text style={styles.projectItemValue}>
                  {myLead.latestTransfer
                    ? myLead.latestTransfer.transferStatus === 'signed'
                      ? 'Signe'
                      : myLead.latestTransfer.transferStatus === 'deal_created'
                        ? 'Offre creee'
                        : 'Transmis'
                    : '-'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={startQuestionnaireEdit} style={styles.editProjectBtn}>
              <Ionicons name="create-outline" size={16} color={Colors.accentMagenta} />
              <Text style={styles.editProjectBtnText}>Modifier mon profil / mes criteres</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.menuCard}>
          {menuItems.map((item, index) => (
            <React.Fragment key={item.label}>
              <TouchableOpacity
                style={styles.menuItem}
                activeOpacity={0.7}
                onPress={() => handleMenuPress(item.key)}
              >
                <View style={[styles.menuIcon, { backgroundColor: `${item.color}14` }]}>
                  <Ionicons name={item.icon as any} size={18} color={item.color} />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
                {item.key === 'language' ? <Text style={styles.menuValue}>{t(LANGUAGE_OPTIONS.find((option) => option.key === appLanguage)?.label || 'profile.language.fr')}</Text> : null}
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
              {index < menuItems.length - 1 && <View style={styles.menuDivider} />}
            </React.Fragment>
          ))}
        </View>

        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
          <Text style={styles.logoutText}>{t('profile.logout')}</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={editVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Modifier mon profil</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Nom complet"
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
            />
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="Telephone"
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
              style={styles.input}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditVisible(false)}>
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={saveProfile} disabled={saving}>
                <Text style={styles.saveText}>{saving ? 'Enregistrement...' : 'Enregistrer'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={languageVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('profile.appLanguageTitle')}</Text>
            <Text style={styles.modalHint}>{t('profile.appLanguageHint')}</Text>
            <View style={styles.languageList}>
              {LANGUAGE_OPTIONS.map((item) => {
                const active = item.key === appLanguage;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.languageOption, active && styles.languageOptionActive]}
                    onPress={() => saveLanguage(item.key)}
                  >
                    <Text style={[styles.languageOptionText, active && styles.languageOptionTextActive]}>{t(item.label)}</Text>
                    {active ? <Ionicons name="checkmark-circle" size={20} color={Colors.primary} /> : <Ionicons name="ellipse-outline" size={20} color={Colors.textMuted} />}
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setLanguageVisible(false)}>
              <Text style={styles.cancelText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!infoVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.modalCard, styles.infoCard]}>
            <Text style={styles.modalTitle}>
              {infoVisible === 'support' ? 'Aide & support' : infoVisible === 'security' ? 'Securite & confidentialite' : 'Conditions d utilisation'}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {infoVisible === 'support' ? (
                <View style={styles.infoBlock}>
                  <Text style={styles.infoTitle}>Contacter Selix</Text>
                  {appConfig.supportEmail ? (
                    <Text style={styles.infoText}>Email support: {appConfig.supportEmail}</Text>
                  ) : null}
                  {appConfig.supportWhatsApp ? (
                    <Text style={styles.infoText}>Whatsapp support: {appConfig.supportWhatsApp}</Text>
                  ) : null}
                  {appConfig.supportPhone && appConfig.supportPhone !== appConfig.supportWhatsApp ? (
                    <Text style={styles.infoText}>Telephone support: {appConfig.supportPhone}</Text>
                  ) : null}
                  <Text style={styles.infoText}>Ton commercial reste aussi ton point de contact principal pour les dossiers actifs.</Text>
                  {appConfig.supportHours ? (
                    <>
                      <Text style={styles.infoTitle}>Horaires</Text>
                      <Text style={styles.infoText}>{appConfig.supportHours}</Text>
                    </>
                  ) : null}
                  {!appConfig.supportEmail && !appConfig.supportWhatsApp && !appConfig.supportPhone ? (
                    <Text style={styles.infoText}>Les coordonnees du support n ont pas encore ete configurees par l administration.</Text>
                  ) : null}
                  <Text style={styles.infoTitle}>Signaler un probleme</Text>
                  <View style={styles.chipsWrap}>
                    {[
                      { key: 'question', label: 'Question' },
                      { key: 'problem', label: 'Problème' },
                      { key: 'feedback', label: 'Avis' },
                      { key: 'suggestion', label: 'Suggestion' },
                    ].map((item) => (
                      <TouchableOpacity
                        key={item.key}
                        style={[styles.supportChip, supportCategory === item.key && styles.supportChipActive]}
                        onPress={() => setSupportCategory(item.key as SupportRequest['category'])}
                      >
                        <Text style={[styles.supportChipText, supportCategory === item.key && styles.supportChipTextActive]}>{item.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    value={supportSubject}
                    onChangeText={setSupportSubject}
                    placeholder="Sujet"
                    placeholderTextColor={Colors.textMuted}
                    style={styles.input}
                  />
                  <TextInput
                    value={supportMessage}
                    onChangeText={setSupportMessage}
                    placeholder="Explique ton probleme ou ta demande"
                    placeholderTextColor={Colors.textMuted}
                    multiline
                    textAlignVertical="top"
                    style={[styles.input, styles.textarea]}
                  />
                  <TouchableOpacity
                    style={[styles.saveBtn, supportSaving && styles.saveBtnDisabled]}
                    onPress={submitSupportRequest}
                    disabled={supportSaving}
                  >
                    <Text style={styles.saveText}>{supportSaving ? 'Envoi...' : 'Envoyer au support client'}</Text>
                  </TouchableOpacity>
                  <Text style={styles.infoTitle}>Mes demandes</Text>
                  {safeSupportRequests.length ? safeSupportRequests.map((item) => (
                    <View key={item.id} style={styles.supportItem}>
                      <View style={styles.supportTop}>
                        <Text style={styles.supportSubject}>{item.subject}</Text>
                        <Text style={styles.supportStatus}>{item.status}</Text>
                      </View>
                      <Text style={styles.assignmentMeta}>{item.category || 'question'}</Text>
                      <Text style={styles.infoText}>{item.message}</Text>
                      {item.adminNote ? <Text style={styles.supportNote}>Note support: {item.adminNote}</Text> : null}
                    </View>
                  )) : (
                    <Text style={styles.infoText}>Aucune demande envoyee pour le moment.</Text>
                  )}
                </View>
              ) : null}

              {infoVisible === 'security' ? (
                <View style={styles.infoBlock}>
                  <Text style={styles.infoTitle}>Protection des donnees</Text>
                  <Text style={styles.infoText}>Tes informations servent uniquement au matching immobilier, au suivi commercial et a la mise en relation avec les promoteurs concernes.</Text>
                  <Text style={styles.infoTitle}>Acces aux donnees</Text>
                  <Text style={styles.infoText}>Seuls les roles autorises dans la plateforme peuvent acceder aux donnees necessaires a ton dossier.</Text>
                  <Text style={styles.infoTitle}>Messagerie</Text>
                  <Text style={styles.infoText}>Les conversations in-app restent liees a ton projet immobilier et a son suivi.</Text>
                </View>
              ) : null}

              {infoVisible === 'terms' ? (
                <View style={styles.infoBlock}>
                  <Text style={styles.infoTitle}>Utilisation de la plateforme</Text>
                  <Text style={styles.infoText}>Selix aide a matcher les clients avec des projets immobiliers et a structurer le suivi commercial jusqu a la validation promoteur.</Text>
                  <Text style={styles.infoTitle}>Validation des ventes</Text>
                  <Text style={styles.infoText}>Une vente n est consideree finalisee qu apres validation par le promoteur sur la plateforme.</Text>
                  <Text style={styles.infoTitle}>Mises a jour du profil</Text>
                  <Text style={styles.infoText}>Le client peut modifier ses criteres. Sur un dossier avance, ces changements peuvent necessiter une revue commerciale.</Text>
                </View>
              ) : null}
            </ScrollView>
            <TouchableOpacity style={styles.closeWideBtn} onPress={() => setInfoVisible(null)}>
              <Text style={styles.closeWideText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
    )
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgMain },
  header: { paddingTop: 24, paddingBottom: 32, alignItems: 'center', position: 'relative', overflow: 'hidden' },
  deco: { position: 'absolute', borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.07)' },
  decoA: { width: 220, height: 220, top: -60, right: -60 },
  decoB: { width: 160, height: 160, bottom: -40, left: -40 },
  avatarRing: { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 2, borderColor: 'rgba(246,139,31,0.45)' },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: Colors.accentMagenta },
  avatarInitials: { fontSize: 26, fontWeight: '800', color: Colors.accentMagenta },
  name: { fontSize: 20, fontWeight: '800', color: Colors.white, marginBottom: 12 },
  badgesRow: { flexDirection: 'row', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  chipMRE: { backgroundColor: `${Colors.accentOrange}80` },
  chipText: { fontSize: 11, fontWeight: '700', color: Colors.white },
  body: { padding: 20, gap: 16 },
  statsRow: { flexDirection: 'row', backgroundColor: Colors.bgCard, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.borderSoft },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: Colors.textDark },
  statLabel: { fontSize: 11, color: Colors.textSoft, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: Colors.borderSoft, marginHorizontal: 8 },
  projectCard: { backgroundColor: Colors.bgCard, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.borderSoft },
  projectHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  projectTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.textDark },
  statusChip: { backgroundColor: Colors.lavenderUltra, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusChipText: { fontSize: 11, fontWeight: '700', color: Colors.accentMagenta },
  validationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  validationValue: { fontSize: 12, fontWeight: '800', color: Colors.primary },
  projectGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  projectItem: { width: '50%', paddingVertical: 6 },
  projectItemWide: { width: '100%', paddingVertical: 6 },
  projectItemLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '500', marginBottom: 2 },
  projectItemValue: { fontSize: 13, fontWeight: '700', color: Colors.textDark },
  editProjectBtn: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.lavenderUltra, borderRadius: 12, paddingVertical: 12 },
  editProjectBtnText: { fontSize: 13, fontWeight: '700', color: Colors.accentMagenta },
  menuCard: { backgroundColor: Colors.bgCard, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: Colors.borderSoft },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 15 },
  menuIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: Colors.textDark },
  menuValue: { fontSize: 12, fontWeight: '700', color: Colors.textSoft, marginRight: 8 },
  menuDivider: { height: 1, backgroundColor: Colors.borderSoft, marginLeft: 66 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.dangerLight, padding: 16, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.danger },
  logoutText: { fontSize: 15, fontWeight: '700', color: Colors.danger },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', backgroundColor: Colors.bgCard, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: Colors.borderSoft },
  infoCard: { maxHeight: 500 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.textDark, marginBottom: 14 },
  modalHint: { fontSize: 13, lineHeight: 19, color: Colors.textSoft, marginBottom: 12 },
  input: { borderWidth: 1, borderColor: Colors.borderSoft, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontWeight: '600', color: Colors.textDark, backgroundColor: Colors.bgSoft, marginBottom: 12 },
  languageList: { gap: 10, marginBottom: 12 },
  languageOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, backgroundColor: Colors.bgSoft, borderWidth: 1, borderColor: Colors.borderSoft },
  languageOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.lavenderUltra },
  languageOptionText: { fontSize: 14, fontWeight: '700', color: Colors.textDark },
  languageOptionTextActive: { color: Colors.primary },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, borderRadius: 14, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgSoft },
  cancelText: { fontSize: 14, fontWeight: '700', color: Colors.textSoft },
  saveBtn: { flex: 1, borderRadius: 14, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accentMagenta },
  saveBtnDisabled: { opacity: 0.65 },
  saveText: { fontSize: 14, fontWeight: '800', color: Colors.white },
  notificationItem: { backgroundColor: Colors.bgSoft, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.borderSoft },
  notificationUnread: { borderColor: Colors.accentMagenta, backgroundColor: Colors.lavenderUltra },
  notificationTitle: { fontSize: 13, fontWeight: '800', color: Colors.textDark, marginBottom: 4 },
  notificationBody: { fontSize: 12, lineHeight: 18, color: Colors.textSoft },
  infoBlock: { gap: 10, paddingBottom: 8 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  supportChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.bgSoft, borderWidth: 1, borderColor: Colors.borderSoft },
  supportChipActive: { backgroundColor: Colors.lavenderUltra, borderColor: Colors.primary },
  supportChipText: { fontSize: 12, color: Colors.textSoft, fontWeight: '700' },
  supportChipTextActive: { color: Colors.primary },
  infoTitle: { fontSize: 14, fontWeight: '800', color: Colors.textDark, marginTop: 4 },
  infoText: { fontSize: 13, lineHeight: 20, color: Colors.textSoft },
  textarea: { minHeight: 110, paddingTop: 12 },
  supportItem: { backgroundColor: Colors.bgSoft, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: Colors.borderSoft },
  supportTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 6 },
  supportSubject: { flex: 1, fontSize: 13, fontWeight: '800', color: Colors.textDark },
  supportStatus: { fontSize: 11, fontWeight: '800', color: Colors.accentMagenta, textTransform: 'uppercase' },
  assignmentMeta: { fontSize: 12, color: Colors.textSoft, marginTop: 2 },
  supportNote: { fontSize: 12, lineHeight: 18, color: Colors.textDark, marginTop: 6 },
  emptyText: { fontSize: 13, color: Colors.textSoft, paddingVertical: 12 },
  closeWideBtn: { marginTop: 12, borderRadius: 14, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accentMagenta },
  closeWideText: { fontSize: 14, fontWeight: '800', color: Colors.white },
  subpageHeader: { paddingTop: 20, paddingBottom: 24, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 14 },
  subpageBack: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  subpageTitle: { fontSize: 22, fontWeight: '800', color: Colors.white },
  subpageSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  subpageAction: { fontSize: 13, fontWeight: '700', color: Colors.white },
  notificationPageItem: { backgroundColor: Colors.bgCard, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.borderSoft },
  notificationPageTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.accentOrange },
  timelineRow: { flexDirection: 'row', gap: 12, marginBottom: 14, alignItems: 'stretch' },
  timelineRail: { width: 18, alignItems: 'center' },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.accentMagenta, marginTop: 16, borderWidth: 2, borderColor: 'rgba(246,139,31,0.4)' },
  timelineLine: { flex: 1, width: 2, backgroundColor: Colors.borderSoft, marginTop: 6, marginBottom: -14 },
  timelineCard: { flex: 1, backgroundColor: Colors.bgCard, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.borderSoft },
  timelineTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  timelineType: { flex: 1, fontSize: 13, fontWeight: '800', color: Colors.textDark },
  timelineDate: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, marginTop: 1 },
  timelineActor: { fontSize: 12, fontWeight: '700', color: Colors.accentMagenta, marginBottom: 6 },
  timelineDescription: { fontSize: 13, lineHeight: 19, color: Colors.textSoft },
  emptyPage: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyPageTitle: { fontSize: 18, fontWeight: '800', color: Colors.textDark, marginTop: 12, marginBottom: 6 },
});
