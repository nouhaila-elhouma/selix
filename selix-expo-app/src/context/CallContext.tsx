import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Calls, getRealtimeSocket } from '../lib/api';
import { useApp } from './AppContext';
import { CallSession, Conversation } from '../types';
import { Colors } from '../constants/colors';

interface CallContextType {
  currentCall: CallSession | null;
  incomingCall: CallSession | null;
  callHistory: CallSession[];
  startCall: (conversation: Conversation) => Promise<void>;
  acceptIncomingCall: () => Promise<void>;
  rejectIncomingCall: () => Promise<void>;
  endCurrentCall: () => Promise<void>;
  dismissCallState: () => void;
}

type TransportState = 'idle' | 'booting' | 'ready';

const CallContext = createContext<CallContextType | null>(null);

function toCallSession(value: any): CallSession {
  return value as CallSession;
}

function formatDuration(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds || 0));
  const minutes = String(Math.floor(safe / 60)).padStart(2, '0');
  const seconds = String(safe % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function getCallStatusLabel(call: CallSession | null) {
  if (!call) return '';
  if (call.status === 'ringing') return call.direction === 'incoming' ? 'Appel entrant' : 'Appel en cours';
  if (call.status === 'accepted') return 'En ligne';
  if (call.status === 'rejected') return 'Appel refuse';
  if (call.status === 'missed') return 'Appel manque';
  if (call.status === 'cancelled') return 'Appel annule';
  if (call.status === 'ended') return 'Appel termine';
  return 'Appel Selix';
}

function shouldKeepVisible(call: CallSession | null) {
  if (!call) return false;
  return ['ringing', 'accepted', 'rejected', 'missed', 'cancelled', 'ended'].includes(call.status);
}

function callStatusTone(call: CallSession | null) {
  if (!call) return Colors.info;
  if (call.status === 'accepted') return Colors.success;
  if (call.status === 'ringing') return Colors.warning;
  if (call.status === 'rejected' || call.status === 'cancelled' || call.status === 'missed') return Colors.danger;
  return Colors.primarySoft;
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useApp();
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);
  const [currentCall, setCurrentCall] = useState<CallSession | null>(null);
  const [callHistory, setCallHistory] = useState<CallSession[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [transportState, setTransportState] = useState<TransportState>('idle');

  useEffect(() => {
    if (!currentUser?.id) {
      setIncomingCall(null);
      setCurrentCall(null);
      setCallHistory([]);
      setTransportState('idle');
      return;
    }

    Calls.history()
      .then((items) => setCallHistory((items as CallSession[]).map(toCallSession)))
      .catch(() => {});
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return undefined;
    const socket = getRealtimeSocket();

    const onCallUpdated = (payload: any) => {
      const next = toCallSession(payload);
      setCallHistory((prev) => [next, ...prev.filter((item) => item.id !== next.id)]);

      if (next.receiverId === currentUser.id && next.status === 'ringing') {
        setIncomingCall(next);
        return;
      }

      if (next.status === 'accepted') {
        setIncomingCall(null);
        setCurrentCall(next);
        setTransportState('ready');
        return;
      }

      if (['rejected', 'missed', 'cancelled', 'ended'].includes(next.status)) {
        setIncomingCall((prev) => (prev?.id === next.id ? null : prev));
        setCurrentCall((prev) => (prev?.id === next.id ? next : prev));
        setTransportState('idle');
        return;
      }

      setCurrentCall((prev) => (prev?.id === next.id ? next : prev));
    };

    socket.on('call:updated', onCallUpdated);
    return () => {
      socket.off('call:updated', onCallUpdated);
    };
  }, [currentUser?.id, currentCall?.id, incomingCall?.id]);

  useEffect(() => {
    if (!currentCall || currentCall.status !== 'accepted') {
      setElapsedSeconds(0);
      return undefined;
    }

    const answeredAt = currentCall.answeredAt ? new Date(currentCall.answeredAt).getTime() : Date.now();
    const tick = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - answeredAt) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [currentCall?.id, currentCall?.status, currentCall?.answeredAt]);

  const startCall = async (conversation: Conversation) => {
    try {
      const session = toCallSession(await Calls.start(conversation.id));
      setIncomingCall(null);
      setCurrentCall(session);
      setCallHistory((prev) => [session, ...prev.filter((item) => item.id !== session.id)]);
    } catch (error: any) {
      Alert.alert('Appel Selix', error?.message || "Impossible de demarrer l'appel.");
    }
  };

  const acceptIncomingCall = async () => {
    if (!incomingCall) return;
    try {
      const session = toCallSession(await Calls.respond(incomingCall.id, 'accept'));
      setIncomingCall(null);
      setCurrentCall(session);
      setCallHistory((prev) => [session, ...prev.filter((item) => item.id !== session.id)]);
      setTransportState('ready');
    } catch (error: any) {
      Alert.alert('Appel Selix', error?.message || "Impossible d'accepter l'appel.");
    }
  };

  const rejectIncomingCall = async () => {
    if (!incomingCall) return;
    try {
      const session = toCallSession(await Calls.respond(incomingCall.id, 'reject'));
      setIncomingCall(null);
      setCurrentCall(session);
      setCallHistory((prev) => [session, ...prev.filter((item) => item.id !== session.id)]);
      setTransportState('idle');
    } catch (error: any) {
      Alert.alert('Appel Selix', error?.message || "Impossible de refuser l'appel.");
    }
  };

  const endCurrentCall = async () => {
    if (!currentCall) return;
    try {
      const session = toCallSession(await Calls.end(currentCall.id));
      setCurrentCall(session);
      setCallHistory((prev) => [session, ...prev.filter((item) => item.id !== session.id)]);
      setTransportState('idle');
    } catch (error: any) {
      Alert.alert('Appel Selix', error?.message || "Impossible de terminer l'appel.");
    }
  };

  const dismissCallState = () => {
    if (currentCall && ['ended', 'rejected', 'missed', 'cancelled'].includes(currentCall.status)) {
      setCurrentCall(null);
    }
    setIncomingCall(null);
  };

  const currentLabel = useMemo(() => getCallStatusLabel(currentCall), [currentCall]);
  const incomingLabel = useMemo(() => getCallStatusLabel(incomingCall), [incomingCall]);
  const currentTone = useMemo(() => callStatusTone(currentCall), [currentCall]);
  const incomingTone = useMemo(() => callStatusTone(incomingCall), [incomingCall]);

  return (
    <CallContext.Provider
      value={{
        currentCall,
        incomingCall,
        callHistory,
        startCall,
        acceptIncomingCall,
        rejectIncomingCall,
        endCurrentCall,
        dismissCallState,
      }}
    >
      {children}

      <Modal visible={!!incomingCall} transparent animationType="fade" onRequestClose={rejectIncomingCall}>
        <View style={styles.overlay}>
          <View style={styles.fullscreenCard}>
            <LinearGradient colors={Colors.gradientHero} style={styles.fullscreenHero}>
              <View style={styles.signalPill}>
                <View style={[styles.signalDot, { backgroundColor: incomingTone }]} />
                <Text style={styles.signalText}>Selix appel entrant</Text>
              </View>
              <View style={styles.avatarLarge}>
                <Ionicons name="call" size={28} color={Colors.white} />
              </View>
              <Text style={styles.heroTitle}>{incomingLabel}</Text>
              <Text style={styles.heroName}>{incomingCall?.callerName || 'Contact Selix'}</Text>
              {incomingCall?.relatedPropertyTitle ? <Text style={styles.heroProject}>{incomingCall.relatedPropertyTitle}</Text> : null}
            </LinearGradient>
            <View style={styles.bodyLarge}>
              <Text style={styles.bodyText}>Acceptez cet appel pour poursuivre l'echange dans Selix.</Text>
              <View style={styles.quickActionsRow}>
                <View style={styles.infoChip}>
                  <Ionicons name="chatbubble-ellipses-outline" size={14} color={Colors.primarySoft} />
                  <Text style={styles.infoChipText}>Discussion reliee</Text>
                </View>
                <View style={styles.infoChip}>
                  <Ionicons name="notifications-outline" size={14} color={Colors.primarySoft} />
                  <Text style={styles.infoChipText}>Temps reel</Text>
                </View>
              </View>
              <View style={styles.row}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={rejectIncomingCall} activeOpacity={0.85}>
                  <Ionicons name="close" size={18} color={Colors.textDark} />
                  <Text style={styles.secondaryText}>Refuser</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryBtn} onPress={acceptIncomingCall} activeOpacity={0.85}>
                  <Ionicons name="call" size={18} color={Colors.white} />
                  <Text style={styles.primaryText}>Accepter</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={shouldKeepVisible(currentCall)} transparent animationType="fade" onRequestClose={dismissCallState}>
        <View style={styles.overlay}>
          <View style={styles.fullscreenCard}>
            <LinearGradient colors={Colors.gradientHero} style={styles.fullscreenHero}>
              <View style={styles.signalPill}>
                <View style={[styles.signalDot, { backgroundColor: currentTone }]} />
                <Text style={styles.signalText}>Selix appel actif</Text>
              </View>
              <View style={styles.avatarLarge}>
                <Ionicons name={currentCall?.status === 'accepted' ? 'mic' : 'call-outline'} size={28} color={Colors.white} />
              </View>
              <Text style={styles.heroTitle}>{currentLabel}</Text>
              <Text style={styles.heroName}>
                {currentCall?.direction === 'incoming'
                  ? currentCall?.callerName || 'Contact Selix'
                  : currentCall?.receiverName || 'Contact Selix'}
              </Text>
              {currentCall?.relatedPropertyTitle ? <Text style={styles.heroProject}>{currentCall.relatedPropertyTitle}</Text> : null}
            </LinearGradient>
            <View style={styles.bodyLarge}>
              {currentCall?.status === 'accepted' ? (
                <Text style={styles.timer}>{formatDuration(elapsedSeconds || currentCall.durationSec || 0)}</Text>
              ) : null}
              <Text style={styles.bodyText}>
                {currentCall?.status === 'ringing'
                  ? "Votre contact recoit l'appel dans Selix."
                  : currentCall?.status === 'accepted'
                    ? transportState === 'ready'
                      ? "Session d'appel active dans Selix."
                      : 'Connexion de la session...'
                    : currentCall?.status === 'rejected'
                      ? "Le contact a refuse l'appel."
                      : currentCall?.status === 'missed'
                        ? "L'appel n'a pas ete pris a temps."
                        : currentCall?.status === 'cancelled'
                          ? "L'appel a ete annule."
                          : "L'appel est termine."}
              </Text>
              <View style={styles.controlRow}>
                <View style={styles.controlPill}>
                  <Ionicons name="mic-outline" size={18} color={Colors.textBody} />
                  <Text style={styles.controlPillText}>Micro</Text>
                </View>
                <View style={styles.controlPill}>
                  <Ionicons name="volume-high-outline" size={18} color={Colors.textBody} />
                  <Text style={styles.controlPillText}>Haut-parleur</Text>
                </View>
                <View style={styles.controlPill}>
                  <Ionicons name="chatbox-ellipses-outline" size={18} color={Colors.textBody} />
                  <Text style={styles.controlPillText}>Chat</Text>
                </View>
              </View>
              <View style={styles.row}>
                {currentCall?.status === 'accepted' || currentCall?.status === 'ringing' ? (
                  <TouchableOpacity style={styles.dangerBtn} onPress={endCurrentCall} activeOpacity={0.85}>
                    <Ionicons name="call" size={18} color={Colors.white} />
                    <Text style={styles.primaryText}>Raccrocher</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.primaryBtn} onPress={dismissCallState} activeOpacity={0.85}>
                    <Ionicons name="checkmark" size={18} color={Colors.white} />
                    <Text style={styles.primaryText}>Fermer</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </CallContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5,3,12,0.84)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  fullscreenCard: {
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  hero: {
    paddingVertical: 26,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  fullscreenHero: {
    paddingTop: 26,
    paddingBottom: 30,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  signalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(9,6,17,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    marginBottom: 18,
  },
  signalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  signalText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarLarge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  heroTitle: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  heroName: {
    color: Colors.white,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 6,
    textAlign: 'center',
  },
  heroProject: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  body: {
    padding: 22,
    gap: 16,
  },
  bodyLarge: {
    padding: 24,
    gap: 18,
  },
  bodyText: {
    color: Colors.textSoft,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  timer: {
    color: Colors.textDark,
    fontSize: 34,
    fontWeight: '800',
    textAlign: 'center',
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.lavenderUltra,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  infoChipText: {
    color: Colors.textBody,
    fontSize: 12,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  controlPill: {
    flex: 1,
    minHeight: 66,
    borderRadius: 18,
    backgroundColor: Colors.lavenderUltra,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  controlPillText: {
    color: Colors.textBody,
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryText: {
    color: Colors.textDark,
    fontSize: 14,
    fontWeight: '700',
  },
  primaryBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: Colors.accentMagenta,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  dangerBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
});

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used inside CallProvider');
  return ctx;
}
