import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { Admin } from '../../lib/api';
import {
  AccessScope,
  AccountStatus,
  AccountValidationStatus,
  AdminAssignment,
  AdminProjectAssignment,
  AdminPromoterPaymentRequest,
  AdminPromoterSubscription,
  AdminRole,
  InterestConfirmation,
  LeadTransfer,
  SupportRequest,
  SupportRequestStatus,
} from '../../types';
import { SectionHeader } from '../../components/ui';
import { AddUserModal } from '../../components/AddUserModal';
import {
  ADMIN_ROLE_OPTIONS,
  canManageClients,
  canManageCommercials,
  canCreateCommercials,
  canCreatePromoters,
  canManageAdminUsers,
  canManageAssignments,
  canManagePromoters,
  canManageNonAdminUsers,
  canReadClients,
  canReadCommercials,
  canReadAssignments,
  canReadSupportRequests,
  canReadPromoters,
  canReadUsers,
  canManageSupportRequests,
  getAdminRoleLabel,
  normalizeAdminRole,
} from '../../utils/adminAccess';

type TeamRole = 'commercial' | 'promoter' | 'admin';

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function SettingsScreen() {
  const { currentUser, logout, t } = useApp();
  const [addUserModalVisible, setAddUserModalVisible] = useState(false);
  const [selectedRole, setSelectedRole] = useState<TeamRole>('commercial');
  const [adminUsers, setAdminUsers] = useState<Array<{ id: string; name: string; email: string; adminRole?: string | null; accountStatus?: AccountStatus; accessScope?: AccessScope | null }>>([]);
  const [teamUsers, setTeamUsers] = useState<Array<{ id: string; name: string; email: string; role: string; accountStatus?: AccountStatus; accountValidationStatus?: AccountValidationStatus }>>([]);
  const [promoters, setPromoters] = useState<Array<{ id: string; name: string; assignedCommercials?: number }>>([]);
  const [commercials, setCommercials] = useState<Array<{ id: string; name: string; promoterName?: string | null }>>([]);
  const [assignments, setAssignments] = useState<AdminAssignment[]>([]);
  const [projectAssignments, setProjectAssignments] = useState<AdminProjectAssignment[]>([]);
  const [accessOptions, setAccessOptions] = useState<{
    promoters: Array<{ id: string; name: string }>;
    projects: Array<{ id: string; name: string; city: string; district: string; promoterId: string; promoterName: string }>;
    cities: string[];
    districts: string[];
  }>({ promoters: [], projects: [], cities: [], districts: [] });
  const [scopeEditorUser, setScopeEditorUser] = useState<{ id: string; name: string; accessScope?: AccessScope | null } | null>(null);
  const [draftScope, setDraftScope] = useState<AccessScope>({ promoterIds: [], projectIds: [], cities: [], districts: [] });
  const [selectedPromoterId, setSelectedPromoterId] = useState('');
  const [selectedCommercialId, setSelectedCommercialId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedProjectCommercialId, setSelectedProjectCommercialId] = useState('');
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([]);
  const [promoterSubscriptions, setPromoterSubscriptions] = useState<AdminPromoterSubscription[]>([]);
  const [promoterPaymentRequests, setPromoterPaymentRequests] = useState<AdminPromoterPaymentRequest[]>([]);
  const [interestConfirmations, setInterestConfirmations] = useState<InterestConfirmation[]>([]);
  const [leadTransfers, setLeadTransfers] = useState<LeadTransfer[]>([]);

  const canManageAdmins = canManageAdminUsers(currentUser);
  const canCreatePromoter = canCreatePromoters(currentUser);
  const canCreateCommercial = canCreateCommercials(currentUser);
  const canReadClientAccounts = canReadClients(currentUser);
  const canReadCommercialAccounts = canReadCommercials(currentUser);
  const canReadPromoterAccounts = canReadPromoters(currentUser);
  const canManageClientAccounts = canManageClients(currentUser);
  const canManageCommercialAccounts = canManageCommercials(currentUser);
  const canManagePromoterAccounts = canManagePromoters(currentUser);
  const hasUsersRead = canReadUsers(currentUser);
  const hasNonAdminManagement = canManageNonAdminUsers(currentUser);
  const hasAssignmentsRead = canReadAssignments(currentUser);
  const hasAssignmentsManagement = canManageAssignments(currentUser);
  const hasSupportRequestsRead = canReadSupportRequests(currentUser);
  const hasSupportRequestsManagement = canManageSupportRequests(currentUser);
  const adminRole = normalizeAdminRole(currentUser?.adminRole);
  const settingsTitle =
    adminRole === 'super_admin'
      ? 'Gouvernance globale'
      : adminRole === 'support_client'
        ? 'Support client'
        : adminRole === 'support_commercial'
          ? 'Support commercial'
          : adminRole === 'support_promoter'
            ? 'Support promoteur'
            : 'Intégration projet';
  const settingsText =
    adminRole === 'super_admin'
      ? 'Le super admin pilote toute la plateforme, les accès, les comptes, les projets et les affectations.'
      : adminRole === 'support_client'
        ? 'Cet espace permet de suivre les clients et leurs dossiers.'
        : adminRole === 'support_commercial'
          ? 'Cet espace permet de gérer les comptes commerciaux et leurs affectations.'
          : adminRole === 'support_promoter'
            ? 'Cet espace permet de gérer les comptes promoteurs et le périmètre promoteur/commercial.'
            : 'Cet espace permet de créer, intégrer et mettre à jour les projets immobiliers.';

  const availableActions: Array<{ role: TeamRole; label: string; icon: string; color: string }> = [
    ...(canCreateCommercial ? [{ role: 'commercial' as const, label: 'Ajouter un commercial', icon: 'person-add-outline', color: Colors.primary }] : []),
    ...(canCreatePromoter ? [{ role: 'promoter' as const, label: 'Ajouter un promoteur', icon: 'business-outline', color: Colors.success }] : []),
    ...(canManageAdmins ? [{ role: 'admin' as const, label: 'Ajouter un admin', icon: 'shield-outline', color: Colors.danger }] : []),
  ];

  const availableCommercials = useMemo(
    () => commercials.filter((item) => !item.promoterName),
    [commercials],
  );
  const availableProjectCommercials = useMemo(
    () => commercials,
    [commercials],
  );

  useEffect(() => {
    loadAdminData();
  }, [canManageAdmins, hasAssignmentsRead, hasNonAdminManagement, hasSupportRequestsRead, hasUsersRead]);

  async function loadAdminData() {
    try {
      const [
        promotersResponse,
        commercialsResponse,
        assignmentsResponse,
        projectAssignmentsResponse,
        promoterSubscriptionsResponse,
        promoterPaymentRequestsResponse,
        interestConfirmationsResponse,
        leadTransfersResponse,
      ] = await Promise.all([
        canReadPromoterAccounts ? Admin.promoters() : Promise.resolve([]),
        canReadCommercialAccounts ? Admin.commercials() : Promise.resolve([]),
        hasAssignmentsRead ? Admin.assignments() : Promise.resolve([]),
        hasAssignmentsRead ? Admin.projectAssignments() : Promise.resolve([]),
        canReadPromoterAccounts ? Admin.promoterSubscriptions() : Promise.resolve([]),
        canReadPromoterAccounts ? Admin.promoterPaymentRequests() : Promise.resolve([]),
        hasAssignmentsRead || canReadClientAccounts || canReadPromoterAccounts ? Admin.interestConfirmations() : Promise.resolve([]),
        hasAssignmentsRead || canReadClientAccounts || canReadPromoterAccounts ? Admin.leadTransfers() : Promise.resolve([]),
      ]);
      setPromoters(uniqueById(promotersResponse as Array<{ id: string; name: string; assignedCommercials?: number }>));
      setCommercials(uniqueById(commercialsResponse as Array<{ id: string; name: string; promoterName?: string | null }>));
      setAssignments(uniqueById(assignmentsResponse as AdminAssignment[]));
      setProjectAssignments(uniqueById(projectAssignmentsResponse as AdminProjectAssignment[]));
      setPromoterSubscriptions(uniqueById(promoterSubscriptionsResponse as AdminPromoterSubscription[]));
      setPromoterPaymentRequests(uniqueById(promoterPaymentRequestsResponse as AdminPromoterPaymentRequest[]));
      setInterestConfirmations(uniqueById(interestConfirmationsResponse as InterestConfirmation[]));
      setLeadTransfers(uniqueById(leadTransfersResponse as LeadTransfer[]));
      if (hasSupportRequestsRead) {
        const supportResponse = await Admin.supportRequests();
        setSupportRequests(uniqueById(supportResponse as SupportRequest[]));
      } else {
        setSupportRequests([]);
      }
      if (canManageAdmins) {
        const adminsResponse = await Admin.users('admin');
        setAdminUsers(uniqueById(adminsResponse as Array<{ id: string; name: string; email: string; adminRole?: string | null; accountStatus?: AccountStatus; accessScope?: AccessScope | null }>));
        const options = await Admin.accessOptions();
        setAccessOptions(options as {
          promoters: Array<{ id: string; name: string }>;
          projects: Array<{ id: string; name: string; city: string; district: string; promoterId: string; promoterName: string }>;
          cities: string[];
          districts: string[];
        });
      } else {
        setAdminUsers([]);
        setAccessOptions({ promoters: [], projects: [], cities: [], districts: [] });
      }
      if (hasNonAdminManagement) {
        const requests: Promise<unknown[]>[] = [];
        if (canReadClientAccounts || canManageClientAccounts) requests.push(Admin.users('client'));
        if (canReadCommercialAccounts || canManageCommercialAccounts) requests.push(Admin.users('commercial'));
        if (canReadPromoterAccounts || canManagePromoterAccounts) requests.push(Admin.users('promoter'));
        const responses = await Promise.all(requests);
        setTeamUsers(uniqueById(responses.flat() as Array<{ id: string; name: string; email: string; role: string; accountStatus?: AccountStatus; accountValidationStatus?: AccountValidationStatus }>));
      } else {
        setTeamUsers([]);
      }
    } catch {
      setAdminUsers([]);
      setTeamUsers([]);
      setPromoters([]);
      setCommercials([]);
      setAssignments([]);
      setProjectAssignments([]);
      setSupportRequests([]);
      setPromoterSubscriptions([]);
      setPromoterPaymentRequests([]);
      setInterestConfirmations([]);
      setLeadTransfers([]);
      setAccessOptions({ promoters: [], projects: [], cities: [], districts: [] });
    }
  }

  async function assignCommercial() {
    if (!selectedPromoterId || !selectedCommercialId) {
      Alert.alert('Affectation', 'Choisis un promoteur et un commercial.');
      return;
    }
    try {
      await Admin.assignCommercial(selectedPromoterId, selectedCommercialId);
      setSelectedCommercialId('');
      await loadAdminData();
    } catch (error: any) {
      Alert.alert('Affectation', error?.message || 'Affectation impossible.');
    }
  }

  async function removeAssignment(commercialId: string) {
    try {
      await Admin.removeAssignment(commercialId);
      await loadAdminData();
    } catch (error: any) {
      Alert.alert('Affectation', error?.message || 'Suppression impossible.');
    }
  }

  async function removePromoterAssignment(promoterId: string, commercialId: string) {
    try {
      await Admin.removeAssignment(commercialId, promoterId);
      await loadAdminData();
    } catch (error: any) {
      Alert.alert('Affectation', error?.message || 'Suppression impossible.');
    }
  }

  async function assignCommercialToProject() {
    if (!selectedProjectId || !selectedProjectCommercialId) {
      Alert.alert('Projet', 'Choisis un projet et un commercial.');
      return;
    }
    try {
      await Admin.assignCommercialToProject(selectedProjectId, selectedProjectCommercialId);
      setSelectedProjectCommercialId('');
      await loadAdminData();
    } catch (error: any) {
      Alert.alert('Projet', error?.message || 'Affectation projet impossible.');
    }
  }

  async function removeProjectAssignment(projectId: string, commercialId: string) {
    try {
      await Admin.removeProjectAssignment(projectId, commercialId);
      await loadAdminData();
    } catch (error: any) {
      Alert.alert('Projet', error?.message || 'Suppression impossible.');
    }
  }

  async function updateAdminSubRole(userId: string, adminRole: AdminRole) {
    try {
      await Admin.updateUserRole(userId, 'admin', adminRole);
      await loadAdminData();
    } catch (error: any) {
      Alert.alert('Admin', error?.message || 'Mise a jour impossible.');
    }
  }

  async function deleteUser(userId: string) {
    try {
      await Admin.deleteUser(userId);
      await loadAdminData();
    } catch (error: any) {
      Alert.alert('Utilisateur', error?.message || 'Suppression impossible.');
    }
  }

  async function updateUserStatus(userId: string, accountStatus: AccountStatus) {
    try {
      await Admin.updateUserStatus(userId, accountStatus);
      await loadAdminData();
    } catch (error: any) {
      Alert.alert('Statut', error?.message || 'Mise a jour impossible.');
    }
  }

  async function updateClientValidation(userId: string, accountValidationStatus: AccountValidationStatus) {
    try {
      await Admin.updateClientValidation(userId, accountValidationStatus);
      await loadAdminData();
    } catch (error: any) {
      Alert.alert('Validation', error?.message || 'Mise a jour impossible.');
    }
  }

  async function saveUserScope() {
    if (!scopeEditorUser) return;
    try {
      await Admin.updateUserScope(scopeEditorUser.id, draftScope);
      await loadAdminData();
      setScopeEditorUser(null);
    } catch (error: any) {
      Alert.alert('Périmètre', error?.message || 'Mise a jour impossible.');
    }
  }

  async function updateSupportRequest(requestId: string, status: SupportRequestStatus) {
    try {
      await Admin.updateSupportRequest(requestId, { status });
      await loadAdminData();
    } catch (error: any) {
      Alert.alert('Support client', error?.message || 'Mise a jour impossible.');
    }
  }

  async function updatePromoterPaymentRequest(requestId: string, status: string) {
    try {
      await Admin.updatePromoterPaymentRequest(requestId, { status });
      await loadAdminData();
    } catch (error: any) {
      Alert.alert('Abonnement', error?.message || 'Validation impossible.');
    }
  }

  async function updatePromoterAccountStatus(promoterId: string, accountStatus: string) {
    try {
      await Admin.updatePromoterAccountStatus(promoterId, { accountStatus });
      await loadAdminData();
    } catch (error: any) {
      Alert.alert('Promoteur', error?.message || 'Mise a jour impossible.');
    }
  }

  function toggleScopeValue<K extends keyof AccessScope>(key: K, value: string) {
    setDraftScope((prev) => {
      const current = prev[key] as string[];
      return {
        ...prev,
        [key]: current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
      };
    });
  }

  function openScopeEditor(user: { id: string; name: string; accessScope?: AccessScope | null }) {
    setScopeEditorUser(user);
    setDraftScope(user.accessScope || { promoterIds: [], projectIds: [], cities: [], districts: [] });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#0F0822", "#180A30", "#1C0B38", "#0D0620"]} locations={[0, 0.3, 0.65, 1]} style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.label}>{t('settings.adminLabel')}</Text>
            <Text style={styles.title}>{settingsTitle}</Text>
          </View>
          <View style={styles.badge}>
            <Ionicons name="shield-checkmark" size={16} color={Colors.white} />
            <Text style={styles.badgeText}>{getAdminRoleLabel(currentUser?.adminRole)}</Text>
          </View>
        </View>
        <Text style={styles.headerText}>{settingsText}</Text>
      </LinearGradient>

      <View style={styles.body}>
        <SectionHeader title="Niveau actuel" />
        <View style={styles.card}>
          <InfoRow label="Compte" value={currentUser?.name || '-'} />
          <InfoRow label="Sous-rôle admin" value={getAdminRoleLabel(currentUser?.adminRole)} />
          <InfoRow label="Permissions" value={`${currentUser?.permissions?.length || 0} actives`} />
        </View>

        {availableActions.length > 0 && (
          <>
            <SectionHeader title="Creation des comptes" style={{ marginTop: 20 }} />
            <View style={styles.card}>
              {availableActions.map((item) => (
                <TouchableOpacity
                  key={item.label}
                  style={styles.actionRow}
                  onPress={() => {
                    setSelectedRole(item.role);
                    setAddUserModalVisible(true);
                  }}
                >
                  <View style={[styles.actionIcon, { backgroundColor: `${item.color}20` }]}>
                    <Ionicons name={item.icon as any} size={18} color={item.color} />
                  </View>
                  <Text style={styles.actionText}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {hasAssignmentsRead && canReadCommercialAccounts && canReadPromoterAccounts && (
          <>
            <SectionHeader title="Affecter les commerciaux" style={{ marginTop: 20 }} />
            <View style={styles.card}>
              <Text style={styles.helper}>
                Un commercial affecte apparait ensuite uniquement dans l espace de supervision du promoteur.
              </Text>

              <Text style={styles.fieldLabel}>Promoteur</Text>
              <View style={styles.chipsRow}>
                {promoters.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.chip, selectedPromoterId === item.id && styles.chipActive]}
                    onPress={() => setSelectedPromoterId(item.id)}
                    disabled={!hasAssignmentsManagement}
                  >
                    <Text style={[styles.chipText, selectedPromoterId === item.id && styles.chipTextActive]}>{item.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Commercial libre</Text>
              <View style={styles.chipsRow}>
                {availableCommercials.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.chip, selectedCommercialId === item.id && styles.chipActive]}
                    onPress={() => setSelectedCommercialId(item.id)}
                    disabled={!hasAssignmentsManagement}
                  >
                    <Text style={[styles.chipText, selectedCommercialId === item.id && styles.chipTextActive]}>{item.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {hasAssignmentsManagement ? (
                <TouchableOpacity style={styles.assignButton} onPress={assignCommercial}>
                  <Text style={styles.assignButtonText}>Affecter au promoteur</Text>
                </TouchableOpacity>
              ) : (
                <Text style={[styles.helper, { marginTop: 14 }]}>Lecture seule sur les affectations.</Text>
              )}
            </View>
          </>
        )}

        {hasAssignmentsRead && (
          <>
            <SectionHeader title="Affectations actives" style={{ marginTop: 20 }} />
            <View style={styles.card}>
              {assignments.length === 0 ? (
                <Text style={styles.emptyText}>Aucune affectation pour le moment.</Text>
              ) : (
                assignments.map((item) => (
                  <View key={item.id} style={styles.assignmentRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.assignmentTitle}>{item.commercialName}</Text>
                      <Text style={styles.assignmentMeta}>{item.promoterName}</Text>
                    </View>
                    {hasAssignmentsManagement ? (
                      <TouchableOpacity onPress={() => removePromoterAssignment(item.promoterId, item.commercialId)} style={styles.removeBtn}>
                        <Ionicons name="close-outline" size={18} color={Colors.danger} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))
              )}
            </View>
          </>
        )}

        {hasAssignmentsRead && accessOptions.projects.length > 0 && canReadCommercialAccounts && (
          <>
            <SectionHeader title="Affectations par projet" style={{ marginTop: 20 }} />
            <View style={styles.card}>
              <Text style={styles.helper}>
                Ce niveau permet d affecter un commercial a un projet precis, independamment de l affectation globale promoteur.
              </Text>

              <Text style={styles.fieldLabel}>Projet</Text>
              <View style={styles.chipsRow}>
                {accessOptions.projects.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.chip, selectedProjectId === item.id && styles.chipActive]}
                    onPress={() => setSelectedProjectId(item.id)}
                    disabled={!hasAssignmentsManagement}
                  >
                    <Text style={[styles.chipText, selectedProjectId === item.id && styles.chipTextActive]}>{item.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Commercial</Text>
              <View style={styles.chipsRow}>
                {availableProjectCommercials.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.chip, selectedProjectCommercialId === item.id && styles.chipActive]}
                    onPress={() => setSelectedProjectCommercialId(item.id)}
                    disabled={!hasAssignmentsManagement}
                  >
                    <Text style={[styles.chipText, selectedProjectCommercialId === item.id && styles.chipTextActive]}>{item.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {hasAssignmentsManagement ? (
                <TouchableOpacity style={styles.assignButton} onPress={assignCommercialToProject}>
                  <Text style={styles.assignButtonText}>Affecter au projet</Text>
                </TouchableOpacity>
              ) : null}

              <View style={{ marginTop: 16 }}>
                {projectAssignments.length === 0 ? (
                  <Text style={styles.emptyText}>Aucune affectation projet.</Text>
                ) : (
                  projectAssignments.map((item) => (
                    <View key={item.id} style={styles.assignmentRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.assignmentTitle}>{item.projectName}</Text>
                        <Text style={styles.assignmentMeta}>{item.commercialName} · {item.promoterName || 'Promoteur non renseigne'}</Text>
                      </View>
                      {hasAssignmentsManagement ? (
                        <TouchableOpacity onPress={() => removeProjectAssignment(item.projectId, item.commercialId)} style={styles.removeBtn}>
                          <Ionicons name="close-outline" size={18} color={Colors.danger} />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ))
                )}
              </View>
            </View>
          </>
        )}

        {canReadPromoterAccounts && (
          <>
            <SectionHeader title="Abonnements promoteur" style={{ marginTop: 20 }} />
            <View style={styles.card}>
              {promoterSubscriptions.length === 0 ? (
                <Text style={styles.emptyText}>Aucun abonnement promoteur pour le moment.</Text>
              ) : (
                promoterSubscriptions.map((item) => (
                  <View key={item.id} style={styles.supportRequestCard}>
                    <View style={styles.supportHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.assignmentTitle}>{item.promoterName}</Text>
                        <Text style={styles.assignmentMeta}>{item.planName || item.planKey} · {item.status}</Text>
                        <Text style={styles.assignmentMeta}>
                          {(item.startsAt ? new Date(item.startsAt).toLocaleDateString('fr-FR') : '-') + ' -> ' + (item.endsAt ? new Date(item.endsAt).toLocaleDateString('fr-FR') : '-')}
                        </Text>
                      </View>
                      <View style={styles.supportStatusChip}>
                        <Text style={styles.supportStatusText}>{item.accountStatus || 'pending'}</Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}

        {canReadPromoterAccounts && (
          <>
            <SectionHeader title="Paiements promoteur" style={{ marginTop: 20 }} />
            <View style={styles.card}>
              {promoterPaymentRequests.length === 0 ? (
                <Text style={styles.emptyText}>Aucune demande de paiement.</Text>
              ) : (
                promoterPaymentRequests.map((item) => (
                  <View key={item.id} style={styles.supportRequestCard}>
                    <View style={styles.supportHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.assignmentTitle}>{item.promoterName}</Text>
                        <Text style={styles.assignmentMeta}>
                          {item.planName || item.planKey} · {Number(item.amountMad || 0).toLocaleString('fr-FR')} MAD
                        </Text>
                        <Text style={styles.assignmentMeta}>
                          {item.paymentMethod || 'Paiement manuel'}{item.paymentReference ? ` · Ref ${item.paymentReference}` : ''}
                        </Text>
                      </View>
                      <View style={styles.supportStatusChip}>
                        <Text style={styles.supportStatusText}>{item.status}</Text>
                      </View>
                    </View>
                    {item.notes ? <Text style={styles.helper}>{item.notes}</Text> : null}
                    {canManagePromoterAccounts ? (
                      <View style={styles.supportActions}>
                        {['validated', 'rejected', 'cancelled'].map((status) => (
                          <TouchableOpacity
                            key={`${item.id}-${status}`}
                            style={[styles.chip, item.status === status && styles.chipActive]}
                            onPress={() => updatePromoterPaymentRequest(item.id, status)}
                          >
                            <Text style={[styles.chipText, item.status === status && styles.chipTextActive]}>{status}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ))
              )}
            </View>
          </>
        )}

        {(canReadPromoterAccounts || hasAssignmentsRead) && promoters.length > 0 ? (
          <>
            <SectionHeader title="Statuts promoteur" style={{ marginTop: 20 }} />
            <View style={styles.card}>
              {promoters.map((item) => (
                <View key={item.id} style={styles.supportRequestCard}>
                  <Text style={styles.assignmentTitle}>{item.name}</Text>
                  <Text style={styles.assignmentMeta}>{item.assignedCommercials || 0} commerciaux affectes</Text>
                  {canManagePromoterAccounts ? (
                    <View style={styles.supportActions}>
                      {['pending_payment', 'active', 'expired', 'suspended', 'disabled'].map((status) => (
                        <TouchableOpacity
                          key={`${item.id}-${status}`}
                          style={styles.chip}
                          onPress={() => updatePromoterAccountStatus(item.id, status)}
                        >
                          <Text style={styles.chipText}>{status}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          </>
        ) : null}

        {(hasAssignmentsRead || canReadClientAccounts || canReadPromoterAccounts) && (
          <>
            <SectionHeader title="Suivi post-visite" style={{ marginTop: 20 }} />
            <View style={styles.card}>
              <Text style={styles.helper}>
                L admin suit ici les confirmations d interet client et les leads transmis au promoteur.
              </Text>
              {interestConfirmations.length === 0 ? (
                <Text style={styles.emptyText}>Aucune confirmation d interet.</Text>
              ) : (
                interestConfirmations.slice(0, 8).map((item) => (
                  <View key={item.id} style={styles.assignmentRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.assignmentTitle}>{item.clientName} · {item.propertyTitle || 'Projet'}</Text>
                      <Text style={styles.assignmentMeta}>
                        {item.status} · {item.commercialName || 'Commercial'}{item.promoterName ? ` · ${item.promoterName}` : ''}
                      </Text>
                    </View>
                  </View>
                ))
              )}

              <View style={{ marginTop: 16 }}>
                <Text style={styles.fieldLabel}>Leads transmis</Text>
                {leadTransfers.length === 0 ? (
                  <Text style={styles.emptyText}>Aucun lead transmis au promoteur.</Text>
                ) : (
                  leadTransfers.slice(0, 8).map((item) => (
                    <View key={item.id} style={styles.assignmentRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.assignmentTitle}>{item.clientName} · {item.propertyTitle || 'Projet'}</Text>
                        <Text style={styles.assignmentMeta}>
                          {item.transferStatus} · {item.promoterName || 'Promoteur'} · {item.commercialName || 'Commercial'}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
          </>
        )}

        {hasSupportRequestsRead && (
          <>
            <SectionHeader title="Demandes support client" style={{ marginTop: 20 }} />
            <View style={styles.card}>
              {supportRequests.length === 0 ? (
                <Text style={styles.emptyText}>Aucune demande support pour le moment.</Text>
              ) : (
                supportRequests.map((item) => (
                  <View key={item.id} style={styles.supportRequestCard}>
                    <View style={styles.supportHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.assignmentTitle}>{item.clientName}</Text>
                        <Text style={styles.assignmentMeta}>
                          {item.clientEmail}
                          {item.clientPhone ? ` · ${item.clientPhone}` : ''}
                        </Text>
                      </View>
                      <View style={styles.supportStatusChip}>
                        <Text style={styles.supportStatusText}>{item.status}</Text>
                      </View>
                    </View>
                    <Text style={styles.supportSubject}>{item.subject}</Text>
                    <Text style={styles.helper}>{item.message}</Text>
                    {item.adminNote ? <Text style={styles.assignmentMeta}>Note support: {item.adminNote}</Text> : null}
                    {item.handledByName ? <Text style={styles.assignmentMeta}>Pris en charge par: {item.handledByName}</Text> : null}
                    {hasSupportRequestsManagement ? (
                      <View style={styles.supportActions}>
                        {(['open', 'in_progress', 'resolved', 'closed'] as SupportRequestStatus[]).map((status) => (
                          <TouchableOpacity
                            key={`${item.id}-${status}`}
                            style={[styles.chip, item.status === status && styles.chipActive]}
                            onPress={() => updateSupportRequest(item.id, status)}
                          >
                            <Text style={[styles.chipText, item.status === status && styles.chipTextActive]}>{status}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ))
              )}
            </View>
          </>
        )}

        {canManageAdmins && (
          <>
            <SectionHeader title="Comptes admin" style={{ marginTop: 20 }} />
            <View style={styles.card}>
              {adminUsers.length === 0 ? (
                <Text style={styles.emptyText}>Aucun compte admin.</Text>
              ) : (
                adminUsers.map((item) => (
                  <View key={item.id} style={styles.assignmentRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.assignmentTitle}>{item.name}</Text>
                      <Text style={styles.assignmentMeta}>{item.email}</Text>
                      <StatusBadge status={item.accountStatus || 'active'} />
                      <Text style={styles.assignmentMeta}>{scopeSummary(item.accessScope || null)}</Text>
                      <View style={styles.chipsRow}>
                        {ADMIN_ROLE_OPTIONS.map((role) => (
                          <TouchableOpacity
                            key={`${item.id}-${role.key}`}
                            style={[styles.chip, item.adminRole === role.key && styles.chipActive]}
                            onPress={() => updateAdminSubRole(item.id, role.key)}
                          >
                            <Text style={[styles.chipText, item.adminRole === role.key && styles.chipTextActive]}>{role.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      {item.id !== currentUser?.id ? (
                        <View style={[styles.chipsRow, { marginTop: 8 }]}>
                          <TouchableOpacity style={styles.scopeButton} onPress={() => openScopeEditor(item)}>
                            <Text style={styles.scopeButtonText}>Configurer le périmètre</Text>
                          </TouchableOpacity>
                          {ACCOUNT_STATUS_OPTIONS.map((status) => (
                            <TouchableOpacity
                              key={`${item.id}-${status.key}`}
                              style={[styles.chip, item.accountStatus === status.key && styles.chipActive]}
                              onPress={() => updateUserStatus(item.id, status.key)}
                            >
                              <Text style={[styles.chipText, item.accountStatus === status.key && styles.chipTextActive]}>{status.label}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      ) : null}
                    </View>
                    {item.id !== currentUser?.id ? (
                      <TouchableOpacity onPress={() => deleteUser(item.id)} style={styles.removeBtn}>
                        <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))
              )}
            </View>
          </>
        )}

        {canManageAdmins && scopeEditorUser ? (
          <>
            <SectionHeader title={`Périmètre: ${scopeEditorUser.name}`} style={{ marginTop: 20 }} />
            <View style={styles.card}>
              <Text style={styles.helper}>Laisse vide pour un accès global sur l’axe concerné. Dès qu’un axe contient des valeurs, les vues business sont filtrées dessus.</Text>

              <Text style={styles.fieldLabel}>Promoteurs</Text>
              <View style={styles.chipsRow}>
                {accessOptions.promoters.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.chip, draftScope.promoterIds.includes(item.id) && styles.chipActive]}
                    onPress={() => toggleScopeValue('promoterIds', item.id)}
                  >
                    <Text style={[styles.chipText, draftScope.promoterIds.includes(item.id) && styles.chipTextActive]}>{item.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Projets</Text>
              <View style={styles.chipsRow}>
                {accessOptions.projects.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.chip, draftScope.projectIds.includes(item.id) && styles.chipActive]}
                    onPress={() => toggleScopeValue('projectIds', item.id)}
                  >
                    <Text style={[styles.chipText, draftScope.projectIds.includes(item.id) && styles.chipTextActive]}>{item.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Villes</Text>
              <View style={styles.chipsRow}>
                {accessOptions.cities.map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={[styles.chip, draftScope.cities.includes(item) && styles.chipActive]}
                    onPress={() => toggleScopeValue('cities', item)}
                  >
                    <Text style={[styles.chipText, draftScope.cities.includes(item) && styles.chipTextActive]}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Zones</Text>
              <View style={styles.chipsRow}>
                {accessOptions.districts.map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={[styles.chip, draftScope.districts.includes(item) && styles.chipActive]}
                    onPress={() => toggleScopeValue('districts', item)}
                  >
                    <Text style={[styles.chipText, draftScope.districts.includes(item) && styles.chipTextActive]}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={[styles.chipsRow, { marginTop: 14 }]}>
                <TouchableOpacity style={styles.scopeButton} onPress={saveUserScope}>
                  <Text style={styles.scopeButtonText}>Enregistrer le périmètre</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.scopeButtonMuted} onPress={() => setScopeEditorUser(null)}>
                  <Text style={styles.scopeButtonMutedText}>Fermer</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        ) : null}

        {hasNonAdminManagement && (
          <>
            <SectionHeader title="Comptes métier" style={{ marginTop: 20 }} />
            <View style={styles.card}>
              {teamUsers.length === 0 ? (
                <Text style={styles.emptyText}>Aucun compte métier.</Text>
              ) : (
                teamUsers.map((item) => (
                  <View key={item.id} style={styles.assignmentRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.assignmentTitle}>{item.name}</Text>
                      <Text style={styles.assignmentMeta}>{item.email}</Text>
                      <Text style={styles.assignmentMeta}>{item.role}</Text>
                      <StatusBadge status={item.accountStatus || 'active'} />
                      {item.role === 'client' ? (
                        <ValidationBadge status={item.accountValidationStatus || 'draft'} />
                      ) : null}
                      <View style={[styles.chipsRow, { marginTop: 8 }]}>
                        {ACCOUNT_STATUS_OPTIONS.map((status) => (
                          <TouchableOpacity
                            key={`${item.id}-${status.key}`}
                            style={[styles.chip, item.accountStatus === status.key && styles.chipActive]}
                            onPress={() => updateUserStatus(item.id, status.key)}
                            disabled={
                              (item.role === 'client' && !canManageClientAccounts)
                              || (item.role === 'commercial' && !canManageCommercialAccounts)
                              || (item.role === 'promoter' && !canManagePromoterAccounts)
                            }
                          >
                            <Text style={[styles.chipText, item.accountStatus === status.key && styles.chipTextActive]}>{status.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      {item.role === 'client' ? (
                        <View style={[styles.chipsRow, { marginTop: 8 }]}>
                          {CLIENT_VALIDATION_OPTIONS.map((status) => (
                            <TouchableOpacity
                              key={`${item.id}-${status.key}`}
                              style={[styles.chip, item.accountValidationStatus === status.key && styles.chipActive]}
                              onPress={() => updateClientValidation(item.id, status.key)}
                              disabled={!canManageClientAccounts}
                            >
                              <Text style={[styles.chipText, item.accountValidationStatus === status.key && styles.chipTextActive]}>{status.label}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      onPress={() => deleteUser(item.id)}
                      style={styles.removeBtn}
                      disabled={
                        (item.role === 'client' && !canManageClientAccounts)
                        || (item.role === 'commercial' && !canManageCommercialAccounts)
                        || (item.role === 'promoter' && !canManagePromoterAccounts)
                      }
                    >
                      <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </>
        )}

        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
          <Text style={styles.logoutText}>Se deconnecter</Text>
        </TouchableOpacity>
      </View>

      <AddUserModal
        visible={addUserModalVisible}
        onClose={() => setAddUserModalVisible(false)}
        role={selectedRole}
        onSuccess={() => {
          setAddUserModalVisible(false);
          loadAdminData();
        }}
      />
    </ScrollView>
  );
}

const ACCOUNT_STATUS_OPTIONS: Array<{ key: AccountStatus; label: string }> = [
  { key: 'active', label: 'Actif' },
  { key: 'disabled', label: 'Désactivé' },
  { key: 'blocked', label: 'Bloqué' },
];
const CLIENT_VALIDATION_OPTIONS: Array<{ key: AccountValidationStatus; label: string }> = [
  { key: 'draft', label: 'Brouillon' },
  { key: 'pending_review', label: 'En attente' },
  { key: 'validated', label: 'Validé' },
  { key: 'rejected', label: 'A revoir' },
];

function StatusBadge({ status }: { status: AccountStatus }) {
  const label = status === 'active' ? 'Actif' : status === 'disabled' ? 'Désactivé' : 'Bloqué';
  const colors = status === 'active'
    ? { bg: Colors.successLight, text: Colors.success }
    : status === 'disabled'
      ? { bg: Colors.warningLight, text: Colors.warning }
      : { bg: Colors.dangerLight, text: Colors.danger };

  return (
    <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.statusBadgeText, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

function ValidationBadge({ status }: { status: AccountValidationStatus }) {
  const label = status === 'validated' ? 'Validé' : status === 'rejected' ? 'À revoir' : status === 'pending_review' ? 'En attente' : 'Brouillon';
  const colors = status === 'validated'
    ? { bg: Colors.successLight, text: Colors.success }
    : status === 'rejected'
      ? { bg: Colors.dangerLight, text: Colors.danger }
      : status === 'pending_review'
        ? { bg: Colors.warningLight, text: Colors.warning }
        : { bg: Colors.bgSoft, text: Colors.textSoft };
  return (
    <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.statusBadgeText, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

function scopeSummary(scope: AccessScope | null): string {
  if (!scope) return 'Périmètre global';
  const total = scope.promoterIds.length + scope.projectIds.length + scope.cities.length + scope.districts.length;
  if (!total) return 'Périmètre global';
  return `${scope.promoterIds.length} promoteurs, ${scope.projectIds.length} projets, ${scope.cities.length} villes, ${scope.districts.length} zones`;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgMain },
  header: { paddingTop: 20, paddingBottom: 28, paddingHorizontal: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  label: { fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: '500', marginBottom: 2 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.white },
  headerText: { fontSize: 13, lineHeight: 20, color: 'rgba(255,255,255,0.78)' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '700', color: Colors.white },
  body: { padding: 20 },
  card: { backgroundColor: Colors.bgCard, borderRadius: 16, borderWidth: 1, borderColor: Colors.borderSoft, padding: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  infoLabel: { fontSize: 13, color: Colors.textSoft, fontWeight: '500' },
  infoValue: { fontSize: 13, color: Colors.textDark, fontWeight: '700' },
  actionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  actionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  actionText: { flex: 1, fontSize: 14, color: Colors.textDark, fontWeight: '600' },
  helper: { fontSize: 12, color: Colors.textSoft, lineHeight: 18, marginBottom: 10 },
  scopeButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: Colors.primary },
  scopeButtonText: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  scopeButtonMuted: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: Colors.bgSoft, borderWidth: 1, borderColor: Colors.borderSoft },
  scopeButtonMutedText: { color: Colors.textDark, fontSize: 12, fontWeight: '700' },
  statusBadge: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: Colors.textDark, marginTop: 10, marginBottom: 8 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.bgSoft, borderWidth: 1, borderColor: Colors.borderSoft },
  chipActive: { backgroundColor: Colors.lavenderUltra, borderColor: Colors.primary },
  chipText: { fontSize: 12, color: Colors.textSoft, fontWeight: '600' },
  chipTextActive: { color: Colors.primary },
  assignButton: { marginTop: 14, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.accentMagenta },
  assignButtonText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  assignmentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderSoft },
  assignmentTitle: { fontSize: 14, fontWeight: '700', color: Colors.textDark },
  assignmentMeta: { fontSize: 12, color: Colors.textSoft, marginTop: 2 },
  supportRequestCard: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderSoft, gap: 8 },
  supportHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  supportStatusChip: { backgroundColor: Colors.lavenderUltra, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  supportStatusText: { fontSize: 11, fontWeight: '800', color: Colors.accentMagenta, textTransform: 'uppercase' },
  supportSubject: { fontSize: 14, fontWeight: '800', color: Colors.textDark },
  supportActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  removeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.dangerLight },
  emptyText: { fontSize: 13, color: Colors.textSoft },
  logoutBtn: { marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.dangerLight, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.danger },
  logoutText: { fontSize: 15, fontWeight: '700', color: Colors.danger },
});
