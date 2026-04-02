import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
    Image,
    KeyboardAvoidingView,
    Linking,
    Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { useCall } from '../../context/CallContext';
import { Conversations, Uploads, getRealtimeSocket } from '../../lib/api';
import { Conversation, Message } from '../../types';
import { EmptyState } from '../../components/ui';

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function documentLabelParts(content: string) {
  const parts = String(content || '').split('\n');
  return {
    title: parts[0] || 'Document',
    url: parts.length > 1 ? parts[parts.length - 1] : parts[0] || '',
  };
}

function getConversationCounterpartName(conversation: Conversation, currentUserName?: string | null) {
  return conversation.participantNames.find((name) => name !== currentUserName) || conversation.participantNames[0] || 'Discussion Selix';
}

function getCounterpartRoleLabel(currentRole?: string) {
  if (currentRole === 'client') return 'Commercial attitre';
  if (currentRole === 'commercial') return 'Client Selix';
  if (currentRole === 'promoter') return 'Commercial ou client';
  if (currentRole === 'admin') return 'Conversation supervisee';
  return 'Conversation Selix';
}

function getConversationPreview(item: Message | Conversation) {
  if ('messageType' in item) {
    if (item.messageType === 'image') return 'Image envoyee';
    if (item.messageType === 'document') return 'Document partage';
    return item.content || 'Conversation disponible';
  }
  if ('lastMessage' in item) {
    return item.lastMessage || 'Conversation disponible';
  }
  return 'Conversation disponible';
}

function getSenderRoleLabel(role?: string) {
  if (role === 'client') return 'Client';
  if (role === 'commercial') return 'Commercial';
  if (role === 'promoter') return 'Promoteur';
  if (role === 'admin') return 'Admin';
  return 'Selix';
}

