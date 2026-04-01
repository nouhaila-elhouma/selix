const express = require('express');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { createHash, randomUUID } = require('crypto');
require('dotenv').config();

const app = express();
const server = createServer(app);
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const PROJECT_UPLOADS_DIR = path.join(UPLOADS_DIR, 'projects');
const CHAT_UPLOADS_DIR = path.join(UPLOADS_DIR, 'messages');
fs.mkdirSync(PROJECT_UPLOADS_DIR, { recursive: true });
fs.mkdirSync(CHAT_UPLOADS_DIR, { recursive: true });
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:19006')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST', 'PATCH', 'DELETE'] },
});

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

let db;
const PORT = Number(process.env.PORT || 3000);
const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PROJECT_UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${randomUUID()}${extension}`);
  },
});
const uploadProjectImage = multer({
  storage: uploadStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (String(file.mimetype || '').startsWith('image/')) return cb(null, true);
    return cb(new Error('Only image files are allowed'));
  },
});
const uploadMessageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, CHAT_UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${randomUUID()}${extension}`);
  },
});
const uploadMessageImage = multer({
  storage: uploadMessageStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (String(file.mimetype || '').startsWith('image/')) return cb(null, true);
    return cb(new Error('Only image files are allowed'));
  },
});
const uploadMessageFile = multer({
  storage: uploadMessageStorage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = String(file.mimetype || '').toLowerCase();
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];
    if (allowed.includes(mime)) return cb(null, true);
    return cb(new Error('Only PDF, DOC, DOCX or TXT files are allowed'));
  },
});

const leadToDb = { Nouveau: 'new', Contacté: 'contacted', Visité: 'qualified', Offre: 'offered', Signé: 'converted', Perdu: 'lost' };
const leadFromDb = { new: 'Nouveau', contacted: 'Contacté', qualified: 'Visité', offered: 'Offre', converted: 'Signé', lost: 'Perdu' };
const apptToDb = { Planifié: 'scheduled', Confirmé: 'confirmed', Effectué: 'completed', Annulé: 'cancelled', 'Report demande': 'reschedule_requested' };
const apptFromDb = { scheduled: 'Planifié', confirmed: 'Confirmé', completed: 'Effectué', cancelled: 'Annulé', reschedule_requested: 'Report demande' };

