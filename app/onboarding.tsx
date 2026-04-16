import React, { useState, useEffect, useRef } from 'react';
import { requestNotificationPermissions } from '../services/notifications';
import { runStartupPermissionCheck, promptBatteryOptimization, promptFullScreenIntent } from '../services/permissions';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/ui/Button';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../constants/theme';
import { useSettings } from '../hooks/useSettings';

const { width } = Dimensions.get('window');

const slides = [
  {
    isBrandSlide: true,
    image: null,
    title: '',
    description: '',
  },
  {
    isBrandSlide: false,
    image: require('../assets/images/onboarding-1.png'),
    title: 'Smart Notes & Reminders',
    description: 'Organize your thoughts and never miss important tasks with our powerful 2-in-1 productivity app',
  },
  {
    isBrandSlide: false,
    image: require('../assets/images/onboarding-2.png'),
    title: 'Intelligent Organization',
    description: 'Rich task details, categories, priorities, and seamless note-reminder linking for ultimate productivity',
  },
  {
    isBrandSlide: false,
    image: require('../assets/images/onboarding-3.png'),
    title: 'Secure & Private',
    description: 'Your data stays on your device with biometric security and PIN protection',
  },
];

// ── Animated brand title component ───────────────────────────────────────────
function BrandTitle({ colors }: { colors: any }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;
  const subtitleFade = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.7)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Logo entrance
    Animated.sequence([
      Animated.delay(100),
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, tension: 130, friction: 8, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    ]).start();

    // Title slide up
    Animated.sequence([
      Animated.delay(350),
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();

    // Subtitle
    Animated.sequence([
      Animated.delay(900),
      Animated.timing(subtitleFade, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    // Continuous shimmer loop on app name
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const letterSpacing = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [-1.5, 0.5] });

  return (
    <View style={brandStyles.wrap}>
      {/* App logo — no background box */}
      <Animated.View style={{ transform: [{ scale: logoScale }], opacity: logoOpacity }}>
        <Image
          source={require('../assets/images/logo.png')}
          style={brandStyles.logoImg}
          contentFit="contain"
        />
      </Animated.View>

      {/* App name — gradient text via masked approach */}
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY }], alignItems: 'center' }}>
        {/* "Creatorz" — large gradient letters */}
        <View style={brandStyles.appNameRow}>
          {['C','r','e','a','t','o','r','z'].map((letter, i) => {
            const gradientColors: [string, string] =
              i < 3 ? ['#818CF8', '#6366F1'] :
              i < 6 ? ['#6366F1', '#A855F7'] :
                      ['#A855F7', '#EC4899'];
            return (
              <LinearGradient
                key={i}
                colors={gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={brandStyles.letterGradient}
              >
                <Text style={brandStyles.appNameLetter}>{letter}</Text>
              </LinearGradient>
            );
          })}
        </View>

        {/* Subtitle row */}
        <View style={brandStyles.subtitleRow}>
          <View style={[brandStyles.subtitleDot, { backgroundColor: '#6366F1' }]} />
          <Text style={[brandStyles.appSubName, { color: colors.textSecondary }]}>
            Reminder {'&'} Notes
          </Text>
          <View style={[brandStyles.subtitleDot, { backgroundColor: '#A855F7' }]} />
        </View>
      </Animated.View>

      {/* Tagline + decorative line */}
      <Animated.View style={{ opacity: subtitleFade, alignItems: 'center', gap: SPACING.sm }}>
        <Text style={[brandStyles.tagline, { color: colors.textTertiary }]}>
          Your productivity, beautifully organized
        </Text>
        <LinearGradient
          colors={['transparent', '#6366F1', '#A855F7', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={brandStyles.dividerLine}
        />
      </Animated.View>
    </View>
  );
}

const brandStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.lg,
  },
  logoImg: {
    width: 100,
    height: 100,
  },
  appNameRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1,
    marginBottom: SPACING.xs,
  },
  letterGradient: {
    borderRadius: 4,
    paddingHorizontal: 1,
  },
  appNameLetter: {
    fontSize: 48,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -1,
    includeFontPadding: false,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  subtitleDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    opacity: 0.7,
  },
  appSubName: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.8,
  },
  tagline: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '400',
    textAlign: 'center',
    letterSpacing: 0.3,
    fontStyle: 'italic',
  },
  dividerLine: {
    height: 2,
    width: 200,
    borderRadius: 1,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentTheme, updateSettings } = useSettings();
  const colors = COLORS[currentTheme];
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      finishOnboarding();
    }
  };

  const handleSkip = () => {
    finishOnboarding();
  };

  const finishOnboarding = async () => {
    // Request all permissions in sequence so the user sees proper system dialogs
    await requestNotificationPermissions().catch(() => {});
    await runStartupPermissionCheck().catch(() => {});
    // Prompt battery optimization on Android so alarms work when app is killed
    if (typeof promptBatteryOptimization === 'function') {
      promptBatteryOptimization(
        () => {
          // After battery optimization, prompt full-screen intent (Android 14+)
          if (typeof promptFullScreenIntent === 'function') {
            promptFullScreenIntent(() => {}, () => {});
          }
        },
        () => {
          // Even if user skips battery opt, still prompt for full-screen
          if (typeof promptFullScreenIntent === 'function') {
            promptFullScreenIntent(() => {}, () => {});
          }
        }
      );
    }
    updateSettings({ onboardingCompleted: true });
    router.replace('/setup-security');
  };

  const slide = slides[currentSlide];
  const isBrandSlide = slide.isBrandSlide;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.content, { paddingTop: insets.top + SPACING.md }]}>

        {/* ── Brand slide: full-screen logo + animated name only ────────── */}
        {isBrandSlide ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <BrandTitle colors={colors} />
          </View>
        ) : (
          <>
            <Image
              source={slide.image}
              style={styles.image}
              contentFit="contain"
              transition={300}
            />
            <View style={styles.textContent}>
              <Text style={[styles.title, { color: colors.text }]}>{slide.title}</Text>
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                {slide.description}
              </Text>
            </View>
          </>
        )}

        {!isBrandSlide ? null : <View style={{ flex: 1 }} />}
        <View style={styles.pagination}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor: index === currentSlide ? colors.primary : colors.border,
                  width: index === currentSlide ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        <View style={[styles.buttonsContainer, { paddingBottom: insets.bottom + SPACING.lg }]}>
          {currentSlide < slides.length - 1 && (
            <Button
              title="Skip"
              onPress={handleSkip}
              variant="ghost"
              style={styles.skipButton}
            />
          )}
          <Button
            title={currentSlide === slides.length - 1 ? 'Get Started' : 'Next'}
            onPress={handleNext}
            variant="primary"
            style={styles.nextButton}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  image: {
    width: width * 0.75,
    height: width * 0.85,
  },
  textContent: {
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
  },
  title: {
    fontSize: TYPOGRAPHY.sizes.xxl,
    fontWeight: TYPOGRAPHY.weights.bold,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  description: {
    fontSize: TYPOGRAPHY.sizes.md,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.sizes.md * TYPOGRAPHY.lineHeights.relaxed,
  },
  pagination: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  dot: {
    height: 8,
    borderRadius: RADIUS.sm,
  },
  buttonsContainer: {
    width: '100%',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  skipButton: {
    width: '100%',
  },
  nextButton: {
    width: '100%',
  },
});
