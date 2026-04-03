import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolation,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandWordmark } from '../../components/BrandWordmark';
import {
  ActionButtonsRow,
  BrandHeader,
  OnboardingContainer,
  OnboardingNextButton,
  OnboardingPagination,
  PropertyShowcaseCard,
  onboardingTheme,
} from '../../components/onboarding';
import { useApp } from '../../context/AppContext';

const PANEL_INNER_WIDTH =
  onboardingTheme.panelWidth - onboardingTheme.contentHorizontal * 2;

const PROPERTY_IMAGE =
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80';
const SWIPE_IMAGE =
  'https://images.unsplash.com/photo-1460317442991-0ec209397118?w=1200&q=80';

// ─── Per-page animated wrapper ────────────────────────────────────────────────
// Fades + slides content in when its page becomes active.
function PageWrapper({
  children,
  index,
  activeIndex,
}: {
  children: React.ReactNode;
  index: number;
  activeIndex: number;
}) {
  const opacity = useSharedValue(index === 0 ? 1 : 0);
  const translateY = useSharedValue(index === 0 ? 0 : 14);

  useEffect(() => {
    if (activeIndex === index) {
      opacity.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
      translateY.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.quad) });
    } else {
      opacity.value = withTiming(0, { duration: 180 });
      translateY.value = withTiming(14, { duration: 180 });
    }
  }, [activeIndex, index, opacity, translateY]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[StyleSheet.absoluteFill, style]}>{children}</Animated.View>;
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export function OnboardingScreen() {
  const { setCurrentScreen, setHasSeenOnboarding } = useApp();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView | null>(null);
  const scrollX = useSharedValue(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const PAGE_COUNT = 3;

  const handleScrollEvent = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollX.value = event.nativeEvent.contentOffset.x;
    },
    [],
  );

  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextIndex = Math.round(
        event.nativeEvent.contentOffset.x / PANEL_INNER_WIDTH,
      );
      setActiveIndex(nextIndex);
    },
    [],
  );

  const goToIndex = useCallback((index: number) => {
    scrollRef.current?.scrollTo({ x: index * PANEL_INNER_WIDTH, animated: true });
    setActiveIndex(index);
  }, []);

  const handleNext = useCallback(() => {
    if (activeIndex < PAGE_COUNT - 1) {
      goToIndex(activeIndex + 1);
      return;
    }
    setHasSeenOnboarding(true);
    setCurrentScreen('Auth');
  }, [activeIndex]);

  // ── Intro brand scale/opacity tied to scroll ──
  const introBrandStyle = useAnimatedStyle(() => {
    const progress = scrollX.value / PANEL_INNER_WIDTH;
    return {
      opacity: interpolate(progress, [0, 0.45], [1, 0.4], Extrapolation.CLAMP),
      transform: [
        {
          scale: interpolate(progress, [0, 1], [1, 0.94], Extrapolation.CLAMP),
        },
      ],
    };
  });

  return (
    <OnboardingContainer contentStyle={styles.content}>
      {/* Horizontal pager */}
      <View style={styles.sliderShell}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={PANEL_INNER_WIDTH}
          snapToAlignment="start"
          bounces={false}
          onMomentumScrollEnd={handleScrollEnd}
          scrollEventThrottle={16}
          onScroll={handleScrollEvent}
        >
          {/* ── Page 0 — Splash branding ── */}
          <View style={styles.page}>
            <PageWrapper index={0} activeIndex={activeIndex}>
              <View style={styles.introPage}>
                <View style={styles.introArtwork} pointerEvents="none">
                  <View style={styles.introHeartOutline} />
                  <View style={styles.introDiamondOutline} />
                  <View style={styles.introWindowGrid}>
                    <View style={styles.introWindow} />
                    <View style={styles.introWindow} />
                    <View style={styles.introWindow} />
                    <View style={styles.introWindow} />
                  </View>
                </View>
                <View style={styles.introSpacer} />
                <Animated.View style={[styles.introBrandWrap, introBrandStyle]}>
                  <BrandWordmark
                    size="xl"
                    variant="white"
                    iconStyle={styles.introBrandIcon}
                  />
                </Animated.View>
                <Text style={styles.introTagline}>Real estate matching</Text>
                <View style={styles.introBottomSpacer} />
              </View>
            </PageWrapper>
          </View>

          {/* ── Page 1 — Premium experience ── */}
          <View style={styles.page}>
            <PageWrapper index={1} activeIndex={activeIndex}>
              <BrandHeader title="Real estate matching" />
              <View style={styles.premiumCardWrap}>
                <PropertyShowcaseCard
                  mode="stacked"
                  imageUri={PROPERTY_IMAGE}
                  propertyName="Linaz Living"
                  standing="HAUT STANDING"
                  availability="CFC 2 - disponible fin 2026"
                />
              </View>
              <View style={styles.copyBlock}>
                <Text style={styles.headline}>Une expérience{'\n'}immobilière</Text>
                <Text style={styles.accent}>premium et intelligente</Text>
                <Text style={styles.body}>
                  Matching, suivi, CRM et validation{'\n'}dans une seule application mobile.
                </Text>
              </View>
            </PageWrapper>
          </View>

          {/* ── Page 2 — Swipe matching ── */}
          <View style={styles.page}>
            <PageWrapper index={2} activeIndex={activeIndex}>
              <BrandHeader
                title="Swipe to like"
                subtitle="Un commercial vas vous contacter"
                titleColor={onboardingTheme.accentPink}
                compact
              />
              <View style={styles.swipeCardWrap}>
                <PropertyShowcaseCard
                  mode="swipe"
                  imageUri={SWIPE_IMAGE}
                  propertyName="Linaz Living"
                  standing="HAUT STANDING"
                  availability="CFC 2 - disponible fin 2026"
                />
              </View>
              <View style={styles.actionsWrap}>
                <ActionButtonsRow />
              </View>
            </PageWrapper>
          </View>
        </ScrollView>
      </View>

      {/* Footer: pagination + next */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) + 10 }]}>
        <OnboardingPagination total={PAGE_COUNT} activeIndex={activeIndex} />
        <OnboardingNextButton onPress={handleNext} />
      </View>
    </OnboardingContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  content: {
    paddingTop: 8,
    paddingBottom: 6,
  },
  sliderShell: {
    flex: 1,
  },

  // Each page is a fixed-width container; PageWrapper fills it absolutely
  page: {
    width: PANEL_INNER_WIDTH,
    flex: 1,
    position: 'relative',
  },

  // ── Intro page ──
  introPage: {
    flex: 1,
    alignItems: 'center',
  },
  introArtwork: {
    position: 'absolute',
    top: -34,
    left: -34,
    right: -34,
    height: '68%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  introHeartOutline: {
    position: 'absolute',
    top: -78,
    width: 470,
    height: 344,
    borderWidth: 1,
    borderColor: 'rgba(103, 63, 183, 0.22)',
    borderBottomWidth: 0,
    borderTopLeftRadius: 235,
    borderTopRightRadius: 235,
    transform: [{ scaleY: 0.84 }],
  },
  introDiamondOutline: {
    position: 'absolute',
    top: 116,
    width: 360,
    height: 360,
    borderWidth: 1,
    borderColor: 'rgba(103, 63, 183, 0.16)',
    borderRadius: 28,
    transform: [{ rotate: '45deg' }],
  },
  introWindowGrid: {
    position: 'absolute',
    top: 162,
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 112,
    gap: 10,
  },
  introWindow: {
    width: 51,
    height: 51,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(103, 63, 183, 0.12)',
  },
  introSpacer: {
    flex: 1.28,
  },
  introBrandWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  introBrandIcon: {
    width: 410,
    height: 122,
  },
  introTagline: {
    marginTop: 54,
    color: onboardingTheme.accentPink,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 1.8,
    fontWeight: '400',
  },
  introBottomSpacer: {
    flex: 0.88,
  },

  // ── Premium page ──
  premiumCardWrap: {
    marginTop: 10,
  },
  copyBlock: {
    marginTop: 16,
    flex: 1,
  },
  headline: {
    color: onboardingTheme.textPrimary,
    fontSize: 31,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.9,
  },
  accent: {
    marginTop: 12,
    color: onboardingTheme.accentPink,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '500',
    letterSpacing: -0.4,
  },
  body: {
    marginTop: 18,
    color: onboardingTheme.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    maxWidth: 292,
  },

  // ── Swipe page ──
  swipeCardWrap: {
    marginTop: 2,
    flex: 1,
    justifyContent: 'flex-start',
  },
  actionsWrap: {
    marginTop: -10,
    marginBottom: 12,
  },

  // ── Footer ──
  footer: {
    marginTop: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
