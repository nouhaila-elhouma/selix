import { AdminRole, User } from '../types';

export type AdminPermission =
  | '*'
  | 'access.read'
  | 'admin.manage'
  | 'assignments.read'
  | 'assignments.manage'
  | 'commissions.read'
  | 'crm.assign'
  | 'crm.manage'
  | 'crm.read'
  | 'deals.manage'
  | 'deals.read'
  | 'deals.validate'
  | 'projects.manage'
  | 'projects.read'
  | 'reports.read'
  | 'support.requests.read'
  | 'support.requests.manage'
  | 'users.create.client'
  | 'users.create.commercial'
  | 'users.create.promoter'
  | 'users.manage.client'
  | 'users.manage.commercial'
  | 'users.manage.promoter'
  | 'users.read.client'
  | 'users.read.commercial'
  | 'users.read.promoter'
  | 'users.status.client'
  | 'users.status.commercial'
  | 'users.status.promoter';

type UserLike = Pick<User, 'role' | 'adminRole' | 'permissions'> | null | undefined;

export const ADMIN_ROLE_OPTIONS: Array<{ key: AdminRole; label: string }> = [
  { key: 'super_admin', label: 'Super Admin' },
  { key: 'support_client', label: 'Support Client' },
  { key: 'support_commercial', label: 'Support Commercial' },
  { key: 'support_promoter', label: 'Support Promoteur' },
  { key: 'project_integrator', label: 'Integrateur de Projet' },
];

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'Super Admin',
  support_client: 'Support Client',
  support_commercial: 'Support Commercial',
  support_promoter: 'Support Promoteur',
  project_integrator: 'Integrateur de Projet',
};

export const ADMIN_ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
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

export function normalizeAdminRole(role?: string | null): AdminRole {
  const value = String(role || '').trim().toLowerCase();
  if (
    value === 'super_admin'
    || value === 'support_client'
    || value === 'support_commercial'
    || value === 'support_promoter'
    || value === 'project_integrator'
  ) {
    return value;
  }
  if (value === 'administrator') return 'support_client';
  if (value === 'access_manager') return 'support_commercial';
  return 'support_client';
}

export function getDefaultAdminPermissions(role?: string | null): AdminPermission[] {
  return ADMIN_ROLE_PERMISSIONS[normalizeAdminRole(role)];
}

export function getUserPermissions(user?: UserLike): string[] {
  if (!user || user.role !== 'admin') return [];
  return Array.from(new Set([
    ...getDefaultAdminPermissions(user.adminRole),
    ...((user.permissions || []) as string[]),
  ]));
}

export function hasAdminPermission(user: UserLike, permission: AdminPermission): boolean {
  const permissions = getUserPermissions(user);
  return permissions.includes('*') || permissions.includes(permission);
}

export function hasAnyAdminPermission(user: UserLike, permissions: AdminPermission[]): boolean {
  return permissions.some((permission) => hasAdminPermission(user, permission));
}

export function getAdminRoleLabel(role?: string | null): string {
  return ADMIN_ROLE_LABELS[normalizeAdminRole(role)];
}

export function canReadAdminReports(user?: UserLike): boolean {
  return hasAdminPermission(user, 'reports.read');
}

export function canAccessAdminCrm(user?: UserLike): boolean {
  return hasAdminPermission(user, 'crm.read');
}

export function canManageProjects(user?: UserLike): boolean {
  return hasAdminPermission(user, 'projects.manage');
}

export function canReadProjects(user?: UserLike): boolean {
  return hasAnyAdminPermission(user, ['projects.read', 'projects.manage']);
}

export function canManageAdminUsers(user?: UserLike): boolean {
  return hasAdminPermission(user, 'admin.manage');
}

export function canReadUsers(user?: UserLike): boolean {
  return hasAnyAdminPermission(user, ['users.read.client', 'users.read.commercial', 'users.read.promoter']);
}

export function canManageNonAdminUsers(user?: UserLike): boolean {
  return hasAnyAdminPermission(user, [
    'users.manage.client',
    'users.manage.commercial',
    'users.manage.promoter',
    'users.status.client',
    'users.status.commercial',
    'users.status.promoter',
  ]);
}

export function canCreatePromoters(user?: UserLike): boolean {
  return hasAdminPermission(user, 'users.create.promoter');
}

export function canCreateCommercials(user?: UserLike): boolean {
  return hasAdminPermission(user, 'users.create.commercial');
}

export function canReadClients(user?: UserLike): boolean {
  return hasAdminPermission(user, 'users.read.client');
}

export function canReadCommercials(user?: UserLike): boolean {
  return hasAdminPermission(user, 'users.read.commercial');
}

export function canReadPromoters(user?: UserLike): boolean {
  return hasAdminPermission(user, 'users.read.promoter');
}

export function canManageClients(user?: UserLike): boolean {
  return hasAnyAdminPermission(user, ['users.manage.client', 'users.status.client']);
}

export function canManageCommercials(user?: UserLike): boolean {
  return hasAnyAdminPermission(user, ['users.manage.commercial', 'users.status.commercial']);
}

export function canManagePromoters(user?: UserLike): boolean {
  return hasAnyAdminPermission(user, ['users.manage.promoter', 'users.status.promoter']);
}

export function canReadAssignments(user?: UserLike): boolean {
  return hasAdminPermission(user, 'assignments.read');
}

export function canManageAssignments(user?: UserLike): boolean {
  return hasAdminPermission(user, 'assignments.manage');
}

export function canReadSupportRequests(user?: UserLike): boolean {
  return hasAnyAdminPermission(user, ['support.requests.read', 'support.requests.manage']);
}

export function canManageSupportRequests(user?: UserLike): boolean {
  return hasAdminPermission(user, 'support.requests.manage');
}