const appointmentStatusVariants = {
  scheduled: ['scheduled', 'Planifie', 'Planifié'],
  confirmed: ['confirmed', 'Confirme', 'Confirmé'],
  completed: ['completed', 'Effectue', 'Effectué'],
  cancelled: ['cancelled', 'Annule', 'Annulé'],
  reschedule_requested: ['reschedule_requested', 'report_demande', 'Report demande'],
};
let appointmentStatusColumnType = null;
let appointmentReminderInterval = null;
const SIGNED_DEAL_STATUS_VARIANTS = ['Sign\u00E9', 'Signe', 'Sign\\u00E9'];
const INTEREST_CONFIRMATION_DEADLINE_HOURS = Math.max(1, Number(process.env.INTEREST_CONFIRMATION_DEADLINE_HOURS || 48));
const ACTIVE_CALL_SESSION_STATUSES = ['ringing', 'accepted'];
const money = (n) => `${Number(n || 0).toLocaleString('fr-FR')} MAD`;
const parseJson = (v, fallback) => { try { return v ? (typeof v === 'string' ? JSON.parse(v) : v) : fallback; } catch { return fallback; } };
const isEmail = (value = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
const hasStrongSecret = (value = '') => String(value).trim().length >= 32 && !String(value).includes('change-this');
const toInt = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
};
function leadStatusNotificationContent(status = '', actorName = 'Votre commercial') {
  switch (String(status || '')) {
    case 'Contacté':
      return {
        title: 'Dossier pris en charge',
        body: `${actorName} a pris en charge votre dossier. Vous pouvez maintenant échanger dans l'application.`,
      };
    case 'Visité':
      return {
        title: 'Visite enregistrée',
        body: `${actorName} a fait avancer votre dossier vers l'étape visite. Consultez vos visites pour le détail.`,
      };
    case 'Offre':
      return {
        title: 'Offre en cours',
        body: `${actorName} a fait évoluer votre dossier vers l'étape offre.`,
      };
    case 'Perdu':
      return {
        title: 'Dossier mis à jour',
        body: `${actorName} a mis à jour votre dossier.`,
      };
    default:
      return {
        title: 'Dossier mis à jour',
        body: `${actorName} a mis à jour le statut de votre dossier: ${status}.`,
      };
  }
}
function normalizeAppointmentStatus(status = 'scheduled') {
  const value = String(status || 'scheduled');
  for (const [canonical, variants] of Object.entries(appointmentStatusVariants)) {
    if (canonical === value || variants.includes(value)) return canonical;
  }
  return value;
}
function appointmentStatusList(statuses = []) {
  return Array.from(new Set(
    statuses.flatMap((status) => {
      const canonical = normalizeAppointmentStatus(status);
      return appointmentStatusVariants[canonical] || [canonical];
    }),
  ));
}
async function resolveAppointmentStorageStatus(status = 'scheduled') {
  const canonical = normalizeAppointmentStatus(status);
  if (appointmentStatusColumnType === null) {
    const [rows] = await db.query(
      `SELECT COLUMN_TYPE
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'appointments'
         AND COLUMN_NAME = 'status'
       LIMIT 1`,
    );
    appointmentStatusColumnType = rows[0]?.COLUMN_TYPE || '';
  }

  const columnType = String(appointmentStatusColumnType || '').toLowerCase();
  if (!columnType.startsWith('enum(')) return canonical;

  const allowedValues = Array.from(columnType.matchAll(/'([^']+)'/g)).map((match) => match[1]);
  const candidates = appointmentStatusVariants[canonical] || [canonical];
  return candidates.find((candidate) => allowedValues.includes(String(candidate).toLowerCase()))
    || allowedValues[0]
    || canonical;
}
function publicUrl(req, relativePath) {
  if (process.env.PUBLIC_BASE_URL) {
    return `${process.env.PUBLIC_BASE_URL.replace(/\/$/, '')}${relativePath}`;
  }
  const protocol = String(req.headers['x-forwarded-proto'] || req.protocol || 'http');
  return `${protocol}://${req.get('host')}${relativePath}`;
}
function getAppConfig() {
  return {
    supportEmail: String(process.env.SUPPORT_EMAIL || process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim() || null,
    supportPhone: String(process.env.SUPPORT_PHONE || '').trim() || null,
    supportWhatsApp: String(process.env.SUPPORT_WHATSAPP || process.env.SUPPORT_PHONE || '').trim() || null,
    supportHours: String(process.env.SUPPORT_HOURS || '').trim() || null,
  };
}
function validateConfig() {
  const required = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  if (!hasStrongSecret(process.env.JWT_SECRET) || !hasStrongSecret(process.env.JWT_REFRESH_SECRET)) {
    throw new Error('JWT secrets are missing or too weak');
  }
}
const ADMIN_ROLE_PERMISSIONS = {
  super_admin: ['*'],
  support_client: [
    'users.read.client',
    'users.manage.client',
    'users.status.client',
    'crm.read',
    'crm.manage',
    'projects.read',
    'deals.read',
    'support.requests.read',
    'support.requests.manage',
  ],
  support_commercial: [
    'users.read.commercial',
    'users.create.commercial',
    'users.manage.commercial',
    'users.status.commercial',
    'crm.read',
    'reports.read',
    'assignments.read',
    'assignments.manage',
    'deals.read',
    'commissions.read',
  ],
  support_promoter: [
    'users.read.promoter',
    'users.create.promoter',
    'users.manage.promoter',
    'users.status.promoter',
    'projects.read',
    'assignments.read',
    'assignments.manage',
    'reports.read',
    'deals.read',
    'commissions.read',
  ],
  project_integrator: [
    'users.read.promoter',
    'projects.read',
    'projects.manage',
  ],
};
function normalizeAdminRole(role) {
  const value = String(role || '').trim().toLowerCase();
  if (value && ADMIN_ROLE_PERMISSIONS[value]) return value;
  if (value === 'administrator') return 'support_client';
  if (value === 'access_manager') return 'support_commercial';
  return 'support_client';
}
function getUserPermissions(user) {
  if (!user || user.role !== 'admin') return [];
  const customPermissions = parseJson(user.permissions, null);
  const rolePermissions = ADMIN_ROLE_PERMISSIONS[normalizeAdminRole(user.adminRole)] || ADMIN_ROLE_PERMISSIONS.support_client;
  if (Array.isArray(customPermissions) && customPermissions.length) {
    return Array.from(new Set([...rolePermissions, ...customPermissions]));
  }
  return rolePermissions;
}
function hasPermission(user, permission) {
  const permissions = getUserPermissions(user);
  return permissions.includes('*') || permissions.includes(permission);
}
function hasAnyPermission(user, permissions = []) {
  return permissions.some((permission) => hasPermission(user, permission));
}
function isAdminUser(user) {
  return !!user && user.role === 'admin';
}
function canManageProjects(user) {
  if (!user) return false;
  if (user.role === 'admin') return hasPermission(user, 'projects.manage');
  return false;
}
function canReadProjects(user) {
  if (!user) return false;
  if (user.role === 'admin') return hasPermission(user, 'projects.read') || hasPermission(user, 'projects.manage');
  return user.role === 'promoter';
}
function canReadAdminReports(user) {
  return isAdminUser(user) && hasPermission(user, 'reports.read');
}
function canReadAdminCrm(user) {
  return isAdminUser(user) && hasPermission(user, 'crm.read');
}
function canManageAdminUsers(user) {
  return isAdminUser(user) && hasPermission(user, 'admin.manage');
}
function canReadUsers(user) {
  return isAdminUser(user) && hasAnyPermission(user, ['users.read.client', 'users.read.commercial', 'users.read.promoter']);
}
function canReadUserRole(user, role) {
  if (!isAdminUser(user)) return false;
  if (hasPermission(user, '*')) return true;
  if (role === 'client') return hasPermission(user, 'users.read.client');
  if (role === 'commercial') return hasPermission(user, 'users.read.commercial');
  if (role === 'promoter') return hasPermission(user, 'users.read.promoter');
  return false;
}
function canManageUserRole(user, role) {
  if (!isAdminUser(user)) return false;
  if (hasPermission(user, '*')) return true;
  if (role === 'client') return hasPermission(user, 'users.manage.client') || hasPermission(user, 'users.status.client');
  if (role === 'commercial') return hasPermission(user, 'users.manage.commercial') || hasPermission(user, 'users.status.commercial');
  if (role === 'promoter') return hasPermission(user, 'users.manage.promoter') || hasPermission(user, 'users.status.promoter');
  return false;
}
function canManageNonAdminUsers(user) {
  return isAdminUser(user) && hasAnyPermission(user, [
    'users.manage.client',
    'users.manage.commercial',
    'users.manage.promoter',
    'users.status.client',
    'users.status.commercial',
    'users.status.promoter',
  ]);
}
function canManageAdminCrm(user) {
  return isAdminUser(user) && hasPermission(user, 'crm.manage');
}
function canAssignAdminCrm(user) {
  return isAdminUser(user) && hasPermission(user, 'crm.assign');
}
function canReadDeals(user) {
  return isAdminUser(user) && hasAnyPermission(user, ['deals.read', 'deals.manage', 'deals.validate']);
}
function canManageDeals(user) {
  return isAdminUser(user) && hasPermission(user, 'deals.manage');
}
function canValidateDeals(user) {
  return isAdminUser(user) && hasPermission(user, 'deals.validate');
}
function canReadCommissions(user) {
  return isAdminUser(user) && hasPermission(user, 'commissions.read');
}
function canReadAssignments(user) {
  return isAdminUser(user) && hasPermission(user, 'assignments.read');
}
function canManageAssignments(user) {
  return isAdminUser(user) && hasPermission(user, 'assignments.manage');
}
function canReadSupportRequests(user) {
  return isAdminUser(user) && hasAnyPermission(user, ['support.requests.read', 'support.requests.manage']);
}
function canManageSupportRequests(user) {
  return isAdminUser(user) && hasPermission(user, 'support.requests.manage');
}
function emptyAccessScope() {
  return { promoterIds: [], projectIds: [], cities: [], districts: [] };
}
function normalizeAccessScope(scope) {
  const source = parseJson(scope, {}) || {};
  const normalizeList = (items) => Array.from(new Set((Array.isArray(items) ? items : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)));
  return {
    promoterIds: normalizeList(source.promoterIds),
    projectIds: normalizeList(source.projectIds),
    cities: normalizeList(source.cities),
    districts: normalizeList(source.districts),
  };
}
function getUserAccessScope(user) {
  if (!isAdminUser(user) || hasPermission(user, '*')) return emptyAccessScope();
  return normalizeAccessScope(user.accessScope);
}
function hasScopedRestrictions(user) {
  const scope = getUserAccessScope(user);
  return !!(scope.promoterIds.length || scope.projectIds.length || scope.cities.length || scope.districts.length);
}
function matchesAccessScope(user, entity = {}) {
  if (!isAdminUser(user) || hasPermission(user, '*')) return true;
  const scope = getUserAccessScope(user);
  if (!hasScopedRestrictions(user)) return true;

  const entityPromoterIds = Array.from(new Set((entity.promoterIds || []).map((item) => String(item || '').trim()).filter(Boolean)));
  const entityProjectIds = Array.from(new Set((entity.projectIds || []).map((item) => String(item || '').trim()).filter(Boolean)));
  const entityCities = Array.from(new Set((entity.cities || []).map((item) => String(item || '').trim().toLowerCase()).filter(Boolean)));
  const entityDistricts = Array.from(new Set((entity.districts || []).map((item) => String(item || '').trim().toLowerCase()).filter(Boolean)));

  if (scope.promoterIds.length && !entityPromoterIds.some((item) => scope.promoterIds.includes(item))) return false;
  if (scope.projectIds.length && !entityProjectIds.some((item) => scope.projectIds.includes(item))) return false;
  if (scope.cities.length && !entityCities.some((item) => scope.cities.map((value) => value.toLowerCase()).includes(item))) return false;
  if (scope.districts.length && !entityDistricts.some((item) => scope.districts.map((value) => value.toLowerCase()).includes(item))) return false;
  return true;
}
async function dealScopeEntity(row) {
  const [properties] = row.propertyId ? await db.query('SELECT id, city, district FROM properties WHERE id = ? LIMIT 1', [row.propertyId]) : [[]];
  const property = properties[0] || {};
  return {
    promoterIds: [row.promoterId || ''],
    projectIds: [row.propertyId || ''],
    cities: [property.city || ''],
    districts: [property.district || ''],
  };
}
async function leadScopeEntity(row) {
  return {
    promoterIds: [row.promoterId || ''],
    projectIds: [row.projectId || ''],
    cities: [row.city || ''],
    districts: [row.district || ''],
  };
}
function projectScopeEntity(row) {
  return {
    promoterIds: [row.promoterId || ''],
    projectIds: [row.id || ''],
    cities: [row.city || ''],
    districts: [row.district || ''],
  };
}

function projectBelongsToPromoter(row, user) {
  if (!row || !user || user.role !== 'promoter') return false;
  const rowPromoterId = String(row.promoterId || '').trim();
  const rowPromoterName = String(row.promoterName || '').trim().toLowerCase();
  const userId = String(user.userId || user.id || '').trim();
  const userName = String(user.name || '').trim().toLowerCase();
  return (!!rowPromoterId && rowPromoterId === userId) || (!!rowPromoterName && rowPromoterName === userName);
}
function appointmentScopeEntity(row) {
  return {
    promoterIds: [row.promoterId || ''],
    projectIds: [row.projectId || row.propertyId || ''],
    cities: [row.city || ''],
    districts: [row.district || ''],
  };
}
async function resolveLeadOwnership(answers = {}) {
  const matches = await matchedProperties(answers);
  const primaryMatch = matches[0] || null;
  return {
    promoterId: primaryMatch?.promoterId || null,
    projectId: primaryMatch?.projectId || primaryMatch?.id || null,
    city: String(answers.city || primaryMatch?.city || '').trim(),
    district: String(answers.targetZone || primaryMatch?.district || '').trim(),
    matches,
  };
}
async function resolvePropertyScope(propertyId = null) {
  if (!propertyId) return { promoterId: null, projectId: null, city: null, district: null, title: null };
  const [rows] = await db.query('SELECT id, title, promoterId, projectId, city, district FROM properties WHERE id = ? LIMIT 1', [propertyId]);
  const property = rows[0] || null;
  return {
    promoterId: property?.promoterId || null,
    projectId: property?.projectId || property?.id || null,
    city: property?.city || null,
    district: property?.district || null,
    title: property?.title || null,
  };
}
async function loadCurrentUser(userId) {
  const [rows] = await db.query(
    'SELECT id, name, email, phone, role, adminRole, accountStatus, accountValidationStatus, accessScope, permissions, hasCompletedQuestionnaire, avatar, createdAt FROM users WHERE id = ? LIMIT 1',
    [userId],
  );
  if (!rows.length) return null;
  const user = rows[0];
  const promoterAccess = user.role === 'promoter' ? await getPromoterAccessSnapshot(user.id) : null;
  return {
    ...user,
    adminRole: user.adminRole || null,
    accountStatus: user.accountStatus || 'active',
    accountValidationStatus: normalizeAccountValidationStatus(user.accountValidationStatus, user.role === 'client' ? 'draft' : 'validated'),
    accessScope: normalizeAccessScope(user.accessScope),
    permissions: getUserPermissions(user),
    promoterAccountStatus: promoterAccess?.accountStatus || null,
    promoterSubscriptionStatus: promoterAccess?.subscriptionStatus || null,
    promoterSubscriptionPlanKey: promoterAccess?.planKey || null,
    promoterSubscriptionStartsAt: promoterAccess?.startsAt || null,
    promoterSubscriptionEndsAt: promoterAccess?.endsAt || null,
    promoterHasActiveSubscription: promoterAccess ? isSubscriptionActive(promoterAccess) : null,
    promoterAccessRestrictedReason: promoterAccess && !isSubscriptionActive(promoterAccess) ? promoterRestrictionReason(promoterAccess) : null,
  };
}
function isUserAccountActive(user) {
  return String(user?.accountStatus || 'active') === 'active';
}
function accountStatusErrorMessage(status) {
  if (status === 'blocked') return 'Account blocked';
  if (status === 'disabled') return 'Account disabled';
  return 'Account unavailable';
}
const signTokens = (user) => ({
  accessToken: jwt.sign({ userId: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '24h' }),
  refreshToken: jwt.sign({ userId: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }),
});
const auth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await loadCurrentUser(decoded.userId);
    if (!user) return res.status(401).json({ error: 'Invalid or expired token' });
    if (!isUserAccountActive(user)) return res.status(403).json({ error: accountStatusErrorMessage(user.accountStatus) });
    req.user = { ...decoded, ...user };
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

async function rejectIfPromoterRestricted(req, res) {
  if (req.user?.role !== 'promoter') return null;
  const access = await ensurePromoterCanUseBusinessFeatures(req.user);
  if (access.ok) return access.snapshot;
  res.status(403).json({
    error: access.error,
    promoterAccountStatus: access.snapshot?.accountStatus || null,
    promoterSubscriptionStatus: access.snapshot?.subscriptionStatus || null,
    promoterSubscriptionEndsAt: access.snapshot?.endsAt || null,
  });
  return false;
}

const leadScore = (a = {}) => {
  let score = 12;
  if (String(a.firstName || '').trim()) score += 2;
  if (String(a.lastName || '').trim()) score += 2;
  if (String(a.phone || '').trim()) score += 3;
  if (String(a.email || '').trim()) score += 2;

  const budgetMax = Number(a.budgetRaw || a.budgetMaxRaw || 0);
  const budgetMin = Number(a.budgetMinRaw || 0);
  const downPayment = Number(a.downPaymentRaw || 0);
  const areaMin = Number(a.desiredAreaMinRaw || a.desiredAreaRaw || 0);
  const areaMax = Number(a.desiredAreaMaxRaw || 0);
  const urgency = Number(a.urgencyLevel || 0);
  const seriousness = Number(a.projectSeriousness || 0);
  const financingReadiness = Number(a.financingReadiness || 0);

  if (budgetMax >= 700000) score += 6;
  if (budgetMax >= 1500000) score += 8;
  if (budgetMin > 0) score += 3;
  if (downPayment >= 100000) score += 5;
  if (downPayment >= 300000) score += 6;

  if (a.financing === 'Cash') score += 15;
  else if (a.financing === 'Mixte') score += 10;
  else if (a.financing === 'Crédit') score += 6;

  if (a.hasBankPreApproval || a.creditPreApproval === 'Oui') score += 10;
  if (Number(a.maxMonthlyPaymentRaw || 0) > 0) score += 4;
  if (String(a.netIncome || '').trim()) score += 3;

  if (['Immediat', 'Imm\u00E9diat'].includes(a.purchaseDeadline)) score += 18;
  else if (['Moins de 1 mois', '1 a 3 mois', '3 mois'].includes(a.purchaseDeadline)) score += 12;
  else if (['3 a 6 mois', '6 mois'].includes(a.purchaseDeadline)) score += 8;
  else if (a.purchaseDeadline === '1 an') score += 4;

  if (String(a.objective || '').trim()) score += 6;
  if (String(a.clientGoal || '').trim()) score += 4;
  if (String(a.propertyType || '').trim() || (a.propertyTypes || []).length) score += 6;
  if (String(a.targetZone || a.searchedCity || '').trim() || (a.searchedCities || []).length) score += 6;
  if (areaMin > 0) score += 3;
  if (areaMax > 0) score += 2;
  if (Number(a.rooms || 0) > 0) score += 4;
  if (Number(a.bathrooms || 0) > 0) score += 2;

  const strictCriteria = (a.mustHave || []).length + (a.mandatoryCriteria || []).length;
  if (strictCriteria >= 3) score += 6;
  else if (strictCriteria > 0) score += 3;
  if ((a.requiredCriteria || []).length > 0) score += 4;
  if ((a.veryImportantCriteria || []).length > 0) score += 3;
  if (a.isMRE) score += 4;
  if (String(a.expectedYield || a.expectedRentalYield || '').trim()) score += 3;
  if (a.qualificationIndicators) {
    score += Math.round(((Number(a.qualificationIndicators.needPrecision || 0) + Number(a.qualificationIndicators.estimatedSeriousness || 0)) / 200) * 8);
  }

  score += Math.min(8, urgency + seriousness + financingReadiness);
  return Math.max(0, Math.min(100, Math.round(score)));
};
const leadTemp = (s) => (s >= 70 ? 'hot' : s >= 40 ? 'warm' : 'cold');

function normalizeYesNoPreference(value, fallback = 'Sans préférence') {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  if (['oui', 'yes', 'true', 'obligatoire'].includes(normalized)) return 'Oui';
  if (['non', 'no', 'false'].includes(normalized)) return 'Non';
  return value;
}

function normalizeAccountValidationStatus(value, fallback = 'draft') {
  const normalized = String(value || '').trim().toLowerCase();
  if (['draft', 'pending_review', 'validated', 'rejected'].includes(normalized)) return normalized;
  return fallback;
}

function normalizePromoterAccountStatus(value, fallback = 'invited') {
  const normalized = String(value || '').trim().toLowerCase();
  if (['invited', 'pending_payment', 'active', 'expired', 'suspended', 'disabled'].includes(normalized)) return normalized;
  return fallback;
}

function normalizeSubscriptionStatus(value, fallback = 'pending') {
  const normalized = String(value || '').trim().toLowerCase();
  if (['pending', 'active', 'expired', 'cancelled', 'suspended'].includes(normalized)) return normalized;
  return fallback;
}

function normalizePaymentRequestStatus(value, fallback = 'pending') {
  const normalized = String(value || '').trim().toLowerCase();
  if (['pending', 'validated', 'rejected', 'cancelled'].includes(normalized)) return normalized;
  return fallback;
}

function normalizePlanKey(value, fallback = 'monthly') {
  const normalized = String(value || '').trim().toLowerCase();
  if (['monthly', 'quarterly', 'yearly'].includes(normalized)) return normalized;
  return fallback;
}

function isSubscriptionActive(snapshot) {
  return normalizeSubscriptionStatus(snapshot?.subscriptionStatus, '') === 'active'
    && normalizePromoterAccountStatus(snapshot?.accountStatus, '') === 'active';
}

function promoterRestrictionReason(snapshot) {
  const accountStatus = normalizePromoterAccountStatus(snapshot?.accountStatus, 'invited');
  const subscriptionStatus = normalizeSubscriptionStatus(snapshot?.subscriptionStatus, 'pending');

  if (accountStatus === 'disabled') return 'Compte promoteur désactivé.';
  if (accountStatus === 'suspended' || subscriptionStatus === 'suspended') return 'Compte promoteur suspendu.';
  if (subscriptionStatus === 'expired' || accountStatus === 'expired') return 'Abonnement promoteur expiré. Renouvelez votre formule pour réactiver l espace métier.';
  if (accountStatus === 'pending_payment' || subscriptionStatus === 'pending') return 'Abonnement promoteur en attente de paiement ou de validation.';
  if (accountStatus === 'invited') return 'Compte promoteur invité. Activez un abonnement pour ouvrir l espace métier.';
  return 'Accès promoteur restreint.';
}

function matchingBlockedReasonForUser(user) {
  if (!user || user.role !== 'client') return null;
  if (!user.hasCompletedQuestionnaire) return 'Complétez votre inscription et le formulaire intelligent pour accéder au matching.';
  if (String(user.accountStatus || 'active').toLowerCase() !== 'active') {
    return 'Votre compte est temporairement restreint. Contactez Selix pour réactiver votre accès.';
  }
  return null;
}

function formatProperty(row) {
  return {
    id: row.id, title: row.title, project: row.project || '', projectId: row.projectId || row.id, promoter: row.promoter || '', promoterId: row.promoterId || '',
    type: row.type || 'Appartement', city: row.city || '', district: row.district || '', price: money(row.priceRaw), priceRaw: Number(row.priceRaw || 0),
    area: `${Number(row.areaRaw || 0)} m\u00B2`, areaRaw: Number(row.areaRaw || 0), rooms: Number(row.rooms || 0), floor: Number(row.floor || 0),
    description: row.description || '', highlights: parseJson(row.highlights, []), options: parseJson(row.optionsJson, []), image: row.image,
    images: parseJson(row.images, row.image ? [row.image] : []), availability: row.availability || 'Disponible',
    monthlyEstimate: `${Number(row.monthlyEstimateRaw || 0).toLocaleString('fr-FR')} MAD/mois`, monthlyEstimateRaw: Number(row.monthlyEstimateRaw || 0),
    score: Number(row.score || 0), badge: row.badge || 'Bon potentiel', delivery: row.delivery || '', reference: row.referenceCode || '',
    commercialId: row.commercialId || '', commercialName: row.commercialName || '', projectStatus: row.projectStatus || '',
    visibleInMatching: row.visibleInMatching == null ? true : !!row.visibleInMatching,
    isActive: row.isActive == null ? true : !!row.isActive,
    specs: parseJson(row.specsJson, {}),
  };
}

function formatProject(row) {
  return {
    id: row.id, name: row.name, promoterId: row.promoterId || '', promoterName: row.promoterName || '', city: row.city || '', district: row.district || '',
    type: row.type || 'Appartement', description: row.description || '', image: row.image || '', images: parseJson(row.images, row.image ? [row.image] : []), status: row.status || 'En construction',
    totalUnits: Number(row.totalUnits || 0), availableUnits: Number(row.availableUnits || 0), reservedUnits: Number(row.reservedUnits || 0),
    soldUnits: Number(row.soldUnits || 0), minPrice: money(row.minPriceRaw), minPriceRaw: Number(row.minPriceRaw || 0),
    maxPrice: money(row.maxPriceRaw), maxPriceRaw: Number(row.maxPriceRaw || 0), areaFromRaw: Number(row.areaFromRaw || 0), areaToRaw: Number(row.areaToRaw || 0),
    bedroomsFrom: Number(row.bedroomsFrom || 0), bedroomsTo: Number(row.bedroomsTo || 0), viewLabel: row.viewLabel || '',
    delivery: row.delivery || '', completionPercent: Number(row.completionPercent || 0),
    isActive: row.isActive == null ? true : !!row.isActive,
    visibleInMatching: row.visibleInMatching == null ? true : !!row.visibleInMatching,
    commercialId: row.commercialId || '',
    commercialName: row.commercialName || '',
    features: parseJson(row.features, []),
    specs: parseJson(row.specsJson, {}),
    units: parseJson(row.unitsJson, []),
  };
}

async function matchedProperties(answers = {}) {
  const [rows] = await db.query(`
    SELECT *
    FROM properties
    WHERE availability IN ('Disponible', 'R\u00E9serv\u00E9', 'Reserve', 'R\\u00E9serv\\u00E9')
      AND COALESCE(isActive, 1) = 1
      AND COALESCE(visibleInMatching, 1) = 1
    ORDER BY createdAt DESC
  `);
  const budget = Number(answers.budgetRaw || answers.budgetMaxRaw || 0);
  const budgetMin = Number(answers.budgetMinRaw || 0);
  const searchedCities = Array.from(new Set([...(answers.searchedCities || []), answers.searchedCity || answers.city || ''].map((item) => String(item || '').trim().toLowerCase()).filter(Boolean)));
  const targetZones = Array.from(new Set([...(answers.searchedDistricts || []), answers.targetZone || ''].map((item) => String(item || '').trim().toLowerCase()).filter(Boolean)));
  const mustHave = [
    ...(answers.mustHave || []),
    ...(answers.mandatoryCriteria || []),
    ...(answers.veryImportantCriteria || []),
    ...(answers.requiredCriteria || []),
  ].map((item) => String(item).toLowerCase());
  const desiredAreaMin = Number(answers.desiredAreaMinRaw || answers.desiredAreaRaw || 0);
  const desiredAreaMax = Number(answers.desiredAreaMaxRaw || 0);
  const desiredRooms = Number(answers.bedroomsMin || answers.rooms || 0);
  const budgetFlexRatio = 1 + (Math.min(30, Number(answers.budgetFlexibilityPercent || 0)) / 100);

  return rows
    .map(formatProperty)
    .map((property) => {
      let score = 25;
      const propertySpecs = property.specs || {};
      const propertyTypeTargets = answers.propertyTypes?.length ? answers.propertyTypes : [answers.propertyType].filter(Boolean);
      if (propertyTypeTargets.includes(property.type)) score += 24;
      if (searchedCities.some((city) => property.city.toLowerCase() === city)) score += 16;
      if (targetZones.some((zone) => property.district.toLowerCase().includes(zone))) score += 18;
      if ((answers.projectTypes || []).some((item) => (propertySpecs.projectTypes || []).includes(item))) score += 8;

      if (budget > 0) {
        if (property.priceRaw <= budget) score += 18;
        else if (property.priceRaw <= budget * Math.max(1.1, budgetFlexRatio)) score += 10;
        else if (property.priceRaw <= budget * Math.max(1.2, budgetFlexRatio)) score += 4;
      }
      if (budgetMin > 0 && property.priceRaw >= budgetMin) score += 4;

      if (desiredAreaMin > 0 && property.areaRaw >= desiredAreaMin) score += 8;
      if (desiredAreaMax > 0 && property.areaRaw <= desiredAreaMax) score += 4;
      if (desiredRooms > 0 && property.rooms >= desiredRooms) score += 6;

      if (String(answers.objective || '').includes('Investissement') && ['Studio', 'Appartement', 'Bureau', 'Local', 'Plateau bureau', 'Local commercial'].includes(property.type)) {
        score += 8;
      }
      if (String(answers.objective || '').includes('Residence') && ['Villa', 'Appartement', 'Duplex', 'Penthouse', 'Riad', 'Maison'].includes(property.type)) {
        score += 8;
      }

      if (mustHave.length) {
        const highlights = [...property.highlights.map((item) => String(item).toLowerCase()), ...((propertySpecs.amenities || []).map((item) => String(item).toLowerCase()))];
        const matchedCriteria = mustHave.filter((item) => highlights.some((highlight) => highlight.includes(item)));
        score += Math.min(12, matchedCriteria.length * 4);
      }

      if (['Immediat', 'Imm\u00E9diat'].includes(answers.purchaseDeadline) && /livr/i.test(property.delivery)) score += 4;
      if (property.availability === 'Disponible') score += 5;
      if (normalizeYesNoPreference(answers.parkingRequired, '') === 'Oui' && property.highlights.some((item) => /parking/i.test(String(item)))) score += 4;
      if (normalizeYesNoPreference(answers.terraceRequired, '') === 'Oui' && property.highlights.some((item) => /terrasse|balcon/i.test(String(item)))) score += 4;
      if (normalizeYesNoPreference(answers.gardenRequired, '') === 'Oui' && property.highlights.some((item) => /jardin/i.test(String(item)))) score += 4;
      if (String(answers.viewPreference || '').trim() && String(answers.viewPreference).toLowerCase() !== 'sans préférence' && property.highlights.some((item) => String(item).toLowerCase().includes(String(answers.viewPreference).toLowerCase()))) score += 4;
      if ((answers.viewPreferences || []).length && (propertySpecs.viewOptions || []).some((item) => (answers.viewPreferences || []).map((value) => String(value).toLowerCase()).includes(String(item).toLowerCase()))) score += 6;
      if (answers.gatedResidenceRequired && propertySpecs.residenceType === 'Fermee') score += 5;
      if (answers.securityRequired && (propertySpecs.securityFeatures || []).length) score += 5;
      if (answers.deliveryMaxMonths && Number(propertySpecs.deliveryMaxMonths || 0) > 0 && Number(propertySpecs.deliveryMaxMonths || 0) <= Number(answers.deliveryMaxMonths || 0)) score += 5;

      const finalScore = Math.max(0, Math.min(100, Math.round(score)));
      return {
        ...property,
        score: finalScore,
        badge: finalScore >= 90 ? 'Top Match' : finalScore >= 78 ? 'Excellent Match' : finalScore >= 62 ? 'Bon potentiel' : '\u00C0 explorer',
        matchScore: finalScore,
      };
    })
    .filter((property) => property.score >= 45)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

async function formatProjectWithUnits(row) {
  const project = formatProject(row);
  const units = await listProjectUnits(row.id);
  return {
    ...project,
    units: units.length ? units : project.units,
  };
}

function advancedLeadStatus(status = '') {
  return ['qualified', 'offered', 'converted'].includes(status);
}

async function formatLead(row) {
  const answers = parseJson(row.answers, {});
  const [clients] = await db.query('SELECT name, email, phone, accountValidationStatus FROM users WHERE id = ?', [row.clientId]);
  const [commercials] = row.commercialId ? await db.query('SELECT name FROM users WHERE id = ?', [row.commercialId]) : [[]];
  const latestInterestConfirmation = await getLatestInterestConfirmationForLead(row.id);
  const latestTransfer = await getLatestLeadTransferForLead(row.id);
  return {
    id: row.id, clientId: row.clientId, clientName: clients[0]?.name || '', clientPhone: clients[0]?.phone || '', clientEmail: clients[0]?.email || '',
    commercialId: row.commercialId || undefined, commercialName: commercials[0]?.name || undefined, answers, source: row.source || 'questionnaire',
    score: Number(row.score || leadScore(answers)), temperature: row.temperature || leadTemp(Number(row.score || leadScore(answers))),
    status: leadFromDb[row.status] || 'Nouveau', statusHistory: [], matchedProperties: await matchedProperties(answers), notes: row.notes || '',
    lastContact: row.updatedAt, createdAt: row.createdAt, updatedAt: row.updatedAt,
    accountValidationStatus: normalizeAccountValidationStatus(clients[0]?.accountValidationStatus, 'draft'),
    latestInterestConfirmation,
    latestTransfer,
  };
}
async function backfillLeadOwnership() {
  const [rows] = await db.query('SELECT id, answers, promoterId, projectId, city, district FROM leads');
  for (const row of rows) {
    if (row.promoterId && row.projectId && row.city && row.district) continue;
    const answers = parseJson(row.answers, {});
    const ownership = await resolveLeadOwnership(answers);
    await db.query(
      'UPDATE leads SET promoterId = COALESCE(?, promoterId), projectId = COALESCE(?, projectId), city = COALESCE(?, city), district = COALESCE(?, district), updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
      [ownership.promoterId, ownership.projectId, ownership.city || null, ownership.district || null, row.id],
    );
  }
}
async function backfillAppointmentScope() {
  const [rows] = await db.query('SELECT id, propertyId, promoterId, projectId, city, district FROM appointments');
  for (const row of rows) {
    if (row.promoterId && row.projectId && row.city && row.district) continue;
    const scope = await resolvePropertyScope(row.propertyId);
    await db.query(
      'UPDATE appointments SET promoterId = COALESCE(?, promoterId), projectId = COALESCE(?, projectId), city = COALESCE(?, city), district = COALESCE(?, district), updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
      [scope.promoterId, scope.projectId, scope.city, scope.district, row.id],
    );
  }
}
async function backfillConversationScope() {
  const [rows] = await db.query('SELECT id, relatedPropertyId, relatedPromoterId, relatedCity, relatedDistrict FROM conversations');
  for (const row of rows) {
    if (row.relatedPromoterId && row.relatedCity && row.relatedDistrict) continue;
    const scope = await resolvePropertyScope(row.relatedPropertyId);
    await db.query(
      'UPDATE conversations SET relatedPromoterId = COALESCE(?, relatedPromoterId), relatedCity = COALESCE(?, relatedCity), relatedDistrict = COALESCE(?, relatedDistrict), updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
      [scope.promoterId, scope.city, scope.district, row.id],
    );
  }
}

async function formatAppointment(row) {
  const [clients] = await db.query('SELECT name FROM users WHERE id = ?', [row.clientId]);
  const [commercials] = await db.query('SELECT name, phone FROM users WHERE id = ?', [row.commercialId]);
  const [properties] = row.propertyId ? await db.query('SELECT title, city, project FROM properties WHERE id = ?', [row.propertyId]) : [[]];
  const p = properties[0] || {};
  const dt = new Date(row.dateTime);
  const normalizedStatus = normalizeAppointmentStatus(row.status);
  const lead = row.leadId ? { id: row.leadId } : await resolveLeadForAppointment(row);
  return {
    id: row.id, leadId: lead?.id || '', clientName: clients[0]?.name || 'Client', propertyId: row.propertyId, propertyTitle: p.title || row.title,
    commercialId: row.commercialId, commercialName: commercials[0]?.name || '', date: dt.toISOString().slice(0, 10),
    time: dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), city: p.city || '', status: apptFromDb[normalizedStatus] || 'Planifi\u00E9', notes: sanitizeAppointmentNotes(row.description || ''),
  };
}

async function notify(userId, title, body, type = 'system', targetId = null) {
  await db.query('INSERT INTO notifications (id, userId, type, title, body, targetId) VALUES (?, ?, ?, ?, ?, ?)', [randomUUID(), userId, type, title, body, targetId]);
  io.to(`user:${userId}`).emit('notifications:updated', { userId, type, targetId });
  await sendExpoPushNotification(userId, title, body, { type, targetId });
}

function formatSupportRequest(row) {
  return {
    id: row.id,
    clientId: row.clientId,
    clientName: row.clientName || '',
    clientEmail: row.clientEmail || '',
    clientPhone: row.clientPhone || '',
    category: row.category || 'question',
    subject: row.subject || '',
    message: row.message || '',
    status: row.status || 'open',
    adminNote: row.adminNote || '',
    handledBy: row.handledBy || null,
    handledByName: row.handledByName || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function loadSupportAdmins() {
  const [rows] = await db.query("SELECT id, role, adminRole, permissions, accountStatus FROM users WHERE role = 'admin' AND accountStatus = 'active'");
  return rows.filter((row) => canReadSupportRequests(row));
}

async function pickSupportAdmin() {
  const admins = await loadSupportAdmins();
  return admins[0] || null;
}

async function logClientTimelineEvent({
  clientId,
  actorRole,
  actorName,
  actionType,
  description,
  targetId = null,
  metadata = null,
  createdAt = null,
}) {
  if (!clientId || !actionType || !description) return;
  await db.query(
    `INSERT INTO timeline_events (id, clientId, actorRole, actorName, actionType, description, targetId, metadata, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
    [
      randomUUID(),
      clientId,
      actorRole || 'system',
      actorName || '',
      actionType,
      description,
      targetId,
      metadata ? JSON.stringify(metadata) : null,
      createdAt,
    ],
  );
  io.to(`user:${clientId}`).emit('timeline:updated', { clientId, actionType, targetId });
}

function emitUserRealtime(userId, event, payload = {}) {
  if (!userId) return;
  io.to(`user:${userId}`).emit(event, payload);
}

function emitConversationRealtime(conversationId, event, payload = {}) {
  if (!conversationId) return;
  io.to(`conversation:${conversationId}`).emit(event, payload);
}

function formatCallSession(row, viewerUserId = null) {
  if (!row) return null;
  const startedAt = row.startedAt || row.createdAt || new Date().toISOString();
  const answeredAt = row.answeredAt || null;
  const endedAt = row.endedAt || null;
  const direction = viewerUserId
    ? (viewerUserId === row.callerId ? 'outgoing' : viewerUserId === row.receiverId ? 'incoming' : null)
    : null;

  return {
    id: row.id,
    conversationId: row.conversationId,
    callerId: row.callerId,
    callerName: row.callerName || '',
    receiverId: row.receiverId,
    receiverName: row.receiverName || '',
    relatedPropertyId: row.relatedPropertyId || null,
    relatedPropertyTitle: row.relatedPropertyTitle || null,
    callType: row.callType || 'audio',
    status: row.status || 'ringing',
    startedAt,
    answeredAt,
    endedAt,
    durationSec: Number(row.durationSec || 0),
    direction,
  };
}

async function getConversationParticipants(conversationId) {
  const [rows] = await db.query(
    `SELECT u.id, u.name, u.role
     FROM conversation_participants cp
     JOIN users u ON u.id = cp.userId
     WHERE cp.conversationId = ?
     ORDER BY cp.createdAt ASC`,
    [conversationId],
  );
  return rows;
}

async function getConversationById(conversationId) {
  const [rows] = await db.query(
    'SELECT id, relatedPropertyId, relatedPropertyTitle FROM conversations WHERE id = ? LIMIT 1',
    [conversationId],
  );
  return rows[0] || null;
}

async function getCallSessionById(callId) {
  const [rows] = await db.query('SELECT * FROM call_sessions WHERE id = ? LIMIT 1', [callId]);
  return rows[0] || null;
}

async function getUserActiveCall(userId) {
  const [rows] = await db.query(
    `SELECT *
     FROM call_sessions
     WHERE (callerId = ? OR receiverId = ?)
       AND status IN (${ACTIVE_CALL_SESSION_STATUSES.map(() => '?').join(', ')})
     ORDER BY createdAt DESC
     LIMIT 1`,
    [userId, userId, ...ACTIVE_CALL_SESSION_STATUSES],
  );
  return rows[0] || null;
}

async function emitCallSessionUpdate(callId, event = 'call:updated') {
  const session = await getCallSessionById(callId);
  if (!session) return null;
  const callerPayload = formatCallSession(session, session.callerId);
  const receiverPayload = formatCallSession(session, session.receiverId);
  emitUserRealtime(session.callerId, event, callerPayload);
  emitUserRealtime(session.receiverId, event, receiverPayload);
  return session;
}

function isExpoPushToken(token) {
  return typeof token === 'string' && /^ExponentPushToken\[[A-Za-z0-9_-]+\]$/.test(token.trim());
}

async function sendExpoPushNotification(userId, title, body, data = {}) {
  if (!userId) return;
  try {
    const [rows] = await db.query('SELECT expoPushToken FROM users WHERE id = ? LIMIT 1', [userId]);
    const token = rows[0]?.expoPushToken || null;
    if (!isExpoPushToken(token)) return;

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: token,
        sound: 'default',
        title,
        body,
        data,
      }),
    });

    if (!response.ok) {
      console.error('expo push failed', response.status, await response.text().catch(() => ''));
    }
  } catch (error) {
    console.error('expo push failed', error?.message || error);
  }
}

function formatTimelineEvent(row) {
  return {
    id: row.id,
    actionType: row.actionType,
    actorRole: row.actorRole,
    actorName: row.actorName,
    description: row.description,
    targetId: row.targetId || undefined,
    metadata: parseJson(row.metadata, null),
    createdAt: row.createdAt,
  };
}

function formatReminderMessage(appointment) {
  return `${appointment.propertyTitle}${appointment.projectTitle ? ` - ${appointment.projectTitle}` : ''} le ${appointment.date} a ${appointment.time}.`;
}

async function formatAppointment(row) {
  const [clients] = await db.query('SELECT name FROM users WHERE id = ?', [row.clientId]);
  const [commercials] = await db.query('SELECT name, phone FROM users WHERE id = ?', [row.commercialId]);
  const [properties] = row.propertyId ? await db.query('SELECT title, city, project FROM properties WHERE id = ?', [row.propertyId]) : [[]];
  const property = properties[0] || {};
  const dt = new Date(row.dateTime);
  const normalizedStatus = normalizeAppointmentStatus(row.status);
  const lead = row.leadId ? { id: row.leadId } : await resolveLeadForAppointment(row);
  return {
    id: row.id,
    leadId: lead?.id || '',
    clientName: clients[0]?.name || 'Client',
    propertyId: row.propertyId,
    propertyTitle: property.title || row.title,
    projectTitle: property.project || '',
    commercialId: row.commercialId,
    commercialName: commercials[0]?.name || '',
    commercialPhone: commercials[0]?.phone || '',
    date: dt.toISOString().slice(0, 10),
    time: dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    city: property.city || '',
    status: apptFromDb[normalizedStatus] || 'Planifi\u00E9',
    notes: sanitizeAppointmentNotes(row.description || ''),
  };
}

async function dispatchAppointmentReminders(userId = null) {
  const activeStatuses = appointmentStatusList(['scheduled', 'confirmed']);
  const params = [...activeStatuses];
  let userFilter = '';
  if (userId) {
    userFilter = ' AND clientId = ?';
    params.push(userId);
  }

  const [rows] = await db.query(
    `SELECT id, clientId, commercialId, propertyId, dateTime, status, description, reminderDaySentAt, reminderHoursSentAt
     FROM appointments
     WHERE status IN (${activeStatuses.map(() => '?').join(', ')})
       AND dateTime > NOW()
       ${userFilter}
     ORDER BY dateTime ASC`,
    params,
  );

  for (const row of rows) {
    const visitTime = new Date(row.dateTime);
    const diffMs = visitTime.getTime() - Date.now();
    if (!Number.isFinite(diffMs) || diffMs <= 0) continue;

    const appointment = await formatAppointment(row);
    const reminderDetails = formatReminderMessage(appointment);

    if (!row.reminderDaySentAt && diffMs <= 24 * 60 * 60 * 1000 && diffMs > 3 * 60 * 60 * 1000) {
      await notify(row.clientId, 'Rappel visite demain', `Votre visite est prevue demain : ${reminderDetails}`, 'visit', row.id);
      await db.query('UPDATE appointments SET reminderDaySentAt = NOW(), updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [row.id]);
    }

    if (!row.reminderHoursSentAt && diffMs <= 3 * 60 * 60 * 1000) {
      await notify(row.clientId, 'Rappel visite aujourd hui', `Votre visite approche : ${reminderDetails}`, 'visit', row.id);
      await db.query('UPDATE appointments SET reminderHoursSentAt = NOW(), updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [row.id]);
    }
  }
}

function startAppointmentReminderScheduler() {
  const intervalMs = Math.max(60_000, Number(process.env.APPOINTMENT_REMINDER_INTERVAL_MS || 300_000));
  if (appointmentReminderInterval) clearInterval(appointmentReminderInterval);

  const runDispatch = async () => {
    if (!db) return;
    try {
      await dispatchAppointmentReminders();
    } catch (error) {
      console.error('appointment reminder dispatch failed', error?.message || error);
    }
  };

  appointmentReminderInterval = setInterval(runDispatch, intervalMs);
  if (typeof appointmentReminderInterval.unref === 'function') appointmentReminderInterval.unref();
  runDispatch();
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

async function getUserById(userId) {
  const [rows] = await db.query('SELECT id, name, email, role FROM users WHERE id = ?', [userId]);
  return rows[0] || null;
}

async function getPromoterAccessSnapshot(promoterId) {
  if (!promoterId) return null;

  const [accountRows] = await db.query(
    `SELECT pa.promoterId, pa.accountStatus, pa.currentSubscriptionId, ps.planKey, ps.status AS subscriptionStatus, ps.startsAt, ps.endsAt
     FROM promoter_accounts pa
     LEFT JOIN promoter_subscriptions ps ON ps.id = pa.currentSubscriptionId
     WHERE pa.promoterId = ?
     LIMIT 1`,
    [promoterId],
  );

  if (!accountRows.length) {
    return {
      promoterId,
      accountStatus: 'invited',
      currentSubscriptionId: null,
      planKey: null,
      subscriptionStatus: 'pending',
      startsAt: null,
      endsAt: null,
    };
  }

  const row = accountRows[0];
  let accountStatus = normalizePromoterAccountStatus(row.accountStatus, 'invited');
  const subscriptionStatus = normalizeSubscriptionStatus(row.subscriptionStatus, 'pending');
  const endsAt = row.endsAt ? new Date(row.endsAt) : null;
  if (subscriptionStatus === 'active' && endsAt && endsAt.getTime() < Date.now()) {
    accountStatus = 'expired';
  }

  return {
    promoterId,
    accountStatus,
    currentSubscriptionId: row.currentSubscriptionId || null,
    planKey: row.planKey || null,
    subscriptionStatus: endsAt && subscriptionStatus === 'active' && endsAt.getTime() < Date.now() ? 'expired' : subscriptionStatus,
    startsAt: row.startsAt || null,
    endsAt: row.endsAt || null,
  };
}

async function ensurePromoterCanUseBusinessFeatures(user) {
  if (!user || user.role !== 'promoter') return { ok: true, snapshot: null };
  const snapshot = await getPromoterAccessSnapshot(user.userId || user.id);
  if (isSubscriptionActive(snapshot)) return { ok: true, snapshot };
  return {
    ok: false,
    snapshot,
    error: promoterRestrictionReason(snapshot),
  };
}

async function getCommercialIdsForPromoter(promoterId) {
  if (!promoterId) return [];
  const [rows] = await db.query(
    'SELECT commercialId FROM promoter_commercial_assignments WHERE promoterId = ? ORDER BY createdAt ASC',
    [promoterId],
  );
  return rows.map((row) => row.commercialId).filter(Boolean);
}

async function pickCommercialForPromoter(promoterId) {
  const ids = await getCommercialIdsForPromoter(promoterId);
  return ids[0] || null;
}

async function getCommercialIdsForProject(projectId) {
  if (!projectId) return [];
  const [rows] = await db.query(
    'SELECT commercialId FROM project_commercial_assignments WHERE projectId = ? ORDER BY createdAt ASC',
    [projectId],
  );
  return rows.map((row) => row.commercialId).filter(Boolean);
}

async function listPromoterCommercialAssignments() {
  const [rows] = await db.query(`
    SELECT
      a.id,
      a.promoterId,
      p.name AS promoterName,
      a.commercialId,
      c.name AS commercialName,
      c.email AS commercialEmail,
      c.phone AS commercialPhone,
      a.assignedBy,
      a.createdAt
    FROM promoter_commercial_assignments a
    JOIN users p ON p.id = a.promoterId
    JOIN users c ON c.id = a.commercialId
    ORDER BY p.name ASC, c.name ASC
  `);
  return rows;
}

async function listProjectCommercialAssignments() {
  const [rows] = await db.query(`
    SELECT
      a.id,
      a.projectId,
      pr.name AS projectName,
      pr.promoterId,
      pr.promoterName,
      a.commercialId,
      c.name AS commercialName,
      c.email AS commercialEmail,
      c.phone AS commercialPhone,
      a.assignedBy,
      a.createdAt
    FROM project_commercial_assignments a
    JOIN projects pr ON pr.id = a.projectId
    JOIN users c ON c.id = a.commercialId
    ORDER BY pr.name ASC, c.name ASC
  `);
  return rows;
}

async function upsertClientProjectAction(userId, propertyId, actionType, metadata = null) {
  await db.query(
    `INSERT INTO client_project_actions (id, userId, propertyId, actionType, metadata)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE metadata = VALUES(metadata), updatedAt = CURRENT_TIMESTAMP`,
    [randomUUID(), userId, propertyId, actionType, metadata ? JSON.stringify(metadata) : null],
  );
}

async function removeClientProjectAction(userId, propertyId, actionType) {
  await db.query('DELETE FROM client_project_actions WHERE userId = ? AND propertyId = ? AND actionType = ?', [userId, propertyId, actionType]);
}

async function setClientReaction(userId, propertyId, reaction) {
  if (reaction === 'liked') {
    await removeClientProjectAction(userId, propertyId, 'passed');
    await upsertClientProjectAction(userId, propertyId, 'liked');
    return;
  }
  if (reaction === 'passed') {
    await removeClientProjectAction(userId, propertyId, 'liked');
    await upsertClientProjectAction(userId, propertyId, 'passed');
    await db.query('DELETE FROM matches WHERE clientId = ? AND propertyId = ?', [userId, propertyId]);
  }
}

async function listClientProjectActionRows(userId, actionTypes = []) {
  if (!actionTypes.length) return [];
  const [rows] = await db.query(
    `SELECT * FROM client_project_actions
     WHERE userId = ?
       AND actionType IN (${actionTypes.map(() => '?').join(', ')})
     ORDER BY updatedAt DESC, createdAt DESC`,
    [userId, ...actionTypes],
  );
  return rows;
}

async function fetchPropertiesByIds(ids = []) {
  if (!ids.length) return [];
  const [rows] = await db.query(`SELECT * FROM properties WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
  const byId = new Map(rows.map((row) => [row.id, formatProperty(row)]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

async function recordMatch(clientId, propertyId, payload = {}) {
  await db.query(
    `INSERT INTO matches (id, clientId, propertyId, leadId, conversationId, commercialId, promoterId)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       leadId = COALESCE(VALUES(leadId), leadId),
       conversationId = COALESCE(VALUES(conversationId), conversationId),
       commercialId = COALESCE(VALUES(commercialId), commercialId),
       promoterId = COALESCE(VALUES(promoterId), promoterId),
       updatedAt = CURRENT_TIMESTAMP`,
    [randomUUID(), clientId, propertyId, payload.leadId || null, payload.conversationId || null, payload.commercialId || null, payload.promoterId || null],
  );
}

async function ensureConversationBetweenUsers(userIds, relatedPropertyId = null, relatedPropertyTitle = null) {
  const uniqueUserIds = Array.from(new Set((userIds || []).filter(Boolean)));
  if (uniqueUserIds.length < 2) return null;
  const propertyScope = await resolvePropertyScope(relatedPropertyId);

  const placeholders = uniqueUserIds.map(() => '?').join(', ');
  const [candidates] = await db.query(
    `SELECT cp.conversationId
     FROM conversation_participants cp
     WHERE cp.userId IN (${placeholders})
     GROUP BY cp.conversationId
     HAVING COUNT(DISTINCT cp.userId) = ?
        AND COUNT(*) = ?`,
    [...uniqueUserIds, uniqueUserIds.length, uniqueUserIds.length],
  );

  if (candidates.length) {
    const conversationId = candidates[0].conversationId;
    if (relatedPropertyId || relatedPropertyTitle) {
      await db.query(
        'UPDATE conversations SET relatedPropertyId = COALESCE(?, relatedPropertyId), relatedPropertyTitle = COALESCE(?, relatedPropertyTitle), relatedPromoterId = COALESCE(?, relatedPromoterId), relatedCity = COALESCE(?, relatedCity), relatedDistrict = COALESCE(?, relatedDistrict), updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
        [relatedPropertyId, relatedPropertyTitle, propertyScope.promoterId, propertyScope.city, propertyScope.district, conversationId],
      );
    }
    return conversationId;
  }

  const conversationId = randomUUID();
  await db.query(
    'INSERT INTO conversations (id, relatedPropertyId, relatedPropertyTitle, relatedPromoterId, relatedCity, relatedDistrict) VALUES (?, ?, ?, ?, ?, ?)',
    [conversationId, relatedPropertyId, relatedPropertyTitle, propertyScope.promoterId, propertyScope.city, propertyScope.district],
  );
  for (const userId of uniqueUserIds) {
    await db.query('INSERT INTO conversation_participants (id, conversationId, userId) VALUES (?, ?, ?)', [randomUUID(), conversationId, userId]);
  }
  return conversationId;
}

async function seedConversationMessage(conversationId, senderId, content, messageType = 'text') {
  if (!conversationId || !senderId || !content) return;
  const [messages] = await db.query('SELECT id FROM messages WHERE conversationId = ? LIMIT 1', [conversationId]);
  if (messages.length) return;
  await db.query('INSERT INTO messages (id, conversationId, senderId, content, messageType, deliveredAt) VALUES (?, ?, ?, ?, ?, NOW())', [randomUUID(), conversationId, senderId, content, messageType]);
  await db.query('UPDATE conversations SET updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [conversationId]);
}

function isClientHiddenConversationMessage(content = '') {
  const value = String(content || '').trim().toLowerCase();
  return value.startsWith('lead chaud detecte:');
}

function formatDeal(row) {
  return {
    id: row.id,
    leadId: row.leadId,
    clientId: row.clientId,
    clientName: row.clientName || '',
    propertyId: row.propertyId,
    propertyTitle: row.propertyTitle || '',
    commercialId: row.commercialId,
    commercialName: row.commercialName || '',
    promoterId: row.promoterId,
    promoterName: row.promoterName || '',
    salePrice: Number(row.salePrice || 0),
    status: row.status || 'En cours',
    signedAt: row.promoterValidatedAt || undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function pickCommercialForLead(promoterId = null, projectId = null) {
  const projectCommercialIds = await getCommercialIdsForProject(projectId);
  if (projectCommercialIds.length) return projectCommercialIds[0];

  const promoterCommercialId = await pickCommercialForPromoter(promoterId);
  if (promoterCommercialId) return promoterCommercialId;

  const [rows] = await db.query(`
    SELECT u.id
    FROM users u
    LEFT JOIN leads l ON l.commercialId = u.id
    WHERE u.role = 'commercial'
    GROUP BY u.id
    ORDER BY COUNT(l.id) ASC, MIN(u.createdAt) ASC
    LIMIT 1
  `);
  return rows[0]?.id || null;
}

async function pickBestPropertyForLead(lead) {
  const answers = parseJson(lead.answers, {});
  const matches = await matchedProperties(answers);
  if (!matches.length) return null;
  const [rows] = await db.query('SELECT * FROM properties WHERE id = ?', [matches[0].id]);
  return rows[0] || null;
}

async function resolvePromoterForProperty(property) {
  if (!property) return null;

  // Project-backed properties use the project owner as the source of truth.
  const [projectRows] = await db.query(
    'SELECT promoterId, promoterName FROM projects WHERE id = ? OR name = ? LIMIT 1',
    [property.id, property.project || ''],
  );
  const projectOwner = projectRows[0] || null;
  const promoterId = projectOwner?.promoterId || property.promoterId || null;
  if (!promoterId) return null;

  const [promoterRows] = await db.query('SELECT id, name, role FROM users WHERE id = ? LIMIT 1', [promoterId]);
  const promoter = promoterRows[0] || null;
  if (!promoter?.id) return null;

  return {
    id: promoter.id,
    name: projectOwner?.promoterName || promoter.name || property.promoter || '',
  };
}

function formatInterestConfirmation(row) {
  if (!row) return null;
  return {
    id: row.id,
    leadId: row.leadId,
    appointmentId: row.appointmentId || null,
    clientId: row.clientId,
    clientName: row.clientName || '',
    commercialId: row.commercialId,
    commercialName: row.commercialName || '',
    promoterId: row.promoterId || null,
    promoterName: row.promoterName || '',
    propertyId: row.propertyId || null,
    propertyTitle: row.propertyTitle || '',
    projectId: row.projectId || null,
    projectTitle: row.projectTitle || '',
    city: row.city || '',
    district: row.district || '',
    status: row.status || 'pending',
    requestMessage: row.requestMessage || '',
    responseNote: row.responseNote || '',
    requestedAt: row.requestedAt || row.createdAt,
    expiresAt: row.expiresAt || null,
    expiredAt: row.expiredAt || null,
    respondedAt: row.respondedAt || null,
    transferredAt: row.transferredAt || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function formatLeadTransfer(row) {
  if (!row) return null;
  return {
    id: row.id,
    leadId: row.leadId,
    interestConfirmationId: row.interestConfirmationId || null,
    clientId: row.clientId,
    clientName: row.clientName || '',
    commercialId: row.commercialId,
    commercialName: row.commercialName || '',
    promoterId: row.promoterId || null,
    promoterName: row.promoterName || '',
    propertyId: row.propertyId || null,
    propertyTitle: row.propertyTitle || '',
    projectId: row.projectId || null,
    projectTitle: row.projectTitle || '',
    city: row.city || '',
    district: row.district || '',
    transferStatus: row.transferStatus || 'transmitted',
    transferReason: row.transferReason || '',
    notes: row.notes || '',
    transferredAt: row.transferredAt || row.createdAt,
    acknowledgedAt: row.acknowledgedAt || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function getLatestInterestConfirmationForLead(leadId) {
  if (!leadId) return null;
  const [rows] = await db.query(
    'SELECT * FROM interest_confirmations WHERE leadId = ? ORDER BY requestedAt DESC, createdAt DESC LIMIT 1',
    [leadId],
  );
  return rows.length ? formatInterestConfirmation(rows[0]) : null;
}

async function getLatestLeadTransferForLead(leadId) {
  if (!leadId) return null;
  const [rows] = await db.query(
    'SELECT * FROM lead_transfers WHERE leadId = ? ORDER BY transferredAt DESC, createdAt DESC LIMIT 1',
    [leadId],
  );
  return rows.length ? formatLeadTransfer(rows[0]) : null;
}

function computeInterestConfirmationExpiry(baseDate = new Date()) {
  const next = new Date(baseDate);
  next.setHours(next.getHours() + INTEREST_CONFIRMATION_DEADLINE_HOURS);
  return next;
}

async function expirePendingInterestConfirmations() {
  await db.query(
    `UPDATE interest_confirmations
     SET status = 'expired',
         expiredAt = NOW(),
         updatedAt = CURRENT_TIMESTAMP
     WHERE status = 'pending'
       AND expiresAt IS NOT NULL
       AND expiresAt < NOW()`,
  );
}

async function findLatestAppointmentForLead(lead, propertyId = null) {
  if (!lead?.clientId || !lead?.commercialId) return null;
  const params = [lead.clientId, lead.commercialId];
  let propertySql = '';
  if (propertyId) {
    propertySql = ' AND propertyId <=> ?';
    params.push(propertyId);
  }
  const [rows] = await db.query(
    `SELECT *
     FROM appointments
     WHERE clientId = ?
       AND commercialId = ?
       ${propertySql}
     ORDER BY dateTime DESC, createdAt DESC
     LIMIT 1`,
    params,
  );
  return rows[0] || null;
}

async function resolveLeadForAppointment(appointment) {
  if (!appointment?.clientId || !appointment?.commercialId) return null;

  const params = [appointment.clientId, appointment.commercialId];
  let extraSql = '';
  if (appointment.projectId) {
    extraSql = ' AND (projectId = ? OR projectId IS NULL)';
    params.push(appointment.projectId);
  }

  let [rows] = await db.query(
    `SELECT *
     FROM leads
     WHERE clientId = ?
       AND commercialId = ?
       ${extraSql}
     ORDER BY updatedAt DESC, createdAt DESC
     LIMIT 1`,
    params,
  );
  if (!rows.length) {
    [rows] = await db.query(
      `SELECT *
       FROM leads
       WHERE clientId = ?
         AND commercialId = ?
       ORDER BY updatedAt DESC, createdAt DESC
       LIMIT 1`,
      [appointment.clientId, appointment.commercialId],
    );
  }
  if (!rows.length) {
    [rows] = await db.query(
      `SELECT *
       FROM leads
       WHERE clientId = ?
       ORDER BY updatedAt DESC, createdAt DESC
       LIMIT 1`,
      [appointment.clientId],
    );
  }
  return rows[0] || null;
}

function sanitizeAppointmentNotes(description = '') {
  const lines = String(description || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const visibleLines = [];
  let hasRescheduleRequest = false;

  for (const line of lines) {
    if (/^\d{4}-\d{2}-\d{2}t/i.test(line) && /demande de report client/i.test(line)) {
      hasRescheduleRequest = true;
      continue;
    }
    visibleLines.push(line);
  }

  if (hasRescheduleRequest) {
    visibleLines.push('Le client a demande un autre creneau.');
  }

  return visibleLines.join('\n');
}

async function createLeadTransferFromConfirmation(confirmation, actor = null) {
  if (!confirmation?.id) return null;
  const [existingRows] = await db.query(
    'SELECT * FROM lead_transfers WHERE interestConfirmationId = ? LIMIT 1',
    [confirmation.id],
  );
  if (existingRows.length) return formatLeadTransfer(existingRows[0]);

  const id = randomUUID();
  await db.query(
    `INSERT INTO lead_transfers (
      id, leadId, interestConfirmationId, clientId, clientName, commercialId, commercialName,
      promoterId, promoterName, propertyId, propertyTitle, projectId, projectTitle,
      city, district, transferStatus, transferReason, notes, transferredAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      id,
      confirmation.leadId,
      confirmation.id,
      confirmation.clientId,
      confirmation.clientName || '',
      confirmation.commercialId,
      confirmation.commercialName || '',
      confirmation.promoterId || null,
      confirmation.promoterName || '',
      confirmation.propertyId || null,
      confirmation.propertyTitle || '',
      confirmation.projectId || null,
      confirmation.projectTitle || '',
      confirmation.city || '',
      confirmation.district || '',
      'transmitted',
      'client_confirmed_interest',
      actor?.notes || '',
    ],
  );

  await db.query(
    'UPDATE interest_confirmations SET transferredAt = NOW(), updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
    [confirmation.id],
  );

  const [rows] = await db.query('SELECT * FROM lead_transfers WHERE id = ? LIMIT 1', [id]);
  return rows.length ? formatLeadTransfer(rows[0]) : null;
}

async function resolvePromoterForLead(lead) {
  if (!lead) return { promoter: null, property: null };
  const property = await pickBestPropertyForLead(lead);
  if (!property) return { promoter: null, property: null };
  const promoter = await resolvePromoterForProperty(property);
  return { promoter, property };
}

async function isCommercialAssignedToPromoter(promoterId, commercialId) {
  if (!promoterId || !commercialId) return false;
  const [rows] = await db.query(
    'SELECT id FROM promoter_commercial_assignments WHERE promoterId = ? AND commercialId = ? LIMIT 1',
    [promoterId, commercialId],
  );
  return !!rows[0]?.id;
}

async function notifyPromoterForCommercialLeadAction(lead, status, actorName = 'Commercial') {
  if (!lead?.commercialId) return;
  const { promoter, property } = await resolvePromoterForLead(lead);
  if (!promoter?.id || !property?.id) return;
  const isAssigned = await isCommercialAssignedToPromoter(promoter.id, lead.commercialId);
  if (!isAssigned) return;

  const [clientRows] = await db.query('SELECT name FROM users WHERE id = ? LIMIT 1', [lead.clientId]);
  const clientName = clientRows[0]?.name || 'Client';
  const statusText = String(status || '');
  let title = 'Mise a jour commerciale';
  let body = `${actorName} a mis a jour le dossier ${clientName} sur "${property.title}".`;

  if (statusText === 'Contacté') {
    title = 'Lead contacte';
    body = `${actorName} a contacte ${clientName} pour "${property.title}".`;
  } else if (statusText === 'Visité') {
    title = 'Visite planifiee';
    body = `${actorName} a planifie une visite avec ${clientName} pour "${property.title}".`;
  }

  await notify(promoter.id, title, body, 'lead', lead.id);
}

async function getPropertyById(propertyId) {
  if (!propertyId) return null;
  const [rows] = await db.query('SELECT * FROM properties WHERE id = ? LIMIT 1', [propertyId]);
  return rows[0] || null;
}

async function notifyPromoterForProjectInterest(propertyId, actorName, actionLabel, targetId = null) {
  const property = await getPropertyById(propertyId);
  if (!property) return;
  const promoter = await resolvePromoterForProperty(property);
  if (!promoter?.id) return;
  await notify(
    promoter.id,
    'Interet sur votre projet',
    `${actorName} a ${actionLabel} le bien "${property.title}"${property.project ? ` du projet ${property.project}` : ''}.`,
    'match',
    targetId || property.id,
  );
}

async function notifyPromoterForAppointmentAction(appointment, formattedAppointment, title, body) {
  if (!appointment?.propertyId) return;
  const property = await getPropertyById(appointment.propertyId);
  if (!property) return;
  const promoter = await resolvePromoterForProperty(property);
  if (!promoter?.id) return;
  await notify(promoter.id, title, body || `Mise a jour visite sur "${formattedAppointment?.propertyTitle || property.title}".`, 'visit', appointment.id);
  emitUserRealtime(promoter.id, 'appointments:updated', { appointmentId: appointment.id, promoterId: promoter.id });
}

async function notifyPromoterForProjectUpdate(project, actorName = 'Admin', previousProject = null) {
  if (!project?.promoterId) return;

  const changes = [];
  if (previousProject) {
    if (String(previousProject.status || '') !== String(project.status || '')) changes.push(`statut: ${previousProject.status || '-'} -> ${project.status || '-'}`);
    if (Number(previousProject.completionPercent || 0) !== Number(project.completionPercent || 0)) changes.push(`avancement: ${Number(project.completionPercent || 0)}%`);
    if (Number(previousProject.availableUnits || 0) !== Number(project.availableUnits || 0)) changes.push(`disponibles: ${Number(project.availableUnits || 0)}`);
    if (Number(previousProject.soldUnits || 0) !== Number(project.soldUnits || 0)) changes.push(`vendues: ${Number(project.soldUnits || 0)}`);
  }

  const title = previousProject ? 'Projet mis a jour' : 'Nouveau projet';
  const body = previousProject
    ? `${actorName} a mis a jour votre projet "${project.name}".${changes.length ? ` Changements: ${changes.join(', ')}.` : ''}`
    : `${actorName} a ajoute le projet "${project.name}" a votre portefeuille.`;

  await notify(project.promoterId, title, body, 'system', project.id);
}

async function createPendingDealFromLead(leadId, overrides = {}) {
  const [existingDeals] = await db.query("SELECT * FROM deals WHERE leadId = ? AND status = 'En cours' ORDER BY createdAt DESC LIMIT 1", [leadId]);
  if (existingDeals.length) return formatDeal(existingDeals[0]);

  const [leadRows] = await db.query('SELECT * FROM leads WHERE id = ?', [leadId]);
  if (!leadRows.length) return null;
  const lead = leadRows[0];

  const property = overrides.propertyId
    ? (await db.query('SELECT * FROM properties WHERE id = ?', [overrides.propertyId]))[0][0]
    : await pickBestPropertyForLead(lead);
  if (!property) return null;

  const [clientRows] = await db.query('SELECT id, name FROM users WHERE id = ?', [lead.clientId]);
  if (!clientRows.length) return null;
  const client = clientRows[0];

  const [commercialRows] = lead.commercialId ? await db.query('SELECT id, name FROM users WHERE id = ?', [lead.commercialId]) : [[]];
  const commercial = commercialRows[0] || null;
  const promoter = await resolvePromoterForProperty(property);
  if (!promoter?.id) return null;

  const dealId = randomUUID();
  const salePrice = Math.max(0, Number(overrides.salePrice || property.priceRaw || 0));

  await db.query(
    `INSERT INTO deals (
      id, leadId, clientId, clientName, propertyId, propertyTitle, commercialId, commercialName,
      promoterId, promoterName, salePrice, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      dealId,
      lead.id,
      client.id,
      client.name,
      property.id,
      property.title,
      commercial?.id || null,
      commercial?.name || '',
      promoter.id,
      promoter.name,
      salePrice,
      'En cours',
    ],
  );

  const nextNotes = [lead.notes || '', `${new Date().toISOString()}: dossier passe en offre, validation promoteur en attente sur ${property.title}`]
    .filter(Boolean)
    .join('\n');
  await db.query('UPDATE leads SET notes = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [nextNotes, lead.id]);
  await db.query(
    "UPDATE lead_transfers SET transferStatus = 'deal_created', updatedAt = CURRENT_TIMESTAMP WHERE leadId = ?",
    [lead.id],
  );

  await notify(promoter.id, 'Validation requise', `Une vente sur "${property.title}" attend votre validation finale.`, 'offer', dealId);
  if (commercial?.id) {
    await notify(commercial.id, 'Validation promoteur requise', `Le dossier ${client.name} a ete transmis au promoteur pour validation.`, 'offer', dealId);
  }
  await logClientTimelineEvent({
    clientId: client.id,
    actorRole: 'commercial',
    actorName: commercial?.name || 'Commercial',
    actionType: 'offer_sent',
    description: `Une offre a ete envoyee pour ${property.title}. Validation promoteur en attente.`,
    targetId: dealId,
    metadata: { propertyId: property.id, propertyTitle: property.title, projectTitle: property.project || '' },
  });

  const [rows] = await db.query('SELECT * FROM deals WHERE id = ?', [dealId]);
  emitUserRealtime(client.id, 'deals:updated', { dealId, clientId: client.id });
  if (commercial?.id) emitUserRealtime(commercial.id, 'deals:updated', { dealId, commercialId: commercial.id });
  emitUserRealtime(promoter.id, 'deals:updated', { dealId, promoterId: promoter.id });
  return rows.length ? formatDeal(rows[0]) : null;
}

async function validateDealByPromoter(dealId, user) {
  const [dealRows] = await db.query('SELECT * FROM deals WHERE id = ?', [dealId]);
  if (!dealRows.length) return { error: 'Deal not found', status: 404 };

  const deal = dealRows[0];
  if (user.role === 'promoter' && deal.promoterId !== user.userId) return { error: 'Access denied', status: 403 };
  if (deal.status === 'Sign\\u00E9') return { error: 'Deal already validated', status: 400 };
  if (['Annul\u00E9', 'Annule', 'Annul\\u00E9'].includes(deal.status)) return { error: 'Cancelled deal cannot be validated', status: 400 };

  await db.query(
    `UPDATE deals
     SET status = 'Sign\\u00E9', promoterValidatedAt = NOW(), promoterValidatedBy = ?, commissionTriggeredAt = NOW(), updatedAt = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [user.userId, dealId],
  );

  const [leadRows] = await db.query('SELECT notes FROM leads WHERE id = ?', [deal.leadId]);
  const leadNotes = leadRows[0]?.notes || '';
  const nextLeadNotes = [leadNotes, `${new Date().toISOString()}: vente validee par le promoteur`].filter(Boolean).join('\n');
  await db.query("UPDATE leads SET status = 'converted', notes = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?", [nextLeadNotes, deal.leadId]);

  const [commissionRows] = await db.query('SELECT id FROM commissions WHERE dealId = ?', [dealId]);
  if (!commissionRows.length) {
    const rate = 2;
    const amount = Math.round((Number(deal.salePrice || 0) * rate) / 100);
    await db.query(
      `INSERT INTO commissions (
        id, dealId, commercialId, commercialName, promoterId, propertyId, propertyTitle, clientName, salePrice, rate, amount, status, dueDate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        dealId,
        deal.commercialId || null,
        deal.commercialName || '',
        deal.promoterId || null,
        deal.propertyId || null,
        deal.propertyTitle || '',
        deal.clientName || '',
        Number(deal.salePrice || 0),
        rate,
        amount,
        'En attente',
        addDays(new Date(), 30),
      ],
    );
  }

  if (deal.propertyId) {
    await db.query("UPDATE properties SET availability = 'Vendu', updatedAt = CURRENT_TIMESTAMP WHERE id = ?", [deal.propertyId]);
    await db.query(
      `UPDATE projects
       SET soldUnits = soldUnits + 1,
           availableUnits = GREATEST(0, availableUnits - 1),
           updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [deal.propertyId],
    );
  }

  if (deal.commercialId) {
    await notify(deal.commercialId, 'Vente validee', `Le promoteur a valide la vente pour "${deal.propertyTitle}". Commission declenchee.`, 'offer', dealId);
  }
  if (deal.promoterId) {
    await notify(deal.promoterId, 'Vente finalisee', `La vente pour "${deal.propertyTitle}" est enregistree et la commission est declenchee.`, 'offer', dealId);
  }
  if (deal.clientId) {
    await logClientTimelineEvent({
      clientId: deal.clientId,
      actorRole: user.role,
      actorName: user.name,
      actionType: 'offer_validated',
      description: `Le promoteur a valide l'offre pour ${deal.propertyTitle}.`,
      targetId: dealId,
      metadata: { propertyId: deal.propertyId || null, propertyTitle: deal.propertyTitle, promoterName: deal.promoterName || user.name },
    });
  }

  const [rows] = await db.query('SELECT * FROM deals WHERE id = ?', [dealId]);
  if (deal.clientId) emitUserRealtime(deal.clientId, 'deals:updated', { dealId, clientId: deal.clientId });
  if (deal.commercialId) emitUserRealtime(deal.commercialId, 'deals:updated', { dealId, commercialId: deal.commercialId });
  if (deal.promoterId) emitUserRealtime(deal.promoterId, 'deals:updated', { dealId, promoterId: deal.promoterId });
  return { deal: rows.length ? formatDeal(rows[0]) : null };
}

async function openLeadConversation(leadId, senderId, customMessage = '') {
  const [leadRows] = await db.query('SELECT * FROM leads WHERE id = ?', [leadId]);
  if (!leadRows.length) return null;
  const lead = leadRows[0];
  if (!lead.clientId || !lead.commercialId) return null;

  const property = await pickBestPropertyForLead(lead);
  const conversationId = await ensureConversationBetweenUsers(
    [lead.clientId, lead.commercialId],
    property?.id || lead.projectId || null,
    property?.title || null,
  );

  const [clientRows] = await db.query('SELECT name FROM users WHERE id = ?', [lead.clientId]);
  const clientName = clientRows[0]?.name || 'Client';
  const intro = customMessage || `Conversation ouverte pour suivre le dossier de ${clientName}.`;
  await seedConversationMessage(conversationId, senderId || lead.commercialId, intro);
  return conversationId;
}

function isVisitedLeadStatus(status) {
  return typeof status === 'string' && status.toLowerCase().includes('visit');
}

async function scheduleVisitForLead(leadId, userId, requestedDateTime = null) {
  const [leadRows] = await db.query('SELECT * FROM leads WHERE id = ?', [leadId]);
  if (!leadRows.length) return null;
  const lead = leadRows[0];
  if (!lead.clientId || !lead.commercialId) return null;

  const property = await pickBestPropertyForLead(lead);
  const [clientRows] = await db.query('SELECT id, name FROM users WHERE id = ?', [lead.clientId]);
  if (!clientRows.length) return null;
  const client = clientRows[0];

  const activeStatuses = appointmentStatusList(['scheduled', 'confirmed']);
  const [[existing]] = await db.query(
    `SELECT id, dateTime
     FROM appointments
     WHERE clientId = ?
       AND commercialId = ?
       AND propertyId <=> ?
       AND status IN (${activeStatuses.map(() => '?').join(', ')})
     ORDER BY createdAt DESC
     LIMIT 1`,
    [lead.clientId, lead.commercialId, property?.id || null, ...activeStatuses],
  );
  const safeVisitSideEffects = async (appointmentId, formattedDate, formattedTime) => {
    try {
      await notify(lead.clientId, 'Visite mise a jour', `Votre visite est prevue le ${formattedDate} a ${formattedTime}.`, 'visit', appointmentId);
      await notify(lead.commercialId, 'Visite mise a jour', `La visite de ${client.name} est planifiee le ${formattedDate} a ${formattedTime}.`, 'visit', appointmentId);
      await logClientTimelineEvent({
        clientId: lead.clientId,
        actorRole: 'commercial',
        actorName: (await getUserById(lead.commercialId))?.name || 'Commercial',
        actionType: 'visit_scheduled',
        description: `Une visite a ete planifiee pour ${property?.title || 'votre bien'} le ${formattedDate} a ${formattedTime}.`,
        targetId: appointmentId,
        metadata: { propertyId: property?.id || null, propertyTitle: property?.title || '', projectTitle: property?.project || '' },
      });

      const conversationId = await openLeadConversation(leadId, userId, `Visite planifiee le ${formattedDate} a ${formattedTime}.`);
      if (conversationId) {
        await notify(lead.clientId, 'Message de suivi', 'Le detail de votre visite est disponible dans Messages.', 'message', conversationId);
      }
    } catch (error) {
      console.error('scheduleVisitForLead side effects failed:', error?.message || error);
    }
  };
  if (existing?.id) {
    if (requestedDateTime) {
      const visitDate = new Date(requestedDateTime);
      if (!Number.isNaN(visitDate.getTime())) {
        const formattedDate = visitDate.toLocaleDateString('fr-FR');
        const formattedTime = visitDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const title = property?.title ? `Visite - ${property.title}` : 'Visite';
        const description = property?.title
          ? `Visite planifiee pour ${client.name} sur ${property.title}.`
          : `Visite planifiee pour ${client.name}.`;
        const scheduledStatus = await resolveAppointmentStorageStatus('scheduled');

        await db.query(
          'UPDATE appointments SET propertyId = ?, projectId = ?, promoterId = ?, city = ?, district = ?, title = ?, description = ?, dateTime = ?, status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
          [property?.id || null, property?.projectId || property?.id || lead.projectId || null, property?.promoterId || lead.promoterId || null, property?.city || lead.city || null, property?.district || lead.district || null, title, description, visitDate, scheduledStatus, existing.id],
        );

        await safeVisitSideEffects(existing.id, formattedDate, formattedTime);
      }
    }
    emitUserRealtime(lead.clientId, 'appointments:updated', { appointmentId: existing.id, clientId: lead.clientId });
    emitUserRealtime(lead.commercialId, 'appointments:updated', { appointmentId: existing.id, commercialId: lead.commercialId });
    emitUserRealtime(lead.clientId, 'leads:updated', { leadId });
    emitUserRealtime(lead.commercialId, 'leads:updated', { leadId });
    return { appointmentId: existing.id, wasCreated: false, clientId: lead.clientId };
  }
  const visitDate = requestedDateTime ? new Date(requestedDateTime) : new Date();
  if (!requestedDateTime) {
    visitDate.setDate(visitDate.getDate() + 1);
    visitDate.setHours(11, 0, 0, 0);
  }
  if (Number.isNaN(visitDate.getTime())) return null;

  const appointmentId = randomUUID();
  const title = property?.title ? `Visite - ${property.title}` : 'Visite';
  const description = property?.title
    ? `Visite planifiee pour ${client.name} sur ${property.title}.`
    : `Visite planifiee pour ${client.name}.`;

  const scheduledStatus = await resolveAppointmentStorageStatus('scheduled');
  await db.query(
    'INSERT INTO appointments (id, clientId, commercialId, propertyId, projectId, promoterId, city, district, title, description, dateTime, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [appointmentId, lead.clientId, lead.commercialId, property?.id || null, property?.projectId || property?.id || lead.projectId || null, property?.promoterId || lead.promoterId || null, property?.city || lead.city || null, property?.district || lead.district || null, title, description, visitDate, scheduledStatus],
  );

  const formattedDate = visitDate.toLocaleDateString('fr-FR');
  const formattedTime = visitDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  await safeVisitSideEffects(appointmentId, formattedDate, formattedTime);

  emitUserRealtime(lead.clientId, 'appointments:updated', { appointmentId, clientId: lead.clientId });
  emitUserRealtime(lead.commercialId, 'appointments:updated', { appointmentId, commercialId: lead.commercialId });
  emitUserRealtime(lead.clientId, 'leads:updated', { leadId });
  emitUserRealtime(lead.commercialId, 'leads:updated', { leadId });

  return { appointmentId, wasCreated: true, clientId: lead.clientId };
}

async function ensureLeadForClientInterest(clientId, propertyId, actionLabel) {
  const [propertyRows] = await db.query('SELECT * FROM properties WHERE id = ?', [propertyId]);
  if (!propertyRows.length) return null;
  const property = formatProperty(propertyRows[0]);

  const [clientRows] = await db.query('SELECT id, name, email, phone FROM users WHERE id = ?', [clientId]);
  if (!clientRows.length) return null;
  const client = clientRows[0];

  const [leadRows] = await db.query('SELECT * FROM leads WHERE clientId = ? ORDER BY createdAt DESC LIMIT 1', [clientId]);
  const [promoterRows] = property.promoterId ? await db.query('SELECT id, name FROM users WHERE id = ?', [property.promoterId]) : [[]];
  const promoter = promoterRows[0] || null;

  if (leadRows.length) {
    const lead = leadRows[0];
    let commercialId = lead.commercialId || null;
    if (!commercialId) {
      commercialId = await pickCommercialForLead(promoter?.id || property.promoterId || null, property.projectId || property.id || null);
      if (commercialId) {
        await db.query('UPDATE leads SET commercialId = ?, promoterId = ?, projectId = ?, city = ?, district = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [commercialId, promoter?.id || property.promoterId || null, property.projectId || property.id || null, property.city || null, property.district || null, lead.id]);
      }
    }

    const nextNotes = [lead.notes || '', `${new Date().toISOString()}: ${actionLabel} sur ${property.title}`]
      .filter(Boolean)
      .join('\n');
    await db.query(
      "UPDATE leads SET notes = ?, promoterId = ?, projectId = ?, city = ?, district = ?, source = CASE WHEN source = 'questionnaire' THEN 'matching' ELSE source END, updatedAt = CURRENT_TIMESTAMP WHERE id = ?",
      [nextNotes, promoter?.id || property.promoterId || null, property.projectId || property.id || null, property.city || null, property.district || null, lead.id],
    );

    if (commercialId) {
      await notify(commercialId, 'Interaction client', `${client.name} a ${actionLabel.toLowerCase()} "${property.title}".`, 'lead', lead.id);
      const conversationId = await ensureConversationBetweenUsers([clientId, commercialId], property.id, property.title);
      await notify(commercialId, 'Boite de reception activee', `La conversation avec ${client.name} est prete dans Messages.`, 'message', conversationId);
      if (promoter?.id) {
        await notify(promoter.id, 'Interet client', `${client.name} a ${actionLabel.toLowerCase()} "${property.title}".`, 'match', lead.id);
      }
      return { leadId: lead.id, commercialId, promoterId: promoter?.id || null, conversationId };
    }
    if (promoter?.id) {
      await notify(promoter.id, 'Interet client', `${client.name} a ${actionLabel.toLowerCase()} "${property.title}".`, 'match', lead.id);
    }

    return { leadId: lead.id, commercialId, promoterId: promoter?.id || null, conversationId: null };
  }

  const commercialId = await pickCommercialForLead(promoter?.id || property.promoterId || null, property.projectId || property.id || null);
  const fullName = String(client.name || '').trim();
  const [firstName, ...rest] = fullName.split(' ');
  const answers = {
    firstName: firstName || fullName || 'Client',
    lastName: rest.join(' '),
    phone: client.phone || '',
    email: client.email || '',
    password: '',
    city: property.city || '',
    isMRE: false,
    propertyType: property.type || '',
    objective: 'Habiter',
    targetZone: property.district || '',
    budget: property.price || money(property.priceRaw),
    budgetRaw: Number(property.priceRaw || 0),
    downPayment: '0 MAD',
    downPaymentRaw: 0,
    financing: 'Mixte',
    purchaseDeadline: '3 mois',
    desiredArea: property.area || '',
    desiredAreaRaw: Number(property.areaRaw || 0),
    rooms: Number(property.rooms || 0),
    mustHave: property.highlights || [],
    tolerances: [],
    consent: true,
    contactWhatsApp: true,
  };
  const score = leadScore(answers);
  const temperature = leadTemp(score);
  const leadId = randomUUID();
  const notes = `${new Date().toISOString()}: ${actionLabel} sur ${property.title}`;

  await db.query(
    'INSERT INTO leads (id, clientId, answers, status, notes, commercialId, promoterId, projectId, city, district, source, score, temperature) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [leadId, clientId, JSON.stringify(answers), 'new', notes, commercialId, promoter?.id || property.promoterId || null, property.projectId || property.id || null, property.city || null, property.district || null, 'matching', score, temperature],
  );

  if (commercialId) {
    await notify(commercialId, 'Nouveau lead interesse', `${client.name} a ${actionLabel.toLowerCase()} "${property.title}".`, 'lead', leadId);
    const conversationId = await ensureConversationBetweenUsers([clientId, commercialId], property.id, property.title);
    await notify(commercialId, 'Boite de reception activee', `La conversation avec ${client.name} est prete dans Messages.`, 'message', conversationId);
    if (promoter?.id) {
      await notify(promoter.id, 'Interet client', `${client.name} a ${actionLabel.toLowerCase()} "${property.title}".`, 'match', leadId);
    }
    return { leadId, commercialId, promoterId: promoter?.id || null, conversationId };
  }
  if (promoter?.id) {
    await notify(promoter.id, 'Interet client', `${client.name} a ${actionLabel.toLowerCase()} "${property.title}".`, 'match', leadId);
  }

  return { leadId, commercialId, promoterId: promoter?.id || null, conversationId: null };
}

function normalizeProjectPayload(body = {}) {
  const totalUnits = Math.max(0, toInt(body.totalUnits));
  const soldUnits = Math.max(0, toInt(body.soldUnits));
  const reservedUnits = Math.max(0, toInt(body.reservedUnits));
  const image = String(body.image || '').trim();
  const availableUnits = body.availableUnits === undefined || body.availableUnits === null || body.availableUnits === ''
    ? Math.max(0, totalUnits - soldUnits - reservedUnits)
    : Math.max(0, toInt(body.availableUnits));
  const completionPercent = totalUnits > 0
    ? Math.min(100, Math.round(((soldUnits + reservedUnits) / totalUnits) * 100))
    : 0;

  return {
    name: String(body.name || '').trim(),
    promoterId: body.promoterId ? String(body.promoterId).trim() : null,
    commercialId: body.commercialId ? String(body.commercialId).trim() : null,
    city: String(body.city || '').trim(),
    district: String(body.district || '').trim(),
    type: String(body.type || '').trim() || 'Appartement',
    description: String(body.description || '').trim(),
    image,
    images: Array.isArray(body.images) ? body.images.map((item) => String(item || '').trim()).filter(Boolean) : [],
    features: Array.isArray(body.features) ? body.features.map((item) => String(item || '').trim()).filter(Boolean) : [],
    specs: body.specs && typeof body.specs === 'object' ? body.specs : {},
    units: Array.isArray(body.units) ? body.units : [],
    isActive: body.isActive == null ? true : !!body.isActive,
    visibleInMatching: body.visibleInMatching == null ? true : !!body.visibleInMatching,
    status: String(body.status || '').trim() || 'En construction',
    totalUnits,
    availableUnits,
    reservedUnits,
    soldUnits,
    minPriceRaw: Math.max(0, toInt(body.minPriceRaw)),
    maxPriceRaw: Math.max(0, toInt(body.maxPriceRaw)),
    areaFromRaw: Math.max(0, toInt(body.areaFromRaw)),
    areaToRaw: Math.max(0, toInt(body.areaToRaw)),
    bedroomsFrom: Math.max(0, toInt(body.bedroomsFrom)),
    bedroomsTo: Math.max(0, toInt(body.bedroomsTo)),
    viewLabel: String(body.viewLabel || '').trim(),
    delivery: String(body.delivery || '').trim(),
    completionPercent,
  };
}

function validateProjectPayload(payload) {
  if (!payload.name || !payload.city || !payload.district) return 'Missing required project fields';
  if (payload.maxPriceRaw > 0 && payload.minPriceRaw > payload.maxPriceRaw) return 'Invalid project prices';
  if (payload.areaToRaw > 0 && payload.areaFromRaw > payload.areaToRaw) return 'Invalid project areas';
  if (payload.bedroomsTo > 0 && payload.bedroomsFrom > payload.bedroomsTo) return 'Invalid bedroom range';
  if (payload.totalUnits > 0 && payload.availableUnits + payload.reservedUnits + payload.soldUnits > payload.totalUnits) {
    return 'Units exceed total units';
  }
  return null;
}

function normalizeProjectUnitId(projectId, rawId, fallbackSeed = 'default') {
  const candidate = String(rawId || '').trim();
  if (candidate && candidate.length <= 36) return candidate;

  const projectSeed = String(projectId || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 20) || 'projectunit';
  const hash = createHash('sha1')
    .update(`${projectId || ''}:${candidate || fallbackSeed}`)
    .digest('hex')
    .slice(0, 15);
  return `${projectSeed}-${hash}`.slice(0, 36);
}

function normalizeProjectUnitsPayload(projectId, payload) {
  const rawUnits = Array.isArray(payload.units) ? payload.units : [];
  const sharedImages = payload.images.length ? payload.images : (payload.image ? [payload.image] : []);
  const sharedHighlights = payload.features || [];
  const sharedCommercialId = payload.commercialId || null;
  const sharedSpecs = payload.specs && typeof payload.specs === 'object' ? payload.specs : {};

  const normalizedUnits = rawUnits
    .map((item, index) => ({
      id: normalizeProjectUnitId(projectId, item?.id, `unit-${index + 1}`),
      projectId,
      promoterId: payload.promoterId,
      commercialId: item?.commercialId ? String(item.commercialId).trim() : sharedCommercialId,
      label: String(item?.label || item?.title || `Unite ${index + 1}`).trim(),
      unitType: String(item?.unitType || item?.type || payload.type || 'Appartement').trim(),
      priceRaw: Math.max(0, toInt(item?.priceRaw ?? item?.price)),
      areaRaw: Math.max(0, toInt(item?.areaRaw ?? item?.area)),
      bedrooms: Math.max(0, toInt(item?.bedrooms ?? item?.rooms)),
      bathrooms: Math.max(0, toInt(item?.bathrooms)),
      floor: Math.max(0, toInt(item?.floor)),
      availability: String(item?.availability || 'Disponible').trim() || 'Disponible',
      isActive: item?.isActive == null ? payload.isActive : !!item.isActive,
      visibleInMatching: item?.visibleInMatching == null ? payload.visibleInMatching : !!item.visibleInMatching,
      referenceCode: String(item?.referenceCode || item?.reference || `UNT-${projectId.slice(0, 6).toUpperCase()}-${index + 1}`).trim(),
      image: String(item?.image || payload.image || '').trim(),
      images: Array.isArray(item?.images) ? item.images.map((entry) => String(entry || '').trim()).filter(Boolean) : sharedImages,
      highlights: Array.isArray(item?.highlights) ? item.highlights.map((entry) => String(entry || '').trim()).filter(Boolean) : sharedHighlights,
      specs: item?.specs && typeof item.specs === 'object' ? item.specs : sharedSpecs,
      description: String(item?.description || payload.description || '').trim(),
    }))
    .filter((item) => item.label);

  if (normalizedUnits.length) return normalizedUnits;

  return [{
    id: normalizeProjectUnitId(projectId, null, 'default'),
    projectId,
    promoterId: payload.promoterId,
    commercialId: sharedCommercialId,
    label: payload.name,
    unitType: payload.type || 'Appartement',
    priceRaw: Math.max(0, Number(payload.minPriceRaw || payload.maxPriceRaw || 0)),
    areaRaw: Math.max(0, Number(payload.areaFromRaw || payload.areaToRaw || 0)),
    bedrooms: Math.max(0, Number(payload.bedroomsFrom || payload.bedroomsTo || 0)),
    bathrooms: 0,
    floor: 0,
    availability: payload.isActive && Number(payload.availableUnits || payload.totalUnits || 0) > 0 ? 'Disponible' : 'Reserve',
    isActive: payload.isActive,
    visibleInMatching: payload.visibleInMatching,
    referenceCode: `UNT-${projectId.slice(0, 8).toUpperCase()}`,
    image: payload.image || '',
    images: sharedImages,
    highlights: sharedHighlights,
    specs: sharedSpecs,
    description: payload.description || '',
  }];
}

async function listProjectUnits(projectId) {
  const [rows] = await db.query('SELECT * FROM project_units WHERE projectId = ? ORDER BY createdAt ASC, id ASC', [projectId]);
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    unitType: row.unitType || 'Appartement',
    priceRaw: Number(row.priceRaw || 0),
    areaRaw: Number(row.areaRaw || 0),
    bedrooms: Number(row.bedrooms || 0),
    bathrooms: Number(row.bathrooms || 0),
    floor: Number(row.floor || 0),
    availability: row.availability || 'Disponible',
    isActive: row.isActive == null ? true : !!row.isActive,
    visibleInMatching: row.visibleInMatching == null ? true : !!row.visibleInMatching,
    referenceCode: row.referenceCode || '',
    image: row.image || '',
    images: parseJson(row.images, row.image ? [row.image] : []),
    highlights: parseJson(row.highlights, []),
    specs: parseJson(row.specsJson, {}),
    description: row.description || '',
    commercialId: row.commercialId || '',
  }));
}

async function syncProjectUnits(projectId, payload) {
  const normalizedUnits = normalizeProjectUnitsPayload(projectId, payload);
  const incomingIds = normalizedUnits.map((item) => item.id);

  for (const unit of normalizedUnits) {
    await db.query(
      `INSERT INTO project_units (
        id, projectId, promoterId, commercialId, label, unitType, priceRaw, areaRaw, bedrooms, bathrooms, floor, availability, isActive, visibleInMatching, referenceCode, image, images, highlights, specsJson, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        promoterId = VALUES(promoterId),
        commercialId = VALUES(commercialId),
        label = VALUES(label),
        unitType = VALUES(unitType),
        priceRaw = VALUES(priceRaw),
        areaRaw = VALUES(areaRaw),
        bedrooms = VALUES(bedrooms),
        bathrooms = VALUES(bathrooms),
        floor = VALUES(floor),
        availability = VALUES(availability),
        isActive = VALUES(isActive),
        visibleInMatching = VALUES(visibleInMatching),
        referenceCode = VALUES(referenceCode),
        image = VALUES(image),
        images = VALUES(images),
        highlights = VALUES(highlights),
        specsJson = VALUES(specsJson),
        description = VALUES(description),
        updatedAt = CURRENT_TIMESTAMP`,
      [
        unit.id,
        unit.projectId,
        unit.promoterId,
        unit.commercialId,
        unit.label,
        unit.unitType,
        unit.priceRaw,
        unit.areaRaw,
        unit.bedrooms,
        unit.bathrooms,
        unit.floor,
        unit.availability,
        Number(!!unit.isActive),
        Number(!!unit.visibleInMatching),
        unit.referenceCode,
        unit.image,
        JSON.stringify(unit.images),
        JSON.stringify(unit.highlights),
        JSON.stringify(unit.specs || {}),
        unit.description,
      ],
    );
  }

  const [existingRows] = await db.query('SELECT id FROM project_units WHERE projectId = ?', [projectId]);
  const idsToDelete = existingRows
    .map((row) => row.id)
    .filter((id) => !incomingIds.includes(id));

  for (const id of idsToDelete) {
    await db.query('DELETE FROM project_units WHERE id = ?', [id]);
  }
}

async function reassignPropertyReferences(oldPropertyId, nextPropertyId) {
  if (!oldPropertyId || !nextPropertyId || oldPropertyId === nextPropertyId) return;
  await db.query('UPDATE appointments SET propertyId = ?, updatedAt = CURRENT_TIMESTAMP WHERE propertyId = ?', [nextPropertyId, oldPropertyId]);
  await db.query('UPDATE deals SET propertyId = ?, updatedAt = CURRENT_TIMESTAMP WHERE propertyId = ?', [nextPropertyId, oldPropertyId]);
  await db.query('UPDATE conversations SET relatedPropertyId = ?, updatedAt = CURRENT_TIMESTAMP WHERE relatedPropertyId = ?', [nextPropertyId, oldPropertyId]);
  await db.query('UPDATE interest_confirmations SET propertyId = ?, updatedAt = CURRENT_TIMESTAMP WHERE propertyId = ?', [nextPropertyId, oldPropertyId]);
  await db.query('UPDATE lead_transfers SET propertyId = ?, updatedAt = CURRENT_TIMESTAMP WHERE propertyId = ?', [nextPropertyId, oldPropertyId]);
}

async function syncProjectAsProperty(projectId) {
  const [rows] = await db.query('SELECT * FROM projects WHERE id = ?', [projectId]);
  if (!rows.length) return;
  const project = rows[0];
  const features = parseJson(project.features, []);
  const projectSpecs = parseJson(project.specsJson, {});
  const units = await listProjectUnits(projectId);
  const incomingPropertyIds = [];

  for (const unit of units) {
    const propertyId = unit.id;
    incomingPropertyIds.push(propertyId);
    const propertyPayload = [
      `${project.name}${unit.label && unit.label !== project.name ? ` - ${unit.label}` : ''}`,
      project.name,
      project.id,
      project.promoterName || '',
      project.promoterId || null,
      unit.commercialId || project.commercialId || null,
      unit.commercialId ? ((await getUserById(unit.commercialId))?.name || '') : (project.commercialName || ''),
      project.status || '',
      unit.visibleInMatching == null ? 1 : Number(!!unit.visibleInMatching),
      unit.isActive == null ? 1 : Number(!!unit.isActive),
      unit.unitType || project.type || 'Appartement',
      project.city || '',
      project.district || '',
      Number(unit.priceRaw || 0),
      Math.max(0, Number(unit.areaRaw || 0)),
      Math.max(0, Number(unit.bedrooms || 0)),
      Math.max(0, Number(unit.floor || 0)),
      unit.description || project.description || '',
      JSON.stringify([
        project.status || 'En construction',
        project.delivery || 'Disponibilite a confirmer',
        project.viewLabel || '',
        ...(unit.highlights || []),
        ...features,
      ].filter(Boolean)),
      JSON.stringify(units.map((item) => ({
        id: item.id,
        label: item.label,
        priceRaw: item.priceRaw,
        areaRaw: item.areaRaw,
        bedrooms: item.bedrooms,
        bathrooms: item.bathrooms,
        available: ['Disponible', 'Reserve', 'Réservé'].includes(item.availability),
      }))),
      JSON.stringify({ ...projectSpecs, ...(unit.specs || {}), propertyTypes: [unit.unitType || project.type || 'Appartement'] }),
      unit.image || project.image || '',
      JSON.stringify(unit.images?.length ? unit.images : parseJson(project.images, project.image ? [project.image] : [])),
      unit.availability || 'Disponible',
      0,
      Math.max(70, Number(project.completionPercent || 0)),
      Number(project.completionPercent || 0) >= 80 ? 'Top Match' : 'Excellent Match',
      project.delivery || '',
      unit.referenceCode || `UNT-${unit.id.slice(0, 8).toUpperCase()}`,
    ];

    const [existing] = await db.query('SELECT id FROM properties WHERE id = ?', [propertyId]);
    if (existing.length) {
      await db.query(
        `UPDATE properties
         SET title = ?, project = ?, projectId = ?, promoter = ?, promoterId = ?, commercialId = ?, commercialName = ?, projectStatus = ?, visibleInMatching = ?, isActive = ?, type = ?, city = ?, district = ?,
             priceRaw = ?, areaRaw = ?, rooms = ?, floor = ?, description = ?, highlights = ?, optionsJson = ?, specsJson = ?,
             image = ?, images = ?, availability = ?, monthlyEstimateRaw = ?, score = ?, badge = ?, delivery = ?,
             referenceCode = ?, updatedAt = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [...propertyPayload, propertyId],
      );
    } else {
      await db.query(
        `INSERT INTO properties (
          id, title, project, projectId, promoter, promoterId, commercialId, commercialName, projectStatus, visibleInMatching, isActive, type, city, district, priceRaw, areaRaw, rooms, floor,
          description, highlights, optionsJson, specsJson, image, images, availability, monthlyEstimateRaw, score, badge,
          delivery, referenceCode
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [propertyId, ...propertyPayload],
      );
    }
  }

  const [existingProjectProperties] = await db.query('SELECT id FROM properties WHERE projectId = ? OR id = ?', [projectId, projectId]);
  const replacementPropertyId = incomingPropertyIds[0] || null;
  for (const row of existingProjectProperties) {
    if (!incomingPropertyIds.includes(row.id)) {
      if (replacementPropertyId) {
        await reassignPropertyReferences(row.id, replacementPropertyId);
      }
      await db.query('DELETE FROM favorites WHERE propertyId = ?', [row.id]);
      await db.query('DELETE FROM swipes WHERE propertyId = ?', [row.id]);
      await db.query('DELETE FROM client_project_actions WHERE propertyId = ?', [row.id]);
      await db.query('DELETE FROM matches WHERE propertyId = ?', [row.id]);
      await db.query('DELETE FROM properties WHERE id = ?', [row.id]);
    }
  }
}

async function deleteProjectProperty(projectId) {
  const [rows] = await db.query('SELECT id FROM properties WHERE projectId = ? OR id = ?', [projectId, projectId]);
  for (const row of rows) {
    await db.query('DELETE FROM client_project_actions WHERE propertyId = ?', [row.id]);
    await db.query('DELETE FROM matches WHERE propertyId = ?', [row.id]);
    await db.query('DELETE FROM interest_confirmations WHERE propertyId = ?', [row.id]);
    await db.query('DELETE FROM lead_transfers WHERE propertyId = ?', [row.id]);
    await db.query('DELETE FROM favorites WHERE propertyId = ?', [row.id]);
    await db.query('DELETE FROM swipes WHERE propertyId = ?', [row.id]);
    await db.query('DELETE FROM properties WHERE id = ?', [row.id]);
  }
  await db.query('DELETE FROM interest_confirmations WHERE projectId = ?', [projectId]);
  await db.query('DELETE FROM lead_transfers WHERE projectId = ?', [projectId]);
  await db.query('DELETE FROM project_units WHERE projectId = ?', [projectId]);
}

async function backfillProjectProperties() {
  const [projects] = await db.query('SELECT * FROM projects');
  for (const project of projects) {
    await syncProjectUnits(project.id, normalizeProjectPayload({
      ...project,
      images: parseJson(project.images, []),
      features: parseJson(project.features, []),
      units: parseJson(project.unitsJson, []),
    }));
    await syncProjectAsProperty(project.id);
  }
}

async function columnExists(tableName, columnName) {
  const [rows] = await db.query(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName],
  );
  return rows.length > 0;
}

async function ensureColumn(tableName, columnName, definition) {
  if (await columnExists(tableName, columnName)) return;
  await db.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
}

async function indexExists(tableName, indexName) {
  const [rows] = await db.query(
    `SELECT 1
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND INDEX_NAME = ?
     LIMIT 1`,
    [tableName, indexName],
  );
  return rows.length > 0;
}

async function dropIndexIfExists(tableName, indexName) {
  if (!(await indexExists(tableName, indexName))) return;
  await db.query(`ALTER TABLE \`${tableName}\` DROP INDEX \`${indexName}\``);
}

async function ensureIndex(tableName, indexName, definition) {
  if (await indexExists(tableName, indexName)) return;
  await db.query(`ALTER TABLE \`${tableName}\` ADD ${definition}`);
}

async function createTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (id VARCHAR(36) PRIMARY KEY, name VARCHAR(255) NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, phone VARCHAR(30), password VARCHAR(255) NOT NULL, role ENUM('client','commercial','admin','promoter') DEFAULT 'client', adminRole VARCHAR(32) NULL, accountStatus VARCHAR(16) DEFAULT 'active', accountValidationStatus VARCHAR(24) DEFAULT 'draft', accessScope JSON NULL, permissions JSON NULL, hasCompletedQuestionnaire BOOLEAN DEFAULT FALSE, avatar VARCHAR(255), expoPushToken VARCHAR(255) NULL, pushTokenUpdatedAt DATETIME NULL, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS properties (id VARCHAR(36) PRIMARY KEY, title VARCHAR(255) NOT NULL, project VARCHAR(255), promoter VARCHAR(255), promoterId VARCHAR(36), commercialId VARCHAR(36) NULL, commercialName VARCHAR(255) NULL, projectStatus VARCHAR(100) NULL, visibleInMatching BOOLEAN DEFAULT TRUE, isActive BOOLEAN DEFAULT TRUE, type VARCHAR(100), city VARCHAR(255), district VARCHAR(255), priceRaw INT DEFAULT 0, areaRaw INT DEFAULT 0, rooms INT DEFAULT 0, floor INT DEFAULT 0, description TEXT, highlights JSON, optionsJson JSON, specsJson JSON NULL, image VARCHAR(500), images JSON, availability VARCHAR(50) DEFAULT 'Disponible', monthlyEstimateRaw INT DEFAULT 0, score INT DEFAULT 80, badge VARCHAR(50) DEFAULT 'Bon potentiel', delivery VARCHAR(100), referenceCode VARCHAR(100), createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS leads (id VARCHAR(36) PRIMARY KEY, clientId VARCHAR(36) NOT NULL, answers JSON, status VARCHAR(32) DEFAULT 'new', notes TEXT, commercialId VARCHAR(36), promoterId VARCHAR(36) NULL, projectId VARCHAR(36) NULL, city VARCHAR(255) NULL, district VARCHAR(255) NULL, source VARCHAR(32) DEFAULT 'questionnaire', score INT DEFAULT 0, temperature VARCHAR(16) DEFAULT 'warm', createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS favorites (id VARCHAR(36) PRIMARY KEY, userId VARCHAR(36) NOT NULL, propertyId VARCHAR(36) NOT NULL, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uniq_favorite (userId, propertyId));
    CREATE TABLE IF NOT EXISTS swipes (id VARCHAR(36) PRIMARY KEY, userId VARCHAR(36) NOT NULL, propertyId VARCHAR(36) NOT NULL, liked BOOLEAN NOT NULL, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY uniq_swipe (userId, propertyId));
    CREATE TABLE IF NOT EXISTS client_project_actions (id VARCHAR(36) PRIMARY KEY, userId VARCHAR(36) NOT NULL, propertyId VARCHAR(36) NOT NULL, actionType VARCHAR(24) NOT NULL, metadata JSON NULL, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS matches (id VARCHAR(36) PRIMARY KEY, clientId VARCHAR(36) NOT NULL, propertyId VARCHAR(36) NOT NULL, leadId VARCHAR(36) NULL, conversationId VARCHAR(36) NULL, commercialId VARCHAR(36) NULL, promoterId VARCHAR(36) NULL, matchedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS appointments (id VARCHAR(36) PRIMARY KEY, clientId VARCHAR(36) NOT NULL, commercialId VARCHAR(36) NOT NULL, propertyId VARCHAR(36), projectId VARCHAR(36) NULL, promoterId VARCHAR(36) NULL, city VARCHAR(255) NULL, district VARCHAR(255) NULL, title VARCHAR(255) NOT NULL, description TEXT, dateTime DATETIME NOT NULL, status VARCHAR(32) DEFAULT 'scheduled', createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS projects (id VARCHAR(36) PRIMARY KEY, name VARCHAR(255) NOT NULL, promoterId VARCHAR(36), promoterName VARCHAR(255), commercialId VARCHAR(36) NULL, commercialName VARCHAR(255) NULL, city VARCHAR(255), district VARCHAR(255), type VARCHAR(100), description TEXT, image VARCHAR(500), images JSON, features JSON NULL, unitsJson JSON NULL, specsJson JSON NULL, isActive BOOLEAN DEFAULT TRUE, visibleInMatching BOOLEAN DEFAULT TRUE, status VARCHAR(100), totalUnits INT DEFAULT 0, availableUnits INT DEFAULT 0, reservedUnits INT DEFAULT 0, soldUnits INT DEFAULT 0, minPriceRaw INT DEFAULT 0, maxPriceRaw INT DEFAULT 0, areaFromRaw INT DEFAULT 0, areaToRaw INT DEFAULT 0, bedroomsFrom INT DEFAULT 0, bedroomsTo INT DEFAULT 0, viewLabel VARCHAR(255) NULL, delivery VARCHAR(100), completionPercent INT DEFAULT 0, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS deals (id VARCHAR(36) PRIMARY KEY, leadId VARCHAR(36) NOT NULL, clientId VARCHAR(36), clientName VARCHAR(255), propertyId VARCHAR(36), propertyTitle VARCHAR(255), commercialId VARCHAR(36), commercialName VARCHAR(255), promoterId VARCHAR(36), promoterName VARCHAR(255), salePrice INT DEFAULT 0, status VARCHAR(32) DEFAULT 'En cours', promoterValidatedAt DATETIME NULL, promoterValidatedBy VARCHAR(36) NULL, commissionTriggeredAt DATETIME NULL, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS commissions (id VARCHAR(36) PRIMARY KEY, dealId VARCHAR(36), commercialId VARCHAR(36), commercialName VARCHAR(255), promoterId VARCHAR(36), propertyId VARCHAR(36), propertyTitle VARCHAR(255), clientName VARCHAR(255), salePrice INT DEFAULT 0, rate DECIMAL(5,2) DEFAULT 0, amount INT DEFAULT 0, status VARCHAR(32) DEFAULT 'En attente', dueDate DATE, paidDate DATE, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS conversations (id VARCHAR(36) PRIMARY KEY, relatedPropertyId VARCHAR(36), relatedPropertyTitle VARCHAR(255), relatedPromoterId VARCHAR(36) NULL, relatedCity VARCHAR(255) NULL, relatedDistrict VARCHAR(255) NULL, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS conversation_participants (id VARCHAR(36) PRIMARY KEY, conversationId VARCHAR(36) NOT NULL, userId VARCHAR(36) NOT NULL, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uniq_participant (conversationId, userId));
    CREATE TABLE IF NOT EXISTS messages (id VARCHAR(36) PRIMARY KEY, conversationId VARCHAR(36) NOT NULL, senderId VARCHAR(36) NOT NULL, content TEXT NOT NULL, messageType VARCHAR(16) DEFAULT 'text', deliveredAt DATETIME NULL, readAt DATETIME NULL, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS call_sessions (id VARCHAR(36) PRIMARY KEY, conversationId VARCHAR(36) NOT NULL, callerId VARCHAR(36) NOT NULL, callerName VARCHAR(255) NULL, receiverId VARCHAR(36) NOT NULL, receiverName VARCHAR(255) NULL, relatedPropertyId VARCHAR(36) NULL, relatedPropertyTitle VARCHAR(255) NULL, callType VARCHAR(16) DEFAULT 'audio', status VARCHAR(24) DEFAULT 'ringing', startedAt DATETIME NULL, answeredAt DATETIME NULL, endedAt DATETIME NULL, durationSec INT DEFAULT 0, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS notifications (id VARCHAR(36) PRIMARY KEY, userId VARCHAR(36) NOT NULL, type VARCHAR(32) DEFAULT 'system', title VARCHAR(255) NOT NULL, body TEXT, readAt DATETIME NULL, targetId VARCHAR(36), createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS timeline_events (id VARCHAR(36) PRIMARY KEY, clientId VARCHAR(36) NOT NULL, actorRole VARCHAR(32) NOT NULL, actorName VARCHAR(255) NULL, actionType VARCHAR(64) NOT NULL, description TEXT NOT NULL, targetId VARCHAR(36) NULL, metadata JSON NULL, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS promoter_commercial_assignments (id VARCHAR(36) PRIMARY KEY, promoterId VARCHAR(36) NOT NULL, commercialId VARCHAR(36) NOT NULL, assignedBy VARCHAR(36) NULL, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS project_commercial_assignments (id VARCHAR(36) PRIMARY KEY, projectId VARCHAR(36) NOT NULL, commercialId VARCHAR(36) NOT NULL, assignedBy VARCHAR(36) NULL, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS project_units (id VARCHAR(36) PRIMARY KEY, projectId VARCHAR(36) NOT NULL, promoterId VARCHAR(36) NULL, commercialId VARCHAR(36) NULL, label VARCHAR(255) NOT NULL, unitType VARCHAR(100) NULL, priceRaw INT DEFAULT 0, areaRaw INT DEFAULT 0, bedrooms INT DEFAULT 0, bathrooms INT DEFAULT 0, floor INT DEFAULT 0, availability VARCHAR(50) DEFAULT 'Disponible', isActive BOOLEAN DEFAULT TRUE, visibleInMatching BOOLEAN DEFAULT TRUE, referenceCode VARCHAR(100) NULL, image VARCHAR(500) NULL, images JSON NULL, highlights JSON NULL, specsJson JSON NULL, description TEXT NULL, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS promoter_accounts (promoterId VARCHAR(36) PRIMARY KEY, accountStatus VARCHAR(24) DEFAULT 'invited', currentSubscriptionId VARCHAR(36) NULL, restrictedReason TEXT NULL, createdBy VARCHAR(36) NULL, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS subscription_plans (id VARCHAR(36) PRIMARY KEY, planKey VARCHAR(24) NOT NULL UNIQUE, name VARCHAR(100) NOT NULL, durationMonths INT NOT NULL, priceMad INT DEFAULT 0, isActive BOOLEAN DEFAULT TRUE, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS promoter_subscriptions (id VARCHAR(36) PRIMARY KEY, promoterId VARCHAR(36) NOT NULL, planId VARCHAR(36) NOT NULL, planKey VARCHAR(24) NOT NULL, status VARCHAR(24) DEFAULT 'pending', startsAt DATETIME NULL, endsAt DATETIME NULL, activatedAt DATETIME NULL, validatedBy VARCHAR(36) NULL, notes TEXT NULL, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS promoter_payment_requests (id VARCHAR(36) PRIMARY KEY, promoterId VARCHAR(36) NOT NULL, subscriptionId VARCHAR(36) NULL, planId VARCHAR(36) NOT NULL, planKey VARCHAR(24) NOT NULL, status VARCHAR(24) DEFAULT 'pending', amountMad INT DEFAULT 0, paymentMethod VARCHAR(32) NULL, paymentReference VARCHAR(255) NULL, proofUrl VARCHAR(500) NULL, notes TEXT NULL, requestedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, validatedAt DATETIME NULL, validatedBy VARCHAR(36) NULL, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS support_requests (id VARCHAR(36) PRIMARY KEY, clientId VARCHAR(36) NOT NULL, category VARCHAR(32) DEFAULT 'question', subject VARCHAR(255) NOT NULL, message TEXT NOT NULL, status VARCHAR(32) DEFAULT 'open', adminNote TEXT NULL, handledBy VARCHAR(36) NULL, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS interest_confirmations (id VARCHAR(36) PRIMARY KEY, leadId VARCHAR(36) NOT NULL, appointmentId VARCHAR(36) NULL, clientId VARCHAR(36) NOT NULL, clientName VARCHAR(255) NULL, commercialId VARCHAR(36) NOT NULL, commercialName VARCHAR(255) NULL, promoterId VARCHAR(36) NULL, promoterName VARCHAR(255) NULL, propertyId VARCHAR(36) NULL, propertyTitle VARCHAR(255) NULL, projectId VARCHAR(36) NULL, projectTitle VARCHAR(255) NULL, city VARCHAR(255) NULL, district VARCHAR(255) NULL, status VARCHAR(32) DEFAULT 'pending', requestMessage TEXT NULL, responseNote TEXT NULL, requestedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, expiresAt DATETIME NULL, expiredAt DATETIME NULL, respondedAt DATETIME NULL, transferredAt DATETIME NULL, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS lead_transfers (id VARCHAR(36) PRIMARY KEY, leadId VARCHAR(36) NOT NULL, interestConfirmationId VARCHAR(36) NULL, clientId VARCHAR(36) NOT NULL, clientName VARCHAR(255) NULL, commercialId VARCHAR(36) NOT NULL, commercialName VARCHAR(255) NULL, promoterId VARCHAR(36) NULL, promoterName VARCHAR(255) NULL, propertyId VARCHAR(36) NULL, propertyTitle VARCHAR(255) NULL, projectId VARCHAR(36) NULL, projectTitle VARCHAR(255) NULL, city VARCHAR(255) NULL, district VARCHAR(255) NULL, transferStatus VARCHAR(32) DEFAULT 'transmitted', transferReason VARCHAR(255) NULL, notes TEXT NULL, transferredAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, acknowledgedAt DATETIME NULL, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP);
  `);

  for (const [name, definition] of [
    ['project', 'VARCHAR(255) NULL'],
    ['projectId', 'VARCHAR(36) NULL'],
    ['promoter', 'VARCHAR(255) NULL'],
    ['promoterId', 'VARCHAR(36) NULL'],
    ['commercialId', 'VARCHAR(36) NULL'],
    ['commercialName', 'VARCHAR(255) NULL'],
    ['projectStatus', 'VARCHAR(100) NULL'],
    ['visibleInMatching', 'BOOLEAN DEFAULT TRUE'],
    ['isActive', 'BOOLEAN DEFAULT TRUE'],
    ['type', 'VARCHAR(100) NULL'],
    ['city', 'VARCHAR(255) NULL'],
    ['district', 'VARCHAR(255) NULL'],
    ['priceRaw', 'INT DEFAULT 0'],
    ['areaRaw', 'INT DEFAULT 0'],
    ['rooms', 'INT DEFAULT 0'],
    ['floor', 'INT DEFAULT 0'],
    ['description', 'TEXT NULL'],
    ['highlights', 'JSON NULL'],
    ['optionsJson', 'JSON NULL'],
    ['specsJson', 'JSON NULL'],
    ['image', 'VARCHAR(500) NULL'],
    ['images', 'JSON NULL'],
    ['availability', "VARCHAR(50) DEFAULT 'Disponible'"],
    ['monthlyEstimateRaw', 'INT DEFAULT 0'],
    ['score', 'INT DEFAULT 80'],
    ['badge', "VARCHAR(50) DEFAULT 'Bon potentiel'"],
    ['delivery', 'VARCHAR(100) NULL'],
    ['referenceCode', 'VARCHAR(100) NULL'],
    ['createdAt', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
    ['updatedAt', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'],
  ]) {
    await ensureColumn('properties', name, definition);
  }

  for (const [name, definition] of [
    ['adminRole', 'VARCHAR(32) NULL'],
    ['accountStatus', "VARCHAR(16) DEFAULT 'active'"],
    ['accountValidationStatus', "VARCHAR(24) DEFAULT 'draft'"],
    ['accessScope', 'JSON NULL'],
    ['permissions', 'JSON NULL'],
    ['avatar', 'VARCHAR(255) NULL'],
    ['expoPushToken', 'VARCHAR(255) NULL'],
    ['pushTokenUpdatedAt', 'DATETIME NULL'],
  ]) {
    await ensureColumn('users', name, definition);
  }
  await db.query("UPDATE users SET accountStatus = 'active' WHERE accountStatus IS NULL OR accountStatus = ''");
  await db.query("UPDATE users SET accountValidationStatus = CASE WHEN role = 'client' AND hasCompletedQuestionnaire = 1 THEN 'pending_review' WHEN role = 'client' THEN 'draft' ELSE 'validated' END WHERE accountValidationStatus IS NULL OR accountValidationStatus = ''");

  for (const [name, definition] of [
    ['answers', 'JSON NULL'],
    ['status', "VARCHAR(32) DEFAULT 'new'"],
    ['notes', 'TEXT NULL'],
    ['commercialId', 'VARCHAR(36) NULL'],
    ['promoterId', 'VARCHAR(36) NULL'],
    ['projectId', 'VARCHAR(36) NULL'],
    ['city', 'VARCHAR(255) NULL'],
    ['district', 'VARCHAR(255) NULL'],
    ['source', "VARCHAR(32) DEFAULT 'questionnaire'"],
    ['score', 'INT DEFAULT 0'],
    ['temperature', "VARCHAR(16) DEFAULT 'warm'"],
    ['createdAt', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
    ['updatedAt', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'],
  ]) {
    await ensureColumn('leads', name, definition);
  }

  for (const [name, definition] of [
    ['actionType', 'VARCHAR(24) NOT NULL'],
    ['metadata', 'JSON NULL'],
    ['updatedAt', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'],
  ]) {
    await ensureColumn('client_project_actions', name, definition);
  }

  for (const [name, definition] of [
    ['leadId', 'VARCHAR(36) NULL'],
    ['conversationId', 'VARCHAR(36) NULL'],
    ['commercialId', 'VARCHAR(36) NULL'],
    ['promoterId', 'VARCHAR(36) NULL'],
    ['matchedAt', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
    ['updatedAt', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'],
  ]) {
    await ensureColumn('matches', name, definition);
  }

  for (const [name, definition] of [
    ['reminderDaySentAt', 'DATETIME NULL'],
    ['reminderHoursSentAt', 'DATETIME NULL'],
    ['projectId', 'VARCHAR(36) NULL'],
    ['promoterId', 'VARCHAR(36) NULL'],
    ['city', 'VARCHAR(255) NULL'],
    ['district', 'VARCHAR(255) NULL'],
  ]) {
    await ensureColumn('appointments', name, definition);
  }

  for (const [name, definition] of [
    ['relatedPromoterId', 'VARCHAR(36) NULL'],
    ['relatedCity', 'VARCHAR(255) NULL'],
    ['relatedDistrict', 'VARCHAR(255) NULL'],
  ]) {
    await ensureColumn('conversations', name, definition);
  }

  await db.query("ALTER TABLE appointments MODIFY COLUMN status VARCHAR(32) DEFAULT 'scheduled'");
  await db.query(`
    UPDATE appointments
    SET status = CASE status
      WHEN 'Planifie' THEN 'scheduled'
      WHEN 'Planifi\u00E9' THEN 'scheduled'
      WHEN 'Confirme' THEN 'confirmed'
      WHEN 'Confirm\u00E9' THEN 'confirmed'
      WHEN 'Effectue' THEN 'completed'
      WHEN 'Effectu\u00E9' THEN 'completed'
      WHEN 'Annule' THEN 'cancelled'
      WHEN 'Annul\u00E9' THEN 'cancelled'
      WHEN 'report_demande' THEN 'reschedule_requested'
      WHEN 'Report demande' THEN 'reschedule_requested'
      ELSE status
    END
  `);

  for (const [name, definition] of [
    ['promoterId', 'VARCHAR(36) NULL'],
    ['promoterName', 'VARCHAR(255) NULL'],
    ['commercialId', 'VARCHAR(36) NULL'],
    ['commercialName', 'VARCHAR(255) NULL'],
    ['city', 'VARCHAR(255) NULL'],
    ['district', 'VARCHAR(255) NULL'],
    ['type', 'VARCHAR(100) NULL'],
    ['description', 'TEXT NULL'],
    ['image', 'VARCHAR(500) NULL'],
    ['images', 'JSON NULL'],
    ['features', 'JSON NULL'],
    ['unitsJson', 'JSON NULL'],
    ['specsJson', 'JSON NULL'],
    ['isActive', 'BOOLEAN DEFAULT TRUE'],
    ['visibleInMatching', 'BOOLEAN DEFAULT TRUE'],
    ['status', 'VARCHAR(100) NULL'],
    ['totalUnits', 'INT DEFAULT 0'],
    ['availableUnits', 'INT DEFAULT 0'],
    ['reservedUnits', 'INT DEFAULT 0'],
    ['soldUnits', 'INT DEFAULT 0'],
    ['minPriceRaw', 'INT DEFAULT 0'],
    ['maxPriceRaw', 'INT DEFAULT 0'],
    ['areaFromRaw', 'INT DEFAULT 0'],
    ['areaToRaw', 'INT DEFAULT 0'],
    ['bedroomsFrom', 'INT DEFAULT 0'],
    ['bedroomsTo', 'INT DEFAULT 0'],
    ['viewLabel', 'VARCHAR(255) NULL'],
    ['delivery', 'VARCHAR(100) NULL'],
    ['completionPercent', 'INT DEFAULT 0'],
    ['createdAt', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
    ['updatedAt', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'],
  ]) {
    await ensureColumn('projects', name, definition);
  }

  for (const [name, definition] of [
    ['clientId', 'VARCHAR(36) NULL'],
    ['clientName', 'VARCHAR(255) NULL'],
    ['propertyId', 'VARCHAR(36) NULL'],
    ['propertyTitle', 'VARCHAR(255) NULL'],
    ['commercialId', 'VARCHAR(36) NULL'],
    ['commercialName', 'VARCHAR(255) NULL'],
    ['promoterId', 'VARCHAR(36) NULL'],
    ['promoterName', 'VARCHAR(255) NULL'],
    ['salePrice', 'INT DEFAULT 0'],
    ['status', "VARCHAR(32) DEFAULT 'En cours'"],
    ['promoterValidatedAt', 'DATETIME NULL'],
    ['promoterValidatedBy', 'VARCHAR(36) NULL'],
    ['commissionTriggeredAt', 'DATETIME NULL'],
    ['createdAt', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
    ['updatedAt', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'],
  ]) {
    await ensureColumn('deals', name, definition);
  }

  for (const [name, definition] of [
    ['promoterId', 'VARCHAR(36) NULL'],
    ['propertyId', 'VARCHAR(36) NULL'],
    ['clientName', 'VARCHAR(255) NULL'],
  ]) {
    await ensureColumn('commissions', name, definition);
  }

  for (const [name, definition] of [
    ['deliveredAt', 'DATETIME NULL'],
    ['readAt', 'DATETIME NULL'],
    ['messageType', "VARCHAR(16) DEFAULT 'text'"],
  ]) {
    await ensureColumn('messages', name, definition);
  }

  for (const [name, definition] of [
    ['conversationId', 'VARCHAR(36) NOT NULL'],
    ['callerId', 'VARCHAR(36) NOT NULL'],
    ['callerName', 'VARCHAR(255) NULL'],
    ['receiverId', 'VARCHAR(36) NOT NULL'],
    ['receiverName', 'VARCHAR(255) NULL'],
    ['relatedPropertyId', 'VARCHAR(36) NULL'],
    ['relatedPropertyTitle', 'VARCHAR(255) NULL'],
    ['callType', "VARCHAR(16) DEFAULT 'audio'"],
    ['status', "VARCHAR(24) DEFAULT 'ringing'"],
    ['startedAt', 'DATETIME NULL'],
    ['answeredAt', 'DATETIME NULL'],
    ['endedAt', 'DATETIME NULL'],
    ['durationSec', 'INT DEFAULT 0'],
    ['createdAt', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
    ['updatedAt', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'],
  ]) {
    await ensureColumn('call_sessions', name, definition);
  }

  for (const [name, definition] of [
    ['category', "VARCHAR(32) DEFAULT 'question'"],
  ]) {
    await ensureColumn('support_requests', name, definition);
  }

  for (const [name, definition] of [
    ['leadId', 'VARCHAR(36) NOT NULL'],
    ['appointmentId', 'VARCHAR(36) NULL'],
    ['clientId', 'VARCHAR(36) NOT NULL'],
    ['clientName', 'VARCHAR(255) NULL'],
    ['commercialId', 'VARCHAR(36) NOT NULL'],
    ['commercialName', 'VARCHAR(255) NULL'],
    ['promoterId', 'VARCHAR(36) NULL'],
    ['promoterName', 'VARCHAR(255) NULL'],
    ['propertyId', 'VARCHAR(36) NULL'],
    ['propertyTitle', 'VARCHAR(255) NULL'],
    ['projectId', 'VARCHAR(36) NULL'],
    ['projectTitle', 'VARCHAR(255) NULL'],
    ['city', 'VARCHAR(255) NULL'],
    ['district', 'VARCHAR(255) NULL'],
    ['status', "VARCHAR(32) DEFAULT 'pending'"],
    ['requestMessage', 'TEXT NULL'],
    ['responseNote', 'TEXT NULL'],
    ['requestedAt', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
    ['expiresAt', 'DATETIME NULL'],
    ['expiredAt', 'DATETIME NULL'],
    ['respondedAt', 'DATETIME NULL'],
    ['transferredAt', 'DATETIME NULL'],
  ]) {
    await ensureColumn('interest_confirmations', name, definition);
  }

  for (const [name, definition] of [
    ['leadId', 'VARCHAR(36) NOT NULL'],
    ['interestConfirmationId', 'VARCHAR(36) NULL'],
    ['clientId', 'VARCHAR(36) NOT NULL'],
    ['clientName', 'VARCHAR(255) NULL'],
    ['commercialId', 'VARCHAR(36) NOT NULL'],
    ['commercialName', 'VARCHAR(255) NULL'],
    ['promoterId', 'VARCHAR(36) NULL'],
    ['promoterName', 'VARCHAR(255) NULL'],
    ['propertyId', 'VARCHAR(36) NULL'],
    ['propertyTitle', 'VARCHAR(255) NULL'],
    ['projectId', 'VARCHAR(36) NULL'],
    ['projectTitle', 'VARCHAR(255) NULL'],
    ['city', 'VARCHAR(255) NULL'],
    ['district', 'VARCHAR(255) NULL'],
    ['transferStatus', "VARCHAR(32) DEFAULT 'transmitted'"],
    ['transferReason', 'VARCHAR(255) NULL'],
    ['notes', 'TEXT NULL'],
    ['transferredAt', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
    ['acknowledgedAt', 'DATETIME NULL'],
  ]) {
    await ensureColumn('lead_transfers', name, definition);
  }

  for (const [name, definition] of [
    ['assignedBy', 'VARCHAR(36) NULL'],
    ['updatedAt', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'],
  ]) {
    await ensureColumn('project_commercial_assignments', name, definition);
  }

  for (const [name, definition] of [
    ['promoterId', 'VARCHAR(36) NULL'],
    ['commercialId', 'VARCHAR(36) NULL'],
    ['label', 'VARCHAR(255) NOT NULL'],
    ['unitType', 'VARCHAR(100) NULL'],
    ['priceRaw', 'INT DEFAULT 0'],
    ['areaRaw', 'INT DEFAULT 0'],
    ['bedrooms', 'INT DEFAULT 0'],
    ['bathrooms', 'INT DEFAULT 0'],
    ['floor', 'INT DEFAULT 0'],
    ['availability', "VARCHAR(50) DEFAULT 'Disponible'"],
    ['isActive', 'BOOLEAN DEFAULT TRUE'],
    ['visibleInMatching', 'BOOLEAN DEFAULT TRUE'],
    ['referenceCode', 'VARCHAR(100) NULL'],
    ['image', 'VARCHAR(500) NULL'],
    ['images', 'JSON NULL'],
    ['highlights', 'JSON NULL'],
    ['specsJson', 'JSON NULL'],
    ['description', 'TEXT NULL'],
  ]) {
    await ensureColumn('project_units', name, definition);
  }

  for (const [name, definition] of [
    ['accountStatus', "VARCHAR(24) DEFAULT 'invited'"],
    ['currentSubscriptionId', 'VARCHAR(36) NULL'],
    ['restrictedReason', 'TEXT NULL'],
    ['createdBy', 'VARCHAR(36) NULL'],
  ]) {
    await ensureColumn('promoter_accounts', name, definition);
  }

  for (const [name, definition] of [
    ['planKey', 'VARCHAR(24) NOT NULL'],
    ['name', 'VARCHAR(100) NOT NULL'],
    ['durationMonths', 'INT NOT NULL'],
    ['priceMad', 'INT DEFAULT 0'],
    ['isActive', 'BOOLEAN DEFAULT TRUE'],
  ]) {
    await ensureColumn('subscription_plans', name, definition);
  }

  for (const [name, definition] of [
    ['promoterId', 'VARCHAR(36) NOT NULL'],
    ['planId', 'VARCHAR(36) NOT NULL'],
    ['planKey', 'VARCHAR(24) NOT NULL'],
    ['status', "VARCHAR(24) DEFAULT 'pending'"],
    ['startsAt', 'DATETIME NULL'],
    ['endsAt', 'DATETIME NULL'],
    ['activatedAt', 'DATETIME NULL'],
    ['validatedBy', 'VARCHAR(36) NULL'],
    ['notes', 'TEXT NULL'],
  ]) {
    await ensureColumn('promoter_subscriptions', name, definition);
  }

  for (const [name, definition] of [
    ['promoterId', 'VARCHAR(36) NOT NULL'],
    ['subscriptionId', 'VARCHAR(36) NULL'],
    ['planId', 'VARCHAR(36) NOT NULL'],
    ['planKey', 'VARCHAR(24) NOT NULL'],
    ['status', "VARCHAR(24) DEFAULT 'pending'"],
    ['amountMad', 'INT DEFAULT 0'],
    ['paymentMethod', 'VARCHAR(32) NULL'],
    ['paymentReference', 'VARCHAR(255) NULL'],
    ['proofUrl', 'VARCHAR(500) NULL'],
    ['notes', 'TEXT NULL'],
    ['requestedAt', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
    ['validatedAt', 'DATETIME NULL'],
    ['validatedBy', 'VARCHAR(36) NULL'],
  ]) {
    await ensureColumn('promoter_payment_requests', name, definition);
  }

  await dropIndexIfExists('promoter_commercial_assignments', 'commercialId');
  await ensureIndex('promoter_commercial_assignments', 'uniq_promoter_commercial_assignment', 'UNIQUE INDEX `uniq_promoter_commercial_assignment` (`promoterId`, `commercialId`)');
  await ensureIndex('promoter_commercial_assignments', 'idx_promoter_assignment_commercial', 'INDEX `idx_promoter_assignment_commercial` (`commercialId`)');
  await ensureIndex('project_commercial_assignments', 'uniq_project_commercial_assignment', 'UNIQUE INDEX `uniq_project_commercial_assignment` (`projectId`, `commercialId`)');
  await ensureIndex('project_commercial_assignments', 'idx_project_assignment_commercial', 'INDEX `idx_project_assignment_commercial` (`commercialId`)');
  await ensureIndex('project_units', 'idx_project_units_project', 'INDEX `idx_project_units_project` (`projectId`)');
  await ensureIndex('project_units', 'idx_project_units_visibility', 'INDEX `idx_project_units_visibility` (`projectId`, `availability`, `isActive`, `visibleInMatching`)');
  await ensureIndex('client_project_actions', 'uniq_client_project_action', 'UNIQUE INDEX `uniq_client_project_action` (`userId`, `propertyId`, `actionType`)');
  await ensureIndex('client_project_actions', 'idx_client_project_actions_user', 'INDEX `idx_client_project_actions_user` (`userId`, `updatedAt`)');
  await ensureIndex('matches', 'uniq_client_property_match', 'UNIQUE INDEX `uniq_client_property_match` (`clientId`, `propertyId`)');
  await ensureIndex('subscription_plans', 'uniq_subscription_plan_key', 'UNIQUE INDEX `uniq_subscription_plan_key` (`planKey`)');
  await ensureIndex('interest_confirmations', 'idx_interest_confirmations_lead', 'INDEX `idx_interest_confirmations_lead` (`leadId`, `requestedAt`)');
  await ensureIndex('interest_confirmations', 'idx_interest_confirmations_client', 'INDEX `idx_interest_confirmations_client` (`clientId`, `status`, `requestedAt`)');
  await ensureIndex('interest_confirmations', 'idx_interest_confirmations_commercial', 'INDEX `idx_interest_confirmations_commercial` (`commercialId`, `status`, `requestedAt`)');
  await ensureIndex('lead_transfers', 'uniq_lead_transfer_confirmation', 'UNIQUE INDEX `uniq_lead_transfer_confirmation` (`interestConfirmationId`)');
  await ensureIndex('lead_transfers', 'idx_lead_transfers_promoter', 'INDEX `idx_lead_transfers_promoter` (`promoterId`, `transferredAt`)');
  await ensureIndex('lead_transfers', 'idx_lead_transfers_lead', 'INDEX `idx_lead_transfers_lead` (`leadId`, `transferredAt`)');

  const [promoters] = await db.query("SELECT id FROM users WHERE role = 'promoter'");
  for (const promoter of promoters) {
    await db.query(
      `INSERT INTO promoter_accounts (promoterId, accountStatus)
       VALUES (?, 'invited')
       ON DUPLICATE KEY UPDATE promoterId = promoterId`,
      [promoter.id],
    );
  }

  const defaultPlans = [
    { planKey: 'monthly', name: '1 mois', durationMonths: 1, priceMad: 0 },
    { planKey: 'quarterly', name: '3 mois', durationMonths: 3, priceMad: 0 },
    { planKey: 'yearly', name: '1 an', durationMonths: 12, priceMad: 0 },
  ];
  for (const plan of defaultPlans) {
    const [existingPlans] = await db.query('SELECT id FROM subscription_plans WHERE planKey = ? LIMIT 1', [plan.planKey]);
    if (existingPlans.length) {
      await db.query(
        'UPDATE subscription_plans SET name = ?, durationMonths = ?, priceMad = COALESCE(NULLIF(priceMad, 0), ?), isActive = 1, updatedAt = CURRENT_TIMESTAMP WHERE planKey = ?',
        [plan.name, plan.durationMonths, plan.priceMad, plan.planKey],
      );
    } else {
      await db.query(
        'INSERT INTO subscription_plans (id, planKey, name, durationMonths, priceMad, isActive) VALUES (?, ?, ?, ?, ?, 1)',
        [randomUUID(), plan.planKey, plan.name, plan.durationMonths, plan.priceMad],
      );
    }
  }

  await db.query(`
    INSERT INTO client_project_actions (id, userId, propertyId, actionType, createdAt, updatedAt)
    SELECT UUID(), f.userId, f.propertyId, 'favorited', f.createdAt, f.createdAt
    FROM favorites f
    LEFT JOIN client_project_actions a
      ON a.userId = f.userId
     AND a.propertyId = f.propertyId
     AND a.actionType = 'favorited'
    WHERE a.id IS NULL
  `);
  await db.query(`
    INSERT INTO client_project_actions (id, userId, propertyId, actionType, createdAt, updatedAt)
    SELECT UUID(), s.userId, s.propertyId, CASE WHEN s.liked = 1 THEN 'liked' ELSE 'passed' END, s.createdAt, s.updatedAt
    FROM swipes s
    LEFT JOIN client_project_actions a
      ON a.userId = s.userId
     AND a.propertyId = s.propertyId
     AND a.actionType = CASE WHEN s.liked = 1 THEN 'liked' ELSE 'passed' END
    WHERE a.id IS NULL
  `);

  await db.query(`
    UPDATE leads
    SET source = 'matching'
    WHERE (source IS NULL OR source = '' OR source = 'questionnaire')
      AND (
        notes LIKE '%aim%'
        OR notes LIKE '%favori%'
        OR notes LIKE '%Interaction client%'
      )
  `);
}

async function cleanupDuplicateConversationParticipants() {
  const [duplicates] = await db.query(`
    SELECT conversationId, userId, COUNT(*) AS total
    FROM conversation_participants
    GROUP BY conversationId, userId
    HAVING COUNT(*) > 1
  `);

  for (const item of duplicates) {
    const [rows] = await db.query(
      'SELECT id FROM conversation_participants WHERE conversationId = ? AND userId = ? ORDER BY createdAt ASC, id ASC',
      [item.conversationId, item.userId],
    );
    const idsToDelete = rows.slice(1).map((row) => row.id).filter(Boolean);
    for (const id of idsToDelete) {
      await db.query('DELETE FROM conversation_participants WHERE id = ?', [id]);
    }
  }
}

async function cleanupDuplicatePromoterAssignments() {
  const [duplicates] = await db.query(`
    SELECT promoterId, commercialId, COUNT(*) AS total
    FROM promoter_commercial_assignments
    GROUP BY promoterId, commercialId
    HAVING COUNT(*) > 1
  `);

  for (const item of duplicates) {
    const [rows] = await db.query(
      'SELECT id FROM promoter_commercial_assignments WHERE promoterId = ? AND commercialId = ? ORDER BY updatedAt DESC, createdAt ASC, id ASC',
      [item.promoterId, item.commercialId],
    );
    const idsToDelete = rows.slice(1).map((row) => row.id).filter(Boolean);
    for (const id of idsToDelete) {
      await db.query('DELETE FROM promoter_commercial_assignments WHERE id = ?', [id]);
    }
  }
}

async function cleanupDuplicateProjectAssignments() {
  const [duplicates] = await db.query(`
    SELECT projectId, commercialId, COUNT(*) AS total
    FROM project_commercial_assignments
    GROUP BY projectId, commercialId
    HAVING COUNT(*) > 1
  `);

  for (const item of duplicates) {
    const [rows] = await db.query(
      'SELECT id FROM project_commercial_assignments WHERE projectId = ? AND commercialId = ? ORDER BY updatedAt DESC, createdAt ASC, id ASC',
      [item.projectId, item.commercialId],
    );
    const idsToDelete = rows.slice(1).map((row) => row.id).filter(Boolean);
    for (const id of idsToDelete) {
      await db.query('DELETE FROM project_commercial_assignments WHERE id = ?', [id]);
    }
  }
}

async function cleanupLegacyDuplicates() {
  await cleanupDuplicateConversationParticipants();
  await cleanupDuplicatePromoterAssignments();
  await cleanupDuplicateProjectAssignments();
}

async function migrateLegacyAdminRoles() {
  await db.query("UPDATE users SET adminRole = 'support_client' WHERE role = 'admin' AND adminRole = 'administrator'");
  await db.query("UPDATE users SET adminRole = 'support_commercial' WHERE role = 'admin' AND adminRole = 'access_manager'");
}

async function getSubscriptionPlanByKey(planKey) {
  const [rows] = await db.query('SELECT * FROM subscription_plans WHERE planKey = ? AND isActive = 1 LIMIT 1', [normalizePlanKey(planKey)]);
  return rows[0] || null;
}

async function syncPromoterAccountState(promoterId) {
  if (!promoterId) return null;

  const [subscriptionRows] = await db.query(
    `SELECT *
     FROM promoter_subscriptions
     WHERE promoterId = ?
     ORDER BY
       CASE status
         WHEN 'active' THEN 1
         WHEN 'pending' THEN 2
         WHEN 'expired' THEN 3
         WHEN 'suspended' THEN 4
         WHEN 'cancelled' THEN 5
         ELSE 6
       END,
       COALESCE(endsAt, createdAt) DESC,
       createdAt DESC
     LIMIT 1`,
    [promoterId],
  );

  const currentSubscription = subscriptionRows[0] || null;
  let nextAccountStatus = 'invited';
  let nextSubscriptionStatus = 'pending';

  if (currentSubscription) {
    nextSubscriptionStatus = normalizeSubscriptionStatus(currentSubscription.status, 'pending');
    const endsAt = currentSubscription.endsAt ? new Date(currentSubscription.endsAt) : null;
    if (nextSubscriptionStatus === 'active' && endsAt && endsAt.getTime() < Date.now()) {
      nextSubscriptionStatus = 'expired';
      await db.query(
        "UPDATE promoter_subscriptions SET status = 'expired', updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND status = 'active'",
        [currentSubscription.id],
      );
    }

    if (nextSubscriptionStatus === 'active') nextAccountStatus = 'active';
    else if (nextSubscriptionStatus === 'expired') nextAccountStatus = 'expired';
    else if (nextSubscriptionStatus === 'suspended') nextAccountStatus = 'suspended';
    else nextAccountStatus = 'pending_payment';
  }

  await db.query(
    `INSERT INTO promoter_accounts (promoterId, accountStatus, currentSubscriptionId)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE accountStatus = VALUES(accountStatus), currentSubscriptionId = VALUES(currentSubscriptionId), updatedAt = CURRENT_TIMESTAMP`,
    [promoterId, nextAccountStatus, currentSubscription?.id || null],
  );

  return getPromoterAccessSnapshot(promoterId);
}

async function createPromoterPaymentRequest(promoterId, planKey, payload = {}) {
  const plan = await getSubscriptionPlanByKey(planKey);
  if (!plan) return { error: 'Plan introuvable', status: 404 };

  const subscriptionId = randomUUID();
  await db.query(
    `INSERT INTO promoter_subscriptions (id, promoterId, planId, planKey, status, notes)
     VALUES (?, ?, ?, ?, 'pending', ?)`,
    [subscriptionId, promoterId, plan.id, plan.planKey, String(payload.notes || '').trim() || null],
  );

  const paymentRequestId = randomUUID();
  await db.query(
    `INSERT INTO promoter_payment_requests (
      id, promoterId, subscriptionId, planId, planKey, status, amountMad, paymentMethod, paymentReference, proofUrl, notes
     ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
    [
      paymentRequestId,
      promoterId,
      subscriptionId,
      plan.id,
      plan.planKey,
      Number(plan.priceMad || 0),
      String(payload.paymentMethod || '').trim() || null,
      String(payload.paymentReference || '').trim() || null,
      String(payload.proofUrl || '').trim() || null,
      String(payload.notes || '').trim() || null,
    ],
  );

  await db.query(
    "UPDATE promoter_accounts SET accountStatus = 'pending_payment', currentSubscriptionId = ?, updatedAt = CURRENT_TIMESTAMP WHERE promoterId = ?",
    [subscriptionId, promoterId],
  );

  return { subscriptionId, paymentRequestId, plan };
}

async function validatePromoterPaymentRequest(paymentRequestId, adminUserId, nextStatus = 'validated', adminNote = null) {
  const [rows] = await db.query('SELECT * FROM promoter_payment_requests WHERE id = ? LIMIT 1', [paymentRequestId]);
  if (!rows.length) return { error: 'Demande de paiement introuvable', status: 404 };

  const request = rows[0];
  const finalStatus = normalizePaymentRequestStatus(nextStatus, 'validated');
  const plan = await getSubscriptionPlanByKey(request.planKey);
  if (!plan) return { error: 'Plan introuvable', status: 404 };

  await db.query(
    'UPDATE promoter_payment_requests SET status = ?, validatedAt = NOW(), validatedBy = ?, notes = COALESCE(?, notes), updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
    [finalStatus, adminUserId, adminNote, paymentRequestId],
  );

  if (finalStatus !== 'validated') {
    await db.query(
      "UPDATE promoter_subscriptions SET status = 'cancelled', notes = COALESCE(?, notes), updatedAt = CURRENT_TIMESTAMP WHERE id = ?",
      [adminNote, request.subscriptionId],
    );
    await db.query(
      "UPDATE promoter_accounts SET accountStatus = 'pending_payment', updatedAt = CURRENT_TIMESTAMP WHERE promoterId = ?",
      [request.promoterId],
    );
    return { ok: true, status: finalStatus };
  }

  const startsAt = new Date();
  const endsAt = new Date(startsAt);
  endsAt.setMonth(endsAt.getMonth() + Number(plan.durationMonths || 1));

  await db.query(
    `UPDATE promoter_subscriptions
     SET status = 'active',
         startsAt = ?,
         endsAt = ?,
         activatedAt = NOW(),
         validatedBy = ?,
         notes = COALESCE(?, notes),
         updatedAt = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [startsAt, endsAt, adminUserId, adminNote, request.subscriptionId],
  );

  await db.query(
    "UPDATE promoter_accounts SET accountStatus = 'active', currentSubscriptionId = ?, restrictedReason = NULL, updatedAt = CURRENT_TIMESTAMP WHERE promoterId = ?",
    [request.subscriptionId, request.promoterId],
  );

  return { ok: true, status: 'validated', startsAt, endsAt };
}

async function bootstrapAdminIfNeeded() {
  const [[usersCount]] = await db.query('SELECT COUNT(*) AS total FROM users');
  if (usersCount.total) return;

  const email = String(process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim();
  const password = String(process.env.BOOTSTRAP_ADMIN_PASSWORD || '').trim();
  if (!isEmail(email) || password.length < 6) return;

  await db.query(
    'INSERT INTO users (id, name, email, phone, password, role, adminRole) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      randomUUID(),
      String(process.env.BOOTSTRAP_ADMIN_NAME || 'Admin Selix').trim(),
      email,
      String(process.env.BOOTSTRAP_ADMIN_PHONE || '').trim(),
      await bcrypt.hash(password, 10),
      'admin',
      'super_admin',
    ],
  );
}

async function seedDemoData() {
  if (String(process.env.ENABLE_DEMO_SEED || '').trim().toLowerCase() !== 'true') {
    return;
  }

  const [[usersCount]] = await db.query('SELECT COUNT(*) AS total FROM users');
  if (!usersCount.total) {
    const pwd = await bcrypt.hash('selix123', 10);
    for (const user of [
      ['Admin Selix', 'admin@selix.com', '+212600000001', 'admin'],
      ['Nadia El Idrissi', 'commercial@selix.com', '+212600000002', 'commercial'],
      ['Groupe Selix Promoteur', 'promoter@selix.com', '+212600000003', 'promoter'],
      ['Client Demo', 'client@selix.com', '+212600000004', 'client'],
    ]) {
      await db.query(
        'INSERT INTO users (id, name, email, phone, password, role, adminRole) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [randomUUID(), ...user.slice(0, 3), pwd, user[3], user[3] === 'admin' ? 'super_admin' : null],
      );
    }
  }
  await db.query("UPDATE users SET adminRole = 'super_admin' WHERE role = 'admin' AND (adminRole IS NULL OR adminRole = '')");
  const [[assignmentCount]] = await db.query('SELECT COUNT(*) AS total FROM promoter_commercial_assignments');
  if (!assignmentCount.total) {
    const [promoters] = await db.query("SELECT id FROM users WHERE role = 'promoter' ORDER BY createdAt ASC LIMIT 1");
    const [commercials] = await db.query("SELECT id FROM users WHERE role = 'commercial' ORDER BY createdAt ASC LIMIT 1");
    const [admins] = await db.query("SELECT id FROM users WHERE role = 'admin' ORDER BY createdAt ASC LIMIT 1");
    if (promoters[0]?.id && commercials[0]?.id) {
      await db.query(
        'INSERT INTO promoter_commercial_assignments (id, promoterId, commercialId, assignedBy) VALUES (?, ?, ?, ?)',
        [randomUUID(), promoters[0].id, commercials[0].id, admins[0]?.id || null],
      );
    }
  }
  const [[projectCount]] = await db.query('SELECT COUNT(*) AS total FROM projects');
  if (!projectCount.total) {
    const [promoters] = await db.query("SELECT id, name FROM users WHERE role = 'promoter' LIMIT 1");
    const promoter = promoters[0] || { id: null, name: 'Selix Promoteur' };
    const projects = [
      [randomUUID(), 'Tamaris Prestige', promoter.id, promoter.name, 'Casablanca', 'Tamaris', 'Villa', 'Programme premium orient? r?sidence principale et investissement.', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80', 'Livraison 2025', 24, 8, 4, 12, 3800000, 6800000, 'Juin 2025', 75],
      [randomUUID(), 'Les Jardins Bourgogne', promoter.id, promoter.name, 'Casablanca', 'Bourgogne', 'Appartement', 'R\u00E9sidence moderne proche tramway et commerces.', 'https://images.unsplash.com/photo-1560185007-c5ca9d2c014d?auto=format&fit=crop&w=1200&q=80', 'En construction', 48, 14, 8, 26, 1200000, 2400000, 'D\u00E9c. 2025', 58],
    ];
    for (const p of projects) await db.query('INSERT INTO projects (id, name, promoterId, promoterName, city, district, type, description, image, status, totalUnits, availableUnits, reservedUnits, soldUnits, minPriceRaw, maxPriceRaw, delivery, completionPercent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', p);
  }
  const [[propertyCount]] = await db.query('SELECT COUNT(*) AS total FROM properties');
  if (!propertyCount.total) {
    const [projects] = await db.query('SELECT * FROM projects ORDER BY createdAt ASC LIMIT 2');
    const a = projects[0], b = projects[1] || projects[0];
    const items = [
      [randomUUID(), 'Villa Perle de Tamaris', a.name, a.promoterName, a.promoterId, 'Villa', 'Casablanca', 'Tamaris', 4200000, 320, 5, 0, 'Villa haut de gamme avec jardin, piscine et finition premium.', JSON.stringify(['Vue mer', 'Piscine priv?e', 'Jardin', 'Domotique']), JSON.stringify([]), 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80', JSON.stringify(['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80']), 'Disponible', 18500, 94, 'Top Match', 'Livr?', 'TAM-V-014'],
      [randomUUID(), 'R\u00E9sidence Les Jardins - T3', b.name, b.promoterName, b.promoterId, 'Appartement', 'Casablanca', 'Bourgogne', 1680000, 112, 3, 4, 'Appartement lumineux avec terrasse et services r\u00E9sidentiels.', JSON.stringify(['Terrasse', 'Conciergerie', 'Salle de sport']), JSON.stringify([]), 'https://images.unsplash.com/photo-1560185007-c5ca9d2c014d?auto=format&fit=crop&w=1200&q=80', JSON.stringify(['https://images.unsplash.com/photo-1560185007-c5ca9d2c014d?auto=format&fit=crop&w=1200&q=80']), 'Disponible', 7300, 91, 'Excellent Match', 'D\u00E9c. 2025', 'JRD-A-T3-22'],
      [randomUUID(), 'Studio Smart City Marrakech', a.name, a.promoterName, a.promoterId, 'Studio', 'Marrakech', 'Palmeraie', 520000, 42, 1, 2, 'Studio investissement locatif avec gestion incluse.', JSON.stringify(['Gestion locative', 'Piscine', 'Spa']), JSON.stringify([]), 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=80', JSON.stringify(['https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=80']), 'Disponible', 2200, 78, 'Bon potentiel', 'Livr?', 'MRK-S-204'],
    ];
    for (const p of items) await db.query('INSERT INTO properties (id, title, project, promoter, promoterId, type, city, district, priceRaw, areaRaw, rooms, floor, description, highlights, optionsJson, image, images, availability, monthlyEstimateRaw, score, badge, delivery, referenceCode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', p);
  }

}

app.get('/api/health', (req, res) => res.json({ status: 'OK', timestamp: new Date().toISOString() }));
app.get('/api/app-config', (req, res) => res.json(getAppConfig()));

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, phone, password, role = 'client' } = req.body;
    if (!name || !isEmail(email) || !password || String(password).length < 6) {
      return res.status(400).json({ error: 'Invalid registration payload' });
    }
    if (role !== 'client') return res.status(403).json({ error: 'Public registration only allowed for client role.' });
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return res.status(400).json({ error: 'User already exists' });
    const id = randomUUID();
    await db.query(
      'INSERT INTO users (id, name, email, phone, password, role, accountValidationStatus) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name, email, phone, await bcrypt.hash(password, 10), role, 'draft'],
    );
    const user = await loadCurrentUser(id);
    return res.status(201).json({ user, ...signTokens(user) });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Internal server error' }); }
});

app.post('/api/auth/login', async (req, res) => {
  if (!isEmail(req.body.email) || !req.body.password) return res.status(400).json({ error: 'Invalid login payload' });
  const [users] = await db.query('SELECT id, password, role, accountStatus FROM users WHERE email = ?', [req.body.email]);
  if (!users.length || !(await bcrypt.compare(req.body.password, users[0].password))) return res.status(401).json({ error: 'Invalid credentials' });
  const user = await loadCurrentUser(users[0].id);
  if (!isUserAccountActive(user)) return res.status(403).json({ error: accountStatusErrorMessage(user.accountStatus) });
  return res.json({ user, ...signTokens(user) });
});

app.post('/api/auth/refresh', async (req, res) => {
  try {
    if (!req.body.refreshToken) return res.status(400).json({ error: 'Refresh token required' });
    const decoded = jwt.verify(req.body.refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await loadCurrentUser(decoded.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (!isUserAccountActive(user)) return res.status(403).json({ error: accountStatusErrorMessage(user.accountStatus) });
    return res.json(signTokens(user));
  } catch { return res.status(401).json({ error: 'Invalid refresh token' }); }
});

app.post('/api/auth/logout', auth, async (req, res) => res.json({ ok: true }));
app.get('/api/auth/me', auth, async (req, res) => {
  if (req.user.role === 'client') await dispatchAppointmentReminders(req.user.userId);
  res.json(req.user);
});
app.patch('/api/auth/me', auth, async (req, res) => {
  await db.query('UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone), avatar = COALESCE(?, avatar) WHERE id = ?', [req.body.name ?? null, req.body.phone ?? null, req.body.avatar ?? null, req.user.userId]);
  res.json(await loadCurrentUser(req.user.userId));
});
app.patch('/api/auth/me/push-token', auth, async (req, res) => {
  const token = String(req.body.expoPushToken || '').trim();
  if (token && !isExpoPushToken(token)) {
    return res.status(400).json({ error: 'Invalid Expo push token' });
  }
  await db.query(
    'UPDATE users SET expoPushToken = ?, pushTokenUpdatedAt = CASE WHEN ? IS NULL THEN pushTokenUpdatedAt ELSE NOW() END, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
    [token || null, token || null, req.user.userId],
  );
  res.json({ ok: true });
});

app.get('/api/properties', async (req, res) => {
  const [rows] = await db.query('SELECT * FROM properties ORDER BY score DESC, createdAt DESC');
  res.json({ total: rows.length, items: rows.map(formatProperty) });
});
app.get('/api/properties/:id', async (req, res) => {
  const [rows] = await db.query('SELECT * FROM properties WHERE id = ?', [req.params.id]);
  return rows.length ? res.json(formatProperty(rows[0])) : res.status(404).json({ error: 'Property not found' });
});
app.get('/api/properties/my/favorites', auth, async (req, res) => {
  const actionRows = await listClientProjectActionRows(req.user.userId, ['favorited']);
  res.json(await fetchPropertiesByIds(actionRows.map((row) => row.propertyId)));
});
app.get('/api/properties/my/swipes', auth, async (req, res) => {
  const actionRows = await listClientProjectActionRows(req.user.userId, ['liked', 'passed']);
  res.json(actionRows.map((row) => ({ propertyId: row.propertyId, liked: row.actionType === 'liked' })));
});
app.get('/api/properties/my/matches', auth, async (req, res) => {
  if (req.user.role !== 'client') return res.status(403).json({ error: 'Access denied' });
  const blockedReason = matchingBlockedReasonForUser(req.user);

  const actionRows = await listClientProjectActionRows(req.user.userId, ['liked', 'passed', 'favorited']);
  const likedIds = actionRows.filter((item) => item.actionType === 'liked').map((item) => item.propertyId);
  const passedIds = actionRows.filter((item) => item.actionType === 'passed').map((item) => item.propertyId);
  const favoritedIds = actionRows.filter((item) => item.actionType === 'favorited').map((item) => item.propertyId);
  const excludedIds = Array.from(new Set([...likedIds, ...passedIds, ...favoritedIds]));

  const [leadRows] = await db.query('SELECT answers FROM leads WHERE clientId = ? ORDER BY createdAt DESC LIMIT 1', [req.user.userId]);
  const answers = leadRows[0] ? parseJson(leadRows[0].answers, {}) : {};
  const available = blockedReason ? [] : (await matchedProperties(answers))
    .filter((item) => !excludedIds.includes(item.id));

  res.json({
    blockedReason,
    available,
    liked: await fetchPropertiesByIds(likedIds),
    passed: await fetchPropertiesByIds(passedIds),
  });
});
app.post('/api/properties/:id/favorite', auth, async (req, res) => {
  const [existing] = await db.query('SELECT id FROM favorites WHERE userId = ? AND propertyId = ?', [req.user.userId, req.params.id]);
  if (existing.length) {
    await db.query('DELETE FROM favorites WHERE userId = ? AND propertyId = ?', [req.user.userId, req.params.id]);
    await removeClientProjectAction(req.user.userId, req.params.id, 'favorited');
    return res.json({ favorited: false });
  }
  await db.query('INSERT INTO favorites (id, userId, propertyId) VALUES (?, ?, ?)', [randomUUID(), req.user.userId, req.params.id]);
  await upsertClientProjectAction(req.user.userId, req.params.id, 'favorited');
  if (req.user.role === 'client') {
    await ensureLeadForClientInterest(req.user.userId, req.params.id, 'ajoute aux favoris');
    await notifyPromoterForProjectInterest(req.params.id, req.user.name || 'Un client', 'ajoute aux favoris', req.params.id);
  }
  res.json({ favorited: true });
});
app.post('/api/properties/:id/swipe', auth, async (req, res) => {
  if (req.user.role === 'client' && !!req.body.liked) {
    const blockedReason = matchingBlockedReasonForUser(req.user);
    if (blockedReason) return res.status(403).json({ error: blockedReason });
  }
  const [existing] = await db.query('SELECT id FROM swipes WHERE userId = ? AND propertyId = ?', [req.user.userId, req.params.id]);
  const [propertyRows] = await db.query('SELECT title, project, promoterId FROM properties WHERE id = ? LIMIT 1', [req.params.id]);
  const property = propertyRows[0] || null;
  if (existing.length) await db.query('UPDATE swipes SET liked = ?, updatedAt = CURRENT_TIMESTAMP WHERE userId = ? AND propertyId = ?', [!!req.body.liked, req.user.userId, req.params.id]);
  else await db.query('INSERT INTO swipes (id, userId, propertyId, liked) VALUES (?, ?, ?, ?)', [randomUUID(), req.user.userId, req.params.id, !!req.body.liked]);
  await setClientReaction(req.user.userId, req.params.id, !!req.body.liked ? 'liked' : 'passed');
  if (req.user.role === 'client' && !!req.body.liked) {
    const result = await ensureLeadForClientInterest(req.user.userId, req.params.id, 'matche');
    await recordMatch(req.user.userId, req.params.id, result || {});
    await logClientTimelineEvent({
      clientId: req.user.userId,
      actorRole: 'client',
      actorName: req.user.name,
      actionType: 'project_liked',
      description: `Vous avez like ${property?.title || 'un projet'} et un match a ete cree automatiquement.`,
      targetId: req.params.id,
      metadata: { propertyId: req.params.id, propertyTitle: property?.title || '', projectTitle: property?.project || '' },
    });
    await logClientTimelineEvent({
      clientId: req.user.userId,
      actorRole: 'system',
      actorName: 'Selix',
      actionType: 'match_created',
      description: `Une conversation commerciale a ete ouverte pour ${property?.title || 'ce projet'}.`,
      targetId: result?.conversationId || req.params.id,
      metadata: { propertyId: req.params.id, propertyTitle: property?.title || '', conversationId: result?.conversationId || null },
    });
    await notifyPromoterForProjectInterest(req.params.id, req.user.name || 'Un client', 'aime', req.params.id);
    await notify(req.user.userId, 'Match confirme', 'Le projet a ete ajoute a vos matchs et le chat avec le commercial est pret.', 'match', req.params.id);
    if (result?.commercialId) {
      await notify(result.commercialId, 'Nouveau match client', `${req.user.name || 'Un client'} a matche un projet.`, 'match', req.params.id);
    }
    return res.json({ ok: true, liked: !!req.body.liked, conversationId: result?.conversationId || null });
  }
  if (req.user.role === 'client') {
    await logClientTimelineEvent({
      clientId: req.user.userId,
      actorRole: 'client',
      actorName: req.user.name,
      actionType: 'project_passed',
      description: `Vous avez ignore ${property?.title || 'un projet'} pour continuer votre recherche.`,
      targetId: req.params.id,
      metadata: { propertyId: req.params.id, propertyTitle: property?.title || '', projectTitle: property?.project || '' },
    });
  }
  res.json({ ok: true, liked: !!req.body.liked, conversationId: null });
});

app.post('/api/leads', auth, async (req, res) => {
  const answers = req.body.answers || req.body;
  const [existing] = await db.query('SELECT id FROM leads WHERE clientId = ?', [req.user.userId]);
  if (existing.length) return res.status(400).json({ error: 'Questionnaire already submitted' });
  const score = leadScore(answers), temperature = leadTemp(score), id = randomUUID();
  const ownership = await resolveLeadOwnership(answers);
  const commercialId = await pickCommercialForLead(ownership.promoterId, ownership.projectId);
  await db.query(
    'INSERT INTO leads (id, clientId, answers, status, notes, commercialId, promoterId, projectId, city, district, source, score, temperature) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, req.user.userId, JSON.stringify(answers), 'new', '', commercialId, ownership.promoterId, ownership.projectId, ownership.city || null, ownership.district || null, 'questionnaire', score, temperature],
  );
  await db.query('UPDATE users SET hasCompletedQuestionnaire = TRUE, accountValidationStatus = ? WHERE id = ?', ['pending_review', req.user.userId]);
  await logClientTimelineEvent({
    clientId: req.user.userId,
    actorRole: 'client',
    actorName: req.user.name,
    actionType: 'lead_submitted',
    description: 'Votre demande immobiliere a ete envoyee et votre dossier a ete cree.',
    targetId: id,
    metadata: { score, temperature },
  });
  if (commercialId) {
    const primaryMatch = ownership.matches[0] || null;
    const conversationId = temperature === 'hot'
      ? await ensureConversationBetweenUsers([req.user.userId, commercialId], primaryMatch?.id || null, primaryMatch?.title || null)
      : null;

    await notify(
      commercialId,
      temperature === 'hot' ? 'Lead chaud immediat' : 'Nouveau lead',
      `Un nouveau lead a compl?t? son questionnaire avec un score de ${score}.`,
      'lead',
      id,
    );

    if (temperature === 'hot' && conversationId) {
      await notify(commercialId, 'Boite de reception activee', 'La conversation client est disponible dans Messages.', 'message', conversationId);
    }
  }
  emitUserRealtime(req.user.userId, 'leads:updated', { leadId: id });
  if (commercialId) emitUserRealtime(commercialId, 'leads:updated', { leadId: id });
  res.status(201).json({ id, message: 'Questionnaire submitted successfully', matchedProperties: await matchedProperties(answers) });
});
app.get('/api/leads/me', auth, async (req, res) => {
  const [rows] = await db.query('SELECT * FROM leads WHERE clientId = ? ORDER BY createdAt DESC LIMIT 1', [req.user.userId]);
  return rows.length ? res.json(await formatLead(rows[0])) : res.status(404).json({ error: 'Lead not found' });
});
app.patch('/api/leads/me', auth, async (req, res) => {
  const [rows] = await db.query('SELECT * FROM leads WHERE clientId = ? ORDER BY createdAt DESC LIMIT 1', [req.user.userId]);
  if (!rows.length) return res.status(404).json({ error: 'Lead not found' });

  const lead = rows[0];
  const answers = req.body.answers || req.body;
  const score = leadScore(answers);
  const temperature = leadTemp(score);
  const ownership = await resolveLeadOwnership(answers);
  const matches = ownership.matches;

  const trackedAppointmentStatuses = appointmentStatusList(['scheduled', 'confirmed', 'completed']);
  const [[appointmentCount]] = await db.query(
    `SELECT COUNT(*) AS total
     FROM appointments
     WHERE clientId = ?
       AND status IN (${trackedAppointmentStatuses.map(() => '?').join(', ')})`,
    [req.user.userId, ...trackedAppointmentStatuses],
  );
  const [[dealCount]] = await db.query(
    "SELECT COUNT(*) AS total FROM deals WHERE clientId = ? AND status IN ('En cours', 'Sign\u00E9', 'Signe', 'Sign\\u00E9')",
    [req.user.userId],
  );
  const requiresCommercialReview = advancedLeadStatus(lead.status)
    || Number(appointmentCount.total || 0) > 0
    || Number(dealCount.total || 0) > 0;

  let notes = lead.notes || '';
  if (requiresCommercialReview) {
    notes = [notes, `${new Date().toISOString()}: le client a modifie ses criteres. Revue commerciale recommandee.`]
      .filter(Boolean)
      .join('\n');
  }

  await db.query(
    'UPDATE leads SET answers = ?, score = ?, temperature = ?, notes = ?, promoterId = ?, projectId = ?, city = ?, district = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(answers), score, temperature, notes, ownership.promoterId, ownership.projectId, ownership.city || null, ownership.district || null, lead.id],
  );
  await db.query('UPDATE users SET accountValidationStatus = ? WHERE id = ?', ['pending_review', req.user.userId]);
  await logClientTimelineEvent({
    clientId: req.user.userId,
    actorRole: 'client',
    actorName: req.user.name,
    actionType: 'profile_updated',
    description: 'Votre projet immobilier a ete mis a jour.',
    targetId: lead.id,
    metadata: { requiresCommercialReview },
  });

  if (requiresCommercialReview && lead.commercialId) {
    await notify(lead.commercialId, 'Profil client modifie', 'Le client a mis a jour ses criteres. Une revue commerciale est recommandee.', 'lead', lead.id);
  }

  emitUserRealtime(req.user.userId, 'leads:updated', { leadId: lead.id });
  if (lead.commercialId) emitUserRealtime(lead.commercialId, 'leads:updated', { leadId: lead.id });

  const [updatedRows] = await db.query('SELECT * FROM leads WHERE id = ?', [lead.id]);
  res.json({
    lead: await formatLead(updatedRows[0]),
    matchedProperties: matches,
    requiresCommercialReview,
  });
});
app.get('/api/leads', auth, async (req, res) => {
  if (req.user.role === 'admin' && !canReadAdminCrm(req.user)) return res.status(403).json({ error: 'Access denied' });
  let sql = 'SELECT * FROM leads', params = [];
  if (req.user.role === 'commercial') { sql += ' WHERE commercialId = ?'; params = [req.user.userId]; }
  else if (req.user.role === 'client') { sql += ' WHERE clientId = ?'; params = [req.user.userId]; }
  sql += ' ORDER BY createdAt DESC';
  const [rows] = await db.query(sql, params);
  const items = [];
  for (const row of rows) {
    if (req.user.role === 'admin' && !matchesAccessScope(req.user, await leadScopeEntity(row))) continue;
    items.push(await formatLead(row));
  }
  res.json({ total: items.length, items });
});
app.get('/api/leads/:id', auth, async (req, res) => {
  const [rows] = await db.query('SELECT * FROM leads WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Lead not found' });
  if (req.user.role === 'admin' && !canReadAdminCrm(req.user)) return res.status(403).json({ error: 'Access denied' });
  if (req.user.role === 'admin' && !matchesAccessScope(req.user, await leadScopeEntity(rows[0]))) return res.status(403).json({ error: 'Access denied' });
  if (req.user.role === 'commercial' && rows[0].commercialId !== req.user.userId) return res.status(403).json({ error: 'Access denied' });
  res.json(await formatLead(rows[0]));
});
app.patch('/api/leads/:id/status', auth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM leads WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Lead not found' });
    if (req.user.role === 'admin' && !canManageAdminCrm(req.user)) return res.status(403).json({ error: 'Access denied' });
    if (req.user.role === 'admin' && !matchesAccessScope(req.user, await leadScopeEntity(rows[0]))) return res.status(403).json({ error: 'Access denied' });
    if (req.user.role === 'commercial' && rows[0].commercialId !== req.user.userId) return res.status(403).json({ error: 'Access denied' });
    if (req.body.status === 'Sign\u00E9' && req.user.role !== 'promoter' && req.user.role !== 'admin') {
      return res.status(400).json({ error: 'Promoter validation required before finalizing sale' });
    }
    await db.query('UPDATE leads SET status = ?, notes = COALESCE(?, notes), updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [leadToDb[req.body.status] || 'new', req.body.note ?? req.body.notes ?? null, req.params.id]);
    const updatedLead = { ...rows[0], status: leadToDb[req.body.status] || rows[0].status, notes: req.body.note ?? req.body.notes ?? rows[0].notes };
    await logClientTimelineEvent({
      clientId: rows[0].clientId,
      actorRole: req.user.role,
      actorName: req.user.name,
      actionType: 'lead_status_updated',
      description: `Le statut de votre dossier est passe a "${req.body.status}".`,
      targetId: req.params.id,
      metadata: { status: req.body.status },
    });
    if (req.body.status === 'Contact\u00E9') {
      const conversationId = await openLeadConversation(req.params.id, req.user.userId, 'Le commercial a pris en charge ce lead. Vous pouvez echanger ici.');
      if (conversationId) {
        await notify(req.user.userId, 'Conversation client ouverte', 'La conversation est disponible dans Messages.', 'message', conversationId);
      }
    }
    if (req.user.role === 'commercial' && rows[0].clientId) {
      const statusMessage = leadStatusNotificationContent(req.body.status, req.user.name || 'Votre commercial');
      await notify(rows[0].clientId, statusMessage.title, statusMessage.body, 'lead', req.params.id);
      if (['Contacté', 'Visité'].includes(req.body.status)) {
        await notifyPromoterForCommercialLeadAction(updatedLead, req.body.status, req.user.name || 'Commercial');
      }
    }
    if (isVisitedLeadStatus(req.body.status)) {
      const visitResult = await scheduleVisitForLead(req.params.id, req.user.userId, req.body.visitDateTime || null);
      if (visitResult?.appointmentId) {
        await notify(req.user.userId, visitResult.wasCreated ? 'Visite planifiee' : 'Visite mise a jour', 'La visite est visible dans votre espace Visites et attend la confirmation du client.', 'visit', visitResult.appointmentId);
        if (!visitResult.wasCreated && visitResult.clientId) {
          await notify(visitResult.clientId, 'Visite mise a jour', 'Votre visite a ete replanifiee. Merci de confirmer votre presence depuis votre espace Visites.', 'visit', visitResult.appointmentId);
        }
      }
    }
    if (req.body.status === 'Offre') {
      await createPendingDealFromLead(req.params.id);
    }
    emitUserRealtime(rows[0].clientId, 'leads:updated', { leadId: req.params.id });
    if (rows[0].commercialId) emitUserRealtime(rows[0].commercialId, 'leads:updated', { leadId: req.params.id });
    res.json({ message: 'Lead status updated successfully' });
  } catch (error) {
    console.error('PATCH /api/leads/:id/status failed:', error?.message || error);
    res.status(500).json({ error: error?.message || 'Unable to update lead status' });
  }
});
app.patch('/api/leads/:id/notes', auth, async (req, res) => {
  const [rows] = await db.query('SELECT * FROM leads WHERE id = ? LIMIT 1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Lead not found' });
  if (req.user.role === 'admin' && !canManageAdminCrm(req.user)) return res.status(403).json({ error: 'Access denied' });
  if (req.user.role === 'admin' && !matchesAccessScope(req.user, await leadScopeEntity(rows[0]))) return res.status(403).json({ error: 'Access denied' });
  if (req.user.role === 'commercial' && rows[0].commercialId !== req.user.userId) return res.status(403).json({ error: 'Access denied' });
  if (req.user.role !== 'commercial' && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
  await db.query('UPDATE leads SET notes = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [req.body.notes || '', req.params.id]);
  res.json({ ok: true });
});
app.patch('/api/leads/:id/assign', auth, async (req, res) => {
  if (!canAssignAdminCrm(req.user)) return res.status(403).json({ error: 'Access denied' });
  const [rows] = await db.query('SELECT * FROM leads WHERE id = ? LIMIT 1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Lead not found' });
  if (!matchesAccessScope(req.user, await leadScopeEntity(rows[0]))) return res.status(403).json({ error: 'Access denied' });
  await db.query('UPDATE leads SET commercialId = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [req.body.commercialId, req.params.id]);
  res.json({ message: 'Lead assigned successfully' });
});

app.get('/api/appointments', auth, async (req, res) => {
  if (req.user.role === 'admin' && !canReadAdminCrm(req.user)) return res.status(403).json({ error: 'Access denied' });
  if (req.user.role === 'client') await dispatchAppointmentReminders(req.user.userId);
  let sql = 'SELECT * FROM appointments', params = [];
  if (req.user.role === 'commercial') { sql += ' WHERE commercialId = ?'; params = [req.user.userId]; }
  else if (req.user.role === 'client') { sql += ' WHERE clientId = ?'; params = [req.user.userId]; }
  sql += ' ORDER BY dateTime ASC';
  const [rows] = await db.query(sql, params);
  const items = [];
  for (const row of rows) {
    if (req.user.role === 'admin' && !matchesAccessScope(req.user, appointmentScopeEntity(row))) continue;
    items.push(await formatAppointment(row));
  }
  res.json(items);
});
app.post('/api/appointments', auth, async (req, res) => {
  if (req.user.role === 'admin' && !canManageAdminCrm(req.user)) return res.status(403).json({ error: 'Access denied' });
  if (req.user.role !== 'commercial' && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
  const id = randomUUID();
  const propertyScope = await resolvePropertyScope(req.body.propertyId || null);
  if (req.user.role === 'admin' && !matchesAccessScope(req.user, { promoterIds: [propertyScope.promoterId || ''], projectIds: [propertyScope.projectId || ''], cities: [propertyScope.city || ''], districts: [propertyScope.district || ''] })) return res.status(403).json({ error: 'Access denied' });
  const storageStatus = await resolveAppointmentStorageStatus(apptToDb[req.body.status] || 'scheduled');
  await db.query('INSERT INTO appointments (id, clientId, commercialId, propertyId, projectId, promoterId, city, district, title, description, dateTime, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, req.body.clientId, req.body.commercialId || req.user.userId, req.body.propertyId || null, propertyScope.projectId, propertyScope.promoterId, propertyScope.city, propertyScope.district, req.body.title || 'Visite', req.body.description || '', req.body.dateTime, storageStatus]);
  const formatted = await formatAppointment({ id, clientId: req.body.clientId, commercialId: req.body.commercialId || req.user.userId, propertyId: req.body.propertyId || null, projectId: propertyScope.projectId, promoterId: propertyScope.promoterId, city: propertyScope.city, district: propertyScope.district, title: req.body.title || 'Visite', description: req.body.description || '', dateTime: req.body.dateTime, status: storageStatus });
  await notify(req.body.clientId, 'Visite planifiee', `Une visite est prevue le ${formatted.date} a ${formatted.time}. Retrouvez-la dans votre espace Visites.`, 'visit', id);
  await notifyPromoterForAppointmentAction(
    { id, clientId: req.body.clientId, commercialId: req.body.commercialId || req.user.userId, propertyId: req.body.propertyId || null },
    formatted,
    'Rendez-vous planifie',
    `${formatted.commercialName || req.user.name || 'Un commercial'} a planifie une visite pour ${formatted.clientName} sur "${formatted.propertyTitle}" le ${formatted.date} a ${formatted.time}.`,
  );
  emitUserRealtime(req.body.clientId, 'appointments:updated', { appointmentId: id, clientId: req.body.clientId });
  emitUserRealtime(req.body.commercialId || req.user.userId, 'appointments:updated', { appointmentId: id, commercialId: req.body.commercialId || req.user.userId });
  res.status(201).json({ id, ok: true });
});
app.patch('/api/appointments/:id', auth, async (req, res) => {
  const [rows] = await db.query('SELECT * FROM appointments WHERE id = ? LIMIT 1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Appointment not found' });
  const appointment = rows[0];
  if (req.user.role === 'admin' && !canManageAdminCrm(req.user)) return res.status(403).json({ error: 'Access denied' });
  if (req.user.role === 'admin' && !matchesAccessScope(req.user, appointmentScopeEntity(appointment))) return res.status(403).json({ error: 'Access denied' });
  if (req.user.role === 'commercial' && appointment.commercialId !== req.user.userId) return res.status(403).json({ error: 'Access denied' });
  if (req.user.role !== 'commercial' && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

  const nextDate = req.body.dateTime ? new Date(req.body.dateTime) : new Date(appointment.dateTime);
  if (Number.isNaN(nextDate.getTime())) return res.status(400).json({ error: 'Invalid visit date' });
  const propertyScope = await resolvePropertyScope(req.body.propertyId || appointment.propertyId || null);

  const scheduledStatus = await resolveAppointmentStorageStatus('scheduled');
  const nextDescription = String(req.body.description || appointment.description || '').trim();
  await db.query(
    'UPDATE appointments SET propertyId = ?, projectId = ?, promoterId = ?, city = ?, district = ?, title = ?, description = ?, dateTime = ?, status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
    [req.body.propertyId || appointment.propertyId || null, propertyScope.projectId, propertyScope.promoterId, propertyScope.city, propertyScope.district, req.body.title || appointment.title || 'Visite', nextDescription, nextDate, scheduledStatus, req.params.id],
  );

  const formatted = await formatAppointment({ ...appointment, propertyId: req.body.propertyId || appointment.propertyId || null, projectId: propertyScope.projectId, promoterId: propertyScope.promoterId, city: propertyScope.city, district: propertyScope.district, title: req.body.title || appointment.title, description: nextDescription, dateTime: nextDate, status: scheduledStatus });
  await notify(appointment.clientId, 'Visite modifiee', `Votre visite est replanifiee au ${formatted.date} a ${formatted.time}.`, 'visit', req.params.id);
  await notify(appointment.commercialId, 'Visite modifiee', `La visite de ${formatted.clientName} est replanifiee au ${formatted.date} a ${formatted.time}.`, 'visit', req.params.id);
  await notifyPromoterForAppointmentAction(
    appointment,
    formatted,
    'Rendez-vous modifie',
    `${req.user.name || 'Un commercial'} a modifie une visite pour ${formatted.clientName} sur "${formatted.propertyTitle}" : ${formatted.date} a ${formatted.time}.`,
  );
  await logClientTimelineEvent({
    clientId: appointment.clientId,
    actorRole: req.user.role,
    actorName: req.user.name,
    actionType: 'visit_scheduled',
    description: `Une visite a ete replanifiee pour ${formatted.propertyTitle} le ${formatted.date} a ${formatted.time}.`,
    targetId: req.params.id,
    metadata: { status: 'Planifié' },
  });

  emitUserRealtime(appointment.clientId, 'appointments:updated', { appointmentId: req.params.id, clientId: appointment.clientId });
  emitUserRealtime(appointment.commercialId, 'appointments:updated', { appointmentId: req.params.id, commercialId: appointment.commercialId });
  res.json({ ok: true });
});
app.patch('/api/appointments/:id/status', auth, async (req, res) => {
  const storageStatus = await resolveAppointmentStorageStatus(apptToDb[req.body.status] || 'scheduled');
  const [rows] = await db.query('SELECT * FROM appointments WHERE id = ? LIMIT 1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Appointment not found' });
  const appointment = rows[0];
  if (req.user.role === 'admin' && !canManageAdminCrm(req.user)) return res.status(403).json({ error: 'Access denied' });
  if (req.user.role === 'admin' && !matchesAccessScope(req.user, appointmentScopeEntity(appointment))) return res.status(403).json({ error: 'Access denied' });
  if (req.user.role === 'client' && appointment.clientId !== req.user.userId) return res.status(403).json({ error: 'Access denied' });
  if (req.user.role === 'commercial' && appointment.commercialId !== req.user.userId) return res.status(403).json({ error: 'Access denied' });

  await db.query('UPDATE appointments SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [storageStatus, req.params.id]);
  if (req.user.role === 'client' && normalizeAppointmentStatus(storageStatus) === 'confirmed') {
    const formatted = await formatAppointment({ ...appointment, status: storageStatus });
    await notify(appointment.commercialId, 'Presence client confirmee', `${formatted.clientName} a confirme sa presence pour ${formatted.propertyTitle} le ${formatted.date} a ${formatted.time}.`, 'visit', req.params.id);
    await notifyPromoterForAppointmentAction(
      appointment,
      formatted,
      'Visite confirmee',
      `${formatted.clientName} a confirme sa presence pour "${formatted.propertyTitle}" le ${formatted.date} a ${formatted.time}.`,
    );
    await logClientTimelineEvent({
      clientId: appointment.clientId,
      actorRole: 'client',
      actorName: req.user.name,
      actionType: 'visit_confirmed',
      description: `Vous avez confirme votre presence pour la visite ${formatted.propertyTitle} du ${formatted.date} a ${formatted.time}.`,
      targetId: req.params.id,
      metadata: { status: req.body.status },
    });
  }
  if ((req.user.role === 'commercial' || req.user.role === 'admin') && normalizeAppointmentStatus(storageStatus) === 'completed') {
    const formatted = await formatAppointment({ ...appointment, status: storageStatus });
    await notify(
      appointment.clientId,
      'Visite effectuee',
      `Votre visite pour ${formatted.propertyTitle} a bien ete enregistree comme effectuee.`,
      'visit',
      req.params.id,
    );
    await notifyPromoterForAppointmentAction(
      appointment,
      formatted,
      'Visite effectuee',
      `${formatted.commercialName || req.user.name || 'Un commercial'} a marque la visite de ${formatted.clientName} comme effectuee pour "${formatted.propertyTitle}".`,
    );
    await logClientTimelineEvent({
      clientId: appointment.clientId,
      actorRole: req.user.role,
      actorName: req.user.name,
      actionType: 'visit_completed',
      description: `La visite pour ${formatted.propertyTitle} a ete marquee comme effectuee.`,
      targetId: req.params.id,
      metadata: { status: req.body.status },
    });
  }
  emitUserRealtime(appointment.clientId, 'appointments:updated', { appointmentId: req.params.id, clientId: appointment.clientId });
  emitUserRealtime(appointment.commercialId, 'appointments:updated', { appointmentId: req.params.id, commercialId: appointment.commercialId });
  res.json({ ok: true });
});
app.post('/api/appointments/:id/reschedule-request', auth, async (req, res) => {
  const [rows] = await db.query('SELECT * FROM appointments WHERE id = ? LIMIT 1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Appointment not found' });
  const appointment = rows[0];
  if (req.user.role !== 'client' || appointment.clientId !== req.user.userId) return res.status(403).json({ error: 'Access denied' });

  const formatted = await formatAppointment(appointment);
  const requestNote = String(req.body.note || '').trim();
  const nextDescription = [
    appointment.description || '',
    `${new Date().toISOString()}: demande de report client${requestNote ? ` - ${requestNote}` : ''}`,
  ].filter(Boolean).join('\n');
  const rescheduleRequestedStatus = await resolveAppointmentStorageStatus('reschedule_requested');

  await db.query(
    'UPDATE appointments SET description = ?, status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
    [nextDescription, rescheduleRequestedStatus, req.params.id],
  );

  await notify(
    appointment.commercialId,
    'Demande de report',
    `${formatted.clientName} demande le report de la visite ${formatted.propertyTitle} prevue le ${formatted.date} a ${formatted.time}.`,
    'visit',
    req.params.id,
  );
  await notifyPromoterForAppointmentAction(
    appointment,
    formatted,
    'Demande de report',
    `${formatted.clientName} a demande le report de la visite "${formatted.propertyTitle}" prevue le ${formatted.date} a ${formatted.time}.`,
  );
  await notify(
    appointment.clientId,
    'Demande envoyee',
    'Votre demande de report a ete envoyee au commercial. Vous recevrez une mise a jour des que possible.',
    'visit',
    req.params.id,
  );
  await logClientTimelineEvent({
    clientId: appointment.clientId,
    actorRole: 'client',
    actorName: req.user.name,
    actionType: 'visit_reschedule_requested',
    description: `Vous avez demande le report de la visite prevue le ${formatted.date} a ${formatted.time}.`,
    targetId: req.params.id,
  });

  emitUserRealtime(appointment.clientId, 'appointments:updated', { appointmentId: req.params.id, clientId: appointment.clientId });
  emitUserRealtime(appointment.commercialId, 'appointments:updated', { appointmentId: req.params.id, commercialId: appointment.commercialId });

  res.json({ ok: true });
});
app.delete('/api/appointments/:id', auth, async (req, res) => {
  const [rows] = await db.query('SELECT * FROM appointments WHERE id = ? LIMIT 1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Appointment not found' });
  const appointment = rows[0];
  if (req.user.role === 'admin' && !canManageAdminCrm(req.user)) return res.status(403).json({ error: 'Access denied' });
  if (req.user.role === 'admin' && !matchesAccessScope(req.user, appointmentScopeEntity(appointment))) return res.status(403).json({ error: 'Access denied' });
  if (req.user.role === 'commercial' && appointment.commercialId !== req.user.userId) return res.status(403).json({ error: 'Access denied' });
  if (req.user.role === 'client' && appointment.clientId !== req.user.userId) return res.status(403).json({ error: 'Access denied' });
  if (!['client', 'commercial', 'admin'].includes(req.user.role)) return res.status(403).json({ error: 'Access denied' });
  await db.query('DELETE FROM appointments WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

app.get('/api/interest-confirmations', auth, async (req, res) => {
  await expirePendingInterestConfirmations();
  if (req.user.role === 'admin' && !canReadAdminCrm(req.user)) return res.status(403).json({ error: 'Access denied' });
  if (req.user.role === 'promoter' && await rejectIfPromoterRestricted(req, res) === false) return;

  let sql = 'SELECT * FROM interest_confirmations';
  let params = [];
  if (req.user.role === 'client') {
    sql += ' WHERE clientId = ?';
    params = [req.user.userId];
  } else if (req.user.role === 'commercial') {
    sql += ' WHERE commercialId = ?';
    params = [req.user.userId];
  } else if (req.user.role === 'promoter') {
    sql += ' WHERE promoterId = ?';
    params = [req.user.userId];
  }
  sql += ' ORDER BY requestedAt DESC, createdAt DESC';

  const [rows] = await db.query(sql, params);
  const items = [];
  for (const row of rows) {
    if (
      req.user.role === 'admin'
      && !matchesAccessScope(req.user, {
        promoterIds: [row.promoterId || ''],
        projectIds: [row.projectId || ''],
        cities: [row.city || ''],
        districts: [row.district || ''],
      })
    ) continue;
    items.push(formatInterestConfirmation(row));
  }
  res.json(items);
});

app.post('/api/interest-confirmations', auth, async (req, res) => {
  await expirePendingInterestConfirmations();
  if (req.user.role === 'admin' && !canManageAdminCrm(req.user)) return res.status(403).json({ error: 'Access denied' });
  if (req.user.role !== 'commercial' && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

  const appointment = req.body.appointmentId
    ? (await db.query('SELECT * FROM appointments WHERE id = ? LIMIT 1', [req.body.appointmentId]))[0][0]
    : null;
  let lead = req.body.leadId
    ? (await db.query('SELECT * FROM leads WHERE id = ? LIMIT 1', [req.body.leadId]))[0][0]
    : await resolveLeadForAppointment(appointment);
  if (!lead?.id && appointment?.clientId && appointment?.propertyId) {
    const ensured = await ensureLeadForClientInterest(appointment.clientId, appointment.propertyId, 'interesse apres visite');
    if (ensured?.leadId) {
      lead = (await db.query('SELECT * FROM leads WHERE id = ? LIMIT 1', [ensured.leadId]))[0][0];
    }
  }
  if (!lead?.id) return res.status(404).json({ error: 'Lead not found' });

  if (req.user.role === 'admin' && !matchesAccessScope(req.user, await leadScopeEntity(lead))) return res.status(403).json({ error: 'Access denied' });
  if (req.user.role === 'commercial' && lead.commercialId !== req.user.userId) return res.status(403).json({ error: 'Access denied' });

  const [[pendingExisting]] = await db.query(
    "SELECT id FROM interest_confirmations WHERE leadId = ? AND status = 'pending' LIMIT 1",
    [lead.id],
  );
  if (pendingExisting?.id) return res.status(400).json({ error: 'A pending interest confirmation already exists for this lead' });

  const property = await pickBestPropertyForLead(lead);
  const promoter = property ? await resolvePromoterForProperty(property) : null;
  const effectiveAppointment = appointment?.id
    ? appointment
    : await findLatestAppointmentForLead(lead, property?.id || null);
  if (!effectiveAppointment?.id) return res.status(400).json({ error: 'A visit is required before sending an interest confirmation' });
  const [[existingForAppointment]] = await db.query(
    'SELECT id, status FROM interest_confirmations WHERE appointmentId = ? ORDER BY requestedAt DESC, createdAt DESC LIMIT 1',
    [effectiveAppointment.id],
  );
  if (existingForAppointment?.id) {
    return res.status(400).json({ error: existingForAppointment.status === 'pending' ? 'An interest confirmation has already been sent for this visit' : 'This visit already has an interest decision' });
  }

  const [clientRows] = await db.query('SELECT id, name FROM users WHERE id = ? LIMIT 1', [lead.clientId]);
  if (!clientRows.length) return res.status(400).json({ error: 'Client not found' });
  const [commercialRows] = await db.query('SELECT id, name FROM users WHERE id = ? LIMIT 1', [lead.commercialId]);
  if (!commercialRows.length) return res.status(400).json({ error: 'Commercial not found' });

  const id = randomUUID();
  const expiresAt = computeInterestConfirmationExpiry();
  const requestMessage = String(req.body.requestMessage || '').trim()
    || `Suite a votre visite, merci de confirmer si vous souhaitez avancer sur ${property?.title || 'ce projet'}.`;

  await db.query(
    `INSERT INTO interest_confirmations (
      id, leadId, appointmentId, clientId, clientName, commercialId, commercialName,
      promoterId, promoterName, propertyId, propertyTitle, projectId, projectTitle,
      city, district, status, requestMessage, expiresAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    [
      id,
      lead.id,
      effectiveAppointment.id,
      lead.clientId,
      clientRows[0].name || '',
      lead.commercialId,
      commercialRows[0].name || '',
      promoter?.id || lead.promoterId || null,
      promoter?.name || '',
      property?.id || null,
      property?.title || '',
      property?.projectId || lead.projectId || null,
      property?.project || '',
      property?.city || lead.city || '',
      property?.district || lead.district || '',
      requestMessage,
      expiresAt,
    ],
  );

  const nextNotes = [
    lead.notes || '',
    `${new Date().toISOString()}: demande de confirmation d'interet envoyee au client`,
  ].filter(Boolean).join('\n');
  await db.query('UPDATE leads SET notes = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [nextNotes, lead.id]);

  const formattedAppointment = await formatAppointment(appointment);
  await notify(
    lead.clientId,
    'Confirmation d interet demandee',
    `Votre commercial attend votre retour apres la visite de ${formattedAppointment.propertyTitle}.`,
    'lead',
    id,
  );
  await notify(
    lead.commercialId,
    'Demande envoyee',
    `La demande de confirmation d interet a ete envoyee a ${clientRows[0].name || 'ce client'}.`,
    'lead',
    id,
  );
  await logClientTimelineEvent({
    clientId: lead.clientId,
    actorRole: req.user.role,
    actorName: req.user.name,
    actionType: 'interest_confirmation_requested',
    description: `Une demande de confirmation d'interet vous a ete envoyee apres votre visite de ${formattedAppointment.propertyTitle}.`,
    targetId: id,
    metadata: { appointmentId: appointment.id, propertyId: property?.id || null, propertyTitle: property?.title || '' },
  });

  emitUserRealtime(lead.clientId, 'interest-confirmations:updated', { interestConfirmationId: id, clientId: lead.clientId });
  emitUserRealtime(lead.commercialId, 'interest-confirmations:updated', { interestConfirmationId: id, commercialId: lead.commercialId });
  emitUserRealtime(lead.clientId, 'leads:updated', { leadId: lead.id });
  emitUserRealtime(lead.commercialId, 'leads:updated', { leadId: lead.id });

  const [rows] = await db.query('SELECT * FROM interest_confirmations WHERE id = ? LIMIT 1', [id]);
  res.status(201).json(formatInterestConfirmation(rows[0]));
});

app.patch('/api/interest-confirmations/:id/respond', auth, async (req, res) => {
  await expirePendingInterestConfirmations();
  const [rows] = await db.query('SELECT * FROM interest_confirmations WHERE id = ? LIMIT 1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Interest confirmation not found' });
  const confirmation = rows[0];
  if (req.user.role === 'promoter' && await rejectIfPromoterRestricted(req, res) === false) return;
  if (req.user.role === 'admin' && !canManageAdminCrm(req.user)) return res.status(403).json({ error: 'Access denied' });
  if (req.user.role === 'admin' && !matchesAccessScope(req.user, {
    promoterIds: [confirmation.promoterId || ''],
    projectIds: [confirmation.projectId || ''],
    cities: [confirmation.city || ''],
    districts: [confirmation.district || ''],
  })) return res.status(403).json({ error: 'Access denied' });
  if (req.user.role === 'client' && confirmation.clientId !== req.user.userId) return res.status(403).json({ error: 'Access denied' });
  if (req.user.role !== 'client' && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
  if (String(confirmation.status || '') === 'expired') return res.status(400).json({ error: 'The confirmation deadline has passed' });
  if (String(confirmation.status || '') !== 'pending') return res.status(400).json({ error: 'This request has already been answered' });

  const responseStatus = ['confirmed', 'declined', 'needs_followup'].includes(String(req.body.status || ''))
    ? String(req.body.status)
    : '';
  if (!responseStatus) return res.status(400).json({ error: 'Invalid response status' });

  const responseNote = String(req.body.responseNote || '').trim();
  await db.query(
    'UPDATE interest_confirmations SET status = ?, responseNote = ?, respondedAt = NOW(), updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
    [responseStatus, responseNote, req.params.id],
  );

  const [leadRows] = await db.query('SELECT * FROM leads WHERE id = ? LIMIT 1', [confirmation.leadId]);
  const lead = leadRows[0] || null;
  let transfer = null;

  if (responseStatus === 'confirmed') {
    transfer = await createLeadTransferFromConfirmation({ ...confirmation, status: responseStatus, responseNote }, { notes: responseNote });
    if (lead?.id) {
      const nextNotes = [
        lead.notes || '',
        `${new Date().toISOString()}: client interesse confirme, lead transmis au promoteur`,
      ].filter(Boolean).join('\n');
      await db.query("UPDATE leads SET status = 'qualified', notes = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?", [nextNotes, lead.id]);
    }

    if (confirmation.commercialId) {
      await notify(
        confirmation.commercialId,
        'Interet client confirme',
        `${confirmation.clientName || 'Le client'} a confirme son interet pour ${confirmation.propertyTitle || 'ce projet'}.`,
        'lead',
        req.params.id,
      );
    }
    if (confirmation.promoterId) {
      await notify(
        confirmation.promoterId,
        'Lead qualifie transmis',
        `${confirmation.clientName || 'Un client'} est confirme comme interesse sur ${confirmation.propertyTitle || 'votre projet'}.`,
        'lead',
        transfer?.id || req.params.id,
      );
    }
    await notify(
      confirmation.clientId,
      'Interet confirme',
      'Votre retour a bien ete pris en compte. Le commercial poursuit le dossier.',
      'lead',
      req.params.id,
    );
    await logClientTimelineEvent({
      clientId: confirmation.clientId,
      actorRole: req.user.role,
      actorName: req.user.name,
      actionType: 'interest_confirmed',
      description: `Vous avez confirme votre interet pour ${confirmation.propertyTitle || 'ce projet'}.`,
      targetId: req.params.id,
      metadata: { propertyId: confirmation.propertyId || null, leadId: confirmation.leadId, transferId: transfer?.id || null },
    });
  } else {
    if (lead?.id) {
      const actionLabel = responseStatus === 'declined' ? 'interet refuse par le client' : 'demande de suivi complementaire du client';
      const nextNotes = [lead.notes || '', `${new Date().toISOString()}: ${actionLabel}`].filter(Boolean).join('\n');
      await db.query('UPDATE leads SET notes = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [nextNotes, lead.id]);
    }
    if (confirmation.commercialId) {
      await notify(
        confirmation.commercialId,
        responseStatus === 'declined' ? 'Interet refuse' : 'Suivi complementaire demande',
        responseStatus === 'declined'
          ? `${confirmation.clientName || 'Le client'} ne souhaite pas poursuivre sur ${confirmation.propertyTitle || 'ce projet'}.`
          : `${confirmation.clientName || 'Le client'} souhaite un echange complementaire avant de se decider.`,
        'lead',
        req.params.id,
      );
    }
    await logClientTimelineEvent({
      clientId: confirmation.clientId,
      actorRole: req.user.role,
      actorName: req.user.name,
      actionType: responseStatus === 'declined' ? 'interest_declined' : 'interest_followup_requested',
      description: responseStatus === 'declined'
        ? `Vous avez indique ne pas vouloir poursuivre sur ${confirmation.propertyTitle || 'ce projet'}.`
        : `Vous avez demande un suivi complementaire pour ${confirmation.propertyTitle || 'ce projet'}.`,
      targetId: req.params.id,
      metadata: { propertyId: confirmation.propertyId || null, leadId: confirmation.leadId },
    });
  }

  emitUserRealtime(confirmation.clientId, 'interest-confirmations:updated', { interestConfirmationId: req.params.id, clientId: confirmation.clientId });
  if (confirmation.commercialId) emitUserRealtime(confirmation.commercialId, 'interest-confirmations:updated', { interestConfirmationId: req.params.id, commercialId: confirmation.commercialId });
  if (confirmation.promoterId) emitUserRealtime(confirmation.promoterId, 'interest-confirmations:updated', { interestConfirmationId: req.params.id, promoterId: confirmation.promoterId });
  if (transfer?.id) {
    emitUserRealtime(confirmation.clientId, 'lead-transfers:updated', { transferId: transfer.id, clientId: confirmation.clientId });
    if (confirmation.commercialId) emitUserRealtime(confirmation.commercialId, 'lead-transfers:updated', { transferId: transfer.id, commercialId: confirmation.commercialId });
    if (confirmation.promoterId) emitUserRealtime(confirmation.promoterId, 'lead-transfers:updated', { transferId: transfer.id, promoterId: confirmation.promoterId });
  }
  emitUserRealtime(confirmation.clientId, 'leads:updated', { leadId: confirmation.leadId });
  if (confirmation.commercialId) emitUserRealtime(confirmation.commercialId, 'leads:updated', { leadId: confirmation.leadId });

  const [updatedRows] = await db.query('SELECT * FROM interest_confirmations WHERE id = ? LIMIT 1', [req.params.id]);
  res.json({
    confirmation: formatInterestConfirmation(updatedRows[0]),
    transfer,
  });
});

app.get('/api/lead-transfers', auth, async (req, res) => {
  if (req.user.role === 'admin' && !canReadDeals(req.user) && !canReadAdminCrm(req.user)) return res.status(403).json({ error: 'Access denied' });
  if (req.user.role === 'promoter' && await rejectIfPromoterRestricted(req, res) === false) return;

  let sql = 'SELECT * FROM lead_transfers';
  let params = [];
  if (req.user.role === 'client') {
    sql += ' WHERE clientId = ?';
    params = [req.user.userId];
  } else if (req.user.role === 'commercial') {
    sql += ' WHERE commercialId = ?';
    params = [req.user.userId];
  } else if (req.user.role === 'promoter') {
    sql += ' WHERE promoterId = ?';
    params = [req.user.userId];
  }
  sql += ' ORDER BY transferredAt DESC, createdAt DESC';

  const [rows] = await db.query(sql, params);
  const items = [];
  for (const row of rows) {
    if (
      req.user.role === 'admin'
      && !matchesAccessScope(req.user, {
        promoterIds: [row.promoterId || ''],
        projectIds: [row.projectId || ''],
        cities: [row.city || ''],
        districts: [row.district || ''],
      })
    ) continue;
    items.push(formatLeadTransfer(row));
  }
  res.json(items);
});

app.get('/api/calls/history', auth, async (req, res) => {
  const [rows] = await db.query(
    `SELECT *
     FROM call_sessions
     WHERE callerId = ? OR receiverId = ?
     ORDER BY COALESCE(startedAt, createdAt) DESC, createdAt DESC
     LIMIT 100`,
    [req.user.userId, req.user.userId],
  );
  res.json(rows.map((row) => formatCallSession(row, req.user.userId)));
});

app.post('/api/calls/start', auth, async (req, res) => {
  const conversationId = String(req.body.conversationId || '').trim();
  if (!conversationId) return res.status(400).json({ error: 'conversationId is required' });

  const conversation = await getConversationById(conversationId);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

  const participants = await getConversationParticipants(conversationId);
  if (!participants.some((participant) => participant.id === req.user.userId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const receiver = participants.find((participant) => participant.id !== req.user.userId) || null;
  if (!receiver) return res.status(400).json({ error: 'No counterpart available for this conversation' });

  const callerActive = await getUserActiveCall(req.user.userId);
  if (callerActive) {
    return res.status(409).json({ error: 'Vous avez deja un appel en cours.', session: formatCallSession(callerActive, req.user.userId) });
  }
  const receiverActive = await getUserActiveCall(receiver.id);
  if (receiverActive) {
    return res.status(409).json({ error: 'Le contact est deja en ligne sur un autre appel.', session: formatCallSession(receiverActive, req.user.userId) });
  }

  const caller = await getUserById(req.user.userId);
  const sessionId = randomUUID();
  await db.query(
    `INSERT INTO call_sessions (
      id, conversationId, callerId, callerName, receiverId, receiverName,
      relatedPropertyId, relatedPropertyTitle, callType, status, startedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'audio', 'ringing', NOW())`,
    [
      sessionId,
      conversationId,
      req.user.userId,
      caller?.name || req.user.name || 'Utilisateur Selix',
      receiver.id,
      receiver.name || 'Contact Selix',
      conversation.relatedPropertyId || null,
      conversation.relatedPropertyTitle || null,
    ],
  );

  await notify(
    receiver.id,
    'Appel Selix entrant',
    `${caller?.name || 'Un utilisateur'} vous appelle dans Selix.`,
    'message',
    sessionId,
  );

  const session = await emitCallSessionUpdate(sessionId);
  res.status(201).json(formatCallSession(session, req.user.userId));
});

app.patch('/api/calls/:id/respond', auth, async (req, res) => {
  const action = String(req.body.action || '').trim().toLowerCase();
  if (!['accept', 'reject'].includes(action)) return res.status(400).json({ error: 'Invalid call response action' });

  const session = await getCallSessionById(req.params.id);
  if (!session) return res.status(404).json({ error: 'Call not found' });
  if (session.receiverId !== req.user.userId) return res.status(403).json({ error: 'Access denied' });
  if (session.status !== 'ringing') return res.status(400).json({ error: 'Call is no longer awaiting a response' });

  const nextStatus = action === 'accept' ? 'accepted' : 'rejected';
  await db.query(
    `UPDATE call_sessions
     SET status = ?, answeredAt = CASE WHEN ? = 'accepted' THEN NOW() ELSE answeredAt END,
         endedAt = CASE WHEN ? = 'rejected' THEN NOW() ELSE endedAt END,
         updatedAt = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [nextStatus, nextStatus, nextStatus, req.params.id],
  );

  const updated = await emitCallSessionUpdate(req.params.id);
  if (nextStatus === 'accepted') {
    await notify(session.callerId, 'Appel Selix accepte', `${session.receiverName || 'Votre contact'} a accepte votre appel.`, 'message', req.params.id);
  } else {
    await notify(session.callerId, 'Appel Selix refuse', `${session.receiverName || 'Votre contact'} a refuse votre appel.`, 'message', req.params.id);
  }
  res.json(formatCallSession(updated, req.user.userId));
});

app.patch('/api/calls/:id/end', auth, async (req, res) => {
  const session = await getCallSessionById(req.params.id);
  if (!session) return res.status(404).json({ error: 'Call not found' });
  if (![session.callerId, session.receiverId].includes(req.user.userId)) return res.status(403).json({ error: 'Access denied' });
  if (['ended', 'rejected', 'cancelled', 'missed'].includes(String(session.status || ''))) {
    return res.json(formatCallSession(session, req.user.userId));
  }

  const nextStatus = session.status === 'accepted' ? 'ended' : session.callerId === req.user.userId ? 'cancelled' : 'missed';
  await db.query(
    `UPDATE call_sessions
     SET status = ?, endedAt = NOW(),
         durationSec = CASE
           WHEN answeredAt IS NOT NULL THEN GREATEST(TIMESTAMPDIFF(SECOND, answeredAt, NOW()), 0)
           ELSE durationSec
         END,
         updatedAt = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [nextStatus, req.params.id],
  );

  const updated = await emitCallSessionUpdate(req.params.id);
  res.json(formatCallSession(updated, req.user.userId));
});

app.get('/api/conversations', auth, async (req, res) => {
  const [rows] = await db.query(
    'SELECT DISTINCT c.* FROM conversations c JOIN conversation_participants cp ON cp.conversationId = c.id WHERE cp.userId = ? ORDER BY c.updatedAt DESC',
    [req.user.userId],
  );
  const items = [];
  for (const row of rows) {
    const [participants] = await db.query('SELECT u.id, u.name, u.phone FROM conversation_participants cp JOIN users u ON u.id = cp.userId WHERE cp.conversationId = ?', [row.id]);
    const [messages] = await db.query('SELECT content, messageType, createdAt FROM messages WHERE conversationId = ? ORDER BY createdAt DESC LIMIT 10', [row.id]);
    const [[unread]] = await db.query(
      'SELECT COUNT(*) AS total FROM messages WHERE conversationId = ? AND senderId <> ? AND readAt IS NULL',
      [row.id, req.user.userId],
    );
    const visibleMessages = req.user.role === 'client'
      ? messages.filter((message) => !isClientHiddenConversationMessage(message.content))
      : messages;
    const previewMessage = visibleMessages[0] || null;
    items.push({
      id: row.id,
      participantIds: participants.map((p) => p.id),
      participantNames: participants.map((p) => p.name),
      participantPhones: participants.map((p) => p.phone || ''),
      lastMessage:
        previewMessage?.messageType === 'image'
          ? 'Image'
          : previewMessage?.messageType === 'document'
            ? 'Document'
            : (previewMessage?.content || 'Conversation disponible'),
      lastMessageTime: previewMessage ? new Date(previewMessage.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
      unreadCount: Number(unread.total || 0),
      relatedPropertyId: row.relatedPropertyId || undefined,
      relatedPropertyTitle: row.relatedPropertyTitle || undefined,
    });
  }
  res.json(items);
});
app.get('/api/conversations/:id/messages', auth, async (req, res) => {
  await db.query(
    'UPDATE messages SET readAt = NOW() WHERE conversationId = ? AND senderId <> ? AND readAt IS NULL',
    [req.params.id, req.user.userId],
  );
  const [rows] = await db.query('SELECT m.*, u.name AS senderName, u.role AS senderRole FROM messages m JOIN users u ON u.id = m.senderId WHERE m.conversationId = ? ORDER BY m.createdAt ASC', [req.params.id]);
  const visibleRows = req.user.role === 'client'
    ? rows.filter((row) => !isClientHiddenConversationMessage(row.content))
    : rows;
  res.json(visibleRows.map((r) => ({
    id: r.id,
    conversationId: r.conversationId,
    senderId: r.senderId,
    senderName: r.senderName,
    senderRole: r.senderRole,
    content: r.content,
    messageType: r.messageType || 'text',
    timestamp: new Date(r.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    read: !!r.readAt,
  })));
});
app.post('/api/conversations', auth, async (req, res) => {
  const id = randomUUID(); const ids = Array.from(new Set([req.user.userId, ...(req.body.participantIds || [])]));
  const propertyScope = await resolvePropertyScope(req.body.relatedPropertyId || null);
  await db.query(
    'INSERT INTO conversations (id, relatedPropertyId, relatedPropertyTitle, relatedPromoterId, relatedCity, relatedDistrict) VALUES (?, ?, ?, ?, ?, ?)',
    [id, req.body.relatedPropertyId || null, req.body.relatedPropertyTitle || null, propertyScope.promoterId, propertyScope.city, propertyScope.district],
  );
  for (const userId of ids) await db.query('INSERT INTO conversation_participants (id, conversationId, userId) VALUES (?, ?, ?)', [randomUUID(), id, userId]);
  ids.forEach((userId) => emitUserRealtime(userId, 'conversations:updated', { conversationId: id }));
  res.status(201).json({ id });
});
app.post('/api/conversations/:id/messages', auth, async (req, res) => {
  const id = randomUUID();
  const messageType = ['image', 'document'].includes(req.body.messageType) ? req.body.messageType : 'text';
  await db.query('INSERT INTO messages (id, conversationId, senderId, content, messageType, deliveredAt) VALUES (?, ?, ?, ?, ?, NOW())', [id, req.params.id, req.user.userId, req.body.content, messageType]);
  await db.query('UPDATE conversations SET updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
  const [participantRows] = await db.query('SELECT userId FROM conversation_participants WHERE conversationId = ? AND userId <> ?', [req.params.id, req.user.userId]);
  const [conversationRows] = await db.query('SELECT relatedPropertyTitle FROM conversations WHERE id = ? LIMIT 1', [req.params.id]);
  const sender = await getUserById(req.user.userId);
  for (const participant of participantRows) {
    await notify(participant.userId, 'Nouveau message', `${sender?.name || 'Un utilisateur'} vous a ecrit dans le chat.`, 'message', req.params.id);
  }
  const [allParticipants] = await db.query(
    'SELECT u.id, u.role FROM conversation_participants cp JOIN users u ON u.id = cp.userId WHERE cp.conversationId = ?',
    [req.params.id],
  );
  const clientParticipant = allParticipants.find((participant) => participant.role === 'client') || null;
  if (clientParticipant?.id) {
    const isClientSender = req.user.role === 'client' && clientParticipant.id === req.user.userId;
    const labels = {
      text: isClientSender ? 'Vous avez envoye un message.' : `${sender?.name || 'Un conseiller'} vous a envoye un message.`,
      image: isClientSender ? 'Vous avez partage une image.' : `${sender?.name || 'Un conseiller'} vous a partage une image.`,
      document: isClientSender ? 'Vous avez partage un document.' : `${sender?.name || 'Un conseiller'} vous a partage un document.`,
    };
    await logClientTimelineEvent({
      clientId: clientParticipant.id,
      actorRole: req.user.role,
      actorName: sender?.name || '',
      actionType: messageType === 'document' ? 'document_shared' : 'message',
      description: `${labels[messageType]}${conversationRows[0]?.relatedPropertyTitle ? ` Dossier : ${conversationRows[0].relatedPropertyTitle}.` : ''}`,
      targetId: req.params.id,
      metadata: { messageType, conversationId: req.params.id },
    });
  }
  allParticipants.forEach((participant) => emitUserRealtime(participant.id, 'conversations:updated', { conversationId: req.params.id }));
  emitConversationRealtime(req.params.id, 'message:new', { conversationId: req.params.id, id });
  res.status(201).json({ ok: true, id });
});

app.get('/api/client/timeline', auth, async (req, res) => {
  if (req.user.role !== 'client') return res.status(403).json({ error: 'Access denied' });
  const [rows] = await db.query(
    'SELECT * FROM timeline_events WHERE clientId = ? ORDER BY createdAt DESC LIMIT 200',
    [req.user.userId],
  );
  res.json(rows.map(formatTimelineEvent));
});

app.post('/api/support/requests', auth, async (req, res) => {
  if (req.user.role !== 'client') return res.status(403).json({ error: 'Only clients can submit support requests' });
  const category = ['question', 'problem', 'feedback', 'suggestion'].includes(String(req.body.category || '').trim())
    ? String(req.body.category).trim()
    : 'question';
  const subject = String(req.body.subject || '').trim();
  const message = String(req.body.message || '').trim();
  if (subject.length < 4 || message.length < 10) {
    return res.status(400).json({ error: 'Subject or message is too short' });
  }

  const id = randomUUID();
  await db.query(
    'INSERT INTO support_requests (id, clientId, category, subject, message, status) VALUES (?, ?, ?, ?, ?, ?)',
    [id, req.user.userId, category, subject.slice(0, 255), message, 'open'],
  );

  const supportAdmins = await loadSupportAdmins();
  await Promise.all(supportAdmins.map((admin) => notify(
    admin.id,
    'Nouvelle demande support client',
    `${req.user.name || 'Un client'} a envoye une demande: ${subject.slice(0, 80)}`,
    'support_request',
    id,
  )));

  await logClientTimelineEvent({
    clientId: req.user.userId,
    actorRole: 'client',
    actorName: req.user.name,
    actionType: 'support_request_created',
    description: 'Une demande de support a ete envoyee a l equipe support client.',
    targetId: id,
    metadata: { subject, category },
  });

  const [rows] = await db.query(
    `SELECT sr.*, u.name AS clientName, u.email AS clientEmail, u.phone AS clientPhone, handler.name AS handledByName
     FROM support_requests sr
     JOIN users u ON u.id = sr.clientId
     LEFT JOIN users handler ON handler.id = sr.handledBy
     WHERE sr.id = ?
     LIMIT 1`,
    [id],
  );
  return res.status(201).json(formatSupportRequest(rows[0]));
});

app.get('/api/support/requests/me', auth, async (req, res) => {
  if (req.user.role !== 'client') return res.status(403).json({ error: 'Access denied' });
  const [rows] = await db.query(
    `SELECT sr.*, u.name AS clientName, u.email AS clientEmail, u.phone AS clientPhone, handler.name AS handledByName
     FROM support_requests sr
     JOIN users u ON u.id = sr.clientId
     LEFT JOIN users handler ON handler.id = sr.handledBy
     WHERE sr.clientId = ?
     ORDER BY sr.updatedAt DESC, sr.createdAt DESC`,
    [req.user.userId],
  );
  return res.json(rows.map(formatSupportRequest));
});
app.post('/api/support/conversation', auth, async (req, res) => {
  if (req.user.role !== 'client') return res.status(403).json({ error: 'Access denied' });
  const supportAdmin = await pickSupportAdmin();
  if (!supportAdmin?.id) return res.status(404).json({ error: 'Support client indisponible pour le moment' });

  const conversationId = await ensureConversationBetweenUsers(
    [req.user.userId, supportAdmin.id],
    null,
    'Support client Selix',
  );
  await seedConversationMessage(
    conversationId,
    supportAdmin.id,
    'Bonjour, bienvenue sur le support client Selix. Décrivez votre demande ici.',
  );
  await notify(supportAdmin.id, 'Nouvelle discussion support', `${req.user.name || 'Un client'} a ouvert une discussion support.`, 'message', conversationId);
  emitUserRealtime(req.user.userId, 'conversations:updated', { conversationId });
  emitUserRealtime(supportAdmin.id, 'conversations:updated', { conversationId });
  return res.status(201).json({ id: conversationId });
});

app.get('/api/notifications', auth, async (req, res) => {
  if (req.user.role === 'client') await dispatchAppointmentReminders(req.user.userId);
  const [rows] = await db.query('SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC', [req.user.userId]);
  const notifications = rows.map((r) => ({ id: r.id, type: r.type, title: r.title, body: r.body, read: !!r.readAt, createdAt: r.createdAt, targetId: r.targetId || undefined }));
  res.json({ notifications, unreadCount: notifications.filter((n) => !n.read).length });
});
app.patch('/api/notifications/:id/read', auth, async (req, res) => { await db.query('UPDATE notifications SET readAt = NOW() WHERE id = ? AND userId = ?', [req.params.id, req.user.userId]); res.json({ ok: true }); });
app.post('/api/notifications/mark-all-read', auth, async (req, res) => { await db.query('UPDATE notifications SET readAt = NOW() WHERE userId = ?', [req.user.userId]); res.json({ ok: true }); });

app.get('/api/projects', auth, async (req, res) => {
  if (!canReadProjects(req.user)) return res.status(403).json({ error: 'Access denied' });
  if (await rejectIfPromoterRestricted(req, res) === false) return;
  let sql = 'SELECT * FROM projects', params = [];
  if (req.user.role === 'promoter') {
    sql += ' WHERE promoterId = ? OR LOWER(TRIM(promoterName)) = LOWER(TRIM(?))';
    params = [req.user.userId, req.user.name || ''];
  }
  sql += ' ORDER BY createdAt DESC';
  const [rows] = await db.query(sql, params);
  const items = [];
  for (const row of rows.filter((item) => matchesAccessScope(req.user, projectScopeEntity(item)))) {
    items.push(await formatProjectWithUnits(row));
  }
  res.json(items);
});
app.get('/api/projects/:id', auth, async (req, res) => {
  const [rows] = await db.query('SELECT * FROM projects WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Project not found' });
  if (!canReadProjects(req.user)) return res.status(403).json({ error: 'Access denied' });
  if (await rejectIfPromoterRestricted(req, res) === false) return;
  if (!matchesAccessScope(req.user, projectScopeEntity(rows[0]))) return res.status(403).json({ error: 'Access denied' });
  if (req.user.role === 'promoter' && !projectBelongsToPromoter(rows[0], req.user)) return res.status(403).json({ error: 'Access denied' });
  return res.json(await formatProjectWithUnits(rows[0]));
});
app.get('/api/projects/:id/units', auth, async (req, res) => {
  const [rows] = await db.query('SELECT * FROM projects WHERE id = ? LIMIT 1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Project not found' });
  if (!canReadProjects(req.user)) return res.status(403).json({ error: 'Access denied' });
  if (await rejectIfPromoterRestricted(req, res) === false) return;
  if (!matchesAccessScope(req.user, projectScopeEntity(rows[0]))) return res.status(403).json({ error: 'Access denied' });
  if (req.user.role === 'promoter' && !projectBelongsToPromoter(rows[0], req.user)) return res.status(403).json({ error: 'Access denied' });
  res.json(await listProjectUnits(req.params.id));
});
app.post('/api/uploads/project-image', auth, (req, res) => {
  if (!canManageProjects(req.user)) return res.status(403).json({ error: 'Access denied' });
  uploadProjectImage.single('image')(req, res, (error) => {
    if (error) {
      return res.status(400).json({ error: error.message || 'Upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }
    const relativePath = `/uploads/projects/${req.file.filename}`;
    return res.status(201).json({ url: publicUrl(req, relativePath), path: relativePath });
  });
});
app.post('/api/uploads/message-image', auth, (req, res) => {
  uploadMessageImage.single('image')(req, res, (error) => {
    if (error) {
      return res.status(400).json({ error: error.message || 'Upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }
    const relativePath = `/uploads/messages/${req.file.filename}`;
    return res.status(201).json({ url: publicUrl(req, relativePath), path: relativePath });
  });
});
app.post('/api/uploads/message-file', auth, (req, res) => {
  uploadMessageFile.single('file')(req, res, (error) => {
    if (error) {
      return res.status(400).json({ error: error.message || 'Upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }
    const relativePath = `/uploads/messages/${req.file.filename}`;
    return res.status(201).json({
      url: publicUrl(req, relativePath),
      path: relativePath,
      name: req.file.originalname || req.file.filename,
    });
  });
});
app.post('/api/projects', auth, async (req, res) => {
  if (!canManageProjects(req.user)) return res.status(403).json({ error: 'Access denied' });
  const payload = normalizeProjectPayload(req.body);
  const validationError = validateProjectPayload(payload);
  if (validationError) return res.status(400).json({ error: validationError });

  const owner = await getUserById(req.body.promoterId);
  if (!owner || owner.role !== 'promoter') return res.status(400).json({ error: 'Valid promoter is required' });
  const commercial = payload.commercialId ? await getUserById(payload.commercialId) : null;
  if (payload.commercialId && (!commercial || commercial.role !== 'commercial')) return res.status(400).json({ error: 'Valid commercial is required' });
  if (!matchesAccessScope(req.user, { promoterIds: [owner.id], projectIds: [], cities: [payload.city], districts: [payload.district] })) return res.status(403).json({ error: 'Access denied' });

  const id = randomUUID();
  await db.query(
    `INSERT INTO projects (
      id, name, promoterId, promoterName, commercialId, commercialName, city, district, type, description, image, images, features, unitsJson, specsJson, isActive, visibleInMatching, status,
      totalUnits, availableUnits, reservedUnits, soldUnits, minPriceRaw, maxPriceRaw, areaFromRaw, areaToRaw,
      bedroomsFrom, bedroomsTo, viewLabel, delivery, completionPercent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
    [
      id, payload.name, owner.id, owner.name, commercial?.id || null, commercial?.name || '', payload.city, payload.district, payload.type, payload.description,
      payload.image, JSON.stringify(payload.images.length ? payload.images : (payload.image ? [payload.image] : [])), JSON.stringify(payload.features), JSON.stringify(payload.units), JSON.stringify(payload.specs || {}), Number(payload.isActive), Number(payload.visibleInMatching), payload.status, payload.totalUnits, payload.availableUnits, payload.reservedUnits, payload.soldUnits,
      payload.minPriceRaw, payload.maxPriceRaw, payload.areaFromRaw, payload.areaToRaw, payload.bedroomsFrom, payload.bedroomsTo, payload.viewLabel, payload.delivery, payload.completionPercent,
    ],
  );
  await syncProjectUnits(id, payload);
  if (commercial?.id) {
    await db.query(
      `INSERT INTO project_commercial_assignments (id, projectId, commercialId, assignedBy)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE assignedBy = VALUES(assignedBy), updatedAt = CURRENT_TIMESTAMP`,
      [randomUUID(), id, commercial.id, req.user.userId],
    );
  }
  await syncProjectAsProperty(id);
  const [rows] = await db.query('SELECT * FROM projects WHERE id = ?', [id]);
  await notifyPromoterForProjectUpdate(rows[0], req.user.name || 'Admin');
  return res.status(201).json(await formatProjectWithUnits(rows[0]));
});
app.patch('/api/projects/:id', auth, async (req, res) => {
  if (!canManageProjects(req.user)) return res.status(403).json({ error: 'Access denied' });
  const [existingRows] = await db.query('SELECT * FROM projects WHERE id = ?', [req.params.id]);
  if (!existingRows.length) return res.status(404).json({ error: 'Project not found' });
  const existing = existingRows[0];
  if (!matchesAccessScope(req.user, projectScopeEntity(existing))) return res.status(403).json({ error: 'Access denied' });

  const payload = normalizeProjectPayload({ ...existing, ...req.body });
  const validationError = validateProjectPayload(payload);
  if (validationError) return res.status(400).json({ error: validationError });

  let ownerId = existing.promoterId || null;
  let ownerName = existing.promoterName || '';
  let commercialId = existing.commercialId || null;
  let commercialName = existing.commercialName || '';
  if (req.body.promoterId && req.body.promoterId !== existing.promoterId) {
    const owner = await getUserById(req.body.promoterId);
    if (!owner || owner.role !== 'promoter') return res.status(400).json({ error: 'Valid promoter is required' });
    ownerId = owner.id;
    ownerName = owner.name;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'commercialId')) {
    if (!payload.commercialId) {
      commercialId = null;
      commercialName = '';
    } else {
      const commercial = await getUserById(payload.commercialId);
      if (!commercial || commercial.role !== 'commercial') return res.status(400).json({ error: 'Valid commercial is required' });
      commercialId = commercial.id;
      commercialName = commercial.name;
    }
  }

  await db.query(
    `UPDATE projects
     SET promoterId = ?, promoterName = ?, commercialId = ?, commercialName = ?, name = ?, city = ?, district = ?, type = ?, description = ?, image = ?, status = ?,
         images = ?, features = ?, unitsJson = ?, specsJson = ?, isActive = ?, visibleInMatching = ?, totalUnits = ?, availableUnits = ?, reservedUnits = ?, soldUnits = ?, minPriceRaw = ?, maxPriceRaw = ?,
         areaFromRaw = ?, areaToRaw = ?, bedroomsFrom = ?, bedroomsTo = ?, viewLabel = ?, delivery = ?, completionPercent = ?, updatedAt = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      ownerId, ownerName, commercialId, commercialName, payload.name, payload.city, payload.district, payload.type, payload.description, payload.image, payload.status,
      JSON.stringify(payload.images.length ? payload.images : (payload.image ? [payload.image] : [])), JSON.stringify(payload.features), JSON.stringify(payload.units), JSON.stringify(payload.specs || {}), Number(payload.isActive), Number(payload.visibleInMatching), payload.totalUnits, payload.availableUnits, payload.reservedUnits, payload.soldUnits, payload.minPriceRaw,
      payload.maxPriceRaw, payload.areaFromRaw, payload.areaToRaw, payload.bedroomsFrom, payload.bedroomsTo, payload.viewLabel, payload.delivery, payload.completionPercent, req.params.id,
    ],
  );
  await syncProjectUnits(req.params.id, { ...payload, promoterId: ownerId, commercialId });
  if (commercialId) {
    await db.query(
      `INSERT INTO project_commercial_assignments (id, projectId, commercialId, assignedBy)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE assignedBy = VALUES(assignedBy), updatedAt = CURRENT_TIMESTAMP`,
      [randomUUID(), req.params.id, commercialId, req.user.userId],
    );
  }
  await syncProjectAsProperty(req.params.id);
  const [rows] = await db.query('SELECT * FROM projects WHERE id = ?', [req.params.id]);
  await notifyPromoterForProjectUpdate(rows[0], req.user.name || 'Admin', existing);
  return res.json(await formatProjectWithUnits(rows[0]));
});
app.delete('/api/projects/:id', auth, async (req, res) => {
  if (!canManageProjects(req.user)) return res.status(403).json({ error: 'Access denied' });
  const [existingRows] = await db.query('SELECT * FROM projects WHERE id = ?', [req.params.id]);
  if (!existingRows.length) return res.status(404).json({ error: 'Project not found' });
  if (!matchesAccessScope(req.user, projectScopeEntity(existingRows[0]))) return res.status(403).json({ error: 'Access denied' });
  await deleteProjectProperty(req.params.id);
  await db.query('DELETE FROM interest_confirmations WHERE projectId = ?', [req.params.id]);
  await db.query('DELETE FROM lead_transfers WHERE projectId = ?', [req.params.id]);
  await db.query('DELETE FROM project_commercial_assignments WHERE projectId = ?', [req.params.id]);
  await db.query('DELETE FROM projects WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});
app.get('/api/deals', auth, async (req, res) => {
  if (req.user.role === 'admin' && !canReadDeals(req.user)) return res.status(403).json({ error: 'Access denied' });
  let sql = 'SELECT * FROM deals';
  let params = [];
  if (req.user.role === 'commercial') {
    sql += ' WHERE commercialId = ?';
    params = [req.user.userId];
  } else if (req.user.role === 'promoter') {
    sql += ' WHERE promoterId = ?';
    params = [req.user.userId];
  } else if (req.user.role === 'client') {
    sql += ' WHERE clientId = ?';
    params = [req.user.userId];
  }
  sql += ' ORDER BY createdAt DESC';
  const [rows] = await db.query(sql, params);
  const items = [];
  for (const row of rows) {
    if (req.user.role === 'admin' && !matchesAccessScope(req.user, await dealScopeEntity(row))) continue;
    items.push(formatDeal(row));
  }
  res.json(items);
});
app.post('/api/deals', auth, async (req, res) => {
  if (req.user.role === 'admin' && !canManageDeals(req.user)) return res.status(403).json({ error: 'Access denied' });
  if (req.user.role !== 'commercial' && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
  const [leadRows] = await db.query('SELECT * FROM leads WHERE id = ?', [req.body.leadId]);
  if (!leadRows.length) return res.status(404).json({ error: 'Lead not found' });
  if (req.user.role === 'admin' && !matchesAccessScope(req.user, await leadScopeEntity(leadRows[0]))) return res.status(403).json({ error: 'Access denied' });
  if (req.user.role === 'commercial' && leadRows[0].commercialId !== req.user.userId) return res.status(403).json({ error: 'Access denied' });
  const deal = await createPendingDealFromLead(req.body.leadId, { propertyId: req.body.propertyId, salePrice: req.body.salePrice });
  if (!deal) return res.status(400).json({ error: 'Unable to create pending deal' });
  res.status(201).json(deal);
});
app.patch('/api/deals/:id/validate', auth, async (req, res) => {
  if (req.user.role === 'admin' && !canValidateDeals(req.user)) return res.status(403).json({ error: 'Access denied' });
  if (req.user.role !== 'promoter' && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
  if (req.user.role === 'admin') {
    const [rows] = await db.query('SELECT * FROM deals WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Deal not found' });
    if (!matchesAccessScope(req.user, await dealScopeEntity(rows[0]))) return res.status(403).json({ error: 'Access denied' });
  }
  const result = await validateDealByPromoter(req.params.id, req.user);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result.deal);
});
app.get('/api/commissions', auth, async (req, res) => {
  if (req.user.role === 'admin' && !canReadCommissions(req.user)) return res.status(403).json({ error: 'Access denied' });
  let sql = 'SELECT * FROM commissions', params = [];
  if (req.user.role === 'commercial') { sql += ' WHERE commercialId = ?'; params = [req.user.userId]; }
  else if (req.user.role === 'promoter') { sql += ' WHERE promoterId = ?'; params = [req.user.userId]; }
  sql += ' ORDER BY createdAt DESC';
  const [rows] = await db.query(sql, params);
  const items = [];
  for (const row of rows) {
    if (req.user.role === 'admin' && !matchesAccessScope(req.user, await dealScopeEntity({ promoterId: row.promoterId, propertyId: row.propertyId }))) continue;
    items.push(row);
  }
  res.json(items);
});
app.patch('/api/commissions/:id/status', auth, async (req, res) => { await db.query('UPDATE commissions SET status = ? WHERE id = ?', [req.body.status, req.params.id]); res.json({ ok: true }); });

app.get('/api/promoter/team', auth, async (req, res) => {
  if (req.user.role !== 'promoter') return res.status(403).json({ error: 'Access denied' });
  if (await rejectIfPromoterRestricted(req, res) === false) return;
  const [rows] = await db.query(`
    SELECT
      u.id,
      u.name,
      u.email,
      u.phone,
      COUNT(DISTINCT l.id) AS totalLeads,
      SUM(CASE WHEN l.temperature = 'hot' THEN 1 ELSE 0 END) AS hotLeads,
      COUNT(DISTINCT a.id) AS totalVisits,
      COUNT(DISTINCT CASE WHEN lt.transferStatus IS NOT NULL THEN lt.id ELSE NULL END) AS qualifiedTransfers,
      COUNT(DISTINCT d.id) AS totalDeals,
      COALESCE(SUM(CASE WHEN d.status IN (?, ?, ?) THEN d.salePrice ELSE 0 END), 0) AS signedRevenue
    FROM promoter_commercial_assignments pca
    JOIN users u ON u.id = pca.commercialId
    LEFT JOIN leads l ON l.commercialId = u.id
    LEFT JOIN appointments a ON a.commercialId = u.id AND a.promoterId = pca.promoterId
    LEFT JOIN lead_transfers lt ON lt.commercialId = u.id AND lt.promoterId = pca.promoterId
    LEFT JOIN deals d ON d.commercialId = u.id AND d.promoterId = pca.promoterId
    WHERE pca.promoterId = ?
    GROUP BY u.id, u.name, u.email, u.phone
    ORDER BY u.name ASC
  `, [...SIGNED_DEAL_STATUS_VARIANTS, req.user.userId]);
  return res.json(rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    totalLeads: Number(row.totalLeads || 0),
    hotLeads: Number(row.hotLeads || 0),
    totalVisits: Number(row.totalVisits || 0),
    qualifiedTransfers: Number(row.qualifiedTransfers || 0),
    totalDeals: Number(row.totalDeals || 0),
    signedRevenue: Number(row.signedRevenue || 0),
  })));
});

app.get('/api/promoter/summary', auth, async (req, res) => {
  if (req.user.role !== 'promoter') return res.status(403).json({ error: 'Access denied' });
  const access = await ensurePromoterCanUseBusinessFeatures(req.user);
  if (!access.ok) {
    return res.json({
      teamSize: 0,
      projectCount: 0,
      soldUnits: 0,
      availableUnits: 0,
      teamLeads: 0,
      teamHotLeads: 0,
      totalMatches: 0,
      totalVisits: 0,
      qualifiedTransfers: 0,
      totalDeals: 0,
      signedRevenue: 0,
      subscription: {
        accountStatus: access.snapshot?.accountStatus || null,
        subscriptionStatus: access.snapshot?.subscriptionStatus || null,
        planKey: access.snapshot?.planKey || null,
        startsAt: access.snapshot?.startsAt || null,
        endsAt: access.snapshot?.endsAt || null,
        restrictedReason: access.error,
      },
    });
  }
  const commercialIds = await getCommercialIdsForPromoter(req.user.userId);
  const commercialPlaceholders = commercialIds.length ? commercialIds.map(() => '?').join(', ') : null;
  const [[projectCount]] = await db.query('SELECT COUNT(*) AS total FROM projects WHERE promoterId = ?', [req.user.userId]);
  const [[soldUnits]] = await db.query('SELECT COALESCE(SUM(soldUnits), 0) AS total FROM projects WHERE promoterId = ?', [req.user.userId]);
  const [[availableUnits]] = await db.query('SELECT COALESCE(SUM(availableUnits), 0) AS total FROM projects WHERE promoterId = ?', [req.user.userId]);
  const [[dealCount]] = await db.query('SELECT COUNT(*) AS total FROM deals WHERE promoterId = ?', [req.user.userId]);
  const [[matchCount]] = await db.query('SELECT COUNT(*) AS total FROM matches WHERE promoterId = ?', [req.user.userId]);
  const [[visitCount]] = await db.query('SELECT COUNT(*) AS total FROM appointments WHERE promoterId = ?', [req.user.userId]);
  const [[transferCount]] = await db.query('SELECT COUNT(*) AS total FROM lead_transfers WHERE promoterId = ?', [req.user.userId]);
  const [[signedRevenue]] = await db.query(
    `SELECT COALESCE(SUM(salePrice), 0) AS total
     FROM deals
     WHERE promoterId = ?
       AND status IN (?, ?, ?)`,
    [req.user.userId, ...SIGNED_DEAL_STATUS_VARIANTS],
  );
  let teamLeads = 0;
  let teamHotLeads = 0;
  if (commercialPlaceholders) {
    const [[leadTotals]] = await db.query(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN temperature = 'hot' THEN 1 ELSE 0 END) AS hotTotal
       FROM leads
       WHERE commercialId IN (${commercialPlaceholders})`,
      commercialIds,
    );
    teamLeads = Number(leadTotals.total || 0);
    teamHotLeads = Number(leadTotals.hotTotal || 0);
  }
  return res.json({
    teamSize: commercialIds.length,
    projectCount: Number(projectCount.total || 0),
    soldUnits: Number(soldUnits.total || 0),
    availableUnits: Number(availableUnits.total || 0),
    teamLeads,
    teamHotLeads,
    totalMatches: Number(matchCount.total || 0),
    totalVisits: Number(visitCount.total || 0),
    qualifiedTransfers: Number(transferCount.total || 0),
    totalDeals: Number(dealCount.total || 0),
    signedRevenue: Number(signedRevenue.total || 0),
    subscription: {
      accountStatus: access.snapshot?.accountStatus || 'active',
      subscriptionStatus: access.snapshot?.subscriptionStatus || 'active',
      planKey: access.snapshot?.planKey || null,
      startsAt: access.snapshot?.startsAt || null,
      endsAt: access.snapshot?.endsAt || null,
      restrictedReason: null,
    },
  });
});

app.get('/api/promoter/subscription', auth, async (req, res) => {
  if (req.user.role !== 'promoter') return res.status(403).json({ error: 'Access denied' });
  const snapshot = await syncPromoterAccountState(req.user.userId);
  const [plans] = await db.query('SELECT planKey, name, durationMonths, priceMad, isActive FROM subscription_plans WHERE isActive = 1 ORDER BY durationMonths ASC');
  const [paymentRequests] = await db.query(
    `SELECT id, subscriptionId, planKey, status, amountMad, paymentMethod, paymentReference, proofUrl, notes, requestedAt, validatedAt, validatedBy, createdAt, updatedAt
     FROM promoter_payment_requests
     WHERE promoterId = ?
     ORDER BY createdAt DESC`,
    [req.user.userId],
  );
  res.json({
    accountStatus: snapshot?.accountStatus || 'invited',
    subscriptionStatus: snapshot?.subscriptionStatus || 'pending',
    planKey: snapshot?.planKey || null,
    startsAt: snapshot?.startsAt || null,
    endsAt: snapshot?.endsAt || null,
    restrictedReason: isSubscriptionActive(snapshot) ? null : promoterRestrictionReason(snapshot),
    plans,
    paymentRequests,
  });
});

app.post('/api/promoter/payment-requests', auth, async (req, res) => {
  if (req.user.role !== 'promoter') return res.status(403).json({ error: 'Access denied' });
  const planKey = normalizePlanKey(req.body.planKey, '');
  if (!planKey) return res.status(400).json({ error: 'Plan requis' });
  const created = await createPromoterPaymentRequest(req.user.userId, planKey, req.body);
  if (created.error) return res.status(created.status || 400).json({ error: created.error });
  await syncPromoterAccountState(req.user.userId);
  res.status(201).json({ ok: true, ...created });
});

app.get('/api/promoter/payment-requests', auth, async (req, res) => {
  if (req.user.role !== 'promoter') return res.status(403).json({ error: 'Access denied' });
  const [rows] = await db.query(
    `SELECT id, subscriptionId, planKey, status, amountMad, paymentMethod, paymentReference, proofUrl, notes, requestedAt, validatedAt, validatedBy, createdAt, updatedAt
     FROM promoter_payment_requests
     WHERE promoterId = ?
     ORDER BY createdAt DESC`,
    [req.user.userId],
  );
  res.json(rows);
});

app.get('/api/promoter/team', auth, async (req, res) => {
  if (req.user.role !== 'promoter') return res.status(403).json({ error: 'Access denied' });
  if (await rejectIfPromoterRestricted(req, res) === false) return;
  const [rows] = await db.query(`
    SELECT
      u.id,
      u.name,
      u.email,
      u.phone,
      COUNT(DISTINCT l.id) AS totalLeads,
      SUM(CASE WHEN l.temperature = 'hot' THEN 1 ELSE 0 END) AS hotLeads,
      COUNT(DISTINCT a.id) AS totalVisits,
      COUNT(DISTINCT CASE WHEN lt.transferStatus IS NOT NULL THEN lt.id ELSE NULL END) AS qualifiedTransfers,
      COUNT(DISTINCT d.id) AS totalDeals,
      COALESCE(SUM(CASE WHEN d.status IN (?, ?, ?) THEN d.salePrice ELSE 0 END), 0) AS signedRevenue
    FROM promoter_commercial_assignments a
    JOIN users u ON u.id = a.commercialId
    LEFT JOIN leads l ON l.commercialId = u.id
    LEFT JOIN appointments a2 ON a2.commercialId = u.id AND a2.promoterId = a.promoterId
    LEFT JOIN lead_transfers lt ON lt.commercialId = u.id AND lt.promoterId = a.promoterId
    LEFT JOIN deals d ON d.commercialId = u.id AND d.promoterId = a.promoterId
    WHERE a.promoterId = ?
    GROUP BY u.id, u.name, u.email, u.phone
    ORDER BY u.name ASC
  `, [...SIGNED_DEAL_STATUS_VARIANTS, req.user.userId]);
  res.json(rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    totalLeads: Number(row.totalLeads || 0),
    hotLeads: Number(row.hotLeads || 0),
    totalVisits: Number(row.totalVisits || 0),
    qualifiedTransfers: Number(row.qualifiedTransfers || 0),
    totalDeals: Number(row.totalDeals || 0),
    signedRevenue: Number(row.signedRevenue || 0),
  })));
});
app.get('/api/promoter/summary', auth, async (req, res) => {
  if (req.user.role !== 'promoter') return res.status(403).json({ error: 'Access denied' });
  const access = await ensurePromoterCanUseBusinessFeatures(req.user);
  if (!access.ok) {
    return res.json({
      teamSize: 0,
      projectCount: 0,
      soldUnits: 0,
      availableUnits: 0,
      teamLeads: 0,
      teamHotLeads: 0,
      totalMatches: 0,
      totalVisits: 0,
      qualifiedTransfers: 0,
      totalDeals: 0,
      signedRevenue: 0,
      subscription: {
        accountStatus: access.snapshot?.accountStatus || null,
        subscriptionStatus: access.snapshot?.subscriptionStatus || null,
        planKey: access.snapshot?.planKey || null,
        startsAt: access.snapshot?.startsAt || null,
        endsAt: access.snapshot?.endsAt || null,
        restrictedReason: access.error,
      },
    });
  }
  const commercialIds = await getCommercialIdsForPromoter(req.user.userId);
  const commercialPlaceholders = commercialIds.length ? commercialIds.map(() => '?').join(', ') : null;
  const [[projectCount]] = await db.query('SELECT COUNT(*) AS total FROM projects WHERE promoterId = ?', [req.user.userId]);
  const [[soldUnits]] = await db.query('SELECT COALESCE(SUM(soldUnits), 0) AS total FROM projects WHERE promoterId = ?', [req.user.userId]);
  const [[availableUnits]] = await db.query('SELECT COALESCE(SUM(availableUnits), 0) AS total FROM projects WHERE promoterId = ?', [req.user.userId]);
  const [[dealCount]] = await db.query('SELECT COUNT(*) AS total FROM deals WHERE promoterId = ?', [req.user.userId]);
  const [[matchCount]] = await db.query('SELECT COUNT(*) AS total FROM matches WHERE promoterId = ?', [req.user.userId]);
  const [[visitCount]] = await db.query('SELECT COUNT(*) AS total FROM appointments WHERE promoterId = ?', [req.user.userId]);
  const [[transferCount]] = await db.query('SELECT COUNT(*) AS total FROM lead_transfers WHERE promoterId = ?', [req.user.userId]);
  const [[signedRevenue]] = await db.query(
    `SELECT COALESCE(SUM(salePrice), 0) AS total
     FROM deals
     WHERE promoterId = ?
       AND status IN (?, ?, ?)`,
    [req.user.userId, ...SIGNED_DEAL_STATUS_VARIANTS],
  );
  let teamLeads = 0;
  let teamHotLeads = 0;
  if (commercialPlaceholders) {
    const [[leadTotals]] = await db.query(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN temperature = 'hot' THEN 1 ELSE 0 END) AS hotTotal
       FROM leads
       WHERE commercialId IN (${commercialPlaceholders})`,
      commercialIds,
    );
    teamLeads = Number(leadTotals.total || 0);
    teamHotLeads = Number(leadTotals.hotTotal || 0);
  }
  res.json({
    teamSize: commercialIds.length,
    projectCount: Number(projectCount.total || 0),
    soldUnits: Number(soldUnits.total || 0),
    availableUnits: Number(availableUnits.total || 0),
    teamLeads,
    teamHotLeads,
    totalMatches: Number(matchCount.total || 0),
    totalVisits: Number(visitCount.total || 0),
    qualifiedTransfers: Number(transferCount.total || 0),
    totalDeals: Number(dealCount.total || 0),
    signedRevenue: Number(signedRevenue.total || 0),
    subscription: {
      accountStatus: access.snapshot?.accountStatus || 'active',
      subscriptionStatus: access.snapshot?.subscriptionStatus || 'active',
      planKey: access.snapshot?.planKey || null,
      startsAt: access.snapshot?.startsAt || null,
      endsAt: access.snapshot?.endsAt || null,
      restrictedReason: null,
    },
  });
});
app.get('/api/admin/stats', auth, async (req, res) => {
  if (!canReadAdminReports(req.user)) return res.status(403).json({ error: 'Access denied' });
  if (hasScopedRestrictions(req.user)) {
    const [leadRows] = await db.query('SELECT * FROM leads ORDER BY createdAt DESC');
    const [dealRows] = await db.query('SELECT * FROM deals ORDER BY createdAt DESC');
    const [commissionRows] = await db.query('SELECT * FROM commissions ORDER BY createdAt DESC');
    const filteredLeads = [];
    for (const row of leadRows) {
      if (matchesAccessScope(req.user, await leadScopeEntity(row))) filteredLeads.push(row);
    }
    const filteredDeals = [];
    for (const row of dealRows) {
      if (matchesAccessScope(req.user, await dealScopeEntity(row))) filteredDeals.push(row);
    }
    const filteredCommissions = [];
    for (const row of commissionRows) {
      if (matchesAccessScope(req.user, await dealScopeEntity({ promoterId: row.promoterId, propertyId: row.propertyId }))) filteredCommissions.push(row);
    }
    const signed = filteredLeads.filter((row) => row.status === 'converted').length;
    const totalLeads = filteredLeads.length;
    return res.json({
      totalLeads,
      hotLeads: filteredLeads.filter((row) => row.temperature === 'hot').length,
      signed,
      conversionRate: totalLeads ? Number(((signed / totalLeads) * 100).toFixed(1)) : 0,
      totalClients: 0,
      totalCommercials: 0,
      totalPromoters: 0,
      revenue: filteredCommissions.reduce((sum, row) => sum + Number(row.salePrice || 0), 0),
      visitsThisWeek: 0,
      newLeadsToday: filteredLeads.filter((row) => new Date(row.createdAt).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10)).length,
      activeDeals: filteredDeals.filter((row) => row.status === 'En cours').length,
      pendingCommissions: filteredCommissions.filter((row) => row.status === 'En attente').reduce((sum, row) => sum + Number(row.amount || 0), 0),
    });
  }
  const [[leadCount]] = await db.query('SELECT COUNT(*) AS total FROM leads');
  const [[hotCount]] = await db.query("SELECT COUNT(*) AS total FROM leads WHERE temperature = 'hot'");
  const [[signedCount]] = await db.query("SELECT COUNT(*) AS total FROM leads WHERE status = 'converted'");
  const [[clientCount]] = await db.query("SELECT COUNT(*) AS total FROM users WHERE role = 'client'");
  const [[commercialCount]] = await db.query("SELECT COUNT(*) AS total FROM users WHERE role = 'commercial'");
  const [[promoterCount]] = await db.query("SELECT COUNT(*) AS total FROM users WHERE role = 'promoter'");
  const [[visitsCount]] = await db.query('SELECT COUNT(*) AS total FROM appointments WHERE YEARWEEK(dateTime, 1) = YEARWEEK(CURDATE(), 1)');
  const [[newLeadsToday]] = await db.query('SELECT COUNT(*) AS total FROM leads WHERE DATE(createdAt) = CURDATE()');
  const [[activeDeals]] = await db.query("SELECT COUNT(*) AS total FROM deals WHERE status = 'En cours'");
  const [[pendingCommissions]] = await db.query("SELECT COALESCE(SUM(amount), 0) AS total FROM commissions WHERE status = 'En attente'");
  const [[revenueSum]] = await db.query('SELECT COALESCE(SUM(salePrice), 0) AS total FROM commissions');
  const totalLeads = Number(leadCount.total || 0), signed = Number(signedCount.total || 0);
  res.json({
    totalLeads,
    hotLeads: Number(hotCount.total || 0),
    signed,
    conversionRate: totalLeads ? Number(((signed / totalLeads) * 100).toFixed(1)) : 0,
    totalClients: Number(clientCount.total || 0),
    totalCommercials: Number(commercialCount.total || 0),
    totalPromoters: Number(promoterCount.total || 0),
    revenue: Number(revenueSum.total || 0),
    visitsThisWeek: Number(visitsCount.total || 0),
    newLeadsToday: Number(newLeadsToday.total || 0),
    activeDeals: Number(activeDeals.total || 0),
    pendingCommissions: Number(pendingCommissions.total || 0),
  });
});
app.get('/api/admin/pipeline', auth, async (req, res) => {
  if (!canReadAdminReports(req.user)) return res.status(403).json({ error: 'Access denied' });
  if (hasScopedRestrictions(req.user)) {
    const [rows] = await db.query('SELECT * FROM leads ORDER BY createdAt DESC');
    const filtered = [];
    for (const row of rows) {
      if (matchesAccessScope(req.user, await leadScopeEntity(row))) filtered.push(row);
    }
    const p = { nouveau: 0, contacte: 0, visite: 0, offre: 0, signe: 0, perdu: 0 };
    for (const row of filtered) {
      const label = leadFromDb[row.status] || 'Nouveau';
      if (label === 'Nouveau') p.nouveau += 1;
      if (label === 'Contacté') p.contacte += 1;
      if (label === 'Visité') p.visite += 1;
      if (label === 'Offre') p.offre += 1;
      if (label === 'Signé') p.signe += 1;
      if (label === 'Perdu') p.perdu += 1;
    }
    return res.json(p);
  }
  const [rows] = await db.query('SELECT status, COUNT(*) AS total FROM leads GROUP BY status');
  const p = { nouveau: 0, contacte: 0, visite: 0, offre: 0, signe: 0, perdu: 0 };
  for (const row of rows) {
    const label = leadFromDb[row.status] || 'Nouveau';
    if (label === 'Nouveau') p.nouveau = Number(row.total);
    if (label === 'Contact\u00E9') p.contacte = Number(row.total);
    if (label === 'Visit\u00E9') p.visite = Number(row.total);
    if (label === 'Offre') p.offre = Number(row.total);
    if (label === 'Sign\u00E9') p.signe = Number(row.total);
    if (label === 'Perdu') p.perdu = Number(row.total);
  }
  return res.json(p);
});
app.get('/api/admin/commissions', auth, async (req, res) => {
  if (!canReadAdminReports(req.user)) return res.status(403).json({ error: 'Access denied' });
  const [rows] = await db.query('SELECT * FROM commissions ORDER BY createdAt DESC');
  const items = [];
  for (const row of rows) {
    if (!matchesAccessScope(req.user, await dealScopeEntity({ promoterId: row.promoterId, propertyId: row.propertyId }))) continue;
    items.push(row);
  }
  const total = items.reduce((s, i) => s + Number(i.amount || 0), 0);
  const paid = items.filter((i) => ['Pay\u00E9e', 'Payee', 'Pay\\u00E9e'].includes(i.status)).reduce((s, i) => s + Number(i.amount || 0), 0);
  res.json({ total, paid, items });
});
app.get('/api/admin/users', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
  const roleFilter = String(req.query.role || '').trim();
  const wantsAdmins = roleFilter === 'admin';

  if (wantsAdmins) {
    if (!canManageAdminUsers(req.user)) return res.status(403).json({ error: 'Access denied' });
  } else if (roleFilter) {
    if (!canReadUserRole(req.user, roleFilter)) return res.status(403).json({ error: 'Access denied' });
  } else if (!canReadUsers(req.user)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  let sql = `
    SELECT id, name, email, phone, role, adminRole, accountStatus, accountValidationStatus, accessScope, permissions, createdAt
    FROM users
  `;
  const params = [];
  if (roleFilter) {
    sql += ' WHERE role = ?';
    params.push(roleFilter);
  } else if (!canManageAdminUsers(req.user)) {
    const visibleRoles = ['client', 'commercial', 'promoter'].filter((role) => canReadUserRole(req.user, role));
    if (!visibleRoles.length) return res.json([]);
    sql += ` WHERE role IN (${visibleRoles.map(() => '?').join(', ')})`;
    params.push(...visibleRoles);
  }
  sql += ' ORDER BY createdAt DESC';

  const [rows] = await db.query(sql, params);
  res.json(rows.map((row) => ({
    id: row.id,
    name: row.name || '',
    email: row.email || '',
    phone: row.phone || '',
    role: row.role || '',
    adminRole: row.adminRole || null,
    accountStatus: row.accountStatus || 'active',
    accountValidationStatus: normalizeAccountValidationStatus(row.accountValidationStatus, row.role === 'client' ? 'draft' : 'validated'),
    accessScope: normalizeAccessScope(row.accessScope),
    permissions: Array.isArray(parseJson(row.permissions, [])) ? parseJson(row.permissions, []) : [],
    createdAt: row.createdAt,
  })));
});
app.post('/api/admin/users', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
  const targetRole = String(req.body.role || '').trim();
  const targetAdminRole = normalizeAdminRole(req.body.adminRole);
  if (targetRole === 'admin' && !canManageAdminUsers(req.user)) return res.status(403).json({ error: 'Access denied' });
  if (targetRole === 'promoter' && !hasPermission(req.user, 'users.create.promoter')) return res.status(403).json({ error: 'Access denied' });
  if (targetRole === 'commercial' && !hasPermission(req.user, 'users.create.commercial')) return res.status(403).json({ error: 'Access denied' });
  if (!['admin', 'promoter', 'commercial'].includes(targetRole)) return res.status(400).json({ error: 'Invalid role' });
  const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [req.body.email]);
  if (existing.length) return res.status(400).json({ error: 'Email already exists' });
  const plainPassword = String(req.body.password || 'selix123').trim();
  const id = randomUUID();
  await db.query(
    'INSERT INTO users (id, name, email, phone, password, role, adminRole, accountValidationStatus, accessScope, permissions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      id,
      req.body.name,
      req.body.email,
      req.body.phone || '',
      await bcrypt.hash(plainPassword, 10),
      targetRole,
      targetRole === 'admin' ? targetAdminRole : null,
      targetRole === 'client' ? 'pending_review' : 'validated',
      targetRole === 'admin' ? JSON.stringify(emptyAccessScope()) : null,
      targetRole === 'admin' ? JSON.stringify(ADMIN_ROLE_PERMISSIONS[targetAdminRole] || ADMIN_ROLE_PERMISSIONS.support_client) : null,
    ],
  );
  res.status(201).json({ message: 'User created successfully', user: await loadCurrentUser(id), plainPassword });
});
app.get('/api/admin/access-profile', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
  res.json({
    id: req.user.id,
    role: req.user.role,
    adminRole: req.user.adminRole || 'support_client',
    accountStatus: req.user.accountStatus || 'active',
    accessScope: normalizeAccessScope(req.user.accessScope),
    permissions: req.user.permissions || [],
  });
});
app.get('/api/admin/access-options', auth, async (req, res) => {
  if (!canManageAdminUsers(req.user)) return res.status(403).json({ error: 'Access denied' });
  const [promoters] = await db.query("SELECT id, name FROM users WHERE role = 'promoter' ORDER BY name ASC");
  const [projects] = await db.query('SELECT id, name, city, district, promoterId, promoterName FROM projects ORDER BY name ASC');
  const cities = Array.from(new Set(projects.map((item) => String(item.city || '').trim()).filter(Boolean)));
  const districts = Array.from(new Set(projects.map((item) => String(item.district || '').trim()).filter(Boolean)));
  res.json({
    promoters: promoters.map((item) => ({ id: item.id, name: item.name })),
    projects: projects.map((item) => ({ id: item.id, name: item.name, city: item.city || '', district: item.district || '', promoterId: item.promoterId || '', promoterName: item.promoterName || '' })),
    cities,
    districts,
  });
});
app.patch('/api/admin/users/:id/status', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
  if (req.params.id === req.user.userId) return res.status(400).json({ error: 'Cannot change your own account status' });
  const nextStatus = String(req.body.accountStatus || '').trim().toLowerCase();
  if (!['active', 'disabled', 'blocked'].includes(nextStatus)) return res.status(400).json({ error: 'Invalid account status' });
  const [existingRows] = await db.query('SELECT role, accessScope FROM users WHERE id = ? LIMIT 1', [req.params.id]);
  if (!existingRows.length) return res.status(404).json({ error: 'User not found' });
  if (existingRows[0].role === 'admin') {
    if (!canManageAdminUsers(req.user)) return res.status(403).json({ error: 'Access denied' });
  } else if (!canManageUserRole(req.user, existingRows[0].role)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  await db.query(
    'UPDATE users SET accountStatus = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
    [nextStatus, req.params.id],
  );
  res.json({ message: 'User account status updated successfully' });
});
app.patch('/api/admin/users/:id/validation', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
  const nextStatus = normalizeAccountValidationStatus(req.body.accountValidationStatus, '');
  if (!['draft', 'pending_review', 'validated', 'rejected'].includes(nextStatus)) {
    return res.status(400).json({ error: 'Invalid validation status' });
  }
  const [existingRows] = await db.query('SELECT role FROM users WHERE id = ? LIMIT 1', [req.params.id]);
  if (!existingRows.length) return res.status(404).json({ error: 'User not found' });
  if (existingRows[0].role !== 'client') return res.status(400).json({ error: 'Validation status is only available for client accounts' });
  if (!canManageUserRole(req.user, 'client')) return res.status(403).json({ error: 'Access denied' });
  await db.query(
    'UPDATE users SET accountValidationStatus = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
    [nextStatus, req.params.id],
  );
  await notify(
    req.params.id,
    nextStatus === 'validated' ? 'Compte validé' : nextStatus === 'rejected' ? 'Dossier à compléter' : 'Validation du dossier',
    nextStatus === 'validated'
      ? 'Votre compte Selix a ete valide. Le matching est maintenant disponible.'
      : nextStatus === 'rejected'
        ? 'Votre dossier nécessite une mise à jour avant validation.'
        : 'Votre dossier est en cours de revue par Selix.',
    'system',
    req.params.id,
  );
  emitUserRealtime(req.params.id, 'leads:updated', { clientId: req.params.id });
  res.json({ message: 'Client validation status updated successfully' });
});
app.patch('/api/admin/users/:id/scope', auth, async (req, res) => {
  if (!canManageAdminUsers(req.user)) return res.status(403).json({ error: 'Access denied' });
  const [existingRows] = await db.query('SELECT role FROM users WHERE id = ? LIMIT 1', [req.params.id]);
  if (!existingRows.length) return res.status(404).json({ error: 'User not found' });
  if (existingRows[0].role !== 'admin') return res.status(400).json({ error: 'Scope can only be applied to admin users' });
  const nextScope = normalizeAccessScope(req.body.accessScope);
  await db.query(
    'UPDATE users SET accessScope = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(nextScope), req.params.id],
  );
  res.json({ message: 'User access scope updated successfully' });
});
app.patch('/api/admin/users/:id/role', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
  const nextRole = String(req.body.role || '').trim();
  const nextAdminRole = normalizeAdminRole(req.body.adminRole);
  const [existingRows] = await db.query('SELECT role FROM users WHERE id = ? LIMIT 1', [req.params.id]);
  if (!existingRows.length) return res.status(404).json({ error: 'User not found' });
  const targetRole = String(existingRows[0].role || '').trim();
  const touchesAdminAccess = targetRole === 'admin' || nextRole === 'admin';
  if (touchesAdminAccess) {
    if (!canManageAdminUsers(req.user)) return res.status(403).json({ error: 'Access denied' });
  } else if (!canManageUserRole(req.user, targetRole) || !canManageUserRole(req.user, nextRole)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  await db.query(
    'UPDATE users SET role = ?, adminRole = ?, accessScope = ?, permissions = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
    [
      nextRole,
      nextRole === 'admin' ? nextAdminRole : null,
      nextRole === 'admin' ? JSON.stringify(normalizeAccessScope(existingRows[0].accessScope)) : null,
      nextRole === 'admin' ? JSON.stringify(ADMIN_ROLE_PERMISSIONS[nextAdminRole] || ADMIN_ROLE_PERMISSIONS.support_client) : null,
      req.params.id,
    ],
  );
  res.json({ message: 'User role updated successfully' });
});
app.delete('/api/admin/users/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
  if (req.params.id === req.user.userId) return res.status(400).json({ error: 'Cannot delete your own account' });
  const [existingRows] = await db.query('SELECT role FROM users WHERE id = ? LIMIT 1', [req.params.id]);
  if (!existingRows.length) return res.status(404).json({ error: 'User not found' });
  if (existingRows[0].role === 'admin') {
    if (!canManageAdminUsers(req.user)) return res.status(403).json({ error: 'Access denied' });
  } else if (!canManageUserRole(req.user, existingRows[0].role)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  await db.query('DELETE FROM client_project_actions WHERE userId = ?', [req.params.id]);
  await db.query('DELETE FROM matches WHERE clientId = ?', [req.params.id]);
  await db.query('DELETE FROM favorites WHERE userId = ?', [req.params.id]);
  await db.query('DELETE FROM swipes WHERE userId = ?', [req.params.id]);
  await db.query('DELETE FROM notifications WHERE userId = ?', [req.params.id]);
  await db.query('DELETE FROM conversation_participants WHERE userId = ?', [req.params.id]);
  await db.query('DELETE FROM call_sessions WHERE callerId = ? OR receiverId = ?', [req.params.id, req.params.id]);
  await db.query('DELETE FROM promoter_commercial_assignments WHERE promoterId = ? OR commercialId = ?', [req.params.id, req.params.id]);
  await db.query('DELETE FROM project_commercial_assignments WHERE commercialId = ?', [req.params.id]);
  await db.query('DELETE FROM interest_confirmations WHERE clientId = ? OR commercialId = ? OR promoterId = ?', [req.params.id, req.params.id, req.params.id]);
  await db.query('DELETE FROM lead_transfers WHERE clientId = ? OR commercialId = ? OR promoterId = ?', [req.params.id, req.params.id, req.params.id]);
  await db.query('DELETE FROM promoter_payment_requests WHERE promoterId = ?', [req.params.id]);
  await db.query('DELETE FROM promoter_subscriptions WHERE promoterId = ?', [req.params.id]);
  await db.query('DELETE FROM promoter_accounts WHERE promoterId = ?', [req.params.id]);
  await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
  res.json({ message: 'User deleted successfully' });
});
app.get('/api/admin/commercials', auth, async (req, res) => {
  if (!canReadUserRole(req.user, 'commercial')) return res.status(403).json({ error: 'Access denied' });
  const [rows] = await db.query(`
    SELECT
      u.id,
      u.name,
      u.email,
      u.phone,
      u.createdAt,
      MAX(a.promoterId) AS promoterId,
      MAX(p.name) AS promoterName
    FROM users u
    LEFT JOIN promoter_commercial_assignments a ON a.commercialId = u.id
    LEFT JOIN users p ON p.id = a.promoterId
    WHERE u.role = 'commercial'
    GROUP BY u.id, u.name, u.email, u.phone, u.createdAt
    ORDER BY u.name
  `);
  res.json(rows);
});
app.get('/api/admin/promoters', auth, async (req, res) => {
  if (!canReadUserRole(req.user, 'promoter')) return res.status(403).json({ error: 'Access denied' });
  const [rows] = await db.query(`
    SELECT
      u.id,
      u.name,
      u.email,
      u.phone,
      u.createdAt,
      COUNT(DISTINCT a.commercialId) AS assignedCommercials,
      pa.accountStatus AS promoterAccountStatus,
      ps.planKey AS subscriptionPlanKey,
      ps.status AS subscriptionStatus,
      ps.startsAt AS subscriptionStartsAt,
      ps.endsAt AS subscriptionEndsAt
    FROM users u
    LEFT JOIN promoter_commercial_assignments a ON a.promoterId = u.id
    LEFT JOIN promoter_accounts pa ON pa.promoterId = u.id
    LEFT JOIN promoter_subscriptions ps ON ps.id = pa.currentSubscriptionId
    WHERE u.role = 'promoter'
    GROUP BY u.id, u.name, u.email, u.phone, u.createdAt, pa.accountStatus, ps.planKey, ps.status, ps.startsAt, ps.endsAt
    ORDER BY u.name
  `);
  res.json(rows);
});
app.get('/api/admin/assignments', auth, async (req, res) => {
  if (!canReadAssignments(req.user)) return res.status(403).json({ error: 'Access denied' });
  res.json(await listPromoterCommercialAssignments());
});
app.get('/api/admin/project-assignments', auth, async (req, res) => {
  if (!canReadAssignments(req.user)) return res.status(403).json({ error: 'Access denied' });
  res.json(await listProjectCommercialAssignments());
});
app.get('/api/admin/promoter-subscriptions', auth, async (req, res) => {
  if (!canReadUserRole(req.user, 'promoter')) return res.status(403).json({ error: 'Access denied' });
  const [rows] = await db.query(`
    SELECT
      ps.*,
      u.name AS promoterName,
      u.email AS promoterEmail,
      plan.name AS planName,
      pa.accountStatus
    FROM promoter_subscriptions ps
    JOIN users u ON u.id = ps.promoterId
    JOIN subscription_plans plan ON plan.id = ps.planId
    LEFT JOIN promoter_accounts pa ON pa.promoterId = ps.promoterId
    ORDER BY ps.createdAt DESC
  `);
  res.json(rows);
});
app.get('/api/admin/promoter-payment-requests', auth, async (req, res) => {
  if (!canReadUserRole(req.user, 'promoter')) return res.status(403).json({ error: 'Access denied' });
  const [rows] = await db.query(`
    SELECT
      pr.*,
      u.name AS promoterName,
      u.email AS promoterEmail,
      plan.name AS planName
    FROM promoter_payment_requests pr
    JOIN users u ON u.id = pr.promoterId
    JOIN subscription_plans plan ON plan.id = pr.planId
    ORDER BY FIELD(pr.status, 'pending', 'validated', 'rejected', 'cancelled'), pr.createdAt DESC
  `);
  res.json(rows);
});
app.patch('/api/admin/promoter-payment-requests/:id', auth, async (req, res) => {
  if (!canManageUserRole(req.user, 'promoter')) return res.status(403).json({ error: 'Access denied' });
  const nextStatus = normalizePaymentRequestStatus(req.body.status, '');
  if (!nextStatus) return res.status(400).json({ error: 'Invalid payment request status' });
  const result = await validatePromoterPaymentRequest(req.params.id, req.user.userId, nextStatus, req.body.adminNote ?? null);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});
app.patch('/api/admin/promoter-accounts/:id/status', auth, async (req, res) => {
  if (!canManageUserRole(req.user, 'promoter')) return res.status(403).json({ error: 'Access denied' });
  const nextStatus = normalizePromoterAccountStatus(req.body.accountStatus, '');
  if (!nextStatus) return res.status(400).json({ error: 'Invalid promoter account status' });
  await db.query(
    `INSERT INTO promoter_accounts (promoterId, accountStatus, restrictedReason)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE accountStatus = VALUES(accountStatus), restrictedReason = VALUES(restrictedReason), updatedAt = CURRENT_TIMESTAMP`,
    [req.params.id, nextStatus, String(req.body.restrictedReason || '').trim() || null],
  );
  if (['expired', 'pending_payment'].includes(nextStatus)) {
    await db.query(
      "UPDATE promoter_subscriptions SET status = CASE WHEN status = 'active' THEN 'expired' ELSE status END, updatedAt = CURRENT_TIMESTAMP WHERE promoterId = ?",
      [req.params.id],
    );
  }
  if (['suspended', 'disabled'].includes(nextStatus)) {
    await db.query(
      "UPDATE promoter_subscriptions SET status = CASE WHEN status = 'active' THEN 'suspended' ELSE status END, updatedAt = CURRENT_TIMESTAMP WHERE promoterId = ?",
      [req.params.id],
    );
  }
  await syncPromoterAccountState(req.params.id);
  res.json({ ok: true });
});
app.get('/api/admin/support/requests', auth, async (req, res) => {
  if (!canReadSupportRequests(req.user)) return res.status(403).json({ error: 'Access denied' });
  const [rows] = await db.query(
    `SELECT sr.*, u.name AS clientName, u.email AS clientEmail, u.phone AS clientPhone, handler.name AS handledByName
     FROM support_requests sr
     JOIN users u ON u.id = sr.clientId
     LEFT JOIN users handler ON handler.id = sr.handledBy
     ORDER BY FIELD(sr.status, 'open', 'in_progress', 'resolved', 'closed'), sr.updatedAt DESC, sr.createdAt DESC`,
  );
  res.json(rows.map(formatSupportRequest));
});
app.patch('/api/admin/support/requests/:id', auth, async (req, res) => {
  if (!canManageSupportRequests(req.user)) return res.status(403).json({ error: 'Access denied' });
  const nextStatus = String(req.body.status || '').trim();
  const adminNote = req.body.adminNote == null ? null : String(req.body.adminNote).trim();
  const allowedStatuses = ['open', 'in_progress', 'resolved', 'closed'];
  if (nextStatus && !allowedStatuses.includes(nextStatus)) {
    return res.status(400).json({ error: 'Invalid support request status' });
  }

  const [existingRows] = await db.query('SELECT id, clientId, status FROM support_requests WHERE id = ? LIMIT 1', [req.params.id]);
  if (!existingRows.length) return res.status(404).json({ error: 'Support request not found' });
  const existing = existingRows[0];
  const finalStatus = nextStatus || existing.status || 'open';

  await db.query(
    'UPDATE support_requests SET status = ?, adminNote = COALESCE(?, adminNote), handledBy = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
    [finalStatus, adminNote, req.user.userId, req.params.id],
  );

  if (finalStatus !== existing.status || (adminNote && adminNote.length)) {
    await notify(
      existing.clientId,
      'Mise a jour de votre demande support',
      finalStatus === 'resolved'
        ? 'Votre demande support a ete resolue.'
        : finalStatus === 'in_progress'
          ? 'Votre demande support est en cours de traitement.'
          : 'Votre demande support a ete mise a jour.',
      'support_request',
      req.params.id,
    );
  }

  res.json({ message: 'Support request updated' });
});
app.post('/api/admin/assignments', auth, async (req, res) => {
  if (!canManageAssignments(req.user)) return res.status(403).json({ error: 'Access denied' });
  const promoter = await getUserById(req.body.promoterId);
  const commercial = await getUserById(req.body.commercialId);
  if (!promoter || promoter.role !== 'promoter') return res.status(400).json({ error: 'Valid promoter is required' });
  if (!commercial || commercial.role !== 'commercial') return res.status(400).json({ error: 'Valid commercial is required' });
  await db.query(
    `INSERT INTO promoter_commercial_assignments (id, promoterId, commercialId, assignedBy)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE assignedBy = VALUES(assignedBy), updatedAt = CURRENT_TIMESTAMP`,
    [randomUUID(), promoter.id, commercial.id, req.user.userId],
  );
  emitUserRealtime(promoter.id, 'assignments:updated', { promoterId: promoter.id, commercialId: commercial.id });
  emitUserRealtime(commercial.id, 'assignments:updated', { promoterId: promoter.id, commercialId: commercial.id });
  res.status(201).json({ ok: true, assignments: await listPromoterCommercialAssignments() });
});
app.delete('/api/admin/assignments/:commercialId', auth, async (req, res) => {
  if (!canManageAssignments(req.user)) return res.status(403).json({ error: 'Access denied' });
  const promoterId = String(req.query.promoterId || req.body?.promoterId || '').trim();
  const [rows] = promoterId
    ? await db.query('SELECT promoterId, commercialId FROM promoter_commercial_assignments WHERE commercialId = ? AND promoterId = ? LIMIT 1', [req.params.commercialId, promoterId])
    : await db.query('SELECT promoterId, commercialId FROM promoter_commercial_assignments WHERE commercialId = ? LIMIT 1', [req.params.commercialId]);
  if (promoterId) {
    await db.query('DELETE FROM promoter_commercial_assignments WHERE commercialId = ? AND promoterId = ?', [req.params.commercialId, promoterId]);
  } else {
    await db.query('DELETE FROM promoter_commercial_assignments WHERE commercialId = ?', [req.params.commercialId]);
  }
  if (rows[0]?.promoterId) emitUserRealtime(rows[0].promoterId, 'assignments:updated', { promoterId: rows[0].promoterId, commercialId: rows[0].commercialId });
  if (rows[0]?.commercialId) emitUserRealtime(rows[0].commercialId, 'assignments:updated', { promoterId: rows[0].promoterId, commercialId: rows[0].commercialId });
  res.json({ ok: true });
});
app.post('/api/admin/project-assignments', auth, async (req, res) => {
  if (!canManageAssignments(req.user)) return res.status(403).json({ error: 'Access denied' });
  const [projectRows] = await db.query('SELECT id, promoterId FROM projects WHERE id = ? LIMIT 1', [req.body.projectId]);
  const project = projectRows[0] || null;
  const commercial = await getUserById(req.body.commercialId);
  if (!project) return res.status(400).json({ error: 'Valid project is required' });
  if (!commercial || commercial.role !== 'commercial') return res.status(400).json({ error: 'Valid commercial is required' });
  await db.query(
    `INSERT INTO project_commercial_assignments (id, projectId, commercialId, assignedBy)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE assignedBy = VALUES(assignedBy), updatedAt = CURRENT_TIMESTAMP`,
    [randomUUID(), project.id, commercial.id, req.user.userId],
  );
  emitUserRealtime(commercial.id, 'assignments:updated', { projectId: project.id, commercialId: commercial.id, promoterId: project.promoterId || null });
  if (project.promoterId) emitUserRealtime(project.promoterId, 'assignments:updated', { projectId: project.id, commercialId: commercial.id, promoterId: project.promoterId });
  res.status(201).json({ ok: true, assignments: await listProjectCommercialAssignments() });
});
app.delete('/api/admin/project-assignments/:projectId/:commercialId', auth, async (req, res) => {
  if (!canManageAssignments(req.user)) return res.status(403).json({ error: 'Access denied' });
  await db.query('DELETE FROM project_commercial_assignments WHERE projectId = ? AND commercialId = ?', [req.params.projectId, req.params.commercialId]);
  emitUserRealtime(req.params.commercialId, 'assignments:updated', { projectId: req.params.projectId, commercialId: req.params.commercialId });
  res.json({ ok: true });
});

io.on('connection', (socket) => {
  console.log('socket connected', socket.id);
  socket.on('join-user', (userId) => {
    if (!userId) return;
    socket.join(`user:${userId}`);
  });
  socket.on('leave-user', (userId) => {
    if (!userId) return;
    socket.leave(`user:${userId}`);
  });
  socket.on('join-conversation', (conversationId) => {
    if (!conversationId) return;
    socket.join(`conversation:${conversationId}`);
  });
  socket.on('leave-conversation', (conversationId) => {
    if (!conversationId) return;
    socket.leave(`conversation:${conversationId}`);
  });
  socket.on('call:signal', ({ targetUserId, sessionId, payload }) => {
    if (!targetUserId || !sessionId) return;
    emitUserRealtime(targetUserId, 'call:signal', { sessionId, payload: payload || null });
  });
  socket.on('disconnect', () => console.log('socket disconnected', socket.id));
});

async function startServer(port = PORT, attempts = 0) {
  if (!attempts) {
    try {
      validateConfig();
      db = await mysql.createConnection({ host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, multipleStatements: true });
      await createTables();
      await migrateLegacyAdminRoles();
      await cleanupLegacyDuplicates();
      await backfillLeadOwnership();
      await backfillAppointmentScope();
      await backfillConversationScope();
      await bootstrapAdminIfNeeded();
      await seedDemoData();
      await db.query("UPDATE users SET adminRole = 'super_admin' WHERE role = 'admin' AND (adminRole IS NULL OR adminRole = '')");
      await backfillProjectProperties();
      const [promoterRows] = await db.query("SELECT id FROM users WHERE role = 'promoter'");
      for (const promoter of promoterRows) {
        await syncPromoterAccountState(promoter.id);
      }
      startAppointmentReminderScheduler();
    } catch (error) { console.error('Database init failed:', error); process.exit(1); }
  }
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempts < 3) return setTimeout(() => startServer(port + 1, attempts + 1), 250);
    console.error('Server failed to start:', err); process.exit(1);
  });
  server.listen(port, () => console.log(`Selix Backend API running on port ${port}`));
}

startServer();

module.exports = { app, server, io };

