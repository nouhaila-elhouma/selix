import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Lead, Property, User, Role, LeadAnswers,
  Conversation, Notification, AppScreen, AppConfig as AppConfigType, AppLanguage,
} from '../types';
import { translate } from '../i18n';
import {
  api, Auth, Leads, Properties, Notifications as NotificationsAPI,
  Conversations as ConversationsAPI, AppConfig as AppConfigAPI,
  saveTokens, clearTokens, getRefreshToken, getRealtimeSocket, disconnectRealtimeSocket,
  ApiError,
} from '../lib/api';
import { canAccessAdminCrm } from '../utils/adminAccess';
interface AppContextType {
  currentScreen: AppScreen;
  setCurrentScreen: (s: AppScreen) => void;
  currentUser: User | null;
  currentRole: Role | null;
  clientActiveTab: string;
  setClientActiveTab: (tab: string) => void;
  commercialActiveTab: string;
  setCommercialActiveTab: (tab: string) => void;
  promoterActiveTab: string;
  setPromoterActiveTab: (tab: string) => void;
  conversationFocusId: string | null;
  focusConversation: (conversationId: string | null) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateMyProfile: (data: Partial<{ name: string; phone: string; avatar: string }>) => Promise<void>;
  authError: string | null;
  authLoading: boolean;
  hasSeenOnboarding: boolean;
  setHasSeenOnboarding: (v: boolean) => void;
  leadAnswers: Partial<LeadAnswers>;
  setLeadAnswers: (a: Partial<LeadAnswers>) => void;
  hasCompletedQuestionnaire: boolean;
  submitQuestionnaire: (answers: LeadAnswers) => Promise<void>;
  startQuestionnaireEdit: () => void;
  questionnaireLoading: boolean;
  currentQuestionnaireStep: number;
  setCurrentQuestionnaireStep: (step: number) => void;
  matchedProperties: Property[];
  ignoredProperties: Property[];
  likedProperties: Property[];
  matchingBlockedReason: string | null;
  swipedIds: string[];
  likedIds: string[];
  registerSwipe: (propertyId: string, liked: boolean) => Promise<void>;
  contactCommercialForProperty: (property: Property) => Promise<void>;
  favorites: Property[];
  toggleFavorite: (p: Property) => void;
  isFavorite: (id: string) => boolean;
  loadFavorites: () => Promise<void>;
  leads: Lead[];
  leadsLoading: boolean;
  loadLeads: () => Promise<void>;
  updateLeadStatus: (id: string, status: Lead['status'], note?: string, visitDateTime?: string) => Promise<void>;
  conversations: Conversation[];
  unreadMessages: number;
  loadConversations: () => Promise<void>;
  notifications: Notification[];
  unreadCount: number;
  realtimeVersion: number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  loadNotifications: () => Promise<void>;
  appConfig: AppConfigType;
  loadAppConfig: () => Promise<void>;
  appLanguage: AppLanguage;
  setAppLanguage: (language: AppLanguage) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const AppContext = createContext<AppContextType | null>(null);
const APP_LANGUAGE_KEY = '@selix/app_language';
// ─── Helper to cast API response to frontend types ────────────────────────────

function toUser(u: any): User {
  return {
    id:                       u.id,
    name:                     u.name,
    email:                    u.email,
    phone:                    u.phone ?? '',
    role:                     u.role as Role,
    adminRole:                u.adminRole ?? null,
    accountStatus:            u.accountStatus ?? 'active',
    accessScope:              u.accessScope ?? null,
    permissions:              Array.isArray(u.permissions) ? u.permissions : [],
    avatar:                   u.avatar,
    hasCompletedQuestionnaire: u.hasCompletedQuestionnaire ?? false,
    accountValidationStatus:  u.accountValidationStatus ?? (u.role === 'client' ? 'draft' : 'validated'),
    createdAt:                u.createdAt ?? new Date().toISOString(),
  };
}

function toProperty(p: any): Property {
  return p as Property;
}

function toLead(l: any): Lead {
  return l as Lead;
}

function toConversation(c: any): Conversation {
  return c as Conversation;
}

function toNotification(n: any): Notification {
  return n as Notification;
}

function toAppConfig(config: any): AppConfigType {
  return {
    supportEmail: config?.supportEmail ?? null,
    supportPhone: config?.supportPhone ?? null,
    supportWhatsApp: config?.supportWhatsApp ?? null,
    supportHours: config?.supportHours ?? null,
  };
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function excludeSeenProperties(items: Property[], seenIds: string[]) {
  const seen = new Set(seenIds);
  return items.filter((item) => item?.id && !seen.has(item.id));
}

function isExpoGoAndroidRuntime() {
  const appOwnership = (Constants as any)?.appOwnership;
  const executionEnvironment = String((Constants as any)?.executionEnvironment || '').toLowerCase();
  return Platform.OS === 'android'
    && (appOwnership === 'expo' || executionEnvironment.includes('storeclient'));
}

function getNotificationsModule(): any | null {
  if (isExpoGoAndroidRuntime()) return null;
  try {
    return require('expo-notifications');
  } catch {
    return null;
  }
}

async function registerPushToken() {
  if (Platform.OS === 'web') return null;
  const Notifications = getNotificationsModule();
  if (!Notifications) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#D80E8C',
    });
  }

  const permissions = await Notifications.getPermissionsAsync();
  let status = permissions.status;
  if (status !== 'granted') {
    const request = await Notifications.requestPermissionsAsync();
    status = request.status;
  }
  if (status !== 'granted') return null;

  const projectId = process.env.EXPO_PUBLIC_EXPO_PROJECT_ID;
  const tokenResponse = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();
  return tokenResponse.data || null;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('Splash');
  const [currentUser, setCurrentUser]     = useState<User | null>(null);
  const [currentRole, setCurrentRole]     = useState<Role | null>(null);
  const [clientActiveTab, setClientActiveTab] = useState('Home');
  const [commercialActiveTab, setCommercialActiveTab] = useState('Dashboard');
  const [promoterActiveTab, setPromoterActiveTab] = useState('Dashboard');
  const [conversationFocusId, setConversationFocusId] = useState<string | null>(null);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [authError, setAuthError]         = useState<string | null>(null);
  const [authLoading, setAuthLoading]     = useState(false);

  // Questionnaire
  const [leadAnswers, setLeadAnswers]                         = useState<Partial<LeadAnswers>>({});
  const [hasCompletedQuestionnaire, setHasCompletedQuestionnaire] = useState(false);
  const [currentQuestionnaireStep, setCurrentQuestionnaireStep]   = useState(0);
  const [questionnaireLoading, setQuestionnaireLoading]           = useState(false);

  // Matching
  const [matchedProperties, setMatchedProperties] = useState<Property[]>([]);
  const [ignoredProperties, setIgnoredProperties] = useState<Property[]>([]);
  const [likedProperties, setLikedProperties] = useState<Property[]>([]);
  const [matchingBlockedReason, setMatchingBlockedReason] = useState<string | null>(null);
  const [swipedIds, setSwipedIds]                 = useState<string[]>([]);
  const [likedIds, setLikedIds]                   = useState<string[]>([]);
  const [favorites, setFavorites]                 = useState<Property[]>([]);

  // CRM
  const [leads, setLeads]           = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);

  // Messaging
  const [conversations, setConversations] = useState<Conversation[]>([]);

  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [realtimeVersion, setRealtimeVersion] = useState(0);
  const [appConfig, setAppConfig] = useState<AppConfigType>({
    supportEmail: null,
    supportPhone: null,
    supportWhatsApp: null,
    supportHours: null,
  });
  const [appLanguage, setAppLanguageState] = useState<AppLanguage>('fr');

  // ── Session restoration on app launch ─────────────────────────────────────
  useEffect(() => {
    loadAppConfig();
    restoreAppLanguage();
    restoreSession();
  }, []);

  async function restoreAppLanguage() {
    try {
      const storedLanguage = await AsyncStorage.getItem(APP_LANGUAGE_KEY);
      if (storedLanguage === 'fr' || storedLanguage === 'en' || storedLanguage === 'ar') {
        setAppLanguageState(storedLanguage);
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!currentUser?.id) return undefined;

    const socket = getRealtimeSocket();
    const bumpRealtime = () => setRealtimeVersion((value) => value + 1);

    const refreshClient = () => {
      bumpRealtime();
      loadNotifications();
      loadConversations();
      if (currentUser.role === 'client') loadClientData(currentUser.id);
      if (currentUser.role === 'commercial' || (currentUser.role === 'admin' && canAccessAdminCrm(currentUser))) loadLeads();
    };
    const refreshLeads = () => {
      bumpRealtime();
      if (currentUser.role === 'client') loadClientData(currentUser.id);
      if (currentUser.role === 'commercial' || (currentUser.role === 'admin' && canAccessAdminCrm(currentUser))) loadLeads();
    };
    const refreshConversations = () => {
      bumpRealtime();
      loadConversations();
      loadNotifications();
    };
    const refreshNotifications = () => {
      bumpRealtime();
      loadNotifications();
    };
    const refreshAssignments = () => {
      bumpRealtime();
      if (currentUser.role === 'commercial' || (currentUser.role === 'admin' && canAccessAdminCrm(currentUser))) loadLeads();
    };

    socket.connect();
    socket.emit('join-user', currentUser.id);
    socket.on('notifications:updated', refreshNotifications);
    socket.on('timeline:updated', refreshClient);
    socket.on('appointments:updated', refreshClient);
    socket.on('leads:updated', refreshLeads);
    socket.on('conversations:updated', refreshConversations);
    socket.on('deals:updated', refreshClient);
    socket.on('assignments:updated', refreshAssignments);

    return () => {
      socket.emit('leave-user', currentUser.id);
      socket.off('notifications:updated', refreshNotifications);
      socket.off('timeline:updated', refreshClient);
      socket.off('appointments:updated', refreshClient);
      socket.off('leads:updated', refreshLeads);
      socket.off('conversations:updated', refreshConversations);
      socket.off('deals:updated', refreshClient);
      socket.off('assignments:updated', refreshAssignments);
      disconnectRealtimeSocket();
    };
  }, [currentUser?.id, currentUser?.role]);

  useEffect(() => {
    if (!currentUser?.id) return undefined;

    let cancelled = false;
    registerPushToken()
      .then((token) => {
        if (!token || cancelled) return;
        return Auth.updatePushToken(token).catch(() => {});
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  async function restoreSession() {
    try {
      const user = await Auth.me();
      applyUserLogin(toUser(user));
    } catch (err) {
      // No valid session — stay on Splash/Welcome flow
      setTimeout(() => setCurrentScreen('Welcome'), 1500);
    }
  }

  function applyUserLogin(user: User) {
    setCurrentUser(user);
    setCurrentRole(user.role);
    setHasCompletedQuestionnaire(user.hasCompletedQuestionnaire);
    setConversationFocusId(null);

    if (user.role === 'client') {
      setClientActiveTab('Home');
      if (user.hasCompletedQuestionnaire) {
        setCurrentScreen('ClientApp');
        loadClientData(user.id);
      } else {
        setCurrentScreen('Questionnaire');
      }
    } else if (user.role === 'commercial') {
      setCommercialActiveTab('Dashboard');
      setCurrentScreen('CommercialApp');
      loadLeads();
    } else if (user.role === 'promoter') {
      setPromoterActiveTab('Dashboard');
      setCurrentScreen('PromoterApp');
    } else {
      setCurrentScreen('AdminApp');
      loadLeads();
    }

    loadNotifications();
    loadConversations();
  }

  async function loadClientData(userId: string) {
    let seenIds: string[] = [];

    try {
      const refreshedUser = await Auth.me();
      setCurrentUser((prev) => prev ? { ...prev, ...toUser(refreshedUser) } : toUser(refreshedUser));
    } catch { /* ignore */ }

    try {
      const swipes = await Properties.swipes();
      seenIds = swipes.map((item) => item.propertyId).filter(Boolean);
      setSwipedIds(seenIds);
      setLikedIds(swipes.filter((item) => item.liked).map((item) => item.propertyId));
    } catch { /* ignore */ }

    try {
      const response = await Leads.myLead() as any;
      if (response) {
        setLeadAnswers(response.answers ?? {});
        const matches = (response.matchedProperties ?? []).map((m: any) => toProperty(m.property ?? m));
        setMatchedProperties(uniqueById(excludeSeenProperties(matches, seenIds)));
      }
    } catch { /* no lead yet */ }

    try {
      const response = await Properties.matches() as any;
      setMatchingBlockedReason(response?.blockedReason ?? null);
      setMatchedProperties(uniqueById((response?.available ?? []).map(toProperty)));
      setLikedProperties(uniqueById((response?.liked ?? []).map(toProperty)));
      setIgnoredProperties(uniqueById((response?.passed ?? []).map(toProperty)));
    } catch { /* ignore */ }

    try {
      const favs = await Properties.favorites() as any[];
      setFavorites(uniqueById(favs.map(toProperty)));
    } catch { /* ignore */ }
  }

  // ── Auth ───────────────────────────────────────────────────────────────────

  const login = async (email: string, password: string) => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      // Clear any existing tokens before new login
      await clearTokens();
      const res = await Auth.login(email, password);
      await saveTokens(res.accessToken, res.refreshToken);
      applyUserLogin(toUser(res.user));
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : '';
      const isNetworkError = ['cnx failed', 'Network request failed', 'Request failed'].includes(rawMessage);
      const msg = isNetworkError ? 'Connexion échouée' : rawMessage || 'Connexion échouée';
      setAuthError(msg);
      throw err;
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = async () => {
    const refreshToken = await getRefreshToken();
    if (refreshToken) await Auth.logout(refreshToken).catch(() => {});
    await clearTokens();

    setCurrentUser(null);
    setCurrentRole(null);
    setClientActiveTab('Home');
    setCommercialActiveTab('Dashboard');
    setPromoterActiveTab('Dashboard');
    setConversationFocusId(null);
    setLeadAnswers({});
    setHasCompletedQuestionnaire(false);
    setCurrentQuestionnaireStep(0);
    setMatchedProperties([]);
    setIgnoredProperties([]);
    setLikedProperties([]);
    setMatchingBlockedReason(null);
    setSwipedIds([]);
    setLikedIds([]);
    setFavorites([]);
    setLeads([]);
    setConversations([]);
    setNotifications([]);
    setRealtimeVersion(0);
    disconnectRealtimeSocket();
    setCurrentScreen('Welcome');
  };

  const updateMyProfile = async (data: Partial<{ name: string; phone: string; avatar: string }>) => {
    const user = await Auth.updateMe(data);
    setCurrentUser(toUser(user));
  };

  // ── Questionnaire ─────────────────────────────────────────────────────────

  const submitQuestionnaire = async (answers: LeadAnswers) => {
    setQuestionnaireLoading(true);
    try {
      let response: any;

      if (!currentUser) {
        let guestUser: User;

        try {
          const registration = await Auth.register({
            name: `${answers.firstName} ${answers.lastName}`.trim(),
            email: answers.email.trim(),
            phone: answers.phone.trim(),
            password: answers.password,
            role: 'client',
          });

          await clearTokens();
          await saveTokens(registration.accessToken, registration.refreshToken);
          guestUser = toUser(registration.user);
        } catch (err) {
          const alreadyExists = err instanceof ApiError
            && err.message.toLowerCase().includes('user already exists');

          if (!alreadyExists) throw err;

          try {
            await clearTokens();
            const loginResponse = await Auth.login(answers.email.trim(), answers.password);
            await saveTokens(loginResponse.accessToken, loginResponse.refreshToken);
            guestUser = toUser(loginResponse.user);
          } catch {
            throw new ApiError(409, 'Un compte existe deja avec cet email. Connectez-vous ou utilisez le meme mot de passe.');
          }
        }

        response = await (guestUser.hasCompletedQuestionnaire ? Leads.updateMine(answers) : Leads.submit(answers)) as any;

        applyUserLogin({
          ...guestUser,
          hasCompletedQuestionnaire: true,
          accountValidationStatus: 'pending_review',
        });
      } else {
        response = await (hasCompletedQuestionnaire ? Leads.updateMine(answers) : Leads.submit(answers)) as any;
      }

      const matches  = (response.matchedProperties ?? []).map((m: any) => ({
        ...toProperty(m),
        matchScore: m.matchScore,
        badge:      m.badge,
      }));

      setMatchedProperties(uniqueById(excludeSeenProperties(matches, swipedIds)));
      setLeadAnswers(answers);
      setHasCompletedQuestionnaire(true);
      setCurrentUser(prev => prev ? { ...prev, hasCompletedQuestionnaire: true, accountValidationStatus: 'pending_review' } : prev);
      setMatchingBlockedReason('Votre profil est en attente de validation par Selix avant ouverture du flux Match.');
      await loadNotifications();
      setCurrentScreen('Analyzing');
    } catch (err) {
      console.error('[submitQuestionnaire]', err);
      throw err;
    } finally {
      setQuestionnaireLoading(false);
    }
  };

  const startQuestionnaireEdit = () => {
    setCurrentQuestionnaireStep(0);
    setCurrentScreen('Questionnaire');
  };

  // ── Swiping ───────────────────────────────────────────────────────────────

  const registerSwipe = async (propertyId: string, liked: boolean) => {
    setSwipedIds(prev => prev.includes(propertyId) ? prev : [...prev, propertyId]);
    const prop = matchedProperties.find((p) => p.id === propertyId);
    if (liked) {
      setLikedIds(prev => prev.includes(propertyId) ? prev : [...prev, propertyId]);
      if (prop && !favorites.some(f => f.id === propertyId)) {
        setFavorites(prev => [...prev, prop]);
      }
      if (prop) {
        setLikedProperties((prev) => uniqueById([{ ...prop, matched: true }, ...prev]));
      }
    } else if (prop) {
      setIgnoredProperties((prev) => uniqueById([{ ...prop, ignored: true }, ...prev]));
    }
    setMatchedProperties((prev) => prev.filter((item) => item.id !== propertyId));
    // Fire and forget — sync to server
    try {
      const response = await Properties.swipe(propertyId, liked);
      if (liked && response?.conversationId) {
        await loadConversations();
        await loadNotifications();
        setClientActiveTab('Messages');
        setConversationFocusId(response.conversationId);
      }
    } catch {
      // Keep optimistic swipe UI even if sync fails.
    }
  };

  const contactCommercialForProperty = async (property: Property) => {
    if (!property?.id) return;

    setSwipedIds((prev) => (prev.includes(property.id) ? prev : [...prev, property.id]));
    setLikedIds((prev) => (prev.includes(property.id) ? prev : [...prev, property.id]));
    setLikedProperties((prev) => uniqueById([{ ...property, matched: true }, ...prev]));
    setMatchedProperties((prev) => prev.filter((item) => item.id !== property.id));

    await Properties.swipe(property.id, true);
    await loadConversations();
    await loadNotifications();
    setClientActiveTab('Messages');
  };

  // ── Favorites ─────────────────────────────────────────────────────────────

  const toggleFavorite = (p: Property) => {
    const alreadyFav = favorites.some(f => f.id === p.id);
    setFavorites(prev => alreadyFav ? prev.filter(f => f.id !== p.id) : [...prev, p]);
    Properties.favorite(p.id).catch(() => {});
  };

  const isFavorite = (id: string) => favorites.some(f => f.id === id);

  const loadFavorites = async () => {
    try {
      const favs = await Properties.favorites() as any[];
      setFavorites(uniqueById(favs.map(toProperty)));
    } catch { /* ignore */ }
  };

  // ── CRM ───────────────────────────────────────────────────────────────────

  const loadLeads = async () => {
    setLeadsLoading(true);
    try {
      const res = await Leads.list() as any;
      setLeads(uniqueById((res.items ?? []).map(toLead)));
    } catch { /* ignore */ }
    finally { setLeadsLoading(false); }
  };

  const updateLeadStatus = async (id: string, status: Lead['status'], note?: string, visitDateTime?: string) => {
    const apiStatus = status as string;
    await Leads.updateStatus(id, apiStatus, note, visitDateTime);
    await loadLeads();
    await loadConversations();
    await loadNotifications();
  };

  // ── Messaging ─────────────────────────────────────────────────────────────

  const loadConversations = async () => {
    try {
      const list = await ConversationsAPI.list() as any[];
      setConversations(uniqueById(list.map(toConversation)));
    } catch { /* ignore */ }
  };

  const unreadMessages = conversations.reduce((a, c) => a + (c.unreadCount ?? 0), 0);

  // ── Notifications ──────────────────────────────────────────────────────────

  const loadNotifications = async () => {
    try {
      const res = await NotificationsAPI.list() as any;
      setNotifications(uniqueById((res.notifications ?? []).map(toNotification)));
    } catch { /* ignore */ }
  };

  const loadAppConfig = async () => {
    try {
      const config = await AppConfigAPI.get();
      setAppConfig(toAppConfig(config));
    } catch { /* ignore */ }
  };

  const setAppLanguage = async (language: AppLanguage) => {
    setAppLanguageState(language);
    try {
      await AsyncStorage.setItem(APP_LANGUAGE_KEY, language);
    } catch { /* ignore */ }
  };

  const t = (key: string, params?: Record<string, string | number>) => translate(appLanguage, key, params);

  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    NotificationsAPI.markRead(id).catch(() => {});
  };

  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    NotificationsAPI.markAllRead().catch(() => {});
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <AppContext.Provider value={{
      currentScreen, setCurrentScreen,
      currentUser, currentRole,
      clientActiveTab, setClientActiveTab,
      commercialActiveTab, setCommercialActiveTab,
      promoterActiveTab, setPromoterActiveTab,
      conversationFocusId,
      focusConversation: setConversationFocusId,
      login, logout, updateMyProfile,
      authError, authLoading,
      hasSeenOnboarding, setHasSeenOnboarding,
      leadAnswers, setLeadAnswers,
      hasCompletedQuestionnaire, submitQuestionnaire, startQuestionnaireEdit,
      questionnaireLoading,
      currentQuestionnaireStep, setCurrentQuestionnaireStep,
      matchedProperties,
      ignoredProperties,
      likedProperties,
      matchingBlockedReason,
      swipedIds, likedIds, registerSwipe, contactCommercialForProperty,
      favorites, toggleFavorite, isFavorite, loadFavorites,
      leads, leadsLoading, loadLeads, updateLeadStatus,
      conversations, unreadMessages, loadConversations,
      notifications, unreadCount,
      realtimeVersion,
      markNotificationRead, markAllNotificationsRead, loadNotifications,
      appConfig, loadAppConfig,
      appLanguage, setAppLanguage,
      t,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
