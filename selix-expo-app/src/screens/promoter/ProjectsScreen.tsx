import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { Admin, ApiError, Projects, Uploads } from '../../lib/api';
import { Project } from '../../types';
import { Button, Card, Input, ProgressBar, SectionHeader } from '../../components/ui';
import { canManageProjects } from '../../utils/adminAccess';
import { AMENITIES, FINISHING_LEVELS, MOROCCO_CITIES, PROJECT_CATEGORIES, PROPERTY_TYPES, VIEW_OPTIONS } from '../../data/realEstateForm';

const PROJECT_TYPES = PROPERTY_TYPES;
const PROJECT_STATUSES = ['Pre-vente', 'En construction', 'Livraison 2025', 'Livraison 2026', 'Termine'] as const;

type ProjectFormState = {
  promoterId: string;
  commercialId: string;
  name: string;
  developer: string;
  projectHeadline: string;
  projectPositioning: string;
  city: string;
  district: string;
  region: string;
  type: string;
  description: string;
  image: string;
  imagesText: string;
  featuresText: string;
  projectAdvantagesText: string;
  projectTypesText: string;
  propertyTypesText: string;
  amenitiesText: string;
  locationTagsText: string;
  districtTagsText: string;
  securityFeaturesText: string;
  viewOptionsText: string;
  finishingLevel: string;
  architectureStyle: string;
  residenceType: string;
  kitchenStyle: string;
  furnishingLevel: string;
  acceptedFinancingModesText: string;
  targetAudienceText: string;
  paymentPlanText: string;
  unitMixText: string;
  unitsText: string;
  nearbyLandmarksText: string;
  programSummaryText: string;
  permitStatus: string;
  launchDate: string;
  expectedDeliveryDate: string;
  landAreaRaw: string;
  builtAreaRaw: string;
  blocksCount: string;
  maxFloors: string;
  parkingSpots: string;
  deliveryMaxMonths: string;
  readyToLive: boolean;
  constructionAccepted: boolean;
  isSubsidized: boolean;
  parking: boolean;
  elevator: boolean;
  balcony: boolean;
  terrace: boolean;
  garden: boolean;
  pool: boolean;
  security: boolean;
  equippedKitchen: boolean;
  furnished: boolean;
  airConditioning: boolean;
  isActive: boolean;
  visibleInMatching: boolean;
  status: string;
  totalUnits: string;
  availableUnits: string;
  reservedUnits: string;
  soldUnits: string;
  minPriceRaw: string;
  maxPriceRaw: string;
  areaFromRaw: string;
  areaToRaw: string;
  bedroomsFrom: string;
  bedroomsTo: string;
  viewLabel: string;
  delivery: string;
};

const emptyForm: ProjectFormState = {
  promoterId: '',
  commercialId: '',
  name: '',
  developer: '',
  projectHeadline: '',
  projectPositioning: '',
  city: '',
  district: '',
  region: '',
  type: 'Appartement',
  description: '',
  image: '',
  imagesText: '',
  featuresText: '',
  projectAdvantagesText: '',
  projectTypesText: '',
  propertyTypesText: '',
  amenitiesText: '',
  locationTagsText: '',
  districtTagsText: '',
  securityFeaturesText: '',
  viewOptionsText: '',
  finishingLevel: '',
  architectureStyle: '',
  residenceType: '',
  kitchenStyle: '',
  furnishingLevel: '',
  acceptedFinancingModesText: '',
  targetAudienceText: '',
  paymentPlanText: '',
  unitMixText: '',
  unitsText: '',
  nearbyLandmarksText: '',
  programSummaryText: '',
  permitStatus: '',
  launchDate: '',
  expectedDeliveryDate: '',
  landAreaRaw: '',
  builtAreaRaw: '',
  blocksCount: '',
  maxFloors: '',
  parkingSpots: '',
  deliveryMaxMonths: '',
  readyToLive: false,
  constructionAccepted: true,
  isSubsidized: false,
  parking: false,
  elevator: false,
  balcony: false,
  terrace: false,
  garden: false,
  pool: false,
  security: false,
  equippedKitchen: false,
  furnished: false,
  airConditioning: false,
  isActive: true,
  visibleInMatching: true,
  status: 'En construction',
  totalUnits: '',
  availableUnits: '',
  reservedUnits: '',
  soldUnits: '',
  minPriceRaw: '',
  maxPriceRaw: '',
  areaFromRaw: '',
  areaToRaw: '',
  bedroomsFrom: '',
  bedroomsTo: '',
  viewLabel: '',
  delivery: '',
};

function getStatusColors(status: string): { bg: string; text: string } {
  switch (status) {
    case 'Termine':
      return { bg: Colors.successLight, text: Colors.success };
    case 'En construction':
      return { bg: Colors.warningLight, text: Colors.warning };
    case 'Pre-vente':
      return { bg: Colors.infoLight, text: Colors.info };
    case 'Livraison 2025':
    case 'Livraison 2026':
      return { bg: Colors.lavenderLight, text: Colors.primary };
    default:
      return { bg: Colors.bgSoft, text: Colors.textSoft };
  }
}

