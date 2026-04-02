import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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

const PANEL_INNER_WIDTH = onboardingTheme.panelWidth - onboardingTheme.contentHorizontal * 2;
const PROPERTY_IMAGE =
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80';

export function OnboardingScreen() {
  const { setCurrentScreen, setHasSeenOnboarding } = useApp();
  const scrollRef = useRef<ScrollView | null>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [activeIndex, setActiveIndex] = useState(0);

  const pages = useMemo(
    () => [
      <View key="intro" style={[styles.page, styles.introPage]}>
        <View style={styles.introSpacer} />
        <Animated.View
          style={[
            styles.introBrandWrap,
            {
              opacity: scrollX.interpolate({
                inputRange: [0, PANEL_INNER_WIDTH * 0.45],
                outputRange: [1, 0.45],
                extrapolate: 'clamp',
              }),
              transform: [
                {
                  scale: scrollX.interpolate({
                    inputRange: [0, PANEL_INNER_WIDTH],
                    outputRange: [1, 0.94],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            },
          ]}
        >
          <BrandWordmark
            size="xl"
            textStyle={styles.introBrandText}
            iconStyle={styles.introBrandIcon}
          />
        </Animated.View>
        <Text style={styles.introTagline}>Real estate matching</Text>
        <View style={styles.introBottomSpacer} />
      </View>,
      <View key="premium" style={styles.page}>
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
      </View>,
      <View key="swipe" style={styles.page}>
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
      </View>,
    ],
    [scrollX],
  );

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / PANEL_INNER_WIDTH);
    setActiveIndex(nextIndex);
  };

  const goToIndex = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * PANEL_INNER_WIDTH, animated: true });
    setActiveIndex(index);
  };

  const handleNext = () => {
    if (activeIndex < pages.length - 1) {
      goToIndex(activeIndex + 1);
      return;
    }

    setHasSeenOnboarding(true);
    setCurrentScreen('Questionnaire');
  };

  return (
    <OnboardingContainer contentStyle={styles.content}>
      <View style={styles.sliderShell}>
        <Animated.ScrollView
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
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false },
          )}
        >
          {pages}
        </Animated.ScrollView>
      </View>

      <View style={styles.footer}>
        <OnboardingPagination total={pages.length} activeIndex={activeIndex} />
        <OnboardingNextButton onPress={handleNext} />
      </View>
    </OnboardingContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 18,
    paddingBottom: 18,
  },
  sliderShell: {
    flex: 1,
  },
  page: {
    width: PANEL_INNER_WIDTH,
    flex: 1,
    paddingTop: 8,
  },
  introPage: {
    alignItems: 'center',
  },
  introSpacer: {
    flex: 1.05,
  },
  introBrandWrap: {
    justifyContent: 'center',
    alignItems: 'center',
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
    marginTop: 126,
    color: onboardingTheme.accentPink,
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: 4,
    fontWeight: '400',
  },
  introBottomSpacer: {
    flex: 1.15,
  },
  premiumCardWrap: {
    marginTop: 20,
  },
  copyBlock: {
    marginTop: 20,
    flex: 1,
  },
  headline: {
    color: onboardingTheme.textPrimary,
    fontSize: 38,
    lineHeight: 42,
    fontWeight: '700',
    letterSpacing: -1.4,
  },
  accent: {
    marginTop: 18,
    color: onboardingTheme.accentPink,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  body: {
    marginTop: 22,
    color: onboardingTheme.textSecondary,
    fontSize: 17,
    lineHeight: 26,
    maxWidth: 330,
  },
  swipeCardWrap: {
    marginTop: 14,
    flex: 1,
    justifyContent: 'center',
  },
  actionsWrap: {
    marginTop: 4,
    marginBottom: 10,
  },
  footer: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