export function MessagesScreen() {
  const {
    conversations,
    currentUser,
    loadConversations,
    loadNotifications,
    realtimeVersion,
    conversationFocusId,
    focusConversation,
    t,
  } = useApp();
  const { startCall } = useCall();
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showActions, setShowActions] = useState(false);
  const listFade = useRef(new Animated.Value(0)).current;
  const listLift = useRef(new Animated.Value(18)).current;
  const trayAnim = useRef(new Animated.Value(0)).current;
  const safeConversations = useMemo(() => uniqueById(conversations), [conversations]);
  const safeMessages = useMemo(() => uniqueById(messages), [messages]);
  const loadConversationMessages = async (conversationId: string) => {
    try {
      const items = await Conversations.messages(conversationId);
      setMessages(uniqueById(items as Message[]));
      await loadConversations();
    } catch {
      setMessages([]);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(listFade, { toValue: 1, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(listLift, { toValue: 0, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();
  }, [listFade, listLift]);

  useEffect(() => {
    if (!activeConvo) {
      setMessages([]);
      return;
    }
    loadConversationMessages(activeConvo.id);
  }, [activeConvo, realtimeVersion]);

  useEffect(() => {
    if (!conversationFocusId) return;
    const targetConversation = safeConversations.find((item) => item.id === conversationFocusId);
    if (targetConversation) {
      setActiveConvo(targetConversation);
      focusConversation(null);
      return;
    }

    let mounted = true;
    Conversations.list()
      .then((items) => {
        if (!mounted) return;
        const refreshed = uniqueById(items as Conversation[]);
        const focused = refreshed.find((item) => item.id === conversationFocusId);
        if (!focused) return;
        setActiveConvo(focused);
        focusConversation(null);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [conversationFocusId, safeConversations, focusConversation]);

  useEffect(() => {
    if (!activeConvo?.id) return undefined;

    const socket = getRealtimeSocket();
    const refreshMessages = (payload?: { conversationId?: string }) => {
      if (payload?.conversationId && payload.conversationId !== activeConvo.id) return;
      loadConversationMessages(activeConvo.id);
      loadNotifications();
    };

    socket.emit('join-conversation', activeConvo.id);
    socket.on('message:new', refreshMessages);

    return () => {
      socket.emit('leave-conversation', activeConvo.id);
      socket.off('message:new', refreshMessages);
    };
  }, [activeConvo?.id]);

  useEffect(() => {
    Animated.spring(trayAnim, {
      toValue: showActions ? 1 : 0,
      friction: 8,
      tension: 70,
      useNativeDriver: false,
    }).start();
  }, [showActions, trayAnim]);

  const pushOptimisticMessage = (message: Message) => {
    setMessages((prev) => uniqueById([...prev, message]));
  };

  const removeOptimisticMessage = (id: string) => {
    setMessages((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSend = async () => {
    if (!activeConvo || !draft.trim()) return;
    const content = draft.trim();
    setDraft('');

    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      conversationId: activeConvo.id,
      senderId: currentUser?.id || 'me',
      senderName: currentUser?.name || 'Moi',
      senderRole: currentUser?.role || 'client',
      content,
      messageType: 'text',
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      read: true,
    };
    pushOptimisticMessage(optimistic);

    try {
      await Conversations.send(activeConvo.id, content, 'text');
      await loadConversations();
    } catch {
      removeOptimisticMessage(optimistic.id);
      setDraft(content);
    }
  };

  const handlePickImage = async () => {
    if (!activeConvo || uploadingImage) return;
    setShowActions(false);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photos', "L'application a besoin d'acceder a votre galerie.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: false,
      selectionLimit: 1,
    });
    if (result.canceled || !result.assets.length) return;

    const asset = result.assets[0];
    const optimistic: Message = {
      id: `tmp-image-${Date.now()}`,
      conversationId: activeConvo.id,
      senderId: currentUser?.id || 'me',
      senderName: currentUser?.name || 'Moi',
      senderRole: currentUser?.role || 'client',
      content: asset.uri,
      messageType: 'image',
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      read: true,
    };

    setUploadingImage(true);
    pushOptimisticMessage(optimistic);
    try {
      const upload = await Uploads.messageImage(asset.uri);
      await Conversations.send(activeConvo.id, upload.url, 'image');
      await loadConversationMessages(activeConvo.id);
      await loadConversations();
    } catch (error: any) {
      removeOptimisticMessage(optimistic.id);
      Alert.alert('Image', error?.message || "Impossible d'envoyer l'image.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleTakePhoto = async () => {
    if (!activeConvo || uploadingImage) return;
    setShowActions(false);

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera', "L'application a besoin d'acceder a la camera.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets.length) return;

    const asset = result.assets[0];
    const optimistic: Message = {
      id: `tmp-camera-${Date.now()}`,
      conversationId: activeConvo.id,
      senderId: currentUser?.id || 'me',
      senderName: currentUser?.name || 'Moi',
      senderRole: currentUser?.role || 'client',
      content: asset.uri,
      messageType: 'image',
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      read: true,
    };

    setUploadingImage(true);
    pushOptimisticMessage(optimistic);
    try {
      const upload = await Uploads.messageImage(asset.uri);
      await Conversations.send(activeConvo.id, upload.url, 'image');
      await loadConversationMessages(activeConvo.id);
      await loadConversations();
    } catch (error: any) {
      removeOptimisticMessage(optimistic.id);
      Alert.alert('Camera', error?.message || "Impossible d'envoyer la photo.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handlePickDocument = async () => {
    if (!activeConvo || uploadingFile) return;
    setShowActions(false);

    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
      ],
    });
    if (result.canceled || !result.assets.length) return;

    const asset = result.assets[0];
    const optimistic: Message = {
      id: `tmp-doc-${Date.now()}`,
      conversationId: activeConvo.id,
      senderId: currentUser?.id || 'me',
      senderName: currentUser?.name || 'Moi',
      senderRole: currentUser?.role || 'client',
      content: asset.name || 'Document',
      messageType: 'document',
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      read: true,
    };

    setUploadingFile(true);
    pushOptimisticMessage(optimistic);
    try {
      const upload = await Uploads.messageFile(asset.uri);
      const docContent = `${upload.name || asset.name || 'Document'}\n${upload.url}`;
      await Conversations.send(activeConvo.id, docContent, 'document');
      await loadConversationMessages(activeConvo.id);
      await loadConversations();
    } catch (error: any) {
      removeOptimisticMessage(optimistic.id);
      Alert.alert('Document', error?.message || "Impossible d'envoyer le document.");
    } finally {
      setUploadingFile(false);
    }
  };

  const openDocument = async (content: string) => {
    const { url } = documentLabelParts(content);
    if (!url) return;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Document', "Impossible d'ouvrir ce document.");
      return;
    }
    await Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <LinearGradient colors={['#120A28', '#1A0A35', '#0D0620']} style={StyleSheet.absoluteFillObject} />
        <Text style={styles.headerTitle}>{t('messages.title')}</Text>
        <Text style={styles.headerSub}>{t('messages.subtitle', { count: safeConversations.length, suffix: safeConversations.length !== 1 ? 's' : '' })}</Text>
      </View>

      {safeConversations.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState icon="chatbubble-outline" title={t('messages.empty')} subtitle={t('messages.emptySub')} />
        </View>
      ) : (
        <Animated.ScrollView style={[styles.scroll, { opacity: listFade, transform: [{ translateY: listLift }] }]} showsVerticalScrollIndicator={false}>
          {safeConversations.map((c) => (
            <TouchableOpacity key={c.id} onPress={() => setActiveConvo(c)} style={styles.convoItem} activeOpacity={0.8}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={20} color={Colors.accentMagenta} />
              </View>
              <View style={styles.convoContent}>
                <View style={styles.convoTop}>
                  <Text style={styles.convoName} numberOfLines={1}>
                    {getConversationCounterpartName(c, currentUser?.name)}
                  </Text>
                  <Text style={styles.convoTime}>{c.lastMessageTime}</Text>
                </View>
                <View style={styles.convoMetaRow}>
                  <View style={styles.convoMetaBadge}>
                    <Text style={styles.convoMetaBadgeText}>{getCounterpartRoleLabel(currentUser?.role)}</Text>
                  </View>
                  {c.relatedPropertyTitle ? (
                    <Text style={styles.convoProperty} numberOfLines={1}>
                      {t('messages.property')}: {c.relatedPropertyTitle}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.convoBottom}>
                  <Text style={styles.convoLast} numberOfLines={1}>{getConversationPreview(c)}</Text>
                  {c.unreadCount > 0 ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{c.unreadCount}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </Animated.ScrollView>
      )}

      <Modal visible={!!activeConvo} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {activeConvo ? (
            <View style={styles.chatScreen}>
              <View style={styles.chatHeader}>
                <LinearGradient colors={['#120A28', '#1A0A35', '#0D0620']} style={StyleSheet.absoluteFillObject} />
                <TouchableOpacity onPress={() => setActiveConvo(null)} style={styles.chatBack}>
                  <Ionicons name="arrow-back" size={20} color={Colors.white} />
                </TouchableOpacity>
                <View style={styles.chatHeaderBody}>
                  <Text style={styles.chatName}>
                    {getConversationCounterpartName(activeConvo, currentUser?.name)}
                  </Text>
                  <View style={styles.chatMetaRow}>
                    <View style={styles.chatRoleBadge}>
                      <Text style={styles.chatRoleBadgeText}>{getCounterpartRoleLabel(currentUser?.role)}</Text>
                    </View>
                    {activeConvo.relatedPropertyTitle ? <Text style={styles.chatProperty}>{activeConvo.relatedPropertyTitle}</Text> : null}
                  </View>
                </View>
                <TouchableOpacity onPress={() => startCall(activeConvo)} style={styles.chatActionBtn} activeOpacity={0.85}>
                  <Ionicons name="call-outline" size={18} color={Colors.white} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.flex} contentContainerStyle={styles.messagesContent} showsVerticalScrollIndicator={false}>
                {safeMessages.map((m) => {
                  const isMe = m.senderId === currentUser?.id;
                  const docInfo = documentLabelParts(m.content);

                  return (
                    <View key={m.id} style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                      {!isMe ? (
                        <View style={styles.bubbleSenderRow}>
                          <Text style={styles.bubbleSender}>{m.senderName}</Text>
                          <View style={styles.senderRoleBadge}>
                            <Text style={styles.senderRoleText}>{getSenderRoleLabel(m.senderRole)}</Text>
                          </View>
                        </View>
                      ) : null}
                      {m.messageType === 'image' ? (
                        <TouchableOpacity activeOpacity={0.9} onPress={() => setPreviewImage(m.content)}>
                          <Image source={{ uri: m.content }} style={styles.messageImage} />
                        </TouchableOpacity>
                      ) : m.messageType === 'document' ? (
                        <TouchableOpacity style={styles.documentCard} activeOpacity={0.8} onPress={() => openDocument(m.content)}>
                          <Ionicons name="document-attach-outline" size={20} color={isMe ? Colors.white : Colors.accentMagenta} />
                          <Text style={[styles.documentText, isMe && styles.documentTextMe]} numberOfLines={2}>
                            {docInfo.title}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{m.content}</Text>
                      )}
                      <View style={styles.bubbleFooter}>
                        <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>{m.timestamp}</Text>
                        {isMe ? (
                          <Ionicons
                            name={m.read ? 'checkmark-done' : 'checkmark'}
                            size={14}
                            color={m.read ? '#BFDBFE' : 'rgba(255,255,255,0.7)'}
                            style={styles.readIcon}
                          />
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>

              <View style={styles.inputWrap}>
                {showActions ? (
                  <Animated.View
                    style={[
                      styles.actionsTray,
                      {
                        opacity: trayAnim,
                        transform: [
                          {
                            translateY: trayAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [10, 0],
                            }),
                          },
                          {
                            scale: trayAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.96, 1],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <TouchableOpacity style={[styles.mediaBtn, uploadingImage && styles.mediaBtnDisabled]} onPress={handleTakePhoto} disabled={uploadingImage}>
                      <Ionicons name="camera-outline" size={20} color={Colors.accentMagenta} />
                      <Text style={styles.mediaLabel}>Photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.mediaBtn, uploadingImage && styles.mediaBtnDisabled]} onPress={handlePickImage} disabled={uploadingImage}>
                      <Ionicons name="image-outline" size={20} color={Colors.accentMagenta} />
                      <Text style={styles.mediaLabel}>Galerie</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.mediaBtn, uploadingFile && styles.mediaBtnDisabled]} onPress={handlePickDocument} disabled={uploadingFile}>
                      <Ionicons name="document-outline" size={20} color={Colors.accentMagenta} />
                      <Text style={styles.mediaLabel}>Document</Text>
                    </TouchableOpacity>
                  </Animated.View>
                ) : null}
                <View style={styles.inputRow}>
                  <TouchableOpacity style={styles.plusBtn} onPress={() => setShowActions((prev) => !prev)}>
                    <Ionicons name={showActions ? 'close' : 'add'} size={22} color={Colors.accentMagenta} />
                  </TouchableOpacity>
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    placeholder={t('messages.placeholder')}
                    placeholderTextColor={Colors.textMuted}
                    style={styles.chatInput}
                    multiline
                  />
                  <TouchableOpacity style={[styles.sendBtn, !draft.trim() && styles.sendBtnDisabled]} disabled={!draft.trim()} onPress={handleSend}>
                    <Ionicons name="send" size={18} color={Colors.white} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!previewImage} transparent animationType="fade">
        <View style={styles.previewOverlay}>
          <TouchableOpacity style={styles.previewClose} onPress={() => setPreviewImage(null)}>
            <Ionicons name="close" size={22} color={Colors.white} />
          </TouchableOpacity>
          {previewImage ? <Image source={{ uri: previewImage }} style={styles.previewImage} resizeMode="contain" /> : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgMain },
  flex: { flex: 1 },
  emptyWrap: { flex: 1, justifyContent: 'center' },

  // Header — dark gradient matching app brand
  header: {
    paddingTop: 20,
    paddingBottom: 22,
    paddingHorizontal: 22,
    overflow: 'hidden',
    position: 'relative',
  },
  headerTitle: { fontSize: 26, fontWeight: '900', color: Colors.white, letterSpacing: -0.4 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.62)', marginTop: 4, fontWeight: '500' },

  // Conversation list
  scroll: { flex: 1 },
  convoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    backgroundColor: Colors.bgMain,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.lavenderUltra,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.accentMagenta,
    shadowColor: Colors.accentMagenta,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  convoContent: { flex: 1 },
  convoTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  convoName: { fontSize: 15, fontWeight: '800', color: Colors.textDark, flex: 1 },
  convoTime: { fontSize: 11, color: Colors.textMuted },
  convoMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  convoMetaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(142,53,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(142,53,255,0.22)',
  },
  convoMetaBadgeText: { color: Colors.primarySoft, fontSize: 10, fontWeight: '700' },
  convoProperty: { flex: 1, fontSize: 11, color: Colors.accentOrange, fontWeight: '600' },
  convoBottom: { flexDirection: 'row', alignItems: 'center' },
  convoLast: { flex: 1, fontSize: 13, color: Colors.textSoft },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: Colors.accentMagenta,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  unreadText: { fontSize: 10, fontWeight: '900', color: Colors.white },

  // Chat screen
  chatScreen: { flex: 1, backgroundColor: Colors.bgMain },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 16,
    gap: 12,
    overflow: 'hidden',
  },
  chatBack: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chatHeaderBody: { flex: 1 },
  chatActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  chatName: { fontSize: 17, fontWeight: '800', color: Colors.white },
  chatMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  chatRoleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(9,6,17,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  chatRoleBadgeText: { color: Colors.white, fontSize: 10, fontWeight: '800' },
  chatProperty: { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.65)' },

  // Messages
  messagesContent: { padding: 16, paddingBottom: 20, gap: 8 },
  bubble: { maxWidth: '80%', padding: 13, borderRadius: 20, marginBottom: 2 },
  bubbleMe: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.accentMagenta,
    borderBottomRightRadius: 5,
    shadowColor: Colors.accentMagenta,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bubbleThem: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(26,19,43,0.97)',
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  bubbleSenderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  bubbleSender: { fontSize: 11, fontWeight: '700', color: Colors.primarySoft },
  senderRoleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: Colors.lavenderUltra },
  senderRoleText: { color: Colors.primarySoft, fontSize: 10, fontWeight: '700' },
  bubbleText: { fontSize: 14, color: Colors.textDark, lineHeight: 21 },
  bubbleTextMe: { color: Colors.white },
  messageImage: { width: 224, height: 224, borderRadius: 16, backgroundColor: Colors.bgSoft },
  documentCard: { flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: 224 },
  documentText: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.textDark },
  documentTextMe: { color: Colors.white },
  bubbleFooter: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 5 },
  bubbleTime: { fontSize: 10, color: Colors.textMuted, alignSelf: 'flex-end' },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.55)' },
  readIcon: { marginLeft: 4 },

  // Input area
  inputWrap: {
    backgroundColor: 'rgba(13,8,24,0.98)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  actionsTray: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingTop: 12 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
  },
  plusBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(142,53,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(142,53,255,0.28)',
  },
  mediaBtn: {
    minWidth: 86,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(26,19,43,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    gap: 4,
  },
  mediaLabel: { color: Colors.textBody, fontSize: 11, fontWeight: '700' },
  mediaBtnDisabled: { opacity: 0.45 },
  chatInput: {
    flex: 1,
    backgroundColor: 'rgba(24,17,38,0.95)',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontSize: 14,
    color: Colors.textDark,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: 'rgba(198,135,255,0.2)',
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accentMagenta,
    shadowColor: Colors.accentMagenta,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 12,
    elevation: 6,
  },
  sendBtnDisabled: { backgroundColor: Colors.border, shadowOpacity: 0 },

  // Image preview
  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  previewClose: { position: 'absolute', top: 54, right: 20, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  previewImage: { width: '100%', height: '80%' },
});
