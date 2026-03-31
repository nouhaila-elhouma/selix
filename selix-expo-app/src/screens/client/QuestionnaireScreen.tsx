import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { ApiError } from '../../lib/api';
import { Button, Input, ProgressBar, SelectChip } from '../../components/ui';
import { ContactPreference, FinancingMode, LeadAnswers, Objective, OwnershipContext, PreferredLanguage, ProjectStage, PropertyType, PurchaseDeadline, PurchaseStage } from '../../types';

type DetailedOption<T extends string> = { label: string; value: T | ''; description: string };

const TYPES: PropertyType[] = ['Appartement', 'Villa', 'Bureau', 'Terrain', 'Duplex', 'Penthouse', 'Studio', 'Local', 'Riad'];
const GOALS: Array<DetailedOption<Objective>> = [
  { label: 'Habiter', value: 'Habiter', description: 'Vous recherchez un bien pour y vivre vous-meme, seul, en couple ou en famille.' },
  { label: 'Investir', value: 'Investir', description: 'Vous cherchez un bien pour placement, rendement locatif ou valorisation patrimoniale.' },
  { label: 'Autre', value: '', description: 'Votre besoin est specifique et vous souhaitez le decrire librement.' },
];
const MONEY: Array<DetailedOption<FinancingMode>> = [
  { label: 'Cash', value: 'Cash', description: 'Achat finance entierement avec vos fonds propres, sans credit bancaire.' },
  { label: 'Credit', value: 'Crédit', description: 'Projet finance principalement par un credit immobilier accorde par une banque.' },
  { label: 'En cours', value: 'Mixte', description: 'Montage mixte avec apport personnel et credit bancaire.' },
];
const DEADLINES: Array<DetailedOption<PurchaseDeadline>> = [
  { label: 'Immediat', value: 'Immédiat', description: 'Vous voulez avancer rapidement, idealement dans les prochaines semaines.' },
  { label: '1 a 3 mois', value: '3 mois', description: 'Le projet est actif et vous ciblez un achat a court terme.' },
  { label: '3 a 6 mois', value: '6 mois', description: 'Vous cherchez serieusement avec un peu plus de souplesse sur le calendrier.' },
  { label: 'Plus tard', value: 'Plus de 1 an', description: 'Vous etudiez le marche pour un projet plus lointain.' },
];
const MUST = ['Parking', 'Balcon', 'Terrasse', 'Piscine', 'Jardin', 'Residence fermee', 'Ascenseur', 'Vue degagee'];
const YES_NO = ['Oui', 'Non'];
const LANGUAGES = ['Français', 'English', 'العربية'];
const CITIES = ['Casablanca', 'Rabat', 'Marrakech', 'Tanger', 'Agadir', 'Fes', 'Mohammedia', 'Bouskoura', 'Temara'];
const CITY_ZONES: Record<string, string[]> = {
  Casablanca: ['Ain Diab', 'Maarif', 'Anfa', 'Bouskoura', 'Sidi Maarouf', 'Californie', 'Casa Finance City'],
  Rabat: ['Agdal', 'Hay Riad', 'Souissi', 'Ocean', 'Aviation', 'Temara'],
  Marrakech: ['Gueliz', 'Hivernage', 'Palmeraie', 'Route de Casablanca', 'Targa', 'Samlalia'],
  Tanger: ['Malabata', 'Iberia', 'Centre-ville', 'Route de Rabat', 'Achakar'],
  Agadir: ['Founty', 'Sonaba', 'Marina', 'Talborjt', 'Hay Mohammadi'],
};
const CONTACT_OPTIONS: Array<DetailedOption<ContactPreference>> = [
  { label: 'WhatsApp', value: 'WhatsApp', description: 'Pour des echanges rapides, vocaux, photos et relances simples.' },
  { label: 'Appel', value: 'Appel', description: 'Pour discuter directement avec un conseiller par telephone.' },
  { label: 'Email', value: 'Email', description: 'Pour recevoir des propositions plus formelles et garder une trace ecrite.' },
];
const PURCHASE_STAGE_OPTIONS: Array<DetailedOption<PurchaseStage>> = [
  { label: 'Neuf uniquement', value: 'Neuf uniquement', description: 'Vous ciblez uniquement les projets neufs ou en VEFA.' },
  { label: 'Neuf et ancien', value: 'Neuf et ancien', description: 'Vous restez ouvert aux biens neufs comme aux opportunites dans l ancien.' },
];
const PROJECT_STAGE_OPTIONS: Array<DetailedOption<ProjectStage>> = [
  { label: 'Pret a livrer', value: 'Prêt à livrer', description: 'Vous privilegiez un bien disponible rapidement ou deja finalise.' },
  { label: 'En construction', value: 'En cours de construction', description: 'Vous acceptez un delai de livraison en echange d un meilleur positionnement ou prix.' },
  { label: 'Sans preference', value: 'Sans préférence', description: 'Le stade du projet n est pas un critere bloquant pour vous.' },
];
const OWNERSHIP_OPTIONS: Array<DetailedOption<OwnershipContext>> = [
  { label: 'Seul', value: 'Seul', description: 'Vous prenez la decision seul et le projet depend principalement de votre profil.' },
  { label: 'Couple', value: 'Couple', description: 'Le bien est cherche a deux avec une decision et un budget communs.' },
  { label: 'Famille', value: 'Famille', description: 'Le besoin tient compte de plusieurs occupants et d usages familiaux.' },
];
const OPTIONAL_CRITERIA = ['Vue mer', 'Calme', 'Proche ecoles', 'Proche tram', 'Haut standing', 'Bon rendement locatif', 'Securite 24/7', 'Faibles charges'];
const LANGUAGE_OPTIONS: Array<{ label: string; value: PreferredLanguage }> = [
  { label: 'Francais', value: 'Français' },
  { label: 'English', value: 'English' },
  { label: 'Arabe', value: 'العربية' },
];

