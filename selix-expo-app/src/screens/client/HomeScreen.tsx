import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { Appointments, SupportRequests } from '../../lib/api';
import { Appointment } from '../../types';
import { Divider, SectionHeader } from '../../components/ui';
import { getScoreColor, getScoreLabel, getTemperatureBgColor, getTemperatureColor, getTemperatureLabel } from '../../utils/scoring';

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

const PIPELINE_STAGES = ['Nouveau', 'Contacté', 'Visité', 'Offre', 'Signé'];

export function HomeScreen() {
  const {
    currentUser, leads, favorites, matchedProperties,
    unreadCount, unreadMessages, setClientActiveTab, focusConversation, realtimeVersion, t,
  } = useApp();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const heroFade = useRef(new Animated.Value(0)).current;
  const heroLift = useRef(new Animated.Value(20)).current;
  const bodyFade = useRef(new Animated.Value(0)).current;
  const bodyLift = useRef(new Animated.Value(28)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;

  const myLead = leads.find((l) => l.clientEmail === currentUser?.email) || leads[0];
  const actualMatches = matchedProperties.filter((p) => !!p?.id && p.score > 0);
  const upcomingVisits = appointments.filter((a) => a.status === 'Planifié' || a.status === 'Confirmé').length;
  const stageIndex = myLead ? PIPELINE_STAGES.indexOf(myLead.status as any) : 0;
  const scoreColor = myLead ? getScoreColor(myLead.score) : Colors.textMuted;

  useEffect(() => {
    let mounted = true;
    Appointments.list().then((items) => { if (mounted) setAppointments(uniqueById(items as Appointment[])); }).catch(() => { if (mounted) setAppointments([]); });
    return () => { mounted = false; };
  }, [realtimeVersion]);

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(heroFade, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.timing(heroLift, { toValue: 0, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      ]),
      Animated.parallel([
        Animated.timing(bodyFade, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.timing(bodyLift, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      ]),
    ]).start();

    Animated.loop(Animated.sequence([
      Animated.timing(floatAnim, { toValue: 1, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      Animated.timing(floatAnim, { toValue: 0, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
    ])).start();

    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      Animated.timing(pulseAnim, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
    ])).start();

    cardAnims.forEach((a) => a.setValue(0));
    Animated.stagger(70, cardAnims.map((a) => Animated.timing(a, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: false }))).start();
  }, [bodyFade, bodyLift, cardAnims, floatAnim, heroFade, heroLift, pulseAnim]);

  const heroTranslateY = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  const openSupportConversation = async () => {
    try {
      const response = await SupportRequests.openConversation();
      focusConversation(response.id);
      setClientActiveTab('Messages');
    } catch { /* ignore */ }
  };

  const FEATURE_CARDS = [
    { icon: 'heart-circle-outline', iconActive: 'heart-circle', label: t('nav.match'), count: actualMatches.length, color: Colors.accentMagenta, tab: 'Match' },
    { icon: 'bookmark-outline', iconActive: 'bookmark', label: t('nav.favorites'), count: favorites.length, color: Colors.primary, tab: 'Favorites' },
    { icon: 'calendar-outline', iconActive: 'calendar', label: t('nav.visits'), count: upcomingVisits, color: Colors.accentOrange, tab: 'Visits' },
    { icon: 'chatbubble-outline', iconActive: 'chatbubble', label: t('nav.messages'), count: unreadMessages, color: Colors.success, tab: 'Messages' },
  ];

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <Animated.View style={{ opacity: heroFade, transform: [{ translateY: heroLift }] }}>
        <LinearGradient
          colors={['#120A28', '#1A0A35', '#0D0620']}
          style={styles.header}
        >
          {/* Animated orbs */}
          <Animated.View style={[styles.orbA, { transform: [{ translateY: heroTranslateY }] }]} />
          <Animated.View style={[styles.orbB, { transform: [{ translateY: heroTranslateY }] }]} />

          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>Bonjour</Text>
              <Text style={styles.userName}>{currentUser?.name?.split(' ')[0] || 'Bienvenue'} 👋</Text>
            </View>
            <Animated.View style={{ transform: [{ scale: unreadCount > 0 ? pulseScale : 1 }] }}>
              <TouchableOpacity style={styles.bellBtn}>
                <Ionicons name="notifications-outline" size={21} color={Colors.white} />
                {unreadCount > 0 && <View style={styles.bellBadge} />}
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Stats strip */}
          <View style={styles.statsStrip}>
            {[
              { value: actualMatches.length, label: t('home.matches'), color: Colors.accentMagenta },
              { value: favorites.length, label: t('home.favorites'), color: Colors.primary },
              { value: myLead?.score || '–', label: t('home.score'), color: Colors.accentOrange },
            ].map((stat, i) => (
              <React.Fragment key={stat.label}>
                {i > 0 && <View style={styles.statDivider} />}
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        </LinearGradient>
      </Animated.View>

      {/* BODY */}
      <Animated.ScrollView
        style={[styles.body, { opacity: bodyFade, transform: [{ translateY: bodyLift }] }]}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Dossier card */}
        {myLead && (
          <View style={styles.sectionWrap}>
            <SectionHeader title={t('home.file')} />
            <LinearGradient colors={['rgba(20,12,38,0.97)', 'rgba(13,8,24,0.99)']} style={styles.dossierCard}>
              <View style={styles.dossierRow}>
                {/* Score ring */}
                <View style={[styles.scoreRing, { borderColor: scoreColor }]}>
                  <Text style={[styles.scoreVal, { color: scoreColor }]}>{myLead.score}</Text>
                  <Text style={styles.scoreSub}>/100</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dossierTitle}>Dossier {getScoreLabel(myLead.score)}</Text>
                  <View style={[styles.tempBadge, { backgroundColor: getTemperatureBgColor(myLead.temperature) }]}>
                    <Text style={[styles.tempText, { color: getTemperatureColor(myLead.temperature) }]}>
                      {getTemperatureLabel(myLead.temperature)}
                    </Text>
                  </View>
                  <Text style={styles.dossierSub} numberOfLines={1}>
                    {myLead.answers.propertyType} · {myLead.answers.targetZone}
                  </Text>
                </View>
              </View>

              <Divider style={{ marginVertical: 12 }} />

              <Text style={styles.pipelineLabel}>{t('home.progress')}</Text>
              <View style={styles.pipeline}>
                {PIPELINE_STAGES.map((stage, i) => (
                  <React.Fragment key={stage}>
                    <View style={styles.pipelineStep}>
                      <View style={[
                        styles.pipeDot,
                        i <= stageIndex && styles.pipeDotDone,
                        i === stageIndex && styles.pipeDotCurrent,
                      ]}>
                        {i < stageIndex && <Ionicons name="checkmark" size={9} color={Colors.white} />}
                      </View>
                      <Text style={[
                        styles.pipeStageLabel,
                        i === stageIndex && styles.pipeStageActive,
                        i < stageIndex && styles.pipeStageDone,
                      ]}>{stage}</Text>
                    </View>
                    {i < PIPELINE_STAGES.length - 1 && (
                      <View style={[styles.pipeLine, i < stageIndex && styles.pipeLineDone]} />
                    )}
                  </React.Fragment>
                ))}
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Feature cards grid */}
        <View style={styles.sectionWrap}>
          <SectionHeader title={t('home.yourSpace')} />
          <View style={styles.grid}>
            {FEATURE_CARDS.map((item, i) => (
              <Animated.View
                key={item.label}
                style={[
                  styles.gridItem,
                  {
                    opacity: cardAnims[i],
                    transform: [{
                      translateY: (cardAnims[i]).interpolate({ inputRange: [0, 1], outputRange: [16, 0] }),
                    }],
                  },
                ]}
              >
                <TouchableOpacity
                  style={[styles.featureCard, { borderColor: `${item.color}22` }]}
                  onPress={() => setClientActiveTab(item.tab)}
                  activeOpacity={0.88}
                >
                  <LinearGradient
                    colors={[`${item.color}18`, `${item.color}08`]}
                    style={styles.featureIconWrap}
                  >
                    <Ionicons name={item.icon as any} size={22} color={item.color} />
                  </LinearGradient>
                  <Text style={styles.featureLabel}>{item.label}</Text>
                  <Text style={[styles.featureCount, { color: item.color }]}>{item.count}</Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        </View>
      </Animated.ScrollView>

      {/* Support FAB */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.9} onPress={openSupportConversation}>
        <LinearGradient colors={Colors.gradientPrimary} style={styles.fabInner}>
          <Ionicons name="headset-outline" size={22} color={Colors.white} />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgMain },
<<<<<<< HEAD

  // Header
  header: {
    paddingTop: 12,
    paddingBottom: 18,
    paddingHorizontal: 18,
    position: 'relative',
    overflow: 'hidden',
  },
  orbA: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(92,16,216,0.2)',
    top: -80,
    right: -70,
  },
  orbB: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(227,22,140,0.1)',
    bottom: -50,
    left: -40,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  greeting: { fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: '600' },
  userName: { fontSize: 22, fontWeight: '900', color: Colors.white, letterSpacing: -0.4 },
  bellBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  bellBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: Colors.danger,
    borderWidth: 1.5,
    borderColor: 'rgba(18,10,40,1)',
  },

  statsStrip: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2, fontWeight: '600' },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.14)', marginVertical: 2 },

  // Body
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 90 },
  sectionWrap: { marginBottom: 6 },

  // Dossier card
  dossierCard: {
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  dossierRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  scoreRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  scoreVal: { fontSize: 17, fontWeight: '900' },
  scoreSub: { fontSize: 9, color: Colors.textMuted, fontWeight: '700' },
  dossierTitle: { fontSize: 14, fontWeight: '800', color: Colors.textDark, marginBottom: 4 },
  tempBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginBottom: 5 },
  tempText: { fontSize: 11, fontWeight: '700' },
