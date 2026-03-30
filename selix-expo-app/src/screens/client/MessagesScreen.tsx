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

  const handleCall = async () => {
    if (!activeConvo) return;
    const otherIndex = activeConvo.participantNames.findIndex((name) => name !== currentUser?.name);
    const phone = (activeConvo.participantPhones || [])[otherIndex >= 0 ? otherIndex : 0];
    if (!phone) {
      Alert.alert('Appel', "Aucun numero n'est disponible pour cet interlocuteur.");
      return;
    }

    const url = `tel:${phone}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Appel', 'Cet appareil ne peut pas lancer un appel.');
      return;
    }
    await Linking.openURL(url);
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
      <LinearGradient colors={Colors.gradientPrimary} style={styles.header}>
        <Text style={styles.headerTitle}>{t('messages.title')}</Text>
        <Text style={styles.headerSub}>{t('messages.subtitle', { count: safeConversations.length, suffix: safeConversations.length !== 1 ? 's' : '' })}</Text>
      </LinearGradient>

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
                    {c.participantNames.find((n) => n !== currentUser?.name) || c.participantNames[0]}
                  </Text>
                  <Text style={styles.convoTime}>{c.lastMessageTime}</Text>
                </View>
                {c.relatedPropertyTitle ? <Text style={styles.convoProperty} numberOfLines={1}>{t('messages.property')}: {c.relatedPropertyTitle}</Text> : null}
                <View style={styles.convoBottom}>
                  <Text style={styles.convoLast} numberOfLines={1}>{c.lastMessage}</Text>
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
              <LinearGradient colors={Colors.gradientPrimary} style={styles.chatHeader}>
                <TouchableOpacity onPress={() => setActiveConvo(null)} style={styles.chatBack}>
                  <Ionicons name="arrow-back" size={20} color={Colors.white} />
                </TouchableOpacity>
                <View style={styles.chatHeaderBody}>
                  <Text style={styles.chatName}>
                    {activeConvo.participantNames.find((n) => n !== currentUser?.name) || activeConvo.participantNames[0]}
                  </Text>
                  {activeConvo.relatedPropertyTitle ? <Text style={styles.chatProperty}>{activeConvo.relatedPropertyTitle}</Text> : null}
                </View>
                <TouchableOpacity onPress={handleCall} style={styles.chatCallBtn}>
                  <Ionicons name="call-outline" size={20} color={Colors.white} />
                </TouchableOpacity>
              </LinearGradient>

              <ScrollView style={styles.flex} contentContainerStyle={styles.messagesContent} showsVerticalScrollIndicator={false}>
                {safeMessages.map((m) => {
                  const isMe = m.senderId === currentUser?.id;
                  const docInfo = documentLabelParts(m.content);

                  return (
                    <View key={m.id} style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                      {!isMe ? <Text style={styles.bubbleSender}>{m.senderName}</Text> : null}
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
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.mediaBtn, uploadingImage && styles.mediaBtnDisabled]} onPress={handlePickImage} disabled={uploadingImage}>
                      <Ionicons name="image-outline" size={20} color={Colors.accentMagenta} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.mediaBtn, uploadingFile && styles.mediaBtnDisabled]} onPress={handlePickDocument} disabled={uploadingFile}>
                      <Ionicons name="document-outline" size={20} color={Colors.accentMagenta} />
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
  header: { paddingTop: 20, paddingBottom: 24, paddingHorizontal: 24, alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.white },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  scroll: { flex: 1 },
  convoItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderSoft, backgroundColor: Colors.bgCard },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.lavenderUltra, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.accentMagenta },
  convoContent: { flex: 1 },
  convoTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  convoName: { fontSize: 15, fontWeight: '700', color: Colors.textDark, flex: 1 },
  convoTime: { fontSize: 11, color: Colors.textMuted },
  convoProperty: { fontSize: 11, color: Colors.accentOrange, marginBottom: 3, fontWeight: '600' },
  convoBottom: { flexDirection: 'row', alignItems: 'center' },
  convoLast: { flex: 1, fontSize: 13, color: Colors.textSoft },
  unreadBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.accentOrange, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  unreadText: { fontSize: 10, fontWeight: '800', color: Colors.white },
  chatScreen: { flex: 1, backgroundColor: Colors.bgMain },
  chatHeader: { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, gap: 12 },
  chatBack: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  chatHeaderBody: { flex: 1 },
  chatCallBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  chatName: { fontSize: 17, fontWeight: '700', color: Colors.white },
  chatProperty: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  messagesContent: { padding: 16, paddingBottom: 20, gap: 10 },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 16, marginBottom: 4 },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: Colors.accentMagenta, borderBottomRightRadius: 4 },
  bubbleThem: { alignSelf: 'flex-start', backgroundColor: Colors.bgCard, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: Colors.borderSoft },
  bubbleSender: { fontSize: 11, fontWeight: '700', color: Colors.accentMagenta, marginBottom: 4 },
  bubbleText: { fontSize: 14, color: Colors.textDark, lineHeight: 20 },
  bubbleTextMe: { color: Colors.white },
  messageImage: { width: 220, height: 220, borderRadius: 12, backgroundColor: Colors.bgSoft },
  documentCard: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 220 },
  documentText: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.textDark },
  documentTextMe: { color: Colors.white },
  bubbleFooter: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 4 },
  bubbleTime: { fontSize: 10, color: Colors.textMuted, marginTop: 4, alignSelf: 'flex-end' },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.6)' },
  readIcon: { marginLeft: 4 },
  inputWrap: { backgroundColor: Colors.bgCard, borderTopWidth: 1, borderTopColor: Colors.borderSoft },
  actionsTray: { flexDirection: 'row', gap: 12, paddingHorizontal: 12, paddingTop: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, paddingBottom: Platform.OS === 'ios' ? 30 : 12 },
  plusBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.lavenderUltra, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.borderSoft },
  mediaBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.lavenderUltra, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.borderSoft },
  mediaBtnDisabled: { opacity: 0.5 },
  chatInput: { flex: 1, backgroundColor: Colors.bgInput, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: Colors.textDark, maxHeight: 100, borderWidth: 1, borderColor: Colors.border },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.accentOrange, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: Colors.border },
  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  previewClose: { position: 'absolute', top: 54, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  previewImage: { width: '100%', height: '80%' },
});
