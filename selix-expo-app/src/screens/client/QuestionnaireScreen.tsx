import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, LayoutAnimation, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { ApiError } from '../../lib/api';
import { Badge, Button, Card, Input, ProgressBar, SelectChip } from '../../components/ui';
import { ContactPreference, FinancingMode, LeadAnswers, LeadConsistencyIssue, LeadQualificationIndicators, Objective, PreferredLanguage, ProjectCategory, PropertyType, PurchaseDeadline } from '../../types';
import { AMENITIES, ARCHITECTURE_STYLES, BUDGET_FLEXIBILITIES, CITY_DISTRICTS, CONTACT_AVAILABILITIES, CONTACT_METHODS, FAMILY_SITUATIONS, FINANCING_MODES, FINISHING_LEVELS, FURNISHING_LEVELS, LOCATION_FLEXIBILITIES, LOCATION_PREFERENCES, MOROCCO_CITIES, OBJECTIVES, PROJECT_CATEGORIES, PROPERTY_TYPES, PURCHASE_DEADLINES, RESIDENCE_STATUSES, VIEW_OPTIONS } from '../../data/realEstateForm';

type StepKey = 'Localisation' | 'Bien' | 'Budget' | 'Configuration' | 'Equipements' | 'Disponibilite' | 'Validation';

const STEPS: StepKey[] = ['Localisation', 'Bien', 'Budget', 'Configuration', 'Equipements', 'Disponibilite', 'Validation'];
const YES_NO = ['Oui', 'Non'];
const STEP_META: Record<StepKey, { title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap }> = {
  Localisation: {
    title: 'Perimetre de recherche',
    subtitle: 'Definissez les villes, quartiers et souplesse de localisation pour cadrer le matching.',
    icon: 'navigate-outline',
  },
  Bien: {
    title: 'Projet et typologie',
    subtitle: 'Precisez le type de bien, l intention et le niveau de selectivite de votre recherche.',
    icon: 'business-outline',
  },
  Budget: {
    title: 'Budget et financement',
    subtitle: 'Le systeme mesure ici la faisabilite du projet et la maturite financiere du lead.',
    icon: 'wallet-outline',
  },
  Configuration: {
    title: 'Surface et agencement',
    subtitle: 'Indiquez la configuration ideale du bien pour affiner la qualification.',
    icon: 'grid-outline',
  },
  Equipements: {
    title: 'Standing et equipements',
    subtitle: 'Renseignez les prestations, la finition et les elements de confort attendus.',
    icon: 'sparkles-outline',
  },
  Disponibilite: {
    title: 'Calendrier d achat',
    subtitle: 'Cette partie determine l urgence, la livraison acceptable et le niveau de compromis.',
    icon: 'calendar-outline',
  },
  Validation: {
    title: 'Identite et qualification',
    subtitle: 'Finalisez votre dossier et laissez Selix etablir une lecture claire de votre profil.',
    icon: 'shield-checkmark-outline',
  },
};
const LANGUAGES: Array<{ label: string; value: PreferredLanguage }> = [
  { label: 'Francais', value: 'Français' },
  { label: 'English', value: 'English' },
  { label: 'Arabe', value: 'العربية' },
];
const KITCHEN_OPTIONS = ['Ouverte', 'Separee', 'Sans preference'];
const DELIVERY_OPTIONS = ['Pret a habiter', 'En construction accepte', 'Flexible'];

function parseNumber(value: string) {
  return parseInt(value.replace(/[^\d]/g, ''), 10) || 0;
}

