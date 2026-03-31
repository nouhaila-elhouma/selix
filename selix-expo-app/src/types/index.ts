// ============================================================
// SELIX — Core TypeScript Types
// ============================================================

// ── Roles ──────────────────────────────────────────────────
export type Role = 'client' | 'commercial' | 'promoter' | 'admin';
export type AdminRole =
  | 'super_admin'
  | 'support_client'
  | 'support_commercial'
  | 'support_promoter'
  | 'project_integrator';
export type AccountStatus = 'active' | 'disabled' | 'blocked';
export type AccountValidationStatus = 'draft' | 'pending_review' | 'validated' | 'rejected';
export type SupportRequestStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type SupportRequestCategory = 'question' | 'problem' | 'feedback' | 'suggestion';
export type AppLanguage = 'fr' | 'en' | 'ar';
export interface AccessScope {
  promoterIds: string[];
  projectIds: string[];
  cities: string[];
  districts: string[];
}

// ── App Screens ────────────────────────────────────────────
export type AppScreen =
  | 'Splash'
  | 'Welcome'
  | 'Onboarding'
  | 'Auth'
  | 'Questionnaire'
  | 'Analyzing'
  | 'Matching'
  | 'ClientApp'
  | 'CommercialApp'
  | 'PromoterApp'
  | 'AdminApp';

// ── Auth / Users ───────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  adminRole?: AdminRole | null;
  accountStatus?: AccountStatus;
  accessScope?: AccessScope | null;
  permissions?: string[];
  avatar?: string;
  hasCompletedQuestionnaire: boolean;
  accountValidationStatus?: AccountValidationStatus;
  createdAt: string;
}

export interface SupportRequest {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  category?: SupportRequestCategory;
  subject: string;
  message: string;
  status: SupportRequestStatus;
  adminNote?: string;
  handledBy?: string | null;
  handledByName?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Property ───────────────────────────────────────────────
export type PropertyType =
  | 'Appartement'
  | 'Villa'
  | 'Bureau'
  | 'Local'
  | 'Terrain'
  | 'Duplex'
  | 'Studio'
  | 'Riad'
  | 'Penthouse';

export type PropertyStatus = 'Disponible' | 'Réservé' | 'Vendu';

export type MatchBadge = 'Top Match' | 'Excellent Match' | 'Bon potentiel' | 'À explorer';

export interface PropertyOption {
  id: string;
  label: string;
  price: string;
  priceRaw: number;
  available: boolean;
}

export interface Property {
  id: string;
  title: string;
  project: string;
  promoter: string;
  promoterId: string;
  type: PropertyType;
  city: string;
  district: string;
  price: string;
  priceRaw: number;
  area: string;
  areaRaw: number;
  rooms: number;
  floor?: number;
  description: string;
  highlights: string[];
  options: PropertyOption[];
  image: string;
  images: string[];
  availability: PropertyStatus;
  monthlyEstimate: string;
  monthlyEstimateRaw: number;
  score: number;
  badge: MatchBadge;
  delivery: string;
  reference: string;
  commercialId?: string;
  commercialName?: string;
  projectStatus?: string;
  visibleInMatching?: boolean;
  isActive?: boolean;
  ignored?: boolean;
  matched?: boolean;
  investment?: {
    rentalYield: string;
    occupancyRate: string;
    furnished: boolean;
  };
}

// ── Lead / Questionnaire ───────────────────────────────────
export type LeadStatus = 'Nouveau' | 'Contacté' | 'Visité' | 'Offre' | 'Signé' | 'Perdu';
export type LeadTemperature = 'hot' | 'warm' | 'cold';
export type LeadSource = 'questionnaire' | 'matching';
export type Objective = 'Habiter' | 'Investir';
export type FinancingMode = 'Cash' | 'Crédit' | 'Mixte';
export type PurchaseDeadline = 'Immédiat' | '3 mois' | '6 mois' | '1 an' | 'Plus de 1 an';
export type ContactPreference = 'Appel' | 'WhatsApp' | 'Email';
export type PreferredLanguage = 'Français' | 'English' | 'العربية' | 'Español';
export type ClientGoal = 'Habiter' | 'Investir' | 'Résidence secondaire' | 'Location';
export type OwnershipContext = 'Seul' | 'Couple' | 'Famille';
export type PurchaseStage = 'Neuf uniquement' | 'Neuf et ancien';
export type ProjectStage = 'Prêt à livrer' | 'En cours de construction' | 'Sans préférence';
export type CreditPreApproval = 'Oui' | 'Non';
export type ViewPreference = 'Mer' | 'Jardin' | 'Piscine' | 'Ville' | 'Sans préférence';
export type FurnishingPreference = 'Meublé' | 'Équipé' | 'Sans préférence' | 'Non';
export type BooleanPreference = 'Oui' | 'Non' | 'Sans préférence';
export type LeadQualification = 'hot' | 'warm' | 'cold';

export interface LeadAnswers {
  // Step 1 — Identity
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  password: string;
  currentCity?: string;
  countryOfResidence?: string;
  contactPreference?: ContactPreference;
  preferredLanguage?: PreferredLanguage;
  excludedZones?: string[];