=======
  header: { paddingTop: 14, paddingBottom: 20, paddingHorizontal: 18, position: 'relative', overflow: 'hidden', borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  deco: { position: 'absolute', borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.07)' },
  decoA: { width: 280, height: 280, top: -100, right: -90, backgroundColor: 'rgba(160,62,255,0.14)' },
  decoB: { width: 170, height: 170, bottom: -54, left: -56, backgroundColor: 'rgba(255,79,216,0.12)' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  greeting: { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '600' },
  userName: { fontSize: 28, fontWeight: '300', color: Colors.white, letterSpacing: -0.5 },
  bellBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  bellBadge: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.danger, borderWidth: 1.5, borderColor: Colors.white },
  quickStats: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  quickStat: { flex: 1, alignItems: 'center' },
  quickStatValue: { fontSize: 20, fontWeight: '800', color: Colors.white },
  quickStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 3, fontWeight: '600' },
  quickStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 8 },
  body: { flex: 1, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 68, justifyContent: 'space-between' },
  sectionBlock: { marginBottom: 4 },
  dossierCard: { backgroundColor: Colors.bgCard, borderRadius: 24, padding: 14, borderWidth: 1, borderColor: Colors.borderSoft, shadowColor: Colors.shadowDark, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.16, shadowRadius: 18, elevation: 5 },
  dossierTop: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  scoreBox: { alignItems: 'center' },
  scoreRingLarge: { width: 54, height: 54, borderRadius: 27, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  scoreValue: { fontSize: 16, fontWeight: '900' },
  scoreMax: { fontSize: 10, color: Colors.textMuted, fontWeight: '600' },
  dossierTitle: { fontSize: 13, fontWeight: '700', color: Colors.textDark, marginBottom: 3 },
  tempBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginBottom: 6 },
  tempBadgeText: { fontSize: 11, fontWeight: '700' },