function parseCsv(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function toggleString(list: string[] | undefined, value: string) {
  return (list || []).includes(value) ? (list || []).filter((item) => item !== value) : [...(list || []), value];
}

function scoreToLabel(score: number): 'chaud' | 'tiede' | 'froid' {
  if (score >= 75) return 'chaud';
  if (score >= 50) return 'tiede';
  return 'froid';
}

function estimateQualificationIndicators(form: Partial<LeadAnswers>): { indicators: LeadQualificationIndicators; issues: LeadConsistencyIssue[]; score: number } {
  const issues: LeadConsistencyIssue[] = [];
  const budgetMax = Number(form.budgetMaxRaw || form.budgetRaw || 0);
  const areaMin = Number(form.desiredAreaMinRaw || form.desiredAreaRaw || 0);
  const propertyTypes = form.propertyTypes || (form.propertyType ? [form.propertyType] : []);
  const preferredLocations = (form.locationPreferences || []).length;
  const mandatoryCriteria = (form.mandatoryCriteria || []).length + (form.mustHave || []).length;
  const precisionSignals = [
    form.searchedCities?.length,
    form.searchedDistricts?.length,
    form.propertyTypes?.length,
    form.projectTypes?.length,
    budgetMax > 0 ? 1 : 0,
    areaMin > 0 ? 1 : 0,
    form.bedroomsMin ? 1 : 0,
    mandatoryCriteria > 0 ? 1 : 0,
  ].reduce<number>((sum, value) => sum + (value ? 1 : 0), 0);

  let budgetCoherence = 78;
  if (propertyTypes.some((item) => item.includes('Villa')) && budgetMax > 0 && budgetMax < 2_000_000) {
    budgetCoherence -= 28;
    issues.push({ severity: 'high', code: 'budget_villa', message: 'Budget faible pour une villa sur le marche marocain, surtout dans les zones prime.' });
  }
  if (propertyTypes.includes('Penthouse') && budgetMax > 0 && budgetMax < 2_500_000) {
    budgetCoherence -= 24;
    issues.push({ severity: 'high', code: 'budget_penthouse', message: 'Budget faible pour un penthouse ou un bien tres premium.' });
  }
  if (areaMin >= 200 && budgetMax > 0 && budgetMax < 1_500_000) {
    budgetCoherence -= 18;
    issues.push({ severity: 'medium', code: 'budget_surface', message: 'Grande surface demandee avec budget serre.' });
  }
  if (String(form.finishingLevelWanted || '').toLowerCase().includes('haut') && budgetMax > 0 && budgetMax < 1_200_000) {
    budgetCoherence -= 14;
    issues.push({ severity: 'medium', code: 'budget_finish', message: 'Niveau de finition ambitieux par rapport au budget annonce.' });
  }

  let requestRealism = 80 - Math.max(0, mandatoryCriteria - 5) * 6 - Math.max(0, preferredLocations - 6) * 2;
  if ((form.locationFlexibility || 'Stricte') === 'Stricte' && (form.searchedCities || []).length > 2) {
    requestRealism -= 8;
    issues.push({ severity: 'medium', code: 'strict_multi_city', message: 'Localisation declaree stricte avec plusieurs villes ciblees.' });
  }
  if (mandatoryCriteria >= 8 && (form.budgetFlexibility || 'Strict') === 'Strict') {
    requestRealism -= 12;
    issues.push({ severity: 'high', code: 'strict_filters', message: 'Trop de criteres obligatoires avec peu de marge de compromis.' });
  }

  let marketCompatibility = 40 + Math.min(20, ((form.searchedCities || []).length || (form.searchedCity ? 1 : 0)) * 5) + Math.min(20, propertyTypes.length * 5) + (budgetMax > 0 ? 10 : 0) + (areaMin > 0 ? 5 : 0);
  if ((form.projectTypes || []).includes('Projet premium') && budgetMax > 0 && budgetMax < 1_500_000) marketCompatibility -= 10;

  const needPrecision = Math.min(100, precisionSignals * 12 + (form.freeNotes?.trim() ? 8 : 0));
  let estimatedSeriousness = 40;
  if (form.urgentPurchase) estimatedSeriousness += 15;
  if (form.contactPreference) estimatedSeriousness += 8;
  if (form.bankConsulted || form.contactedBank) estimatedSeriousness += 10;
  if (form.creditApproved || form.hasBankPreApproval) estimatedSeriousness += 12;
  if ((form.downPaymentRaw || 0) > 0) estimatedSeriousness += 8;
  if (form.isDecisionMaker) estimatedSeriousness += 7;

  budgetCoherence = Math.max(0, Math.min(100, budgetCoherence));
  requestRealism = Math.max(0, Math.min(100, requestRealism));
  marketCompatibility = Math.max(0, Math.min(100, marketCompatibility));
  const seriousness = Math.max(0, Math.min(100, estimatedSeriousness));
  const score = Math.round((budgetCoherence + requestRealism + marketCompatibility + needPrecision + seriousness) / 5);

  return {
    indicators: { budgetCoherence, requestRealism, marketCompatibility, needPrecision, estimatedSeriousness: seriousness },
    issues,
    score,
  };
}

const defaultForm = (currentUser?: { name?: string; email?: string; phone?: string } | null): Partial<LeadAnswers> => ({
  firstName: currentUser?.name?.split(' ')[0] || '',
  lastName: currentUser?.name?.split(' ').slice(1).join(' ') || '',
  email: currentUser?.email || '',
  phone: currentUser?.phone || '',
  password: '',
  currentCity: '',
  city: '',
  searchedCity: '',
  searchedCities: [],
  searchedDistricts: [],
  targetZone: '',
  propertyType: '',
  propertyTypes: [],
  projectTypes: [],
  objective: '',
  budget: '',
  budgetRaw: 0,
  budgetMaxRaw: 0,
  budgetMinRaw: 0,
  downPayment: '',
  downPaymentRaw: 0,
  desiredArea: '',
  desiredAreaRaw: 0,
  desiredAreaMinRaw: 0,
  desiredAreaMaxRaw: 0,
  rooms: 0,
  bedroomsMin: 0,
  bathrooms: 0,
  bathroomsMin: 0,
  livingRoomsMin: 0,
  guestToiletsMin: 0,
  financing: '',
  mustHave: [],
  optionalCriteria: [],
  mandatoryCriteria: [],
  veryImportantCriteria: [],
  negotiableCriteria: [],
  secondaryCriteria: [],
  absoluteRejections: [],
  locationPreferences: [],
  excludedZones: [],
  purchaseDeadline: '',
  residenceStatus: 'Resident local',
  countryOfResidence: '',
  preferredLanguage: 'Français',
  contactPreference: 'WhatsApp',
  contactAvailability: 'Apres-midi',
  locationFlexibility: 'Flexible',
  budgetFlexibility: 'Flexible',
  currency: 'MAD',
  isMRE: false,
  nearMatchAccepted: true,
  contactWhatsApp: true,
  consent: true,
});

export function QuestionnaireScreen() {
  const { currentUser, leadAnswers, hasCompletedQuestionnaire, submitQuestionnaire, questionnaireLoading, currentQuestionnaireStep, setCurrentQuestionnaireStep, setCurrentScreen, setLeadAnswers } = useApp();
  const isGuest = !currentUser;
  const step = Math.min(currentQuestionnaireStep, STEPS.length - 1);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [citiesOpen, setCitiesOpen] = useState(false);
  const [districtsOpen, setDistrictsOpen] = useState(false);
  const [objectiveOpen, setObjectiveOpen] = useState(false);
  const [propertyTypesOpen, setPropertyTypesOpen] = useState(false);
  const [projectTypesOpen, setProjectTypesOpen] = useState(false);
  const [financingOpen, setFinancingOpen] = useState(false);
  const [budgetFlexOpen, setBudgetFlexOpen] = useState(false);
  const [kitchenOpen, setKitchenOpen] = useState(false);
  const [amenitiesOpen, setAmenitiesOpen] = useState(false);
  const [finishingOpen, setFinishingOpen] = useState(false);
  const [viewsOpen, setViewsOpen] = useState(false);
  const [architectureOpen, setArchitectureOpen] = useState(false);
  const [furnishingOpen, setFurnishingOpen] = useState(false);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [residenceStatusOpen, setResidenceStatusOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [contactMethodOpen, setContactMethodOpen] = useState(false);
  const [contactAvailabilityOpen, setContactAvailabilityOpen] = useState(false);
  const [familySituationOpen, setFamilySituationOpen] = useState(false);
  const [locationFlexOpen, setLocationFlexOpen] = useState(false);
  const [locationPrefsOpen, setLocationPrefsOpen] = useState(false);
  const [creditApprovedOpen, setCreditApprovedOpen] = useState(false);
  const [bankConsultedOpen, setBankConsultedOpen] = useState(false);
  const [readyToMoveOpen, setReadyToMoveOpen] = useState(false);
  const [underConstructionOpen, setUnderConstructionOpen] = useState(false);
  const [urgentPurchaseOpen, setUrgentPurchaseOpen] = useState(false);
  const [nearMatchOpen, setNearMatchOpen] = useState(false);
  const [configBinaryOpen, setConfigBinaryOpen] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<Partial<LeadAnswers>>(defaultForm(currentUser));
  const formRef = useRef<Partial<LeadAnswers>>(defaultForm(currentUser));

  useEffect(() => {
    setForm((prev) => {
      const next = { ...defaultForm(currentUser), ...prev, ...leadAnswers, password: prev.password || '' };
      formRef.current = next;
      return next;
    });
  }, [currentUser, leadAnswers]);

  const qualificationPreview = useMemo(() => estimateQualificationIndicators(form), [form]);

  const setValues = (patch: Partial<LeadAnswers>) => {
    setError(null);
    const next = { ...formRef.current, ...patch };
    formRef.current = next;
    setForm(next);
    setLeadAnswers(next);
  };

  const setValue = <K extends keyof LeadAnswers,>(key: K, value: LeadAnswers[K]) => {
    setValues({ [key]: value } as Partial<LeadAnswers>);
  };

  const goBack = () => {
    if (step > 0) {
      setCurrentQuestionnaireStep(step - 1);
      return;
    }
    setCurrentScreen(isGuest ? 'Welcome' : hasCompletedQuestionnaire ? 'ClientApp' : 'Welcome');
  };

  const goNext = () => {
    if (step < STEPS.length - 1) setCurrentQuestionnaireStep(step + 1);
  };

  const selectedCity = form.searchedCities?.[0] || form.searchedCity || form.city || '';
  const suggestedDistricts = CITY_DISTRICTS[selectedCity] || [];
  const currentStepMeta = STEP_META[STEPS[step]];
  const booleanLabel = (value: unknown) => value === true ? 'Oui' : value === false ? 'Non' : '';
  const animateToggle = (toggle: () => void) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    toggle();
  };
  const toggleConfigBinary = (key: string) => animateToggle(() => setConfigBinaryOpen((prev) => ({ ...prev, [key]: !prev[key] })));
  const summarize = (value: string | string[] | undefined, placeholder: string) => {
    if (Array.isArray(value)) return value.length ? value.join(', ') : placeholder;
    return value?.trim() ? value : placeholder;
  };

  const canProceed = () => {
    switch (STEPS[step]) {
      case 'Localisation': return !!((form.searchedCities?.length || form.searchedCity?.trim()) && (form.searchedDistricts?.length || form.targetZone?.trim()));
      case 'Bien': return !!(form.objective && (form.propertyTypes?.length || form.propertyType));
      case 'Budget': return !!(form.financing && Number(form.budgetMaxRaw || form.budgetRaw || 0) > 0);
      case 'Configuration': return !!((form.desiredAreaMinRaw || form.desiredAreaRaw || 0) > 0 || (form.bedroomsMin || form.rooms || 0) > 0);
      case 'Equipements': return true;
      case 'Disponibilite': return !!form.purchaseDeadline;
      case 'Validation': return isGuest
        ? !!(form.firstName?.trim() && form.lastName?.trim() && form.phone?.trim() && form.email?.trim() && form.password && form.password.length >= 6 && form.consent)
        : !!(form.firstName?.trim() && form.lastName?.trim() && form.phone?.trim() && form.email?.trim() && form.consent);
      default: return false;
    }
  };

  const buildAnswers = (): LeadAnswers => {
    const qualification = estimateQualificationIndicators(form);
    const budgetMaxRaw = Number(form.budgetMaxRaw || form.budgetRaw || 0);
    const budgetMinRaw = Number(form.budgetMinRaw || 0);
    const desiredAreaMinRaw = Number(form.desiredAreaMinRaw || form.desiredAreaRaw || 0);
    const desiredAreaMaxRaw = Number(form.desiredAreaMaxRaw || 0);
    const urgencyMap: Record<string, number> = { 'Immédiat': 95, 'Moins de 1 mois': 88, '1 a 3 mois': 76, '3 a 6 mois': 60, 'Plus tard': 34 };

    return {
      ...defaultForm(currentUser),
      ...form,
      firstName: form.firstName?.trim() || '',
      lastName: form.lastName?.trim() || '',
      phone: form.phone?.trim() || '',
      email: form.email?.trim() || '',
      password: form.password || '',
      currentCity: form.currentCity?.trim() || '',
      city: selectedCity,
      searchedCity: selectedCity,
      searchedCities: form.searchedCities?.length ? form.searchedCities : (selectedCity ? [selectedCity] : []),
      searchedDistricts: form.searchedDistricts?.length ? form.searchedDistricts : (form.targetZone ? [String(form.targetZone).trim()] : []),
      targetZone: form.targetZone?.trim() || form.searchedDistricts?.[0] || '',
      countryOfResidence: form.countryOfResidence?.trim() || form.country?.trim() || '',
      country: form.country?.trim() || form.countryOfResidence?.trim() || '',
      isMRE: (form.residenceStatus || '') === 'MRE' || !!form.isMRE,
      propertyType: (form.propertyTypes?.[0] || form.propertyType || '') as PropertyType | '',
      propertyTypes: form.propertyTypes?.length ? form.propertyTypes : (form.propertyType ? [form.propertyType] : []),
      projectTypes: form.projectTypes || [],
      objective: (form.objective || '') as Objective | '',
      budget: `${budgetMaxRaw.toLocaleString('fr-FR')} MAD`,
      budgetRaw: budgetMaxRaw,
      budgetMaxRaw,
      budgetMin: budgetMinRaw ? `${budgetMinRaw.toLocaleString('fr-FR')} MAD` : '',
      budgetMinRaw,
      downPayment: `${Number(form.downPaymentRaw || 0).toLocaleString('fr-FR')} MAD`,
      downPaymentRaw: Number(form.downPaymentRaw || 0),
      financing: (form.financing || '') as FinancingMode | '',
      desiredArea: `${desiredAreaMinRaw || 0} m2`,
      desiredAreaRaw: desiredAreaMinRaw,
      desiredAreaMin: desiredAreaMinRaw ? `${desiredAreaMinRaw} m2` : '',
      desiredAreaMinRaw,
      desiredAreaMax: desiredAreaMaxRaw ? `${desiredAreaMaxRaw} m2` : '',
      desiredAreaMaxRaw,
      rooms: Number(form.rooms || form.bedroomsMin || 0),
      bathrooms: Number(form.bathrooms || form.bathroomsMin || 0),
      mustHave: form.mustHave || [],
      tolerances: form.tolerances || [],
      mandatoryCriteria: form.mandatoryCriteria || [],
      veryImportantCriteria: form.veryImportantCriteria || [],
      negotiableCriteria: form.negotiableCriteria || [],
      secondaryCriteria: form.secondaryCriteria || [],
      absoluteRejections: form.absoluteRejections || [],
      consent: !!form.consent,
      contactWhatsApp: !!form.contactWhatsApp,
      purchaseDeadline: (form.purchaseDeadline || '') as PurchaseDeadline | '',
      urgencyLevel: urgencyMap[String(form.purchaseDeadline || '')] || 30,
      projectSeriousness: qualification.indicators.estimatedSeriousness,
      financingReadiness: Math.round((Number(form.downPaymentRaw || 0) > 0 ? 30 : 0) + (form.creditApproved || form.hasBankPreApproval ? 35 : 0) + (form.bankConsulted || form.contactedBank ? 20 : 0) + (form.financing === 'Cash' ? 15 : 0)),
      compatibilityScore: qualification.indicators.marketCompatibility,
      qualificationIndicators: qualification.indicators,
      consistencyIssues: qualification.issues,
      qualificationLabel: scoreToLabel(qualification.score),
      marketSummary: qualification.issues.length ? qualification.issues.map((item) => item.message).join(' ') : 'Demande globalement coherente et exploitable pour le matching.',
      deliveryConstraint: form.deliveryConstraint,
    };
  };

  const onSubmit = async () => {
    setError(null);
    if (!canProceed()) return;
    if (isGuest && (form.password?.length || 0) < 6) return setError('Le mot de passe doit contenir au moins 6 caracteres.');
    try {
      await submitQuestionnaire(buildAnswers());
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Impossible de finaliser le formulaire.');
    }
  };

  const chipGroup = (items: readonly string[] | string[], selected: string[] | undefined, onToggle: (value: string) => void) => <View style={styles.chips}>{items.map((item) => <SelectChip key={item} label={item} selected={(selected || []).includes(item)} onPress={() => onToggle(item)} />)}</View>;
  const singleChoice = (items: readonly string[] | string[], selected: string | undefined, onPick: (value: string) => void) => <View style={styles.chips}>{items.map((item) => <SelectChip key={item} label={item} selected={selected === item} onPress={() => onPick(item)} />)}</View>;
  const sectionCard = (eyebrow: string, title: string, subtitle: string, children: React.ReactNode) => (
    <Card style={styles.sectionCard}>
      <View style={styles.sectionCardHeader}>
        <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
        <Text style={styles.sectionCardTitle}>{title}</Text>
        <Text style={styles.sectionCardText}>{subtitle}</Text>
      </View>
      <View style={styles.sectionCardBody}>
        {children}
      </View>
    </Card>
  );
  const expandButton = (label: string, value: string, open: boolean, onPress: () => void, icon: string = 'chevron-expand-outline') => (
    <TouchableOpacity style={[styles.expandButton, open && styles.expandButtonOpen]} activeOpacity={0.9} onPress={() => animateToggle(onPress)}>
      <View style={[styles.expandIconWrap, open && styles.expandIconWrapOpen]}>
        <Ionicons name={icon as never} size={22} color={Colors.textSoft} />
      </View>
      <View style={styles.expandCopy}>
        <Text style={styles.expandLabel}>{label}</Text>
        <Text style={styles.expandValue}>{value || 'Cliquer pour afficher les choix'}</Text>
      </View>
      <View style={[styles.expandChevronWrap, open && styles.expandChevronWrapOpen]}>
        <Ionicons name={open ? 'chevron-up-outline' : 'chevron-down-outline'} size={20} color={Colors.textSoft} />
      </View>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={['#1A0530', '#2E0A65', '#3C1085']} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={goBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={Colors.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.stepMeta}>Etape {step + 1} / {STEPS.length}</Text>
            <Text style={styles.stepTitle}>{STEPS[step]}</Text>
          </View>
          <Image source={require('../../../assets/selix-picto-white.png')} style={styles.headerPicto} resizeMode="contain" />
        </View>
        <ProgressBar value={step + 1} max={STEPS.length} color={Colors.white} height={4} style={{ marginTop: 14 }} />
      </LinearGradient>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <LinearGradient colors={Colors.gradientCard} style={styles.heroCard}>
          <View style={styles.heroBadgeRow}>
            <Badge label={`Etape ${step + 1} / ${STEPS.length}`} tone="purple" />
            <Badge label={canProceed() ? 'Section complete' : 'Section a renseigner'} tone={canProceed() ? 'success' : 'warning'} />
          </View>
          <View style={styles.heroHeader}>
            <View style={styles.heroIcon}>
              <Ionicons name={currentStepMeta.icon} size={24} color={Colors.white} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.title}>{currentStepMeta.title}</Text>
              <Text style={styles.subtitle}>{currentStepMeta.subtitle}</Text>
            </View>
          </View>
          <View style={styles.stepRail}>
            {STEPS.map((item, index) => (
              <View key={item} style={[styles.stepRailItem, index === step && styles.stepRailItemActive]}>
                <View style={[styles.stepRailDot, index <= step && styles.stepRailDotDone, index === step && styles.stepRailDotActive]} />
                <Text style={[styles.stepRailLabel, index === step && styles.stepRailLabelActive]} numberOfLines={1}>
                  {item}
                </Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {false ? (
          <>
            <Input label="Prenom" value={form.firstName || ''} onChangeText={(value) => setValue('firstName', value)} placeholder="Votre prenom" icon="person-outline" />
            <Input label="Nom" value={form.lastName || ''} onChangeText={(value) => setValue('lastName', value)} placeholder="Votre nom" icon="person-outline" />
            <Input label="Telephone principal" value={form.phone || ''} onChangeText={(value) => setValue('phone', value)} placeholder="+212 6XX XXX XXX" icon="call-outline" keyboardType="phone-pad" />
            <Input label="Telephone secondaire" value={form.secondaryPhone || ''} onChangeText={(value) => setValue('secondaryPhone', value)} placeholder="+212 6XX XXX XXX" icon="call-outline" keyboardType="phone-pad" />
            <Input label="Email" value={form.email || ''} onChangeText={(value) => setValue('email', value)} placeholder="client@email.com" icon="mail-outline" keyboardType="email-address" />
            <Input label="Ville actuelle" value={form.currentCity || ''} onChangeText={(value) => setValue('currentCity', value)} placeholder="Casablanca" icon="location-outline" />
            <Input label="Pays de residence" value={form.countryOfResidence || ''} onChangeText={(value) => setValue('countryOfResidence', value)} placeholder="Maroc, France, Belgique..." icon="airplane-outline" />
            <Input label="Nationalite" value={form.nationality || ''} onChangeText={(value) => setValue('nationality', value)} placeholder="Marocaine" icon="flag-outline" />
            <Text style={styles.label}>Statut de residence</Text>
            {expandButton('Statut de residence', form.residenceStatus || '', residenceStatusOpen, () => setResidenceStatusOpen((prev) => !prev), 'airplane-outline')}
            {residenceStatusOpen ? singleChoice(RESIDENCE_STATUSES, form.residenceStatus, (value) => setValue('residenceStatus', value as LeadAnswers['residenceStatus'])) : null}
            <Text style={styles.label}>Langue preferee</Text>
            {expandButton('Langue preferee', LANGUAGES.find((item) => item.value === form.preferredLanguage)?.label || '', languageOpen, () => setLanguageOpen((prev) => !prev), 'language-outline')}
            {languageOpen ? singleChoice(LANGUAGES.map((item) => item.label), LANGUAGES.find((item) => item.value === form.preferredLanguage)?.label, (value) => setValue('preferredLanguage', LANGUAGES.find((item) => item.label === value)?.value || 'Français')) : null}
            <Text style={styles.label}>Moyen de contact prefere</Text>
            {expandButton('Moyen de contact', form.contactPreference || '', contactMethodOpen, () => setContactMethodOpen((prev) => !prev), 'call-outline')}
            {contactMethodOpen ? singleChoice(CONTACT_METHODS, form.contactPreference, (value) => setValue('contactPreference', value as ContactPreference)) : null}
            <Text style={styles.label}>Disponibilite pour etre contacte</Text>
            {expandButton('Disponibilite de contact', form.contactAvailability || '', contactAvailabilityOpen, () => setContactAvailabilityOpen((prev) => !prev), 'time-outline')}
            {contactAvailabilityOpen ? singleChoice(CONTACT_AVAILABILITIES, form.contactAvailability, (value) => setValue('contactAvailability', value as LeadAnswers['contactAvailability'])) : null}
            <Input label="Profession" value={form.profession || ''} onChangeText={(value) => setValue('profession', value)} placeholder="Ingenieur, commercant..." icon="briefcase-outline" />
            <Text style={styles.label}>Situation familiale</Text>
            {expandButton('Situation familiale', form.familySituation || '', familySituationOpen, () => setFamilySituationOpen((prev) => !prev), 'people-outline')}
            {familySituationOpen ? singleChoice(FAMILY_SITUATIONS, form.familySituation, (value) => setValue('familySituation', value as LeadAnswers['familySituation'])) : null}
          </>
        ) : null}

        {STEPS[step] === 'Localisation' ? (
          <>
            {sectionCard('Zone cible', 'Recherche geographique', 'Selectionnez d abord les villes et quartiers reellement vises.', (
              <>
                <Text style={styles.label}>Villes recherchees</Text>
                {expandButton('Selection des villes', summarize(form.searchedCities, 'Choisir une ou plusieurs villes'), citiesOpen, () => setCitiesOpen((prev) => !prev), 'navigate-outline')}
                {citiesOpen ? chipGroup(MOROCCO_CITIES, form.searchedCities, (value) => {
                  const next = toggleString(form.searchedCities, value);
                  const primaryCity = next[0] || '';
                  setValues({
                    searchedCities: next,
                    searchedCity: primaryCity,
                    city: primaryCity,
                  });
                }) : null}
                {!(form.searchedCities?.length) ? <Input label="Autre ville" value={form.searchedCity || ''} onChangeText={(value) => setValues({ searchedCity: value, city: value })} placeholder="Ajoutez une ville si besoin" icon="navigate-outline" /> : null}
                {(selectedCity || suggestedDistricts.length) ? <>
                  <Text style={styles.label}>Quartiers suggeres</Text>
                  {expandButton('Selection des quartiers', summarize(form.searchedDistricts, 'Choisir un ou plusieurs quartiers'), districtsOpen, () => setDistrictsOpen((prev) => !prev), 'map-outline')}
                  {districtsOpen ? chipGroup(suggestedDistricts, form.searchedDistricts, (value) => setValue('searchedDistricts', toggleString(form.searchedDistricts, value))) : null}
                </> : null}
                {(selectedCity || (form.searchedDistricts || []).length) ? <Input label="Quartiers / zones recherches" value={(form.searchedDistricts || []).join(', ')} onChangeText={(value) => setValue('searchedDistricts', parseCsv(value))} placeholder="Ain Diab, Agdal, Gueliz..." icon="map-outline" /> : null}
                <Input label="Zones refusees" value={(form.excludedZones || []).join(', ')} onChangeText={(value) => setValue('excludedZones', parseCsv(value))} placeholder="Zone industrielle, vis-a-vis..." icon="close-circle-outline" />
              </>
            ))}
            {sectionCard('Souplesse', 'Rayon de recherche', 'Definissez les compromis geographiques acceptables pour ouvrir le matching sans perdre en pertinence.', (
              <>
                <Text style={styles.label}>Localisation stricte ou flexible</Text>
                {expandButton('Flexibilite localisation', summarize(form.locationFlexibility, 'Definir le niveau de flexibilite'), locationFlexOpen, () => setLocationFlexOpen((prev) => !prev), 'swap-horizontal-outline')}
                {locationFlexOpen ? singleChoice(LOCATION_FLEXIBILITIES, form.locationFlexibility, (value) => setValue('locationFlexibility', value as LeadAnswers['locationFlexibility'])) : null}
                <Input label="Distance maximale acceptable (km)" value={form.maxDistanceKm ? String(form.maxDistanceKm) : ''} onChangeText={(value) => setValue('maxDistanceKm', parseNumber(value))} placeholder="10" icon="swap-horizontal-outline" keyboardType="numeric" />
                <Text style={styles.label}>Preferences de localisation</Text>
                {expandButton('Preferences localisation', summarize(form.locationPreferences, 'Ajouter les environnements recherches'), locationPrefsOpen, () => setLocationPrefsOpen((prev) => !prev), 'pin-outline')}
                {locationPrefsOpen ? chipGroup(LOCATION_PREFERENCES, form.locationPreferences, (value) => setValue('locationPreferences', toggleString(form.locationPreferences, value))) : null}
                <Input label="Region souhaitee" value={form.preferredRegion || ''} onChangeText={(value) => setValue('preferredRegion', value)} placeholder="Casablanca-Settat, Rabat-Sale-Kenitra..." icon="earth-outline" />
              </>
            ))}
          </>
        ) : null}

        {STEPS[step] === 'Bien' ? (
          <>
            {sectionCard('Besoin', 'Cadrage du projet', 'Orientez le moteur de matching avec l objectif reel du client et les typologies pertinentes.', (
              <>
                <Text style={styles.label}>Objectif immobilier</Text>
                {expandButton('Objectif', summarize(form.objective, 'Choisir l objectif principal'), objectiveOpen, () => setObjectiveOpen((prev) => !prev), 'sparkles-outline')}
                {objectiveOpen ? singleChoice(OBJECTIVES, form.objective, (value) => setValue('objective', value as Objective)) : null}
                {form.objective ? <>
                  <Text style={styles.label}>Types de bien recherches</Text>
                  {expandButton('Types de bien', summarize(form.propertyTypes, 'Selectionner les typologies visees'), propertyTypesOpen, () => setPropertyTypesOpen((prev) => !prev), 'business-outline')}
                  {propertyTypesOpen ? chipGroup(PROPERTY_TYPES, form.propertyTypes, (value) => {
                    const next = toggleString(form.propertyTypes, value);
                    setValue('propertyTypes', next as PropertyType[]);
                    setValue('propertyType', (next[0] || '') as PropertyType | '');
                  }) : null}
                </> : null}
                {(form.propertyTypes || []).length ? <Input label="Autre type de bien" value={form.otherPropertyType || ''} onChangeText={(value) => setValue('otherPropertyType', value)} placeholder="Si votre besoin est specifique" icon="create-outline" /> : null}
                {(form.propertyTypes || []).length ? <>
                  <Text style={styles.label}>Type de projet immobilier</Text>
                  {expandButton('Types de projet', summarize(form.projectTypes, 'Choisir le cadre de projet souhaite'), projectTypesOpen, () => setProjectTypesOpen((prev) => !prev), 'layers-outline')}
                  {projectTypesOpen ? chipGroup(PROJECT_CATEGORIES, form.projectTypes, (value) => setValue('projectTypes', toggleString(form.projectTypes, value) as ProjectCategory[])) : null}
                </> : null}
              </>
            ))}
            {(form.projectTypes || []).length ? sectionCard('Filtres', 'Niveau d exigence', 'Ces informations servent au scoring, au matching fin et a la lecture commerciale du lead.', (
              <>
                <Input label="Criteres obligatoires" value={(form.mandatoryCriteria || []).join(', ')} onChangeText={(value) => setValue('mandatoryCriteria', parseCsv(value))} placeholder="Quartier calme, parking, residence fermee..." icon="checkmark-done-outline" />
                <Input label="Criteres tres importants" value={(form.veryImportantCriteria || []).join(', ')} onChangeText={(value) => setValue('veryImportantCriteria', parseCsv(value))} placeholder="Proche tram, suite parentale..." icon="star-outline" />
                <Input label="Criteres negotiables" value={(form.negotiableCriteria || []).join(', ')} onChangeText={(value) => setValue('negotiableCriteria', parseCsv(value))} placeholder="Etage, vue, standing..." icon="options-outline" />
                <Input label="Refus absolus" value={(form.absoluteRejections || []).join(', ')} onChangeText={(value) => setValue('absoluteRejections', parseCsv(value))} placeholder="RDC, sans ascenseur, vis-a-vis..." icon="ban-outline" />
              </>
            )) : null}
          </>
        ) : null}

        {STEPS[step] === 'Budget' ? (
          <>
            {sectionCard('Capacite', 'Envelope financiere', 'Saisissez la plage budgetaire, le mode de financement et la marge de flexibilite.', (
              <>
                <View style={styles.row}>
                  <Input style={styles.half} label="Budget min (MAD)" value={form.budgetMinRaw ? String(form.budgetMinRaw) : ''} onChangeText={(value) => setValue('budgetMinRaw', parseNumber(value))} keyboardType="numeric" icon="cash-outline" />
                  <Input style={styles.half} label="Budget max (MAD)" value={form.budgetMaxRaw ? String(form.budgetMaxRaw) : ''} onChangeText={(value) => { const next = parseNumber(value); setValue('budgetMaxRaw', next); setValue('budgetRaw', next); }} keyboardType="numeric" icon="cash-outline" />
                </View>
                <Input label="Apport disponible (MAD)" value={form.downPaymentRaw ? String(form.downPaymentRaw) : ''} onChangeText={(value) => setValue('downPaymentRaw', parseNumber(value))} keyboardType="numeric" icon="wallet-outline" />
                <Text style={styles.label}>Financement</Text>
                {expandButton('Mode de financement', summarize(form.financing, 'Choisir le mode de financement'), financingOpen, () => setFinancingOpen((prev) => !prev), 'card-outline')}
                {financingOpen ? singleChoice(FINANCING_MODES, form.financing, (value) => setValue('financing', value as FinancingMode)) : null}
                <Text style={styles.label}>Budget strict ou flexible</Text>
                {expandButton('Flexibilite budget', summarize(form.budgetFlexibility, 'Definir la marge de flexibilite'), budgetFlexOpen, () => setBudgetFlexOpen((prev) => !prev), 'options-outline')}
                {budgetFlexOpen ? singleChoice(BUDGET_FLEXIBILITIES, form.budgetFlexibility, (value) => setValue('budgetFlexibility', value as LeadAnswers['budgetFlexibility'])) : null}
                <Input label="Niveau de flexibilite budgetaire (%)" value={form.budgetFlexibilityPercent ? String(form.budgetFlexibilityPercent) : ''} onChangeText={(value) => setValue('budgetFlexibilityPercent', parseNumber(value))} keyboardType="numeric" icon="trending-up-outline" />
              </>
            ))}
            {sectionCard('Maturite', 'Lecture bancaire', 'Ces informations servent a qualifier la capacite reelle et le serieux du lead.', (
              <>
                <Text style={styles.label}>Credit pre-approuve ?</Text>
                {expandButton('Credit pre-approuve', booleanLabel(form.creditApproved), creditApprovedOpen, () => setCreditApprovedOpen((prev) => !prev), 'checkmark-circle-outline')}
                {creditApprovedOpen ? singleChoice(YES_NO, booleanLabel(form.creditApproved), (value) => setValue('creditApproved', value === 'Oui')) : null}
                <Text style={styles.label}>Banque deja consultee ?</Text>
                {expandButton('Banque consultee', booleanLabel(form.bankConsulted), bankConsultedOpen, () => setBankConsultedOpen((prev) => !prev), 'business-outline')}
                {bankConsultedOpen ? singleChoice(YES_NO, booleanLabel(form.bankConsulted), (value) => setValues({ bankConsulted: value === 'Oui', contactedBank: value === 'Oui' })) : null}
                <Input label="Mensualite maximale acceptable (MAD)" value={form.monthlyInstallmentMaxRaw ? String(form.monthlyInstallmentMaxRaw) : ''} onChangeText={(value) => setValue('monthlyInstallmentMaxRaw', parseNumber(value))} keyboardType="numeric" icon="calendar-outline" />
                <Input label="Duree de credit envisagee (ans)" value={form.loanDurationYears ? String(form.loanDurationYears) : ''} onChangeText={(value) => setValue('loanDurationYears', parseNumber(value))} keyboardType="numeric" icon="time-outline" />
                <Input label="Capacite de financement estimee (MAD)" value={form.financingCapacityEstimateRaw ? String(form.financingCapacityEstimateRaw) : ''} onChangeText={(value) => setValue('financingCapacityEstimateRaw', parseNumber(value))} keyboardType="numeric" icon="stats-chart-outline" />
                <Input label="Revenu mensuel du foyer (MAD)" value={form.householdIncomeRaw ? String(form.householdIncomeRaw) : ''} onChangeText={(value) => setValue('householdIncomeRaw', parseNumber(value))} keyboardType="numeric" icon="cash-outline" />
                <Input label="Autres engagements financiers mensuels (MAD)" value={form.existingFinancialCommitmentsRaw ? String(form.existingFinancialCommitmentsRaw) : ''} onChangeText={(value) => setValue('existingFinancialCommitmentsRaw', parseNumber(value))} keyboardType="numeric" icon="alert-circle-outline" />
              </>
            ))}
          </>
        ) : null}

        {STEPS[step] === 'Configuration' ? (
          <>
            {sectionCard('Dimensions', 'Surface et capacite', 'Structurez ici les volumes et le nombre de pieces souhaites.', (
              <>
                <View style={styles.row}>
                  <Input style={styles.half} label="Surface minimum (m2)" value={form.desiredAreaMinRaw ? String(form.desiredAreaMinRaw) : ''} onChangeText={(value) => setValue('desiredAreaMinRaw', parseNumber(value))} keyboardType="numeric" icon="resize-outline" />
                  <Input style={styles.half} label="Surface maximum (m2)" value={form.desiredAreaMaxRaw ? String(form.desiredAreaMaxRaw) : ''} onChangeText={(value) => setValue('desiredAreaMaxRaw', parseNumber(value))} keyboardType="numeric" icon="expand-outline" />
                </View>
                <View style={styles.row}>
                  <Input style={styles.half} label="Chambres min" value={form.bedroomsMin ? String(form.bedroomsMin) : ''} onChangeText={(value) => setValue('bedroomsMin', parseNumber(value))} keyboardType="numeric" icon="bed-outline" />
                  <Input style={styles.half} label="Chambres max" value={form.bedroomsMax ? String(form.bedroomsMax) : ''} onChangeText={(value) => setValue('bedroomsMax', parseNumber(value))} keyboardType="numeric" icon="bed-outline" />
                </View>
                <View style={styles.row}>
                  <Input style={styles.half} label="Salons min" value={form.livingRoomsMin ? String(form.livingRoomsMin) : ''} onChangeText={(value) => setValue('livingRoomsMin', parseNumber(value))} keyboardType="numeric" icon="people-outline" />
                  <Input style={styles.half} label="Salles de bain min" value={form.bathroomsMin ? String(form.bathroomsMin) : ''} onChangeText={(value) => setValue('bathroomsMin', parseNumber(value))} keyboardType="numeric" icon="water-outline" />
                </View>
                <Input label="Toilettes invites min" value={form.guestToiletsMin ? String(form.guestToiletsMin) : ''} onChangeText={(value) => setValue('guestToiletsMin', parseNumber(value))} keyboardType="numeric" icon="water-outline" />
              </>
            ))}
            {sectionCard('Agencement', 'Confort interieur', 'Les options suivantes permettent de distinguer un besoin basique d un besoin hautement qualifie.', (
              <>
                <Text style={styles.label}>Cuisine souhaitee</Text>
                {expandButton('Type de cuisine', summarize(form.kitchenPreference, 'Choisir le type de cuisine'), kitchenOpen, () => setKitchenOpen((prev) => !prev), 'restaurant-outline')}
                {kitchenOpen ? singleChoice(KITCHEN_OPTIONS, form.kitchenPreference, (value) => setValue('kitchenPreference', value as LeadAnswers['kitchenPreference'])) : null}
                <View style={styles.binaryGrid}>
                  {[
                    ['doubleSalonWanted', 'Double salon'],
                    ['masterSuiteWanted', 'Suite parentale'],
                    ['maidRoomWanted', 'Chambre de service'],
                    ['officeWanted', 'Bureau interieur'],
                    ['laundryWanted', 'Buanderie'],
                    ['storageWanted', 'Debarras'],
                  ].map(([key, label]) => (
                    <View key={key} style={styles.binaryItem}>
                      {expandButton(label, booleanLabel(form[key as keyof LeadAnswers]), !!configBinaryOpen[key], () => toggleConfigBinary(key), 'checkmark-outline')}
                      {configBinaryOpen[key]
                        ? singleChoice(YES_NO, booleanLabel(form[key as keyof LeadAnswers]), (value) => setValue(key as keyof LeadAnswers, (value === 'Oui') as never))
                        : null}
                    </View>
                  ))}
                </View>
              </>
            ))}
            {sectionCard('Accessibilite', 'Etage et acces', 'Affinez ici les contraintes liees a l implantation dans l immeuble.', (
              <View style={styles.row}>
                <Input style={styles.half} label="Etage min" value={form.floorMin ? String(form.floorMin) : ''} onChangeText={(value) => setValue('floorMin', parseNumber(value))} keyboardType="numeric" icon="layers-outline" />
                <Input style={styles.half} label="Etage max" value={form.floorMax ? String(form.floorMax) : ''} onChangeText={(value) => setValue('floorMax', parseNumber(value))} keyboardType="numeric" icon="layers-outline" />
              </View>
            ))}
          </>
        ) : null}

        {STEPS[step] === 'Equipements' ? (
          <>
            {sectionCard('Prestations', 'Equipements obligatoires', 'Selectionnez les elements vraiment necessaires a la decision client.', (
              <>
                <Text style={styles.label}>Equipements et caracteristiques</Text>
                {expandButton('Equipements obligatoires', summarize(form.mustHave, 'Choisir les prestations requises'), amenitiesOpen, () => setAmenitiesOpen((prev) => !prev), 'construct-outline')}
                {amenitiesOpen ? chipGroup(AMENITIES, form.mustHave, (value) => setValue('mustHave', toggleString(form.mustHave, value))) : null}
              </>
            ))}
            {sectionCard('Standing', 'Finition et perception', 'Le moteur s aligne ici avec le niveau reel des projets presents dans la plateforme.', (
              <>
                <Text style={styles.label}>Niveau de finition souhaite</Text>
                {expandButton('Niveau de finition', summarize(form.finishingLevelWanted, 'Choisir le standing souhaite'), finishingOpen, () => setFinishingOpen((prev) => !prev), 'color-fill-outline')}
                {finishingOpen ? singleChoice(FINISHING_LEVELS, form.finishingLevelWanted, (value) => setValue('finishingLevelWanted', value)) : null}
                <Text style={styles.label}>Vue souhaitee</Text>
                {expandButton('Vues souhaitees', summarize(form.viewPreferences, 'Selectionner les vues prioritaires'), viewsOpen, () => setViewsOpen((prev) => !prev), 'eye-outline')}
                {viewsOpen ? chipGroup(VIEW_OPTIONS, form.viewPreferences, (value) => setValue('viewPreferences', toggleString(form.viewPreferences, value))) : null}
                <Text style={styles.label}>Architecture</Text>
                {expandButton('Style architectural', summarize(form.architectureStyleWanted, 'Choisir un style architectural'), architectureOpen, () => setArchitectureOpen((prev) => !prev), 'home-outline')}
                {architectureOpen ? singleChoice(ARCHITECTURE_STYLES, form.architectureStyleWanted, (value) => setValue('architectureStyleWanted', value as LeadAnswers['architectureStyleWanted'])) : null}
                <Text style={styles.label}>Niveau d equipement / meuble</Text>
                {expandButton('Niveau d equipement', summarize(form.furnishingLevelWanted, 'Definir le niveau d equipement'), furnishingOpen, () => setFurnishingOpen((prev) => !prev), 'cube-outline')}
                {furnishingOpen ? singleChoice(FURNISHING_LEVELS, form.furnishingLevelWanted, (value) => setValue('furnishingLevelWanted', value as LeadAnswers['furnishingLevelWanted'])) : null}
              </>
            ))}
            {sectionCard('Notes', 'Preferences secondaires', 'Ajoutez ici les nuances utiles qui ne sont pas capturees par les champs structures.', (
              <>
                <Input label="Preferences secondaires" value={(form.secondaryCriteria || []).join(', ')} onChangeText={(value) => setValue('secondaryCriteria', parseCsv(value))} placeholder="Vue degagee, fibre, bon internet..." icon="sparkles-outline" />
                <Input label="Remarques libres" value={form.freeNotes || ''} onChangeText={(value) => setValue('freeNotes', value)} placeholder="Expliquez ce qui compte vraiment" icon="document-text-outline" multiline />
              </>
            ))}
          </>
        ) : null}

        {STEPS[step] === 'Disponibilite' ? (
          <>
            {sectionCard('Temporalite', 'Delai de decision', 'Cette partie classe le niveau d urgence commerciale du lead.', (
              <>
                <Text style={styles.label}>Delai d achat</Text>
                {expandButton('Delai d achat', summarize(form.purchaseDeadline, 'Choisir l horizon d achat'), deadlineOpen, () => setDeadlineOpen((prev) => !prev), 'calendar-outline')}
                {deadlineOpen ? singleChoice(PURCHASE_DEADLINES, form.purchaseDeadline, (value) => setValue('purchaseDeadline', value as PurchaseDeadline)) : null}
                <Text style={styles.label}>Achat urgent ?</Text>
                {expandButton('Achat urgent', booleanLabel(form.urgentPurchase), urgentPurchaseOpen, () => setUrgentPurchaseOpen((prev) => !prev), 'flash-outline')}
                {urgentPurchaseOpen ? singleChoice(YES_NO, booleanLabel(form.urgentPurchase), (value) => setValue('urgentPurchase', value === 'Oui')) : null}
              </>
            ))}
            {sectionCard('Livraison', 'Disponibilite acceptable', 'Selix utilise cette section pour filtrer le stock livre, en cours ou proche du besoin.', (
              <>
                <Text style={styles.label}>Disponibilite / livraison</Text>
                {expandButton('Disponibilite / livraison', summarize(form.deliveryConstraint, 'Choisir la contrainte de livraison'), deliveryOpen, () => setDeliveryOpen((prev) => !prev), 'time-outline')}
                {deliveryOpen ? singleChoice(DELIVERY_OPTIONS, form.deliveryConstraint, (value) => setValue('deliveryConstraint', value as LeadAnswers['deliveryConstraint'])) : null}
                {form.deliveryConstraint ? <Input label="Delai maximum de livraison acceptable (mois)" value={form.deliveryMaxMonths ? String(form.deliveryMaxMonths) : ''} onChangeText={(value) => setValue('deliveryMaxMonths', parseNumber(value))} keyboardType="numeric" icon="calendar-outline" /> : null}
                {form.deliveryConstraint ? <>
                  <Text style={styles.label}>Pret a habiter obligatoire ?</Text>
                  {expandButton('Pret a habiter obligatoire', booleanLabel(form.readyToMoveRequired), readyToMoveOpen, () => setReadyToMoveOpen((prev) => !prev), 'home-outline')}
                  {readyToMoveOpen ? singleChoice(YES_NO, booleanLabel(form.readyToMoveRequired), (value) => setValue('readyToMoveRequired', value === 'Oui')) : null}
                  <Text style={styles.label}>En cours de construction accepte ?</Text>
                  {expandButton('Construction acceptee', booleanLabel(form.underConstructionAccepted), underConstructionOpen, () => setUnderConstructionOpen((prev) => !prev), 'hammer-outline')}
                  {underConstructionOpen ? singleChoice(YES_NO, booleanLabel(form.underConstructionAccepted), (value) => setValue('underConstructionAccepted', value === 'Oui')) : null}
                </> : null}
                <Text style={styles.label}>Biens proches si aucun 100% match ?</Text>
                {expandButton('Biens proches acceptes', booleanLabel(form.nearMatchAccepted), nearMatchOpen, () => setNearMatchOpen((prev) => !prev), 'git-compare-outline')}
                {nearMatchOpen ? singleChoice(YES_NO, booleanLabel(form.nearMatchAccepted), (value) => setValue('nearMatchAccepted', value === 'Oui')) : null}
              </>
            ))}
          </>
        ) : null}

        {STEPS[step] === 'Validation' ? (
          <>
            <Text style={styles.label}>Informations personnelles</Text>
            <Input label="Prenom" value={form.firstName || ''} onChangeText={(value) => setValue('firstName', value)} placeholder="Votre prenom" icon="person-outline" />
            <Input label="Nom" value={form.lastName || ''} onChangeText={(value) => setValue('lastName', value)} placeholder="Votre nom" icon="person-outline" />
            <Input label="Telephone principal" value={form.phone || ''} onChangeText={(value) => setValue('phone', value)} placeholder="+212 6XX XXX XXX" icon="call-outline" keyboardType="phone-pad" />
            <Input label="Telephone secondaire" value={form.secondaryPhone || ''} onChangeText={(value) => setValue('secondaryPhone', value)} placeholder="+212 6XX XXX XXX" icon="call-outline" keyboardType="phone-pad" />
            <Input label="Email" value={form.email || ''} onChangeText={(value) => setValue('email', value)} placeholder="client@email.com" icon="mail-outline" keyboardType="email-address" />
            <Input label="Ville actuelle" value={form.currentCity || ''} onChangeText={(value) => setValue('currentCity', value)} placeholder="Casablanca" icon="location-outline" />
            <Input label="Pays de residence" value={form.countryOfResidence || ''} onChangeText={(value) => setValue('countryOfResidence', value)} placeholder="Maroc, France, Belgique..." icon="airplane-outline" />
            <Input label="Nationalite" value={form.nationality || ''} onChangeText={(value) => setValue('nationality', value)} placeholder="Marocaine" icon="flag-outline" />
            <Text style={styles.label}>Statut de residence</Text>
            {expandButton('Statut de residence', form.residenceStatus || '', residenceStatusOpen, () => setResidenceStatusOpen((prev) => !prev), 'airplane-outline')}
            {residenceStatusOpen ? singleChoice(RESIDENCE_STATUSES, form.residenceStatus, (value) => setValue('residenceStatus', value as LeadAnswers['residenceStatus'])) : null}
            <Text style={styles.label}>Langue preferee</Text>
            {expandButton('Langue preferee', LANGUAGES.find((item) => item.value === form.preferredLanguage)?.label || '', languageOpen, () => setLanguageOpen((prev) => !prev), 'language-outline')}
            {languageOpen ? singleChoice(LANGUAGES.map((item) => item.label), LANGUAGES.find((item) => item.value === form.preferredLanguage)?.label, (value) => setValue('preferredLanguage', LANGUAGES.find((item) => item.label === value)?.value || 'Français')) : null}
            <Text style={styles.label}>Moyen de contact prefere</Text>
            {expandButton('Moyen de contact', form.contactPreference || '', contactMethodOpen, () => setContactMethodOpen((prev) => !prev), 'call-outline')}
            {contactMethodOpen ? singleChoice(CONTACT_METHODS, form.contactPreference, (value) => setValue('contactPreference', value as ContactPreference)) : null}
            <Text style={styles.label}>Disponibilite pour etre contacte</Text>
            {expandButton('Disponibilite de contact', form.contactAvailability || '', contactAvailabilityOpen, () => setContactAvailabilityOpen((prev) => !prev), 'time-outline')}
            {contactAvailabilityOpen ? singleChoice(CONTACT_AVAILABILITIES, form.contactAvailability, (value) => setValue('contactAvailability', value as LeadAnswers['contactAvailability'])) : null}
            <Input label="Profession" value={form.profession || ''} onChangeText={(value) => setValue('profession', value)} placeholder="Ingenieur, commercant..." icon="briefcase-outline" />
            <Text style={styles.label}>Situation familiale</Text>
            {expandButton('Situation familiale', form.familySituation || '', familySituationOpen, () => setFamilySituationOpen((prev) => !prev), 'people-outline')}
            {familySituationOpen ? singleChoice(FAMILY_SITUATIONS, form.familySituation, (value) => setValue('familySituation', value as LeadAnswers['familySituation'])) : null}
            <View style={styles.result}>
              <Text style={styles.resultTitle}>Qualification preliminaire : {scoreToLabel(qualificationPreview.score)}</Text>
              <Text style={styles.resultText}>Score global {qualificationPreview.score}/100. Budget {qualificationPreview.indicators.budgetCoherence}/100, realisme {qualificationPreview.indicators.requestRealism}/100, compatibilite marche {qualificationPreview.indicators.marketCompatibility}/100, precision {qualificationPreview.indicators.needPrecision}/100, serieux estime {qualificationPreview.indicators.estimatedSeriousness}/100.</Text>
            </View>
            {qualificationPreview.issues.length > 0 ? (
              <View style={styles.issueCard}>
                {qualificationPreview.issues.map((item) => <Text key={item.code} style={styles.issueText}>• {item.message}</Text>)}
              </View>
            ) : (
              <View style={styles.issueCard}>
                <Text style={styles.issueText}>Aucune incoherence majeure detectee a ce stade. Le matching sera base sur vos criteres reels.</Text>
              </View>
            )}
            {!currentUser ? (
              <View style={styles.passwordWrap}>
                <Input label="Mot de passe" value={form.password || ''} onChangeText={(value) => setValue('password', value)} placeholder="Au moins 6 caracteres" icon="lock-closed-outline" secure={!showPassword} />
                <TouchableOpacity onPress={() => setShowPassword((prev) => !prev)} style={styles.eyeBtn}>
                  <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color={Colors.textSoft} />
                </TouchableOpacity>
              </View>
            ) : null}
            <TouchableOpacity onPress={() => setValue('consent', !form.consent)} style={styles.checkRow}>
              <View style={[styles.box, form.consent && styles.boxOn]}>{form.consent ? <Ionicons name="checkmark" size={14} color={Colors.white} /> : null}</View>
              <Text style={styles.checkText}>Je confirme que mes criteres sont reels et j accepte d etre contacte par Selix.</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setValue('contactWhatsApp', !form.contactWhatsApp)} style={styles.checkRow}>
              <View style={[styles.box, form.contactWhatsApp && styles.boxOn]}>{form.contactWhatsApp ? <Ionicons name="checkmark" size={14} color={Colors.white} /> : null}</View>
              <Text style={styles.checkText}>J accepte les relances WhatsApp pour accelerer la qualification et le matching.</Text>
            </TouchableOpacity>
            {error ? <View style={styles.error}><Ionicons name="alert-circle-outline" size={16} color={Colors.danger} /><Text style={styles.errorText}>{error}</Text></View> : null}
          </>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button label={step < STEPS.length - 1 ? 'Etape suivante' : isGuest ? 'Creer mon compte et activer le matching' : hasCompletedQuestionnaire ? 'Mettre a jour mon profil' : 'Finaliser mon dossier'} onPress={step < STEPS.length - 1 ? goNext : onSubmit} disabled={!canProceed()} loading={step === STEPS.length - 1 && questionnaireLoading} size="lg" iconRight={step < STEPS.length - 1 ? 'arrow-forward' : 'sparkles-outline'} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingTop: 52, paddingBottom: 22, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  headerPicto: { width: 42, height: 42 },
  stepMeta: { fontSize: 12, color: 'rgba(255,255,255,0.72)', fontWeight: '600', marginBottom: 2 },
  stepTitle: { fontSize: 20, fontWeight: '800', color: Colors.white },
  scroll: { flex: 1, backgroundColor: Colors.bgMain },
  content: { padding: 20, paddingBottom: 20 },
  heroCard: { borderRadius: 28, padding: 18, marginBottom: 18, borderWidth: 1, borderColor: Colors.borderSoft, overflow: 'hidden' },
  heroBadgeRow: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  heroHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  heroIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  heroCopy: { flex: 1 },
  stepRail: { marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', gap: 10 },
  stepRailItem: { flexDirection: 'row', alignItems: 'center', gap: 10, opacity: 0.6 },
  stepRailItemActive: { opacity: 1 },
  stepRailDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.18)' },
  stepRailDotDone: { backgroundColor: Colors.primarySoft },
  stepRailDotActive: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.accentOrange },
  stepRailLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: '700' },
  stepRailLabelActive: { color: Colors.textBody },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '900', color: Colors.textDark },
  subtitle: { marginTop: 8, marginBottom: 18, fontSize: 14, lineHeight: 22, color: Colors.textMuted },
  sectionCard: { marginBottom: 16, padding: 0, backgroundColor: Colors.bgCard, borderRadius: 24, borderWidth: 1, borderColor: Colors.borderSoft, overflow: 'hidden' },
  sectionCardHeader: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.02)' },
  sectionEyebrow: { fontSize: 11, fontWeight: '800', color: Colors.accentOrange, textTransform: 'uppercase', letterSpacing: 1.1, marginBottom: 5 },
  sectionCardTitle: { fontSize: 18, fontWeight: '900', color: Colors.textDark, marginBottom: 6 },
  sectionCardText: { fontSize: 13, lineHeight: 20, color: Colors.textMuted },
  sectionCardBody: { padding: 18 },
  label: { marginTop: 8, marginBottom: 8, fontSize: 13, fontWeight: '800', color: Colors.textBody },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  expandButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.borderSoft, borderRadius: 22, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, minHeight: 74 },
  expandButtonOpen: { borderColor: 'rgba(168,85,247,0.45)', backgroundColor: Colors.lavenderUltra },
  expandIconWrap: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: Colors.borderSoft },
  expandIconWrapOpen: { backgroundColor: 'rgba(168,85,247,0.12)', borderColor: 'rgba(168,85,247,0.28)' },
  expandCopy: { flex: 1 },
  expandLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginBottom: 4 },
  expandValue: { fontSize: 15, fontWeight: '800', color: Colors.textDark },
  expandChevronWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.02)' },
  expandChevronWrapOpen: { backgroundColor: 'rgba(168,85,247,0.12)' },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  binaryGrid: { gap: 8, marginTop: 4 },
  binaryItem: { padding: 12, borderRadius: 14, borderWidth: 1, borderColor: Colors.borderSoft, backgroundColor: Colors.bgCard },
  binaryLabel: { fontSize: 13, fontWeight: '700', color: Colors.textDark, marginBottom: 8 },
  result: { padding: 18, borderRadius: 18, backgroundColor: Colors.lavenderUltra, borderWidth: 1, borderColor: Colors.borderSoft, marginBottom: 14 },
  resultTitle: { fontSize: 16, lineHeight: 23, fontWeight: '900', color: Colors.textDark, marginBottom: 8 },
  resultText: { fontSize: 13, lineHeight: 20, color: Colors.textBody },
  issueCard: { padding: 14, borderRadius: 16, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.borderSoft, marginBottom: 14, gap: 6 },
  issueText: { fontSize: 13, lineHeight: 20, color: Colors.textBody },
  passwordWrap: { position: 'relative' },
  eyeBtn: { position: 'absolute', right: 14, top: 36, padding: 6 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12, backgroundColor: Colors.bgCard, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  boxOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkText: { flex: 1, fontSize: 13, color: Colors.textBody, lineHeight: 19 },
  error: { flexDirection: 'row', gap: 8, alignItems: 'center', borderRadius: 16, backgroundColor: Colors.dangerLight, borderWidth: 1, borderColor: 'rgba(255,107,146,0.18)', padding: 12, marginTop: 8 },
  errorText: { flex: 1, color: Colors.danger, fontSize: 13, fontWeight: '700' },
  footer: { paddingHorizontal: 20, paddingVertical: 16, paddingBottom: Platform.OS === 'ios' ? 34 : 16, backgroundColor: Colors.bgCard, borderTopWidth: 1, borderTopColor: Colors.borderSoft },
});
