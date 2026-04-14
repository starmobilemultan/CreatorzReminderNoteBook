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
    image: require('../assets/images/onboarding-1.png'),
    title: 'Smart Notes & Reminders',
    description: 'Organize your thoughts and never miss important tasks with our powerful 2-in-1 productivity app',
    isFirst: true,
  },
  {
    image: require('../assets/images/onboarding-2.png'),
    title: 'Intelligent Organization',
    description: 'Rich task details, categories, priorities, and seamless note-reminder linking for ultimate productivity',
    isFirst: false,
  },
  {
    image: require('../assets/images/onboarding-3.png'),
    title: 'Secure & Private',
    description: 'Your data stays on your device with biometric security and PIN protection',
    isFirst: false,
  },
];

// ── Animated brand title component ───────────────────────────────────────────
function BrandTitle({ colors }: { colors: any }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const subtitleFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Main title: fade + slide up
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Subtitle fade in after title
    Animated.sequence([
      Animated.delay(800),
      Animated.timing(subtitleFade, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulsing glow loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });

  return (
    <View style={brandStyles.wrap}>
      {/* Glow backdrop */}
      <Animated.View
        style={[brandStyles.glowBg, { opacity: glowOpacity }]}
      >
        <LinearGradient
          colors={['#6366F133', '#818CF866', '#6366F133']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={brandStyles.glowGradient}
        />
      </Animated.View>

      {/* App name */}
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ translateY }],
        }}
      >
        <LinearGradient
          colors={['#818CF8', '#6366F1', '#A855F7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={brandStyles.titleGradientWrap}
        >
          <Text style={brandStyles.appName}>Creatorz</Text>
        </LinearGradient>
        <Text style={[brandStyles.appSubName, { color: colors.text }]}>
          Reminder & Notes
        </Text>
      </Animated.View>

      {/* Tagline */}
      <Animated.Text style={[brandStyles.tagline, { color: colors.textSecondary, opacity: subtitleFade }]}>
        Your productivity, beautifully organized
      </Animated.Text>

      {/* Decorative line */}
      <Animated.View style={{ opacity: subtitleFade, alignItems: 'center' }}>
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
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
  },
  glowBg: {
    position: 'absolute',
    width: 280,
    height: 120,
    borderRadius: 60,
    top: 0,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  glowGradient: { flex: 1 },
  titleGradientWrap: {
    borderRadius: RADIUS.sm,
    paddingHorizontal: 4,
  },
  appName: {
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1.5,
    color: '#fff',
    textAlign: 'center',
  },
  appSubName: {
    fontSize: TYPOGRAPHY.sizes.xl,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginTop: 2,
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
    width: 160,
    borderRadius: 1,
    marginTop: SPACING.xs,
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
  const isFirstSlide = currentSlide === 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.content, { paddingTop: insets.top + SPACING.md }]}>

        {/* ── First slide: premium animated brand block ─────────────────── */}
        {isFirstSlide ? (
          <BrandTitle colors={colors} />
        ) : (
          <Image
            source={slide.image}
            style={styles.image}
            contentFit="contain"
            transition={300}
          />
        )}

        <View style={styles.textContent}>
          {isFirstSlide ? (
            <Image
              source={slide.image}
              style={styles.imageSmall}
              contentFit="contain"
              transition={300}
            />
          ) : null}
          <Text style={[styles.title, { color: colors.text }]}>{slide.title}</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {slide.description}
          </Text>
        </View>

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
  imageSmall: {
    width: width * 0.55,
    height: width * 0.55,
    marginBottom: SPACING.md,
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
