import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { Appointments, SupportRequests } from '../../lib/api';
import { Appointment } from '../../types';
import { Divider, GradientCard, SectionHeader } from '../../components/ui';
import { getScoreColor, getScoreLabel, getTemperatureBgColor, getTemperatureColor, getTemperatureLabel } from '../../utils/scoring';

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

const PIPELINE_STAGES = ['Nouveau', 'Contacte', 'Visite', 'Offre', 'Signe'];

export function HomeScreen() {
  const {
    currentUser,
    leads,
    favorites,
    matchedProperties,
    unreadCount,
    unreadMessages,
    setClientActiveTab,
    focusConversation,
    realtimeVersion,
    t,
  } = useApp();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const heroFade = useRef(new Animated.Value(0)).current;
  const heroLift = useRef(new Animated.Value(18)).current;
  const bodyFade = useRef(new Animated.Value(0)).current;
  const bodyLift = useRef(new Animated.Value(28)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const featureCardAnims = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;

  const myLead = leads.find((lead) => lead.clientEmail === currentUser?.email) || leads[0];
  const actualMatches = matchedProperties.filter((property) => !!property?.id && property.score > 0);
  const heroMatch = actualMatches[0];
  const upcomingVisits = appointments.filter((item) => item.status === 'Planifié' || item.status === 'Confirmé').length;
  const stageIndex = myLead ? PIPELINE_STAGES.indexOf(myLead.status as any) : 0;
  const scoreColor = myLead ? getScoreColor(myLead.score) : Colors.textMuted;

  useEffect(() => {
    let mounted = true;
    Appointments.list()
      .then((items) => {
        if (mounted) setAppointments(uniqueById(items as Appointment[]));
      })
      .catch(() => {
        if (mounted) setAppointments([]);
      });
    return () => {
      mounted = false;
    };
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

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]),
    ).start();

    featureCardAnims.forEach((anim) => anim.setValue(0));
    Animated.stagger(
      80,
      featureCardAnims.map((anim) => Animated.timing(anim, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: false })),
    ).start();
  }, [bodyFade, bodyLift, featureCardAnims, floatAnim, heroFade, heroLift, pulseAnim]);

  const heroTranslateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -6],
  });
  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });

  const openSupportConversation = async () => {
    try {
      const response = await SupportRequests.openConversation();
      focusConversation(response.id);
      setClientActiveTab('Messages');
    } catch {
      // ignore
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity: heroFade, transform: [{ translateY: heroLift }] }}>
        <LinearGradient colors={Colors.gradientHero} style={styles.header}>
          <Animated.View style={[styles.deco, styles.decoA, { transform: [{ translateY: heroTranslateY }] }]} />
          <Animated.View style={[styles.deco, styles.decoB, { transform: [{ translateY: heroTranslateY }] }]} />

          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>{t('home.greeting')}</Text>
              <Text style={styles.userName}>{currentUser?.name?.split(' ')[0] || t('common.welcome')}</Text>
            </View>
            <Animated.View style={{ transform: [{ scale: unreadCount > 0 ? pulseScale : 1 }] }}>
              <TouchableOpacity style={styles.bellBtn}>
                <Ionicons name="notifications-outline" size={22} color={Colors.white} />
                {unreadCount > 0 ? <View style={styles.bellBadge} /> : null}
              </TouchableOpacity>
            </Animated.View>
          </View>

          <View style={styles.quickStats}>
            <View style={styles.quickStat}>
              <Text style={styles.quickStatValue}>{actualMatches.length}</Text>
              <Text style={styles.quickStatLabel}>{t('home.matches')}</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStat}>
              <Text style={styles.quickStatValue}>{favorites.length}</Text>
              <Text style={styles.quickStatLabel}>{t('home.favorites')}</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStat}>
              <Text style={styles.quickStatValue}>{myLead?.score || '-'}</Text>
              <Text style={styles.quickStatLabel}>{t('home.score')}</Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      <Animated.View style={[styles.body, { opacity: bodyFade, transform: [{ translateY: bodyLift }] }]}>
        {myLead ? (
          <View style={styles.sectionBlock}>
            <SectionHeader title={t('home.file')} />
            <View style={styles.dossierCard}>
              <View style={styles.dossierTop}>
                <View style={styles.scoreBox}>
                  <View style={[styles.scoreRingLarge, { borderColor: scoreColor }]}>
                    <Text style={[styles.scoreValue, { color: scoreColor }]}>{myLead.score}</Text>
                    <Text style={styles.scoreMax}>/100</Text>
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dossierTitle}>Dossier {getScoreLabel(myLead.score)}</Text>
                  <View style={[styles.tempBadge, { backgroundColor: getTemperatureBgColor(myLead.temperature) }]}>
                    <Text style={[styles.tempBadgeText, { color: getTemperatureColor(myLead.temperature) }]}>
                      {getTemperatureLabel(myLead.temperature)}
                    </Text>
                  </View>
                  <Text style={styles.dossierSub} numberOfLines={1}>
                    {myLead.answers.propertyType} - {myLead.answers.targetZone}
                  </Text>
                </View>
              </View>

              <Divider style={{ marginVertical: 10 }} />

              <Text style={styles.pipelineTitle}>{t('home.progress')}</Text>
              <View style={styles.pipeline}>
                {PIPELINE_STAGES.map((stage, index) => (
                  <React.Fragment key={stage}>
                    <View style={styles.pipelineStep}>
                      <View
                        style={[
                          styles.pipelineDot,
                          index <= stageIndex && styles.pipelineDotDone,
                          index === stageIndex && styles.pipelineDotCurrent,
                        ]}
                      >
                        {index < stageIndex ? <Ionicons name="checkmark" size={10} color={Colors.white} /> : null}
                      </View>
                      <Text
                        style={[
                          styles.pipelineLabel,
                          index === stageIndex && styles.pipelineLabelActive,
                          index < stageIndex && styles.pipelineLabelDone,
                        ]}
                      >
                        {stage}
                      </Text>
                    </View>
                    {index < PIPELINE_STAGES.length - 1 ? (
                      <View style={[styles.pipelineLine, index < stageIndex && styles.pipelineLineDone]} />
                    ) : null}
                  </React.Fragment>
                ))}
              </View>
            </View>
          </View>
        ) : null}

        {heroMatch ? (
          <View style={styles.sectionBlock}>
            <SectionHeader title={t('home.mainMatch')} action={t('common.open')} onAction={() => setClientActiveTab('Match')} />
            <TouchableOpacity style={styles.heroMatchCard} activeOpacity={0.85} onPress={() => setClientActiveTab('Match')}>
              <View style={styles.heroMatchTop}>
                <Text style={styles.heroMatchBadge}>{heroMatch.badge}</Text>
                <Text style={styles.heroMatchScore}>{heroMatch.score}/100</Text>
              </View>
              <Text style={styles.heroMatchTitle} numberOfLines={1}>{heroMatch.title}</Text>
              <Text style={styles.heroMatchMeta} numberOfLines={1}>{heroMatch.district}, {heroMatch.city}</Text>
              <Text style={styles.heroMatchMeta} numberOfLines={1}>{heroMatch.price} - {heroMatch.area} - {heroMatch.rooms} pieces</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <GradientCard style={styles.noMatchCard}>
            <View style={styles.noMatchContent}>
              <View style={styles.noMatchIcon}>
                <Ionicons name="sparkles-outline" size={24} color={Colors.white} />
              </View>
              <Text style={styles.noMatchTitle}>{t('home.completeProfile')}</Text>
              <Text style={styles.noMatchSub}>{t('home.completeProfileSub')}</Text>
            </View>
          </GradientCard>
        )}

        <View style={styles.sectionBlock}>
          <SectionHeader title={t('home.yourSpace')} />
          <View style={styles.featuresGrid}>
            {[
              { icon: 'heart-circle-outline', label: t('nav.match'), count: actualMatches.length, color: Colors.primary, tab: 'Match' },
              { icon: 'bookmark-outline', label: t('nav.favorites'), count: favorites.length, color: Colors.primaryLight, tab: 'Favorites' },
              { icon: 'calendar-outline', label: t('nav.visits'), count: upcomingVisits, color: Colors.warning, tab: 'Visits' },
              { icon: 'chatbubble-outline', label: t('nav.messages'), count: unreadMessages, color: Colors.success, tab: 'Messages' },
            ].map((item, index) => (
              <Animated.View
                key={item.label}
                style={{
                  width: '48%',
                  opacity: featureCardAnims[index] ?? 1,
                  transform: [{
                    translateY: (featureCardAnims[index] ?? new Animated.Value(1)).interpolate({
                      inputRange: [0, 1],
                      outputRange: [14, 0],
                    }),
                  }],
                }}
              >
                <TouchableOpacity style={styles.featureCard} onPress={() => setClientActiveTab(item.tab)}>
                  <View style={[styles.featureIcon, { backgroundColor: `${item.color}14` }]}>
                    <Ionicons name={item.icon as any} size={20} color={item.color} />
                  </View>
                  <Text style={styles.featureLabel}>{item.label}</Text>
                  <Text style={[styles.featureCount, { color: item.color }]}>{item.count}</Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        </View>
      </Animated.View>

      <TouchableOpacity style={styles.supportFab} activeOpacity={0.9} onPress={openSupportConversation}>
        <LinearGradient colors={Colors.gradientPrimary} style={styles.supportFabInner}>
          <Ionicons name="headset-outline" size={24} color={Colors.white} />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgMain },
  header: { paddingTop: 8, paddingBottom: 12, paddingHorizontal: 16, position: 'relative', overflow: 'hidden' },
  deco: { position: 'absolute', borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.07)' },
  decoA: { width: 220, height: 220, top: -80, right: -60 },
  decoB: { width: 140, height: 140, bottom: -40, left: -40 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  greeting: { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  userName: { fontSize: 20, fontWeight: '800', color: Colors.white, letterSpacing: -0.3 },
  bellBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  bellBadge: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.danger, borderWidth: 1.5, borderColor: Colors.white },
  quickStats: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  quickStat: { flex: 1, alignItems: 'center' },
  quickStatValue: { fontSize: 17, fontWeight: '800', color: Colors.white },
  quickStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2, fontWeight: '500' },
  quickStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 8 },
  body: { flex: 1, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 68, justifyContent: 'space-between' },
  sectionBlock: { marginBottom: 4 },
  dossierCard: { backgroundColor: Colors.bgCard, borderRadius: 18, padding: 10, borderWidth: 1, borderColor: Colors.borderSoft, shadowColor: Colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  dossierTop: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  scoreBox: { alignItems: 'center' },
  scoreRingLarge: { width: 54, height: 54, borderRadius: 27, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  scoreValue: { fontSize: 16, fontWeight: '900' },
  scoreMax: { fontSize: 10, color: Colors.textMuted, fontWeight: '600' },
  dossierTitle: { fontSize: 13, fontWeight: '700', color: Colors.textDark, marginBottom: 3 },
  tempBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginBottom: 6 },
  tempBadgeText: { fontSize: 11, fontWeight: '700' },
  dossierSub: { fontSize: 11, color: Colors.textSoft },
  pipelineTitle: { fontSize: 10, fontWeight: '700', color: Colors.textSoft, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  pipeline: { flexDirection: 'row', alignItems: 'center' },
  pipelineStep: { alignItems: 'center', gap: 4 },
  pipelineDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.borderSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.border },
  pipelineDotDone: { backgroundColor: Colors.success, borderColor: Colors.success },
  pipelineDotCurrent: { backgroundColor: Colors.primary, borderColor: Colors.primary, width: 22, height: 22, borderRadius: 11 },
  pipelineLabel: { fontSize: 7, color: Colors.textMuted, fontWeight: '500', textAlign: 'center', maxWidth: 38 },
  pipelineLabelActive: { color: Colors.primary, fontWeight: '700', fontSize: 9 },
  pipelineLabelDone: { color: Colors.success, fontWeight: '600' },
  pipelineLine: { flex: 1, height: 2, backgroundColor: Colors.borderSoft, marginBottom: 14 },
  pipelineLineDone: { backgroundColor: Colors.success },
  heroMatchCard: { backgroundColor: Colors.bgCard, borderRadius: 18, padding: 10, borderWidth: 1, borderColor: Colors.borderSoft },
  heroMatchTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  heroMatchBadge: { fontSize: 11, fontWeight: '800', color: Colors.primary, backgroundColor: Colors.lavenderUltra, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  heroMatchScore: { fontSize: 12, fontWeight: '800', color: Colors.textDark },
  heroMatchTitle: { fontSize: 14, fontWeight: '800', color: Colors.textDark, marginBottom: 4 },
  heroMatchMeta: { fontSize: 11, color: Colors.textSoft, marginBottom: 2 },
  noMatchCard: { padding: 10, marginBottom: 4 },
  noMatchContent: { alignItems: 'center', gap: 5 },
  noMatchIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  noMatchTitle: { fontSize: 13, fontWeight: '800', color: Colors.white },
  noMatchSub: { fontSize: 10, color: 'rgba(255,255,255,0.82)', textAlign: 'center', lineHeight: 13 },
  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  featureCard: { width: '100%', minHeight: 72, backgroundColor: Colors.bgCard, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: Colors.borderSoft, alignItems: 'center', justifyContent: 'center', gap: 4 },
  featureIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  featureLabel: { fontSize: 10, fontWeight: '600', color: Colors.textDark, textAlign: 'center' },
  featureCount: { fontSize: 14, fontWeight: '800' },
  supportFab: { position: 'absolute', right: 16, bottom: 16, borderRadius: 999, shadowColor: Colors.shadowDark, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8 },
  supportFabInner: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});
