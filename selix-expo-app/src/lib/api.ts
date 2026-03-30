/**
 * Selix — API Client
 * Wraps fetch with auth token injection, token refresh, and typed helpers.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { io, Socket } from 'socket.io-client';

// Change to your machine's LAN IP when testing on a physical device
// e.g. 'http://192.168.1.100:3000/api'
export const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';
const API_ROOT = API_BASE.replace(/\/api$/, '');

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:3000';
export { SOCKET_URL };

let realtimeSocket: Socket | null = null;

export function getRealtimeSocket() {
  if (!realtimeSocket) {
    realtimeSocket = io(SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: false,
    });
  }
  return realtimeSocket;
}

export function disconnectRealtimeSocket() {
  if (realtimeSocket) {
    realtimeSocket.disconnect();
    realtimeSocket = null;
  }
}

// ─── Token storage ─────────────────────────────────────────────────────────────

const ACCESS_KEY  = '@selix/access_token';
const REFRESH_KEY = '@selix/refresh_token';

export async function saveTokens(access: string, refresh: string) {
  await AsyncStorage.multiSet([[ACCESS_KEY, access], [REFRESH_KEY, refresh]]);
}

export async function clearTokens() {
  await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY]);
}

export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(ACCESS_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(REFRESH_KEY);
}

// ─── Core fetch wrapper ────────────────────────────────────────────────────────

async function doFetch<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const token = await getAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // 401 → try to refresh once
  if (res.status === 401 && retry) {
    const refreshed = await tryRefresh();
    if (refreshed) return doFetch<T>(path, options, false);
    throw new ApiError(401, 'Session expired');
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json.error ?? 'Request failed', json);

  return json as T;
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return false;
  try {
    const data = await doFetch<{ accessToken: string; refreshToken: string }>(
      '/auth/refresh',
      { method: 'POST', body: JSON.stringify({ refreshToken }) },
      false,
    );
    await saveTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    await clearTokens();
    return false;
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─── Convenience methods ───────────────────────────────────────────────────────

export const api = {
  get:    <T>(path: string)                         => doFetch<T>(path, { method: 'GET' }),
  post:   <T>(path: string, body?: unknown)         => doFetch<T>(path, { method: 'POST',  body: JSON.stringify(body) }),
  patch:  <T>(path: string, body?: unknown)         => doFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put:    <T>(path: string, body?: unknown)         => doFetch<T>(path, { method: 'PUT',   body: JSON.stringify(body) }),
  delete: <T>(path: string)                         => doFetch<T>(path, { method: 'DELETE' }),
};

// ─── Typed API methods ────────────────────────────────────────────────────────

export interface AuthResponse {
  user: {
    id: string; name: string; email: string; phone: string;
    role: string; adminRole?: string | null; accountStatus?: string; accountValidationStatus?: string; accessScope?: unknown; permissions?: string[]; hasCompletedQuestionnaire: boolean; avatar?: string;
  };
  accessToken:  string;
  refreshToken: string;
}

export interface AppConfigResponse {
  supportEmail?: string | null;
  supportPhone?: string | null;
  supportWhatsApp?: string | null;
  supportHours?: string | null;
}

export interface SupportRequestPayload {
  category?: 'question' | 'problem' | 'feedback' | 'suggestion';
  subject: string;
  message: string;
}

export const Auth = {
  register: (body: { name: string; email: string; phone: string; password: string; role: string }) =>
    api.post<AuthResponse>('/auth/register', body),

  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }),

  logout: (refreshToken: string) =>
    api.post<{ ok: boolean }>('/auth/logout', { refreshToken }),

  me: () => api.get<AuthResponse['user']>('/auth/me'),

  updateMe: (data: Partial<{ name: string; phone: string; avatar: string }>) =>
    api.patch<AuthResponse['user']>('/auth/me', data),

  updatePushToken: (expoPushToken: string) =>
    api.patch<{ ok: boolean }>('/auth/me/push-token', { expoPushToken }),
};

export const Properties = {
  list: (params?: Record<string, string | number>) => {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return api.get<{ total: number; items: unknown[] }>(`/properties${qs}`);
  },
  get:      (id: string)             => api.get<unknown>(`/properties/${id}`),
  favorites: ()                      => api.get<unknown[]>('/properties/my/favorites'),
  swipes:    ()                      => api.get<Array<{ propertyId: string; liked: boolean }>>('/properties/my/swipes'),
  matches:   ()                      => api.get<{ available: unknown[]; liked: unknown[]; passed: unknown[]; blockedReason?: string | null }>('/properties/my/matches'),
  favorite:  (id: string)            => api.post<{ favorited: boolean }>(`/properties/${id}/favorite`),
  swipe:     (id: string, liked: boolean) => api.post<{ ok: boolean; liked: boolean; conversationId?: string | null }>(`/properties/${id}/swipe`, { liked }),
};

export const Leads = {
  submit:       (answers: unknown)   => api.post<unknown>('/leads', answers),
  updateMine:   (answers: unknown)   => api.patch<unknown>('/leads/me', answers),
  myLead:       ()                   => api.get<unknown>('/leads/me'),
  list:         (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get<{ total: number; items: unknown[] }>(`/leads${qs}`);
  },
  get:          (id: string)         => api.get<unknown>(`/leads/${id}`),
  updateStatus: (id: string, status: string, note?: string, visitDateTime?: string) =>
    api.patch<unknown>(`/leads/${id}/status`, { status, note, visitDateTime }),
  updateNotes:  (id: string, notes: string) =>
    api.patch<unknown>(`/leads/${id}/notes`, { notes }),
  assign:       (id: string, commercialId: string) =>
    api.patch<unknown>(`/leads/${id}/assign`, { commercialId }),
};

export const Appointments = {
  list:   ()                   => api.get<unknown[]>('/appointments'),
  create: (body: unknown)      => api.post<unknown>('/appointments', body),
  update: (id: string, body: unknown) => api.patch<unknown>(`/appointments/${id}`, body),
  updateStatus: (id: string, status: string) =>
    api.patch<unknown>(`/appointments/${id}/status`, { status }),
  requestReschedule: (id: string, note?: string) =>
    api.post<unknown>(`/appointments/${id}/reschedule-request`, { note }),
  cancel: (id: string)         => api.delete<unknown>(`/appointments/${id}`),
};

export const InterestConfirmations = {
  list: () => api.get<unknown[]>('/interest-confirmations'),
  create: (body: { leadId: string; appointmentId?: string; requestMessage?: string }) =>
    api.post<unknown>('/interest-confirmations', body),
  respond: (id: string, body: { status: 'confirmed' | 'declined' | 'needs_followup'; responseNote?: string }) =>
    api.patch<unknown>(`/interest-confirmations/${id}/respond`, body),
};

export const LeadTransfers = {
  list: () => api.get<unknown[]>('/lead-transfers'),
};

export const Conversations = {
  list:     ()                   => api.get<unknown[]>('/conversations'),
  messages: (id: string, page = 1) => api.get<unknown[]>(`/conversations/${id}/messages?page=${page}`),
  create:   (body: unknown)      => api.post<unknown>('/conversations', body),
  send:     (id: string, content: string, messageType: 'text' | 'image' | 'document' = 'text') =>
    api.post<unknown>(`/conversations/${id}/messages`, { content, messageType }),
};

export const Notifications = {
  list:       ()         => api.get<{ notifications: unknown[]; unreadCount: number }>('/notifications'),
  markRead:   (id: string) => api.patch<{ ok: boolean }>(`/notifications/${id}/read`),
  markAllRead: ()        => api.post<{ ok: boolean }>('/notifications/mark-all-read'),
};

export const AppConfig = {
  get: () => api.get<AppConfigResponse>('/app-config'),
};

export const Timeline = {
  list: () => api.get<unknown[]>('/client/timeline'),
};

export const SupportRequests = {
  create: (body: SupportRequestPayload) => api.post<unknown>('/support/requests', body),
  mine: () => api.get<unknown[]>('/support/requests/me'),
  openConversation: () => api.post<{ id: string }>('/support/conversation', {}),
};

export const Projects = {
  list: () => api.get<unknown[]>('/projects'),
  get:  (id: string) => api.get<unknown>(`/projects/${id}`),
  create: (body: {
    promoterId: string;
    commercialId?: string;
    name: string;
    city: string;
    district: string;
    type: string;
    description: string;
    image: string;
    images: string[];
    features?: string[];
    units?: unknown[];
    isActive?: boolean;
    visibleInMatching?: boolean;
    status: string;
    totalUnits: number;
    availableUnits: number;
    reservedUnits: number;
    soldUnits: number;
    minPriceRaw: number;
    maxPriceRaw: number;
    areaFromRaw?: number;
    areaToRaw?: number;
    bedroomsFrom?: number;
    bedroomsTo?: number;
    viewLabel?: string;
    delivery: string;
  }) => api.post<unknown>('/projects', body),
  update: (id: string, body: {
    promoterId?: string;
    commercialId?: string | null;
    name: string;
    city: string;
    district: string;
    type: string;
    description: string;
    image: string;
    images: string[];
    features?: string[];
    units?: unknown[];
    isActive?: boolean;
    visibleInMatching?: boolean;
    status: string;
    totalUnits: number;
    availableUnits: number;
    reservedUnits: number;
    soldUnits: number;
    minPriceRaw: number;
    maxPriceRaw: number;
    areaFromRaw?: number;
    areaToRaw?: number;
    bedroomsFrom?: number;
    bedroomsTo?: number;
    viewLabel?: string;
    delivery: string;
  }) => api.patch<unknown>(`/projects/${id}`, body),
  remove: (id: string) => api.delete<{ ok: boolean }>(`/projects/${id}`),
};

function guessMimeType(uri: string) {
  const value = uri.toLowerCase();
  if (value.endsWith('.png')) return 'image/png';
  if (value.endsWith('.webp')) return 'image/webp';
  if (value.endsWith('.heic')) return 'image/heic';
  if (value.endsWith('.pdf')) return 'application/pdf';
  if (value.endsWith('.doc')) return 'application/msword';
  if (value.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (value.endsWith('.txt')) return 'text/plain';
  return 'image/jpeg';
}

function fileNameFromUri(uri: string) {
  const raw = uri.split('/').pop()?.split('?')[0];
  return raw && raw.includes('.') ? raw : `photo-${Date.now()}.jpg`;
}

async function uploadAsset(path: string, uri: string, fieldName: string, retry = true): Promise<{ url: string; path: string; name?: string }> {
  const token = await getAccessToken();
  const formData = new FormData();
  formData.append(fieldName, {
    uri,
    name: fileNameFromUri(uri),
    type: guessMimeType(uri),
  } as never);

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_ROOT}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (res.status === 401 && retry) {
    const refreshed = await tryRefresh();
    if (refreshed) return uploadAsset(path, uri, fieldName, false);
    throw new ApiError(401, 'Session expired');
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json.error ?? 'Upload failed', json);
  return json as { url: string; path: string };
}

export const Uploads = {
  projectImage: (uri: string) => uploadAsset('/api/uploads/project-image', uri, 'image'),
  messageImage: (uri: string) => uploadAsset('/api/uploads/message-image', uri, 'image'),
  messageFile: (uri: string) => uploadAsset('/api/uploads/message-file', uri, 'file'),
};

export const Deals = {
  list:     ()                                             => api.get<unknown[]>('/deals'),
  create:   (body: { leadId: string; propertyId?: string; salePrice?: number }) => api.post<unknown>('/deals', body),
  validate: (id: string)                                  => api.patch<unknown>(`/deals/${id}/validate`, {}),
};

export const Commissions = {
  list:         ()                              => api.get<unknown[]>('/commissions'),
  updateStatus: (id: string, status: string)   => api.patch<unknown>(`/commissions/${id}/status`, { status }),
};

export const Admin = {
  stats:       () => api.get<unknown>('/admin/stats'),
  pipeline:    () => api.get<unknown>('/admin/pipeline'),
  accessProfile: () => api.get<unknown>('/admin/access-profile'),
  commercials: () => api.get<unknown[]>('/admin/commercials'),
  promoters:   () => api.get<unknown[]>('/admin/promoters'),
  assignments: () => api.get<unknown[]>('/admin/assignments'),
  assignCommercial: (promoterId: string, commercialId: string) =>
    api.post<unknown>('/admin/assignments', { promoterId, commercialId }),
  removeAssignment: (commercialId: string, promoterId?: string) =>
    api.delete<{ ok: boolean }>(`/admin/assignments/${commercialId}${promoterId ? `?promoterId=${encodeURIComponent(promoterId)}` : ''}`),
  users:       (role?: string) => api.get<unknown[]>(`/admin/users${role ? `?role=${role}` : ''}`),
  createUser:  (userData: { name: string; email: string; phone: string; password: string; role: string; adminRole?: string }) =>
    api.post<{ message: string; user: unknown; plainPassword?: string }>('/admin/users', userData),
  updateUserRole: (userId: string, role: string, adminRole?: string) => 
    api.patch<{ message: string }>(`/admin/users/${userId}/role`, { role, adminRole }),
  updateUserStatus: (userId: string, accountStatus: string) =>
    api.patch<{ message: string }>(`/admin/users/${userId}/status`, { accountStatus }),
  updateClientValidation: (userId: string, accountValidationStatus: string) =>
    api.patch<{ message: string }>(`/admin/users/${userId}/validation`, { accountValidationStatus }),
  updateUserScope: (userId: string, accessScope: unknown) =>
    api.patch<{ message: string }>(`/admin/users/${userId}/scope`, { accessScope }),
  accessOptions: () => api.get<unknown>('/admin/access-options'),
  deleteUser: (userId: string) => 
    api.delete<{ message: string }>(`/admin/users/${userId}`),
  commissions: () => api.get<unknown>('/admin/commissions'),
  supportRequests: () => api.get<unknown[]>('/admin/support/requests'),
  updateSupportRequest: (requestId: string, body: { status?: string; adminNote?: string }) =>
    api.patch<{ message: string }>(`/admin/support/requests/${requestId}`, body),
  promoterSubscriptions: () => api.get<unknown[]>('/admin/promoter-subscriptions'),
  promoterPaymentRequests: () => api.get<unknown[]>('/admin/promoter-payment-requests'),
  updatePromoterPaymentRequest: (requestId: string, body: { status: string; adminNote?: string }) =>
    api.patch<unknown>(`/admin/promoter-payment-requests/${requestId}`, body),
  updatePromoterAccountStatus: (promoterId: string, body: { accountStatus: string; restrictedReason?: string }) =>
    api.patch<unknown>(`/admin/promoter-accounts/${promoterId}/status`, body),
  projectAssignments: () => api.get<unknown[]>('/admin/project-assignments'),
  assignCommercialToProject: (projectId: string, commercialId: string) =>
    api.post<unknown>('/admin/project-assignments', { projectId, commercialId }),
  removeProjectAssignment: (projectId: string, commercialId: string) =>
    api.delete<{ ok: boolean }>(`/admin/project-assignments/${projectId}/${commercialId}`),
  interestConfirmations: () => api.get<unknown[]>('/interest-confirmations'),
  leadTransfers: () => api.get<unknown[]>('/lead-transfers'),
};

export const Promoter = {
  summary: () => api.get<unknown>('/promoter/summary'),
  team: () => api.get<unknown[]>('/promoter/team'),
  subscription: () => api.get<unknown>('/promoter/subscription'),
  paymentRequests: () => api.get<unknown[]>('/promoter/payment-requests'),
  createPaymentRequest: (body: { planKey: string; paymentMethod?: string; paymentReference?: string; proofUrl?: string; notes?: string }) =>
    api.post<unknown>('/promoter/payment-requests', body),
};
