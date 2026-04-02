import React, { useCallback, useRef, useState } from 'react';
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
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80';

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
  const prevActive = useRef(activeIndex);
  const opacity = useSharedValue(index === 0 ? 1 : 0);
  const translateY = useSharedValue(index === 0 ? 0 : 14);

  // Trigger enter animation whenever this page becomes active
  if (activeIndex !== prevActive.current) {
    prevActive.current = activeIndex;
    if (activeIndex === index) {
      opacity.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
      translateY.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.quad) });
    } else {
      opacity.value = withTiming(0, { duration: 180 });
      translateY.value = withTiming(14, { duration: 180 });
    }
  }

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[StyleSheet.absoluteFill, style]}>{children}</Animated.View>;
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export function OnboardingScreen() {
  const { setCurrentScreen, setHasSeenOnboarding } = useApp();
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
    setCurrentScreen('Questionnaire');
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
                <View style={styles.introSpacer} />
                <Animated.View style={[styles.introBrandWrap, introBrandStyle]}>
                  <BrandWordmark
                    size="xl"
                    textStyle={styles.introBrandText}
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
              />
              <View style={styles.swipeCardWrap}>
                <PropertyShowcaseCard
                  mode="swipe"
                  imageUri={PROPERTY_IMAGE}
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
      <View style={styles.footer}>
        <OnboardingPagination total={PAGE_COUNT} activeIndex={activeIndex} />
        <OnboardingNextButton onPress={handleNext} />
      </View>
    </OnboardingContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  content: {
    paddingTop: 16,
    paddingBottom: 16,
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
  introSpacer: {
    flex: 1.1,
  },
  introBrandWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  introBrandText: {
    fontSize: 68,
    lineHeight: 70,
    fontWeight: '700',
    letterSpacing: -2,
  },
  introBrandIcon: {
    transform: [{ scale: 1.08 }],
    marginRight: 4,
  },
  introTagline: {
    marginTop: 100,
    color: onboardingTheme.accentPink,
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: 3.5,
    fontWeight: '400',
  },
  introBottomSpacer: {
    flex: 1.2,
  },

  // ── Premium page ──
  premiumCardWrap: {
    marginTop: 18,
  },
  copyBlock: {
    marginTop: 18,
    flex: 1,
  },
  headline: {
    color: onboardingTheme.textPrimary,
    fontSize: 38,
    lineHeight: 43,
    fontWeight: '700',
    letterSpacing: -1.5,
  },
  accent: {
    marginTop: 16,
    color: onboardingTheme.accentPink,
    fontSize: 23,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  body: {
    marginTop: 20,
    color: onboardingTheme.textSecondary,
    fontSize: 16,
    lineHeight: 25,
    maxWidth: 330,
  },

  // ── Swipe page ──
  swipeCardWrap: {
    marginTop: 12,
    flex: 1,
    justifyContent: 'center',
  },
  actionsWrap: {
    marginTop: 2,
    marginBottom: 8,
  },

  // ── Footer ──
  footer: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