  // Step 2 — Location
  city: string;
  isMRE: boolean;
  country?: string;

  // Step 3 — Project
  propertyType: PropertyType | '';
  objective: Objective | '';
  clientGoal?: ClientGoal | '';
  targetZone: string;
  searchedCity?: string;
  purchaseStage?: PurchaseStage | '';
  projectStage?: ProjectStage | '';

  // Step 4 — Budget & Financing
  budget: string;
  budgetRaw: number;
  budgetMin?: string;
  budgetMinRaw?: number;
  downPayment: string;
  downPaymentRaw: number;
  financing: FinancingMode | '';
  hasBankPreApproval?: boolean;
  creditPreApproval?: CreditPreApproval;
  maxMonthlyPayment?: string;
  maxMonthlyPaymentRaw?: number;

  // Step 5 — Timeline
  purchaseDeadline: PurchaseDeadline | '';
  hasVisitedProperties?: boolean;
  ownershipContext?: OwnershipContext | '';
  primaryUsage?: string;
  expectedRentalYield?: string;
  requiredCriteria?: string[];
  optionalCriteria?: string[];
  freeNotes?: string;

  // Step 6 — Property Details
  desiredArea: string;
  desiredAreaRaw: number;
  desiredAreaMin?: string;
  desiredAreaMinRaw?: number;
  desiredAreaMax?: string;
  desiredAreaMaxRaw?: number;
  rooms: number;
  bathrooms?: number;
  desiredFloor?: string;
  elevatorPreference?: BooleanPreference;
  parkingRequired?: boolean;
  terraceRequired?: boolean;
  gardenRequired?: boolean;
  poolPreference?: BooleanPreference;
  viewPreference?: ViewPreference;
  furnishingPreference?: FurnishingPreference;
  premiumFinishWanted?: boolean;
  orientationPreference?: string;
  securedResidencePreference?: BooleanPreference;

  // Step 7 — Criteria
  mustHave: string[];
  tolerances: string[];
  contactedBank?: boolean;
  isDecisionMaker?: boolean;

  // Conditional — Investment
  expectedYield?: string;
  preferFurnished?: boolean;

  // Conditional — Credit
  netIncome?: string;
  targetMonthly?: string;
  loanDuration?: string;

  // Conditional — Commercial/Land
  facade?: string;
  vocation?: string;

  // Step 8 — Consent
  consent: boolean;
  contactWhatsApp: boolean;