>>>>>>> 23a070d (Apply new design system across app)
  dossierSub: { fontSize: 11, color: Colors.textSoft },

  // Pipeline
  pipelineLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  pipeline: { flexDirection: 'row', alignItems: 'center' },
  pipelineStep: { alignItems: 'center', gap: 4 },
<<<<<<< HEAD
  pipeDot: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.borderSoft,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.border,
  },
  pipeDotDone: { backgroundColor: Colors.success, borderColor: Colors.success },
  pipeDotCurrent: { backgroundColor: Colors.primary, borderColor: Colors.primary, width: 22, height: 22, borderRadius: 11 },
  pipeStageLabel: { fontSize: 7, color: Colors.textMuted, fontWeight: '500', textAlign: 'center', maxWidth: 42 },
  pipeStageActive: { color: Colors.primary, fontWeight: '800', fontSize: 9 },
  pipeStageDone: { color: Colors.success, fontWeight: '600' },
  pipeLine: { flex: 1, height: 2, backgroundColor: Colors.borderSoft, marginBottom: 14 },
  pipeLineDone: { backgroundColor: Colors.success },

  // Feature grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridItem: { width: '47.5%' },
  featureCard: {
    paddingVertical: 18,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(17,11,33,0.94)',
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  featureIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureLabel: { fontSize: 12, fontWeight: '700', color: Colors.textBody, textAlign: 'center' },
  featureCount: { fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },

  // FAB
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    borderRadius: 999,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.36,
    shadowRadius: 18,
    elevation: 10,
  },
  fabInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
=======
  pipelineDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.borderSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.border },
  pipelineDotDone: { backgroundColor: Colors.success, borderColor: Colors.success },
  pipelineDotCurrent: { backgroundColor: Colors.primary, borderColor: Colors.primary, width: 22, height: 22, borderRadius: 11 },
  pipelineLabel: { fontSize: 7, color: Colors.textMuted, fontWeight: '500', textAlign: 'center', maxWidth: 38 },
  pipelineLabelActive: { color: Colors.primary, fontWeight: '700', fontSize: 9 },
  pipelineLabelDone: { color: Colors.success, fontWeight: '600' },
  pipelineLine: { flex: 1, height: 2, backgroundColor: Colors.borderSoft, marginBottom: 14 },
  pipelineLineDone: { backgroundColor: Colors.success },
  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  featureCard: { width: '100%', minHeight: 86, backgroundColor: Colors.bgCard, borderRadius: 22, padding: 12, borderWidth: 1, borderColor: Colors.borderSoft, alignItems: 'center', justifyContent: 'center', gap: 6 },
  featureIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  featureLabel: { fontSize: 11, fontWeight: '700', color: Colors.textDark, textAlign: 'center' },
  featureCount: { fontSize: 16, fontWeight: '800' },
  supportFab: { position: 'absolute', right: 16, bottom: 16, borderRadius: 999, shadowColor: Colors.shadowDark, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8 },
  supportFabInner: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
>>>>>>> 23a070d (Apply new design system across app)
});