function normalizeProjectStatus(status: string) {
  return status.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function toFormState(project: Project): ProjectFormState {
  return {
    promoterId: project.promoterId,
    commercialId: project.commercialId || '',
    name: project.name,
    developer: project.specs?.developer || project.promoterName || '',
    projectHeadline: (project.specs?.projectHeadline as string) || '',
    projectPositioning: (project.specs?.projectPositioning as string) || '',
    city: project.city,
    district: project.district,
    region: project.specs?.region || '',
    type: project.type,
    description: project.description,
    image: project.image,
    imagesText: (project.images || []).join('\n'),
    featuresText: (project.features || []).join('\n'),
    projectAdvantagesText: ((project.specs?.projectAdvantages as string[]) || []).join('\n'),
    projectTypesText: ((project.specs?.projectTypes as string[]) || []).join(', '),
    propertyTypesText: ((project.specs?.propertyTypes as string[]) || []).join(', '),
    amenitiesText: ((project.specs?.amenities as string[]) || []).join(', '),
    locationTagsText: ((project.specs?.locationTags as string[]) || []).join(', '),
    districtTagsText: ((project.specs?.districtTags as string[]) || []).join(', '),
    securityFeaturesText: ((project.specs?.securityFeatures as string[]) || []).join(', '),
    viewOptionsText: ((project.specs?.viewOptions as string[]) || []).join(', '),
    finishingLevel: project.specs?.finishingLevel || '',
    architectureStyle: (project.specs?.architectureStyle as string) || '',
    residenceType: project.specs?.residenceType || '',
    kitchenStyle: (project.specs?.kitchenStyle as string) || '',
    furnishingLevel: (project.specs?.furnishingLevel as string) || '',
    acceptedFinancingModesText: ((project.specs?.acceptedFinancingModes as string[]) || []).join(', '),
    targetAudienceText: ((project.specs?.targetAudience as string[]) || []).join(', '),
    paymentPlanText: ((project.specs?.paymentPlan as string[]) || []).join('\n'),
    unitMixText: ((project.specs?.unitMix as string[]) || []).join('\n'),
    unitsText: formatUnitsText(project),
    nearbyLandmarksText: ((project.specs?.nearbyLandmarks as string[]) || []).join('\n'),
    programSummaryText: ((project.specs?.programSummary as string[]) || []).join('\n'),
    permitStatus: (project.specs?.permitStatus as string) || '',
    launchDate: (project.specs?.launchDate as string) || '',
    expectedDeliveryDate: (project.specs?.expectedDeliveryDate as string) || '',
    landAreaRaw: project.specs?.landAreaRaw ? String(project.specs.landAreaRaw) : '',
    builtAreaRaw: project.specs?.builtAreaRaw ? String(project.specs.builtAreaRaw) : '',
    blocksCount: project.specs?.blocksCount ? String(project.specs.blocksCount) : '',
    maxFloors: project.specs?.maxFloors ? String(project.specs.maxFloors) : '',
    parkingSpots: project.specs?.parkingSpots ? String(project.specs.parkingSpots) : '',
    deliveryMaxMonths: project.specs?.deliveryMaxMonths ? String(project.specs.deliveryMaxMonths) : '',
    readyToLive: !!project.specs?.readyToLive,
    constructionAccepted: project.specs?.constructionAccepted == null ? true : !!project.specs?.constructionAccepted,
    isSubsidized: !!project.specs?.isSubsidized,
    parking: !!project.specs?.parking,
    elevator: !!project.specs?.elevator,
    balcony: !!project.specs?.balcony,
    terrace: !!project.specs?.terrace,
    garden: !!project.specs?.garden,
    pool: !!project.specs?.pool,
    security: !!project.specs?.securityFeatures?.length,
    equippedKitchen: !!project.specs?.equippedKitchen,
    furnished: !!project.specs?.furnished,
    airConditioning: !!project.specs?.airConditioning,
    isActive: project.isActive ?? true,
    visibleInMatching: project.visibleInMatching ?? true,
    status: normalizeProjectStatus(project.status),
    totalUnits: String(project.totalUnits),
    availableUnits: String(project.availableUnits),
    reservedUnits: String(project.reservedUnits),
    soldUnits: String(project.soldUnits),
    minPriceRaw: String(project.minPriceRaw),
    maxPriceRaw: String(project.maxPriceRaw),
    areaFromRaw: String(project.areaFromRaw || ''),
    areaToRaw: String(project.areaToRaw || ''),
    bedroomsFrom: String(project.bedroomsFrom || ''),
    bedroomsTo: String(project.bedroomsTo || ''),
    viewLabel: project.viewLabel || '',
    delivery: project.delivery,
  };
}

function parseImageList(imagesText: string) {
  return imagesText.split('\n').map((item) => item.trim()).filter(Boolean);
}

function parseCsvList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function parseLineList(value: string) {
  return value.split('\n').map((item) => item.trim()).filter(Boolean);
}

function formatUnitsText(project: Project) {
  return (project.units || [])
    .map((unit) => [
      unit.label || '',
      unit.unitType || project.type || '',
      String(unit.priceRaw || 0),
      String(unit.areaRaw || 0),
      String(unit.bedrooms || 0),
      String(unit.bathrooms || 0),
      String(unit.floor || 0),
      unit.available === false ? 'Reserve' : 'Disponible',
    ].join(' | '))
    .join('\n');
}

function parseUnitsText(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [label, unitType, priceRaw, areaRaw, bedrooms, bathrooms, floor, availability] = line.split('|').map((item) => item.trim());
      return {
        id: `unit-${index + 1}`,
        label: label || `Unite ${index + 1}`,
        unitType: unitType || 'Appartement',
        priceRaw: Number(priceRaw || 0),
        areaRaw: Number(areaRaw || 0),
        bedrooms: Number(bedrooms || 0),
        bathrooms: Number(bathrooms || 0),
        floor: Number(floor || 0),
        availability: availability || 'Disponible',
      };
    });
}

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function ProjectsScreen() {
  const { currentRole, currentUser, t } = useApp();
  const [projects, setProjects] = useState<Project[]>([]);
  const [promoters, setPromoters] = useState<Array<{ id: string; name: string }>>([]);
  const [commercials, setCommercials] = useState<Array<{ id: string; name: string }>>([]);
  const [form, setForm] = useState<ProjectFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const canManage = currentRole === 'admin' && canManageProjects(currentUser);

  useEffect(() => {
    loadProjects();
    if (currentRole === 'admin' && canManageProjects(currentUser)) {
      Admin.promoters().then((items) => setPromoters(uniqueById(items as Array<{ id: string; name: string }>))).catch(() => setPromoters([]));
      Admin.commercials().then((items) => setCommercials(uniqueById(items as Array<{ id: string; name: string }>))).catch(() => setCommercials([]));
    }
  }, [currentRole, currentUser]);

  async function loadProjects() {
    setLoading(true);
    try {
      const items = await Projects.list();
      setProjects(uniqueById(items as Project[]));
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }

  function updateField<K extends keyof ProjectFormState>(key: K, value: ProjectFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  }

  async function requestGalleryPermission() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photos', "L'application a besoin d'acceder a votre galerie.");
      return false;
    }
    return true;
  }

  function updateImages(urls: string[], nextPrimary?: string) {
    const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));
    setForm((prev) => ({
      ...prev,
      image: nextPrimary || prev.image || uniqueUrls[0] || '',
      imagesText: uniqueUrls.join('\n'),
    }));
  }

  async function pickAndUploadImages(mode: 'cover' | 'gallery') {
    const hasPermission = await requestGalleryPermission();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: mode === 'cover',
      allowsMultipleSelection: mode === 'gallery',
      quality: 0.85,
      selectionLimit: mode === 'gallery' ? 10 : 1,
    });

    if (result.canceled || !result.assets.length) return;

    setUploading(true);
    try {
      const uploadedUrls: string[] = [];
      for (const asset of result.assets) {
        const upload = await Uploads.projectImage(asset.uri);
        uploadedUrls.push(upload.url);
      }

      const currentImages = parseImageList(form.imagesText);
      if (mode === 'cover') {
        updateImages([uploadedUrls[0], ...currentImages], uploadedUrls[0]);
      } else {
        updateImages([...currentImages, ...uploadedUrls]);
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Upload impossible';
      Alert.alert('Photos', message);
    } finally {
      setUploading(false);
    }
  }

  function removeImage(uri: string) {
    const nextImages = parseImageList(form.imagesText).filter((item) => item !== uri);
    const nextPrimary = form.image === uri ? nextImages[0] || '' : form.image;
    updateImages(nextImages, nextPrimary);
  }

  function setPrimaryImage(uri: string) {
    updateImages(parseImageList(form.imagesText), uri);
  }

  async function handleSubmit() {
    if (!form.name.trim() || !form.city.trim() || !form.district.trim()) {
      Alert.alert('Projet', 'Nom, ville et quartier sont obligatoires.');
      return;
    }
    if (canManage && !form.promoterId) {
      Alert.alert('Projet', 'Choisis un promoteur pour ce projet.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        promoterId: form.promoterId,
        commercialId: form.commercialId || undefined,
        name: form.name.trim(),
        city: form.city.trim(),
        district: form.district.trim(),
        type: form.type,
        description: form.description.trim(),
        image: form.image.trim(),
        images: parseImageList(form.imagesText),
        features: parseImageList(form.featuresText),
        units: parseUnitsText(form.unitsText),
        specs: {
          developer: form.developer.trim() || undefined,
          projectHeadline: form.projectHeadline.trim() || undefined,
          projectPositioning: form.projectPositioning.trim() || undefined,
          projectTypes: parseCsvList(form.projectTypesText),
          propertyTypes: parseCsvList(form.propertyTypesText),
          amenities: parseCsvList(form.amenitiesText),
          locationTags: parseCsvList(form.locationTagsText),
          districtTags: parseCsvList(form.districtTagsText),
          region: form.region.trim() || undefined,
          securityFeatures: parseCsvList(form.securityFeaturesText),
          viewOptions: parseCsvList(form.viewOptionsText),
          finishingLevel: form.finishingLevel.trim(),
          architectureStyle: form.architectureStyle.trim() || undefined,
          residenceType: form.residenceType.trim() || undefined,
          kitchenStyle: form.kitchenStyle.trim() || undefined,
          furnishingLevel: form.furnishingLevel.trim() || undefined,
          acceptedFinancingModes: parseCsvList(form.acceptedFinancingModesText),
          targetAudience: parseCsvList(form.targetAudienceText),
          paymentPlan: parseLineList(form.paymentPlanText),
          unitMix: parseLineList(form.unitMixText),
          nearbyLandmarks: parseLineList(form.nearbyLandmarksText),
          projectAdvantages: parseLineList(form.projectAdvantagesText),
          programSummary: parseLineList(form.programSummaryText),
          permitStatus: form.permitStatus.trim() || undefined,
          launchDate: form.launchDate.trim() || undefined,
          expectedDeliveryDate: form.expectedDeliveryDate.trim() || undefined,
          landAreaRaw: Number(form.landAreaRaw || 0) || undefined,
          builtAreaRaw: Number(form.builtAreaRaw || 0) || undefined,
          blocksCount: Number(form.blocksCount || 0) || undefined,
          maxFloors: Number(form.maxFloors || 0) || undefined,
          deliveryMaxMonths: Number(form.deliveryMaxMonths || 0) || undefined,
          readyToLive: form.readyToLive,
          constructionAccepted: form.constructionAccepted,
          isSubsidized: form.isSubsidized,
          parking: form.parking,
          parkingSpots: Number(form.parkingSpots || 0) || undefined,
          elevator: form.elevator,
          balcony: form.balcony,
          terrace: form.terrace,
          garden: form.garden,
          pool: form.pool,
          equippedKitchen: form.equippedKitchen,
          furnished: form.furnished,
          airConditioning: form.airConditioning,
        },
        isActive: form.isActive,
        visibleInMatching: form.visibleInMatching,
        status: form.status,
        totalUnits: Number(form.totalUnits || 0),
        availableUnits: Number(form.availableUnits || 0),
        reservedUnits: Number(form.reservedUnits || 0),
        soldUnits: Number(form.soldUnits || 0),
        minPriceRaw: Number(form.minPriceRaw || 0),
        maxPriceRaw: Number(form.maxPriceRaw || 0),
        areaFromRaw: Number(form.areaFromRaw || 0),
        areaToRaw: Number(form.areaToRaw || 0),
        bedroomsFrom: Number(form.bedroomsFrom || 0),
        bedroomsTo: Number(form.bedroomsTo || 0),
        viewLabel: form.viewLabel.trim(),
        delivery: form.delivery.trim(),
      };

      if (editingId) {
        await Projects.update(editingId, payload);
      } else {
        await Projects.create(payload);
      }

      await loadProjects();
      resetForm();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Operation impossible';
      Alert.alert('Projet', message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit(project: Project) {
    setEditingId(project.id);
    setForm(toFormState(project));
    setShowForm(true);
  }

  function handleDelete(project: Project) {
    Alert.alert(
      'Supprimer le projet',
      `Supprimer "${project.name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await Projects.remove(project.id);
              if (editingId === project.id) {
                resetForm();
              }
              await loadProjects();
            } catch (error) {
              const message = error instanceof ApiError ? error.message : 'Suppression impossible';
              Alert.alert('Projet', message);
            }
          },
        },
      ],
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={Colors.gradientPrimary} style={styles.header}>
        <Text style={styles.headerTitle}>{t('projects.title')}</Text>
        <Text style={styles.headerSub}>{t('projects.count', { count: projects.length, suffix: projects.length > 1 ? 's' : '' })}</Text>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: 130, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {showForm && (
          <Card style={styles.formCard}>
            <SectionHeader
              title={editingId ? t('projects.edit') : t('projects.add')}
              action={t('projects.close')}
              onAction={resetForm}
            />

            {canManage ? (
              <>
                <Text style={styles.fieldLabel}>Promoteur</Text>
                <View style={styles.chipsRow}>
                  {promoters.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => updateField('promoterId', item.id)}
                      style={[styles.chip, form.promoterId === item.id && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, form.promoterId === item.id && styles.chipTextActive]}>{item.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.fieldLabel}>Commercial affecté</Text>
                <View style={styles.chipsRow}>
                  {commercials.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => updateField('commercialId', form.commercialId === item.id ? '' : item.id)}
                      style={[styles.chip, form.commercialId === item.id && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, form.commercialId === item.id && styles.chipTextActive]}>{item.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : null}

            <Text style={styles.sectionLabel}>Identite du projet</Text>
            <Input label="Nom du projet" value={form.name} onChangeText={(value) => updateField('name', value)} placeholder="Residence Palm View" />
            <Input label="Promoteur / developpeur" value={form.developer} onChangeText={(value) => updateField('developer', value)} placeholder="Nom du promoteur ou de la marque" />
            <Input label="Signature du projet" value={form.projectHeadline} onChangeText={(value) => updateField('projectHeadline', value)} placeholder="Residence fermee premium avec espaces verts" />
            <Input label="Positionnement commercial" value={form.projectPositioning} onChangeText={(value) => updateField('projectPositioning', value)} placeholder="Economique, moyen standing, premium, mixte..." />
            <Input label="Ville" value={form.city} onChangeText={(value) => updateField('city', value)} placeholder="Casablanca" />
            <Input label="Quartier" value={form.district} onChangeText={(value) => updateField('district', value)} placeholder="Bourgogne" />
            <Input label="Region" value={form.region} onChangeText={(value) => updateField('region', value)} placeholder="Casablanca-Settat" />
            <Input label="Resume programme" value={form.programSummaryText} onChangeText={(value) => updateField('programSummaryText', value)} placeholder={"Une ligne par point\n3 immeubles\nCommerces en pied d'immeuble\nResidence fermee"} multiline />
            <Input label="Atouts globaux du projet" value={form.projectAdvantagesText} onChangeText={(value) => updateField('projectAdvantagesText', value)} placeholder={"Une ligne par avantage\nProche tram\nEspaces verts\nDouble facade"} multiline />
            <Input label="Points d'interet a proximite" value={form.nearbyLandmarksText} onChangeText={(value) => updateField('nearbyLandmarksText', value)} placeholder={"Une ligne par point\nGare\nEcole\nCentre commercial"} multiline />

            <Text style={styles.fieldLabel}>Type principal du projet</Text>
            <View style={styles.chipsRow}>
              {PROJECT_TYPES.map((item) => (
                <TouchableOpacity
                  key={item}
                  onPress={() => updateField('type', item)}
                  style={[styles.chip, form.type === item && styles.chipActive]}
                >
                  <Text style={[styles.chipText, form.type === item && styles.chipTextActive]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Statut</Text>
            <View style={styles.chipsRow}>
              {PROJECT_STATUSES.map((item) => (
                <TouchableOpacity
                  key={item}
                  onPress={() => updateField('status', item)}
                  style={[styles.chip, form.status === item && styles.chipActive]}
                >
                  <Text style={[styles.chipText, form.status === item && styles.chipTextActive]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.sectionLabel}>Positionnement et composition</Text>
            <Input label="Types de projet" value={form.projectTypesText} onChangeText={(value) => updateField('projectTypesText', value)} placeholder={PROJECT_CATEGORIES.join(', ')} />
            <Input label="Types de bien couverts" value={form.propertyTypesText} onChangeText={(value) => updateField('propertyTypesText', value)} placeholder={PROPERTY_TYPES.slice(0, 6).join(', ')} />
            <Input label="Mix produit du projet" value={form.unitMixText} onChangeText={(value) => updateField('unitMixText', value)} placeholder={"Une ligne par composant\nStudios 45-58 m2\nAppartements 2 chambres\nDuplex jardin"} multiline />
            <Input label="Cible client" value={form.targetAudienceText} onChangeText={(value) => updateField('targetAudienceText', value)} placeholder="MRE, primo-accedants, investisseurs, familles..." />
            <Input label="Modalites de paiement / commercialisation" value={form.paymentPlanText} onChangeText={(value) => updateField('paymentPlanText', value)} placeholder={"Une ligne par modalite\n5% reservation\n20% compromis\nCredit partenaire"} multiline />

            <Text style={styles.fieldLabel}>Photos du projet</Text>
            <View style={styles.photoActions}>
              <Button
                label="Photo principale"
                variant="secondary"
                size="sm"
                fullWidth={false}
                onPress={() => pickAndUploadImages('cover')}
                icon="image-outline"
                disabled={uploading}
              />
              <Button
                label="Ajouter des photos"
                variant="secondary"
                size="sm"
                fullWidth={false}
                onPress={() => pickAndUploadImages('gallery')}
                icon="images-outline"
                disabled={uploading}
              />
            </View>
            {uploading ? <Text style={styles.uploadText}>Envoi des photos en cours...</Text> : null}
            {parseImageList(form.imagesText).length > 0 ? (
              <View style={styles.galleryGrid}>
                {parseImageList(form.imagesText).map((uri) => {
                  const isPrimary = form.image === uri;
                  return (
                    <View key={uri} style={styles.galleryItem}>
                      <Image source={{ uri }} style={styles.galleryImage} />
                      <View style={styles.galleryOverlay}>
                        <TouchableOpacity style={styles.galleryIcon} onPress={() => setPrimaryImage(uri)}>
                          <Ionicons name={isPrimary ? 'star' : 'star-outline'} size={16} color={Colors.white} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.galleryIcon} onPress={() => removeImage(uri)}>
                          <Ionicons name="trash-outline" size={16} color={Colors.white} />
                        </TouchableOpacity>
                      </View>
                      <View style={[styles.photoBadge, isPrimary && styles.photoBadgePrimary]}>
                        <Text style={[styles.photoBadgeText, isPrimary && styles.photoBadgeTextPrimary]}>
                          {isPrimary ? 'Principale' : 'Photo'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.helperText}>Ajoute des photos depuis ta galerie pour afficher le projet dans le matching.</Text>
            )}
            <Text style={styles.sectionLabel}>Contenu marketing et prestations</Text>
            <Input label="Description" value={form.description} onChangeText={(value) => updateField('description', value)} placeholder="Description du projet" multiline />
            <Input label="Sous-zones / quartiers cibles" value={form.districtTagsText} onChangeText={(value) => updateField('districtTagsText', value)} placeholder="Ain Diab, Californie, CIL..." />
            <Input label="Style architectural" value={form.architectureStyle} onChangeText={(value) => updateField('architectureStyle', value)} placeholder="Moderne, contemporain, traditionnel..." />
            <Input label="Type de cuisine dominant" value={form.kitchenStyle} onChangeText={(value) => updateField('kitchenStyle', value)} placeholder="Ouverte, separee, les deux..." />
            <Input label="Niveau d'equipement / ameublement" value={form.furnishingLevel} onChangeText={(value) => updateField('furnishingLevel', value)} placeholder="Semi-equipe, meuble, non meuble..." />
            <Input label="Financements acceptes" value={form.acceptedFinancingModesText} onChangeText={(value) => updateField('acceptedFinancingModesText', value)} placeholder="Cash, Credit, Mixte" />
            <Input label="Atouts / features" value={form.featuresText} onChangeText={(value) => updateField('featuresText', value)} placeholder={"Une ligne par critère\nVue mer\nPiscine\nParking"} multiline />
            <Input label="Types de projet" value={form.projectTypesText} onChangeText={(value) => updateField('projectTypesText', value)} placeholder={PROJECT_CATEGORIES.join(', ')} />
            <Input label="Types de bien couverts" value={form.propertyTypesText} onChangeText={(value) => updateField('propertyTypesText', value)} placeholder={PROPERTY_TYPES.slice(0, 6).join(', ')} />
            <Input label="Tags localisation" value={form.locationTagsText} onChangeText={(value) => updateField('locationTagsText', value)} placeholder={`Ville, quartier calme, proche tram, ${MOROCCO_CITIES[0]}`} />
            <Input label="Equipements / amenities" value={form.amenitiesText} onChangeText={(value) => updateField('amenitiesText', value)} placeholder={AMENITIES.join(', ')} />
            <Input label="Securite / surveillance" value={form.securityFeaturesText} onChangeText={(value) => updateField('securityFeaturesText', value)} placeholder="Gardiennage, camera, acces controle..." />
            <Input label="Vues disponibles" value={form.viewOptionsText} onChangeText={(value) => updateField('viewOptionsText', value)} placeholder={VIEW_OPTIONS.join(', ')} />
            <Input label="Niveau de finition" value={form.finishingLevel} onChangeText={(value) => updateField('finishingLevel', value)} placeholder={FINISHING_LEVELS.join(', ')} />
            <Input label="Type de residence" value={form.residenceType} onChangeText={(value) => updateField('residenceType', value)} placeholder="Fermee, ouverte..." />
            <Text style={styles.sectionLabel}>Calendrier et dimensions du programme</Text>
            <Input label="Livraison" value={form.delivery} onChangeText={(value) => updateField('delivery', value)} placeholder="Dec 2026" />
            <View style={styles.row}>
              <Input style={styles.half} label="Date lancement" value={form.launchDate} onChangeText={(value) => updateField('launchDate', value)} placeholder="2025-06" />
              <Input style={styles.half} label="Date livraison cible" value={form.expectedDeliveryDate} onChangeText={(value) => updateField('expectedDeliveryDate', value)} placeholder="2027-12" />
            </View>
            <View style={styles.row}>
              <Input style={styles.half} label="Statut autorisations" value={form.permitStatus} onChangeText={(value) => updateField('permitStatus', value)} placeholder="Autorise, en cours..." />
              <Input style={styles.half} label="Delai de livraison max (mois)" value={form.deliveryMaxMonths} onChangeText={(value) => updateField('deliveryMaxMonths', value)} keyboardType="numeric" placeholder="12" />
            </View>
            <View style={styles.row}>
              <Input style={styles.half} label="Surface terrain (m2)" value={form.landAreaRaw} onChangeText={(value) => updateField('landAreaRaw', value)} keyboardType="numeric" />
              <Input style={styles.half} label="Surface construite (m2)" value={form.builtAreaRaw} onChangeText={(value) => updateField('builtAreaRaw', value)} keyboardType="numeric" />
            </View>
            <View style={styles.row}>
              <Input style={styles.half} label="Nombre de blocs" value={form.blocksCount} onChangeText={(value) => updateField('blocksCount', value)} keyboardType="numeric" />
              <Input style={styles.half} label="Nombre d'etages max" value={form.maxFloors} onChangeText={(value) => updateField('maxFloors', value)} keyboardType="numeric" />
            </View>
            <View style={styles.chipsRow}>
              <TouchableOpacity style={[styles.chip, form.isActive && styles.chipActive]} onPress={() => updateField('isActive', !form.isActive)}>
                <Text style={[styles.chipText, form.isActive && styles.chipTextActive]}>{form.isActive ? 'Projet actif' : 'Projet inactif'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.chip, form.visibleInMatching && styles.chipActive]} onPress={() => updateField('visibleInMatching', !form.visibleInMatching)}>
                <Text style={[styles.chipText, form.visibleInMatching && styles.chipTextActive]}>{form.visibleInMatching ? 'Visible matching' : 'Masqué matching'}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.chipsRow}>
              {[
                ['readyToLive', 'Pret a habiter'],
                ['constructionAccepted', 'Construction acceptee'],
                ['parking', 'Parking'],
                ['elevator', 'Ascenseur'],
                ['balcony', 'Balcon'],
                ['terrace', 'Terrasse'],
                ['garden', 'Jardin'],
                ['pool', 'Piscine'],
                ['security', 'Securite'],
                ['isSubsidized', 'Subventionne'],
                ['equippedKitchen', 'Cuisine equipee'],
                ['furnished', 'Meuble'],
                ['airConditioning', 'Climatisation'],
              ].map(([key, label]) => (
                <TouchableOpacity key={key} style={[styles.chip, form[key as keyof ProjectFormState] && styles.chipActive]} onPress={() => updateField(key as keyof ProjectFormState, !form[key as keyof ProjectFormState] as never)}>
                  <Text style={[styles.chipText, form[key as keyof ProjectFormState] && styles.chipTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Input label="Nombre de places parking" value={form.parkingSpots} onChangeText={(value) => updateField('parkingSpots', value)} keyboardType="numeric" placeholder="120" />

            <Text style={styles.sectionLabel}>Chiffres et fourchettes</Text>
            <View style={styles.row}>
              <Input style={styles.half} label="Total unites" value={form.totalUnits} onChangeText={(value) => updateField('totalUnits', value)} keyboardType="numeric" />
              <Input style={styles.half} label="Disponibles" value={form.availableUnits} onChangeText={(value) => updateField('availableUnits', value)} keyboardType="numeric" />
            </View>
            <View style={styles.row}>
              <Input style={styles.half} label="Reservees" value={form.reservedUnits} onChangeText={(value) => updateField('reservedUnits', value)} keyboardType="numeric" />
              <Input style={styles.half} label="Vendues" value={form.soldUnits} onChangeText={(value) => updateField('soldUnits', value)} keyboardType="numeric" />
            </View>
            <View style={styles.row}>
              <Input style={styles.half} label="Prix min" value={form.minPriceRaw} onChangeText={(value) => updateField('minPriceRaw', value)} keyboardType="numeric" />
              <Input style={styles.half} label="Prix max" value={form.maxPriceRaw} onChangeText={(value) => updateField('maxPriceRaw', value)} keyboardType="numeric" />
            </View>
            <View style={styles.row}>
              <Input style={styles.half} label="Surface min" value={form.areaFromRaw} onChangeText={(value) => updateField('areaFromRaw', value)} keyboardType="numeric" />
              <Input style={styles.half} label="Surface max" value={form.areaToRaw} onChangeText={(value) => updateField('areaToRaw', value)} keyboardType="numeric" />
            </View>
            <View style={styles.row}>
              <Input style={styles.half} label="Chambres min" value={form.bedroomsFrom} onChangeText={(value) => updateField('bedroomsFrom', value)} keyboardType="numeric" />
              <Input style={styles.half} label="Chambres max" value={form.bedroomsTo} onChangeText={(value) => updateField('bedroomsTo', value)} keyboardType="numeric" />
            </View>
            <Input label="Vue / atout" value={form.viewLabel} onChangeText={(value) => updateField('viewLabel', value)} placeholder="Vue mer, jardin, skyline..." />
            <Text style={styles.sectionLabel}>Unites du projet</Text>
            <Input
              label="Catalogue des unites"
              value={form.unitsText}
              onChangeText={(value) => updateField('unitsText', value)}
              placeholder={"Une ligne par unite ou typologie\nEx: Studio A1 | Studio | 620000 | 52 | 1 | 1 | 2 | Disponible\nEx: Villa B3 | Villa | 2850000 | 320 | 4 | 3 | 0 | Reserve"}
              multiline
            />
            <Text style={styles.helperText}>Format: `libelle | type | prix | surface | chambres | salles de bain | etage | disponibilite`</Text>

            <Button
              label={editingId ? 'Mettre a jour' : 'Ajouter le projet'}
              onPress={handleSubmit}
              loading={submitting}
              icon={editingId ? 'create-outline' : 'add-outline'}
            />
          </Card>
        )}

        {loading ? (
          <Text style={styles.emptyText}>Chargement des projets...</Text>
        ) : projects.length === 0 ? (
          <Text style={styles.emptyText}>Aucun projet pour le moment.</Text>
        ) : (
          projects.map((project) => {
            const statusColors = getStatusColors(normalizeProjectStatus(project.status));
            const pct = Math.round((project.soldUnits / Math.max(1, project.totalUnits)) * 100);

            return (
              <View key={project.id} style={styles.card}>
                <View style={styles.imageContainer}>
                  <Image source={{ uri: project.image }} style={styles.image} />
                  <LinearGradient colors={Colors.gradientDark} style={styles.imageOverlay} />
                  <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
                    <Text style={[styles.statusText, { color: statusColors.text }]}>
                      {normalizeProjectStatus(project.status)}
                    </Text>
                  </View>
                  <View style={styles.imageFooter}>
                    <Text style={styles.projectName}>{project.name}</Text>
                    <Text style={styles.projectLocation}>{project.district}, {project.city}</Text>
                  </View>
                </View>

                <View style={styles.body}>
                  <Text style={styles.description}>{project.description}</Text>

                  <View style={styles.unitsRow}>
                    {[
                      { label: 'Total', value: project.totalUnits, color: Colors.primary },
                      { label: 'Vendues', value: project.soldUnits, color: Colors.success },
                      { label: 'Reservees', value: project.reservedUnits, color: Colors.warning },
                      { label: 'Disponibles', value: project.availableUnits, color: Colors.info },
                    ].map((item) => (
                      <View key={item.label} style={styles.unitStat}>
                        <Text style={[styles.unitValue, { color: item.color }]}>{item.value}</Text>
                        <Text style={styles.unitLabel}>{item.label}</Text>
                      </View>
                    ))}
                  </View>

                  <ProgressBar value={pct} height={7} style={{ marginBottom: 4 }} />
                  <View style={styles.progressRow}>
                    <Text style={styles.progressLabel}>Commercialise</Text>
                    <Text style={styles.progressPct}>{pct}%</Text>
                  </View>

                  <View style={styles.priceRow}>
                    <Ionicons name="pricetag-outline" size={13} color={Colors.textSoft} />
                    <Text style={styles.priceText}>{project.minPrice} - {project.maxPrice}</Text>
                    <View style={styles.deliveryChip}>
                      <Ionicons name="calendar-outline" size={11} color={Colors.primary} />
                      <Text style={styles.deliveryText}>{project.delivery}</Text>
                    </View>
                  </View>
                  {(project.areaFromRaw || project.areaToRaw || project.viewLabel || project.promoterName) ? (
                    <View style={styles.metaStack}>
                      <Text style={styles.metaText}>Promoteur: {project.promoterName}</Text>
                      <Text style={styles.metaText}>Surface: {project.areaFromRaw || 0} - {project.areaToRaw || 0} m2</Text>
                      <Text style={styles.metaText}>Chambres: {project.bedroomsFrom || 0} - {project.bedroomsTo || 0}</Text>
                      {project.viewLabel ? <Text style={styles.metaText}>Vue: {project.viewLabel}</Text> : null}
                    </View>
                  ) : null}

                  {canManage ? (
                    <View style={styles.actionsRow}>
                      <Button label="Modifier" variant="secondary" size="sm" fullWidth={false} onPress={() => handleEdit(project)} icon="create-outline" />
                      <Button label="Supprimer" variant="danger" size="sm" fullWidth={false} onPress={() => handleDelete(project)} icon="trash-outline" />
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {canManage ? (
        <TouchableOpacity
          style={styles.fab}
          activeOpacity={0.9}
          onPress={() => {
            if (showForm && !editingId) {
              resetForm();
              return;
            }
            setEditingId(null);
            setForm(emptyForm);
            setShowForm(true);
          }}
        >
          <LinearGradient colors={Colors.gradientPrimary} style={styles.fabInner}>
            <Ionicons name={showForm && !editingId ? 'close-outline' : 'add-outline'} size={24} color={Colors.white} />
            <Text style={styles.fabText}>{showForm && !editingId ? 'Fermer' : 'Ajouter'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgMain },
  header: { paddingTop: 20, paddingBottom: 24, paddingHorizontal: 24, alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.white },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  scroll: { flex: 1 },
  formCard: { gap: 12 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: Colors.textDark, marginTop: 4 },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: Colors.accentOrange, textTransform: 'uppercase', letterSpacing: 0.9, marginTop: 10 },
  helperText: { fontSize: 12, color: Colors.textMuted, marginBottom: 8 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.bgSoft, borderWidth: 1, borderColor: Colors.borderSoft },
  chipActive: { backgroundColor: Colors.lavenderUltra, borderColor: Colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.textSoft },
  chipTextActive: { color: Colors.primary },
  row: { flexDirection: 'row', gap: 12 },
  photoActions: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  uploadText: { fontSize: 12, color: Colors.primary, fontWeight: '600', marginBottom: 8 },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  galleryItem: { width: 96, height: 96, borderRadius: 14, overflow: 'hidden', position: 'relative', backgroundColor: Colors.bgSoft },
  galleryImage: { width: '100%', height: '100%' },
  galleryOverlay: { position: 'absolute', top: 6, right: 6, flexDirection: 'row', gap: 6 },
  galleryIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(20,20,20,0.45)', alignItems: 'center', justifyContent: 'center' },
  photoBadge: { position: 'absolute', left: 6, bottom: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.85)' },
  photoBadgePrimary: { backgroundColor: Colors.primary },
  photoBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.textDark },
  photoBadgeTextPrimary: { color: Colors.white },
  half: { flex: 1 },
  emptyText: { textAlign: 'center', color: Colors.textSoft, marginTop: 12, fontSize: 14 },
  card: { backgroundColor: Colors.bgCard, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: Colors.borderSoft, shadowColor: Colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  imageContainer: { height: 180, position: 'relative' },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  imageOverlay: { position: 'absolute', inset: 0 },
  statusBadge: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '700' },
  imageFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16 },
  projectName: { fontSize: 18, fontWeight: '800', color: Colors.white, letterSpacing: -0.3 },
  projectLocation: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  body: { padding: 16 },
  description: { fontSize: 12, color: Colors.textSoft, marginBottom: 12 },
  unitsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  unitStat: { alignItems: 'center' },
  unitValue: { fontSize: 20, fontWeight: '800' },
  unitLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  progressLabel: { fontSize: 11, color: Colors.textMuted },
  progressPct: { fontSize: 13, fontWeight: '800', color: Colors.primary },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  priceText: { flex: 1, fontSize: 12, color: Colors.textSoft, fontWeight: '500' },
  metaStack: { marginTop: 12, gap: 4 },
  metaText: { fontSize: 12, color: Colors.textSoft },
  deliveryChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.lavenderUltra, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  deliveryText: { fontSize: 11, fontWeight: '600', color: Colors.primary },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  fab: { position: 'absolute', right: 18, bottom: 18, borderRadius: 999, shadowColor: Colors.shadowDark, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 18, elevation: 8 },
  fabInner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 999 },
  fabText: { color: Colors.white, fontSize: 15, fontWeight: '800' },
});