  // Qualification helpers
  urgencyLevel?: number;
  projectSeriousness?: number;
  financingReadiness?: number;
  compatibilityScore?: number;
}

export interface LeadStatusHistory {
  status: LeadStatus;
  date: string;
  note?: string;
  by?: string;
}

export interface Lead {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  commercialId?: string;
  commercialName?: string;
  answers: LeadAnswers;
  source?: LeadSource;
  score: number;
  temperature: LeadTemperature;
  status: LeadStatus;
  statusHistory: LeadStatusHistory[];
  matchedProperties: Array<Property | string>;
  notes: string;
  lastContact?: string;
  createdAt: string;
  updatedAt: string;
  accountValidationStatus?: AccountValidationStatus;
  latestInterestConfirmation?: InterestConfirmation | null;
  latestTransfer?: LeadTransfer | null;
}

// ── Appointment ────────────────────────────────────────────
export type VisitStatus = 'Planifié' | 'Confirmé' | 'Effectué' | 'Annulé';

export interface Appointment {
  id: string;
  leadId: string;
  clientName: string;
  propertyId: string;
  propertyTitle: string;
  projectTitle?: string;
  commercialId: string;
  commercialName: string;
  commercialPhone?: string;
  date: string;
  time: string;
  city: string;
  status: VisitStatus;
  notes?: string;
}

export type InterestConfirmationStatus = 'pending' | 'confirmed' | 'declined' | 'needs_followup' | 'expired';

export interface InterestConfirmation {
  id: string;
  leadId: string;
  appointmentId?: string | null;
  clientId: string;
  clientName: string;
  commercialId: string;
  commercialName?: string;
  promoterId?: string | null;
  promoterName?: string;
  propertyId?: string | null;
  propertyTitle?: string;
  projectId?: string | null;
  projectTitle?: string;
  city?: string;
  district?: string;
  status: InterestConfirmationStatus;
  requestMessage?: string;
  responseNote?: string;
  requestedAt: string;
  expiresAt?: string | null;
  expiredAt?: string | null;
  respondedAt?: string | null;
  transferredAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type LeadTransferStatus = 'transmitted' | 'deal_created' | 'signed';

export interface LeadTransfer {
  id: string;
  leadId: string;
  interestConfirmationId?: string | null;
  clientId: string;
  clientName: string;
  commercialId: string;
  commercialName?: string;
  promoterId?: string | null;
  promoterName?: string;
  propertyId?: string | null;
  propertyTitle?: string;
  projectId?: string | null;
  projectTitle?: string;
  city?: string;
  district?: string;
  transferStatus: LeadTransferStatus | string;
  transferReason?: string;
  notes?: string;
  transferredAt: string;
  acknowledgedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Messaging ──────────────────────────────────────────────
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: Role;
  content: string;
  messageType?: 'text' | 'image' | 'document';
  timestamp: string;
  read: boolean;
  delivered?: boolean;
}

export interface Conversation {
  id: string;
  participantIds: string[];
  participantNames: string[];
  participantPhones?: string[];
  avatars?: string[];
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  relatedPropertyId?: string;
  relatedPropertyTitle?: string;
}

export type CallSessionStatus = 'ringing' | 'accepted' | 'rejected' | 'missed' | 'ended' | 'cancelled';
export type CallSessionDirection = 'incoming' | 'outgoing';

export interface CallSession {
  id: string;
  conversationId: string;
  callerId: string;
  callerName: string;
  receiverId: string;
  receiverName: string;
  relatedPropertyId?: string | null;
  relatedPropertyTitle?: string | null;
  callType?: 'audio';
  status: CallSessionStatus;
  startedAt: string;
  answeredAt?: string | null;
  endedAt?: string | null;
  durationSec?: number;
  direction?: CallSessionDirection | null;
}

// ── Project (Promoter) ─────────────────────────────────────
export type ProjectStatus = 'Pré-vente' | 'En construction' | 'Livraison 2025' | 'Livraison 2026' | 'Terminé';

export interface Project {
  id: string;
  name: string;
  promoterId: string;
  promoterName: string;
  city: string;
  district: string;
  type: PropertyType;
  description: string;
  image: string;
  images?: string[];
  status: ProjectStatus;
  totalUnits: number;
  availableUnits: number;
  reservedUnits: number;
  soldUnits: number;
  minPrice: string;
  minPriceRaw: number;
  maxPrice: string;
  maxPriceRaw: number;
  areaFromRaw?: number;
  areaToRaw?: number;
  bedroomsFrom?: number;
  bedroomsTo?: number;
  viewLabel?: string;
  delivery: string;
  completionPercent: number;
  isActive?: boolean;
  visibleInMatching?: boolean;
  commercialId?: string;
  commercialName?: string;
  features?: string[];
  units?: Array<{
    id: string;
    label: string;
    priceRaw: number;
    areaRaw?: number;
    bedrooms?: number;
    bathrooms?: number;
    available?: boolean;
  }>;
}

export interface AdminAssignment {
  id: string;
  promoterId: string;
  promoterName: string;
  commercialId: string;
  commercialName: string;
  commercialEmail: string;
  commercialPhone: string;
  assignedBy?: string;
  createdAt: string;
}

export interface AdminProjectAssignment {
  id: string;
  projectId: string;
  projectName: string;
  promoterId?: string | null;
  promoterName?: string | null;
  commercialId: string;
  commercialName: string;
  commercialEmail?: string;
  commercialPhone?: string;
  assignedBy?: string | null;
  createdAt: string;
}

export interface AdminPromoterSubscription {
  id: string;
  promoterId: string;
  promoterName: string;
  promoterEmail?: string;
  planId: string;
  planKey: string;
  planName?: string;
  status: string;
  startsAt?: string | null;
  endsAt?: string | null;
  activatedAt?: string | null;
  accountStatus?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPromoterPaymentRequest {
  id: string;
  promoterId: string;
  promoterName: string;
  promoterEmail?: string;
  subscriptionId?: string | null;
  planId: string;
  planKey: string;
  planName?: string;
  status: string;
  amountMad: number;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  proofUrl?: string | null;
  notes?: string | null;
  requestedAt?: string;
  validatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PromoterTeamMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalLeads: number;
  hotLeads: number;
  totalVisits?: number;
  qualifiedTransfers?: number;
  totalDeals: number;
  signedRevenue: number;
}

export interface PromoterSummary {
  teamSize: number;
  projectCount: number;
  soldUnits: number;
  availableUnits: number;
  teamLeads: number;
  teamHotLeads: number;
  totalMatches?: number;
  totalVisits?: number;
  qualifiedTransfers?: number;
  totalDeals: number;
  signedRevenue: number;
  subscription?: {
    accountStatus?: string | null;
    subscriptionStatus?: string | null;
    planKey?: string | null;
    startsAt?: string | null;
    endsAt?: string | null;
    restrictedReason?: string | null;
  };
}

export interface PromoterSubscriptionOverview {
  accountStatus: string;
  subscriptionStatus: string;
  planKey?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  restrictedReason?: string | null;
  plans: Array<{
    planKey: string;
    name: string;
    durationMonths: number;
    priceMad: number;
    isActive: boolean;
  }>;
  paymentRequests: Array<{
    id: string;
    subscriptionId?: string | null;
    planKey: string;
    status: string;
    amountMad: number;
    paymentMethod?: string | null;
    paymentReference?: string | null;
    proofUrl?: string | null;
    notes?: string | null;
    requestedAt?: string;
    validatedAt?: string | null;
    validatedBy?: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
}

// ── Deals & Commissions ────────────────────────────────────
export type CommissionStatus = 'En attente' | 'Payée' | 'Disputée';
export type DealStatus = 'En cours' | 'Signé' | 'Annulé';

export interface Deal {
  id: string;
  leadId: string;
  clientId?: string;
  clientName: string;
  propertyId: string;
  propertyTitle: string;
  commercialId: string;
  commercialName?: string;
  promoterId?: string;
  promoterName?: string;
  salePrice: number;
  status: DealStatus;
  signedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Commission {
  id: string;
  dealId: string;
  commercialId: string;
  commercialName: string;
  promoterId?: string;
  propertyId?: string;
  propertyTitle: string;
  clientName?: string;
  salePrice: number;
  rate: number;
  amount: number;
  status: CommissionStatus;
  dueDate: string;
  paidDate?: string;
}

// ── Notifications ──────────────────────────────────────────
export type NotificationType = 'lead' | 'visit' | 'message' | 'offer' | 'system' | 'match';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  targetId?: string;
}

export interface AppConfig {
  supportEmail?: string | null;
  supportPhone?: string | null;
  supportWhatsApp?: string | null;
  supportHours?: string | null;
}

export interface TimelineEvent {
  id: string;
  actionType: string;
  actorRole: Role | 'system';
  actorName: string;
  description: string;
  targetId?: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

// ── Commercial Profile ─────────────────────────────────────
export interface CommercialProfile {
  id: string;
  userId: string;
  name: string;
  phone: string;
  email: string;
  agency?: string;
  city: string;
  coverageZones: string[];
  specialties: string[];
  languages: string[];
  isActive: boolean;
  avatar?: string;
  stats: {
    totalLeads: number;
    hotLeads: number;
    signed: number;
    conversionRate: number;
    avgResponseTime: string;
    totalCommissions: number;
  };
}

// ── Promoter Profile ───────────────────────────────────────
export interface PromoterProfile {
  id: string;
  userId: string;
  companyName: string;
  responsibleName: string;
  phone: string;
  email: string;
  city: string;
  logo?: string;
  description: string;
  type: string;
  stats: {
    totalProjects: number;
    totalUnits: number;
    soldUnits: number;
    pendingCommissions: number;
    revenue: number;
  };
}

// ── Admin Stats ────────────────────────────────────────────
export interface AdminStats {
  totalLeads: number;
  hotLeads: number;
  signed: number;
  conversionRate: number;
  totalClients: number;
  totalCommercials: number;
  totalPromoters: number;
  revenue: number;
  visitsThisWeek: number;
  newLeadsToday: number;
  activeDeals: number;
  pendingCommissions: number;
}

// ── Pipeline Stats ─────────────────────────────────────────
export interface PipelineStats {
  nouveau: number;
  contacte: number;
  visite: number;
  offre: number;
  signe: number;
  perdu: number;
}