export function QuestionnaireScreen() {
  const { currentUser, leadAnswers, hasCompletedQuestionnaire, submitQuestionnaire, questionnaireLoading, currentQuestionnaireStep, setCurrentQuestionnaireStep, setCurrentScreen, setLeadAnswers } = useApp();
  const isGuest = !currentUser;
  const steps = isGuest ? ['Objectif', 'Type', 'Lieu', 'Budget', 'Criteres', 'Urgence', 'Qualification', 'Compte'] : ['Objectif', 'Type', 'Lieu', 'Budget', 'Criteres', 'Urgence', 'Qualification', 'Validation'];
  const step = Math.min(currentQuestionnaireStep, steps.length - 1);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState<Partial<LeadAnswers>>({
    firstName: currentUser?.name?.split(' ')[0] || '', lastName: currentUser?.name?.split(' ').slice(1).join(' ') || '', email: currentUser?.email || '', phone: currentUser?.phone || '',
    password: '', preferredLanguage: 'Français', propertyType: '', objective: '', clientGoal: '', targetZone: '', searchedCity: '', city: '', currentCity: '', excludedZones: [],
    budgetRaw: 0, budgetMinRaw: 0, downPaymentRaw: 0, financing: '', desiredAreaRaw: 0, rooms: 0, mustHave: [], purchaseDeadline: '', hasVisitedProperties: undefined,
    hasBankPreApproval: undefined, contactedBank: undefined, isDecisionMaker: undefined, parkingRequired: undefined, terraceRequired: undefined, freeNotes: '', consent: true, contactWhatsApp: true,
  });

  useEffect(() => {
    setForm((prev) => ({ ...prev, ...leadAnswers, firstName: leadAnswers.firstName || prev.firstName, lastName: leadAnswers.lastName || prev.lastName, email: leadAnswers.email || prev.email, phone: leadAnswers.phone || prev.phone, password: prev.password, excludedZones: leadAnswers.excludedZones || [], mustHave: leadAnswers.mustHave || [] }));
  }, [leadAnswers]);

  const setValue = (key: keyof LeadAnswers, value: any) => {
    setError(null);
    const next = { ...form, [key]: value };
    setForm(next);
    setLeadAnswers(next);
  };

  const toggleMust = (item: string) => setValue('mustHave', (form.mustHave || []).includes(item) ? (form.mustHave || []).filter((v) => v !== item) : [...(form.mustHave || []), item]);
  const toggleOptional = (item: string) => setValue('optionalCriteria', (form.optionalCriteria || []).includes(item) ? (form.optionalCriteria || []).filter((v) => v !== item) : [...(form.optionalCriteria || []), item]);
  const parseNumber = (v: string) => parseInt(v.replace(/\D/g, ''), 10) || 0;
  const parseCsv = (v: string) => v.split(',').map((x) => x.trim()).filter(Boolean);
  const goBack = () => step > 0 ? setCurrentQuestionnaireStep(step - 1) : setCurrentScreen(isGuest ? 'Welcome' : hasCompletedQuestionnaire ? 'ClientApp' : 'Welcome');
  const goNext = () => step < steps.length - 1 && setCurrentQuestionnaireStep(step + 1);
  const suggestedZones = CITY_ZONES[form.searchedCity || form.city || ''] || [];

  const canProceed = () => {
    if (step === 0) return !!(form.objective || form.clientGoal?.trim());
    if (step === 1) return !!form.propertyType;
    if (step === 2) return !!((form.searchedCity || form.currentCity || form.city)?.trim() && form.targetZone?.trim());
    if (step === 3) return !!form.financing && (form.budgetRaw || 0) > 0;
    if (step === 4) return (form.rooms || 0) > 0 || (form.desiredAreaRaw || 0) > 0 || (form.mustHave?.length || 0) > 0;
    if (step === 5) return !!form.purchaseDeadline && form.hasVisitedProperties !== undefined;
    if (step === 6) return form.contactedBank !== undefined && form.isDecisionMaker !== undefined;
    if (!isGuest) return !!form.consent;
    return !!(form.firstName?.trim() && form.lastName?.trim() && form.phone?.trim() && form.email?.trim() && form.password && form.password.length >= 6 && form.consent);
  };

  const buildAnswers = (): LeadAnswers => {
    const urgency: Record<string, number> = { 'Immédiat': 95, '3 mois': 80, '6 mois': 65, '1 an': 45, 'Plus de 1 an': 25 };
    const financingReadiness = Math.min(100, (form.downPaymentRaw ? 30 : 0) + (form.hasBankPreApproval ? 35 : 0) + (form.contactedBank ? 20 : 0) + (form.financing === 'Cash' ? 15 : 0));
    const projectSeriousness = Math.min(100, (form.isDecisionMaker ? 45 : 20) + (form.hasVisitedProperties ? 20 : 0) + ((form.mustHave?.length || 0) > 0 ? 15 : 0) + ((form.budgetRaw || 0) > 0 ? 20 : 0));
    const compatibilityScore = Math.min(100, 30 + ((form.searchedCity || form.city) ? 15 : 0) + (form.targetZone ? 10 : 0) + ((form.budgetRaw || 0) > 0 ? 15 : 0) + ((form.desiredAreaRaw || 0) > 0 ? 10 : 0) + ((form.rooms || 0) > 0 ? 10 : 0) + ((form.mustHave?.length || 0) > 0 ? 10 : 0));
    return {
      firstName: form.firstName?.trim() || '', lastName: form.lastName?.trim() || '', phone: form.phone?.trim() || '', email: form.email?.trim() || '', password: form.password || '',
      currentCity: form.currentCity?.trim() || form.city?.trim() || '', countryOfResidence: form.country?.trim() || undefined, contactPreference: form.contactPreference || 'WhatsApp', preferredLanguage: (form.preferredLanguage as LeadAnswers['preferredLanguage']) || 'Français',
      excludedZones: form.excludedZones || [], city: form.city?.trim() || form.searchedCity?.trim() || form.currentCity?.trim() || '', isMRE: !!form.isMRE, country: form.country?.trim() || undefined, searchedCity: form.searchedCity?.trim() || form.city?.trim() || '',
      propertyType: (form.propertyType as PropertyType) || '', objective: (form.objective as Objective) || '', clientGoal: form.clientGoal || undefined, targetZone: form.targetZone?.trim() || '', purchaseStage: form.purchaseStage || undefined, projectStage: form.projectStage || undefined,
      budget: `${(form.budgetRaw || 0).toLocaleString('fr-FR')} MAD`, budgetRaw: form.budgetRaw || 0, budgetMin: `${(form.budgetMinRaw || 0).toLocaleString('fr-FR')} MAD`, budgetMinRaw: form.budgetMinRaw || 0,
      downPayment: `${(form.downPaymentRaw || 0).toLocaleString('fr-FR')} MAD`, downPaymentRaw: form.downPaymentRaw || 0, financing: (form.financing as FinancingMode) || '', hasBankPreApproval: form.hasBankPreApproval,
      purchaseDeadline: (form.purchaseDeadline as PurchaseDeadline) || '', hasVisitedProperties: form.hasVisitedProperties, desiredArea: `${form.desiredAreaRaw || 0} m2`, desiredAreaRaw: form.desiredAreaRaw || 0, rooms: form.rooms || 0, bathrooms: form.bathrooms || 0,
      parkingRequired: form.parkingRequired, terraceRequired: form.terraceRequired, mustHave: form.mustHave || [], requiredCriteria: form.requiredCriteria || [], optionalCriteria: form.optionalCriteria || [], freeNotes: form.freeNotes?.trim() || undefined,
      tolerances: form.tolerances || [], contactedBank: form.contactedBank, isDecisionMaker: form.isDecisionMaker, consent: !!form.consent, contactWhatsApp: !!form.contactWhatsApp,
      urgencyLevel: urgency[form.purchaseDeadline || ''] || 30, projectSeriousness, financingReadiness, compatibilityScore,
    };
  };

  const onSubmit = async () => {
    setError(null);
    if (!canProceed()) return;
    if (isGuest && (form.password?.length || 0) < 6) return setError('Le mot de passe doit contenir au moins 6 caracteres.');
    try { await submitQuestionnaire(buildAnswers()); }
    catch (e) { setError(e instanceof ApiError || e instanceof Error ? e.message : 'Impossible de finaliser votre inscription pour le moment.'); }
  };

  const choiceGroup = (items: string[], value: any, onPick: (value: string) => void) => <View style={styles.chips}>{items.map((item) => <SelectChip key={item} label={item} selected={value === item} onPress={() => onPick(item)} />)}</View>;
  const detailChoiceGroup = <T extends string>(items: Array<DetailedOption<T>>, value: T | '' | undefined, onPick: (value: T | '') => void) => (
    <View style={styles.detailOptions}>
      {items.map((item) => {
        const selected = value === item.value || (!item.value && !value);
        return (
          <TouchableOpacity key={item.label} activeOpacity={0.9} onPress={() => onPick(item.value)} style={[styles.detailOption, selected && styles.detailOptionActive]}>
            <View style={styles.detailOptionTop}>
              <Text style={[styles.detailOptionTitle, selected && styles.detailOptionTitleActive]}>{item.label}</Text>
              {selected ? <Ionicons name="checkmark-circle" size={18} color={Colors.primary} /> : null}
            </View>
            <Text style={[styles.detailOptionDescription, selected && styles.detailOptionDescriptionActive]}>{item.description}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
  const booleanGroup = (field: 'hasVisitedProperties' | 'contactedBank' | 'hasBankPreApproval' | 'isDecisionMaker' | 'parkingRequired' | 'terraceRequired') => choiceGroup(YES_NO, form[field] === true ? 'Oui' : form[field] === false ? 'Non' : '', (item) => setValue(field, item === 'Oui'));

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={Colors.gradientPrimary} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={goBack} style={styles.backBtn}><Ionicons name="arrow-back" size={20} color={Colors.white} /></TouchableOpacity>
          <View style={{ flex: 1 }}><Text style={styles.stepMeta}>Etape {step + 1} sur {steps.length}</Text><Text style={styles.stepTitle}>{steps[step]}</Text></View>
        </View>
        <ProgressBar value={step + 1} max={steps.length} color={Colors.white} height={4} style={{ marginTop: 12 }} />
      </LinearGradient>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>
          {step === 0 ? 'Pourquoi vous cherchez ?' : step === 1 ? 'Quel type de bien cherchez-vous ?' : step === 2 ? 'Ou souhaitez-vous acheter ?' : step === 3 ? 'Quel est votre budget ?' : step === 4 ? 'Quels sont vos criteres cles ?' : step === 5 ? 'Ou en est votre projet ?' : step === 6 ? 'Dernieres questions de qualification' : isGuest ? 'Vos resultats sont prets' : 'Validation de votre projet'}
        </Text>
        <Text style={styles.subtitle}>{step === 7 && isGuest ? 'Creez votre compte maintenant pour voir vos resultats et retrouver vos matchs.' : 'Repondez en quelques gestes. Selix construit votre profil au fur et a mesure.'}</Text>

        {step === 0 ? <>
          {detailChoiceGroup(GOALS, form.objective, (value) => { setValue('objective', value); if (!value) setValue('clientGoal', 'Residence secondaire'); })}
          {!form.objective ? <Input label="Precisez votre objectif" value={form.clientGoal || ''} onChangeText={(v) => setValue('clientGoal', v)} placeholder="Habiter, residence secondaire, location..." icon="create-outline" /> : null}
          <Text style={styles.label}>Etes-vous MRE ?</Text>
          {choiceGroup(YES_NO, form.isMRE ? 'Oui' : 'Non', (v) => setValue('isMRE', v === 'Oui'))}
          {form.isMRE ? <Input label="Pays de residence" value={form.country || ''} onChangeText={(v) => setValue('country', v)} placeholder="France, Belgique, Espagne..." icon="airplane-outline" /> : null}
        </> : null}
        {step === 1 ? choiceGroup(TYPES, form.propertyType, (v) => setValue('propertyType', v)) : null}
        {step === 2 ? <>
          <Text style={styles.label}>Ville recherchee</Text>
          {choiceGroup(CITIES, form.searchedCity || '', (v) => { setValue('searchedCity', v); setValue('city', v); })}
          <Input label="Ou saisissez une autre ville" value={form.searchedCity || ''} onChangeText={(v) => { setValue('searchedCity', v); setValue('city', v); }} placeholder="Casablanca, Rabat, Marrakech..." icon="navigate-outline" />
          {suggestedZones.length ? <>
            <Text style={styles.label}>Quartiers suggérés</Text>
            {choiceGroup(suggestedZones, form.targetZone || '', (v) => setValue('targetZone', v))}
          </> : null}
          <Input label="Zone / quartier" value={form.targetZone || ''} onChangeText={(v) => setValue('targetZone', v)} placeholder="Ain Diab, Agdal, Gueliz..." icon="map-outline" />
          <Input label="Zones refusees" value={(form.excludedZones || []).join(', ')} onChangeText={(v) => setValue('excludedZones', parseCsv(v))} placeholder="Ex : centre-ville, zone industrielle" icon="close-circle-outline" />
          <Input label="Ville actuelle" value={form.currentCity || ''} onChangeText={(v) => setValue('currentCity', v)} placeholder="Votre ville actuelle" icon="location-outline" />
          <Text style={styles.label}>Preference de contact</Text>
          {detailChoiceGroup(CONTACT_OPTIONS, form.contactPreference, (value) => setValue('contactPreference', (value || 'WhatsApp') as ContactPreference))}
        </> : null}
        {step === 3 ? <><View style={styles.row}><Input style={styles.half} label="Budget min (MAD)" value={form.budgetMinRaw ? String(form.budgetMinRaw) : ''} onChangeText={(v) => setValue('budgetMinRaw', parseNumber(v))} placeholder="1200000" icon="cash-outline" keyboardType="numeric" /><Input style={styles.half} label="Budget max (MAD)" value={form.budgetRaw ? String(form.budgetRaw) : ''} onChangeText={(v) => setValue('budgetRaw', parseNumber(v))} placeholder="1800000" icon="cash-outline" keyboardType="numeric" /></View><Input label="Apport disponible (MAD)" value={form.downPaymentRaw ? String(form.downPaymentRaw) : ''} onChangeText={(v) => setValue('downPaymentRaw', parseNumber(v))} placeholder="300000" icon="wallet-outline" keyboardType="numeric" /><Text style={styles.label}>Financement</Text>{detailChoiceGroup(MONEY, form.financing, (value) => setValue('financing', value))}</> : null}
        {step === 4 ? <>
          <View style={styles.row}>
            <Input style={styles.half} label="Pieces / chambres" value={form.rooms ? String(form.rooms) : ''} onChangeText={(v) => setValue('rooms', parseNumber(v))} placeholder="3" icon="bed-outline" keyboardType="numeric" />
            <Input style={styles.half} label="Salles de bain" value={form.bathrooms ? String(form.bathrooms) : ''} onChangeText={(v) => setValue('bathrooms', parseNumber(v))} placeholder="2" icon="water-outline" keyboardType="numeric" />
          </View>
          <View style={styles.row}>
            <Input style={styles.half} label="Surface min (m2)" value={form.desiredAreaMinRaw ? String(form.desiredAreaMinRaw) : ''} onChangeText={(v) => setValue('desiredAreaMinRaw', parseNumber(v))} placeholder="90" icon="resize-outline" keyboardType="numeric" />
            <Input style={styles.half} label="Surface ideale (m2)" value={form.desiredAreaRaw ? String(form.desiredAreaRaw) : ''} onChangeText={(v) => setValue('desiredAreaRaw', parseNumber(v))} placeholder="120" icon="expand-outline" keyboardType="numeric" />
          </View>
          <Text style={styles.label}>Options importantes</Text>
          <View style={styles.chips}>{MUST.map((item) => <SelectChip key={item} label={item} selected={(form.mustHave || []).includes(item)} onPress={() => toggleMust(item)} />)}</View>
          <Text style={styles.label}>Options souhaitées</Text>
          <View style={styles.chips}>{OPTIONAL_CRITERIA.map((item) => <SelectChip key={item} label={item} selected={(form.optionalCriteria || []).includes(item)} onPress={() => toggleOptional(item)} />)}</View>
          <Text style={styles.label}>Parking obligatoire ?</Text>{booleanGroup('parkingRequired')}
          <Text style={styles.label}>Balcon / terrasse obligatoire ?</Text>{booleanGroup('terraceRequired')}
        </> : null}
        {step === 5 ? <>
          <Text style={styles.label}>Quand voulez-vous acheter ?</Text>
          {detailChoiceGroup(DEADLINES, form.purchaseDeadline, (value) => setValue('purchaseDeadline', value))}
          <Text style={styles.label}>Avez-vous deja visite des biens ?</Text>{booleanGroup('hasVisitedProperties')}
          <Text style={styles.label}>Etat du bien recherche</Text>
          {detailChoiceGroup(PROJECT_STAGE_OPTIONS, form.projectStage, (value) => setValue('projectStage', value))}
          <Text style={styles.label}>Type de marche</Text>
          {detailChoiceGroup(PURCHASE_STAGE_OPTIONS, form.purchaseStage, (value) => setValue('purchaseStage', value))}
          <Text style={styles.label}>Contexte d achat</Text>
          {detailChoiceGroup(OWNERSHIP_OPTIONS, form.ownershipContext, (value) => setValue('ownershipContext', value))}
        </> : null}
        {step === 6 ? <>
          <Text style={styles.label}>Avez-vous deja contacte une banque ?</Text>{booleanGroup('contactedBank')}
          <Text style={styles.label}>Avez-vous une pre-approbation bancaire ?</Text>{booleanGroup('hasBankPreApproval')}
          <Text style={styles.label}>Etes-vous decisionnaire ?</Text>{booleanGroup('isDecisionMaker')}
          <Text style={styles.label}>Langue preferee</Text>
          {choiceGroup(LANGUAGE_OPTIONS.map((item) => item.label), LANGUAGE_OPTIONS.find((item) => item.value === form.preferredLanguage)?.label || '', (v) => setValue('preferredLanguage', LANGUAGE_OPTIONS.find((item) => item.label === v)?.value || 'Français'))}
          <Input label="Remarques libres" value={form.freeNotes || ''} onChangeText={(v) => setValue('freeNotes', v)} placeholder="Precisez ce qui compte vraiment pour vous" icon="document-text-outline" multiline />
        </> : null}
        {step === 7 ? <>
          <View style={styles.result}><Text style={styles.resultTitle}>{isGuest ? 'Vos resultats sont prets, creez votre compte pour les voir' : 'Votre projet est pret a etre relance'}</Text><Text style={styles.resultText}>Selix a deja calcule votre maturite, votre coherence budget / marche et votre potentiel de matching.</Text></View>
          {isGuest ? <>
            <Input label="Prenom" value={form.firstName || ''} onChangeText={(v) => setValue('firstName', v)} placeholder="Votre prenom" icon="person-outline" />
            <Input label="Nom" value={form.lastName || ''} onChangeText={(v) => setValue('lastName', v)} placeholder="Votre nom" icon="person-outline" />
            <Input label="Telephone" value={form.phone || ''} onChangeText={(v) => setValue('phone', v)} placeholder="+212 6XX XXX XXX" icon="call-outline" keyboardType="phone-pad" />
            <Input label="Email" value={form.email || ''} onChangeText={(v) => setValue('email', v)} placeholder="votre@email.com" icon="mail-outline" keyboardType="email-address" />
            <View style={styles.passwordWrap}><Input label="Mot de passe" value={form.password || ''} onChangeText={(v) => setValue('password', v)} placeholder="Au moins 6 caracteres" icon="lock-closed-outline" secure={!showPassword} /><TouchableOpacity onPress={() => setShowPassword((prev) => !prev)} style={styles.eyeBtn}><Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color={Colors.textSoft} /></TouchableOpacity></View>
            <Text style={styles.label}>Langue preferee</Text>{choiceGroup(LANGUAGES, form.preferredLanguage || '', (v) => setValue('preferredLanguage', v))}
          </> : null}
          <TouchableOpacity onPress={() => setValue('consent', !form.consent)} style={styles.checkRow}><View style={[styles.box, form.consent && styles.boxOn]}>{form.consent ? <Ionicons name="checkmark" size={14} color={Colors.white} /> : null}</View><Text style={styles.checkText}>J accepte d etre contacte par Selix au sujet de mon projet immobilier.</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setValue('contactWhatsApp', !form.contactWhatsApp)} style={styles.checkRow}><View style={[styles.box, form.contactWhatsApp && styles.boxOn]}>{form.contactWhatsApp ? <Ionicons name="checkmark" size={14} color={Colors.white} /> : null}</View><Text style={styles.checkText}>J accepte les echanges WhatsApp pour accelerer le suivi.</Text></TouchableOpacity>
          {error ? <View style={styles.error}><Ionicons name="alert-circle-outline" size={16} color={Colors.danger} /><Text style={styles.errorText}>{error}</Text></View> : null}
        </> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button label={step < steps.length - 1 ? `Continuer - ${steps[step + 1]}` : isGuest ? 'Creer mon compte et voir mes resultats' : hasCompletedQuestionnaire ? 'Mettre a jour mon profil' : 'Analyser mon profil'} onPress={step < steps.length - 1 ? goNext : onSubmit} disabled={!canProceed()} loading={step === steps.length - 1 && questionnaireLoading} size="lg" iconRight={step < steps.length - 1 ? 'arrow-forward' : 'sparkles-outline'} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, header: { paddingTop: 52, paddingBottom: 20, paddingHorizontal: 20 }, headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  stepMeta: { fontSize: 12, color: 'rgba(255,255,255,0.72)', fontWeight: '600', marginBottom: 2 }, stepTitle: { fontSize: 20, fontWeight: '800', color: Colors.white },
  scroll: { flex: 1, backgroundColor: Colors.bgMain }, content: { padding: 20, paddingBottom: 20 }, title: { fontSize: 23, lineHeight: 30, fontWeight: '900', color: Colors.textDark }, subtitle: { marginTop: 8, marginBottom: 18, fontSize: 14, lineHeight: 22, color: Colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }, label: { marginTop: 8, marginBottom: 8, fontSize: 13, fontWeight: '800', color: Colors.textBody }, row: { flexDirection: 'row', gap: 12 }, half: { flex: 1 },
  detailOptions: { gap: 10, marginBottom: 10 },
  detailOption: { borderWidth: 1, borderColor: Colors.borderSoft, backgroundColor: Colors.bgCard, borderRadius: 16, padding: 14 },
  detailOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.lavenderUltra },
  detailOptionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 },
  detailOptionTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: Colors.textDark },
  detailOptionTitleActive: { color: Colors.primarySoft },
  detailOptionDescription: { fontSize: 12, lineHeight: 18, color: Colors.textSoft },
  detailOptionDescriptionActive: { color: Colors.textBody },
  result: { padding: 18, borderRadius: 20, backgroundColor: Colors.lavenderUltra, borderWidth: 1, borderColor: Colors.borderSoft, marginBottom: 16 }, resultTitle: { fontSize: 17, lineHeight: 24, fontWeight: '900', color: Colors.textDark, marginBottom: 8 }, resultText: { fontSize: 13, lineHeight: 20, color: Colors.textBody },
  passwordWrap: { position: 'relative' }, eyeBtn: { position: 'absolute', right: 14, top: 36, padding: 6 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12, backgroundColor: Colors.bgCard, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.border }, box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }, boxOn: { backgroundColor: Colors.primary, borderColor: Colors.primary }, checkText: { flex: 1, fontSize: 13, color: Colors.textBody, lineHeight: 19 },
  error: { flexDirection: 'row', gap: 8, alignItems: 'center', borderRadius: 16, backgroundColor: Colors.dangerLight, borderWidth: 1, borderColor: 'rgba(255,107,146,0.18)', padding: 12, marginTop: 8 }, errorText: { flex: 1, color: Colors.danger, fontSize: 13, fontWeight: '700' },
  footer: { paddingHorizontal: 20, paddingVertical: 16, paddingBottom: Platform.OS === 'ios' ? 34 : 16, backgroundColor: Colors.bgCard, borderTopWidth: 1, borderTopColor: Colors.borderSoft },
});
