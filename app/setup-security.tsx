import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Pressable,
  Animated,
  Vibration,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { MaterialIcons } from '@expo/vector-icons';
import { Button } from '../components/ui/Button';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../constants/theme';
import { useSettings } from '../hooks/useSettings';
import { useAlert } from '@/template';

const PIN_LENGTH = 4;

type SetupStep = 'options' | 'set-pin' | 'confirm-pin';

export default function SetupSecurityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentTheme, updateSettings } = useSettings();
  const colors = COLORS[currentTheme];
  const { showAlert } = useAlert();

  const [enableLock, setEnableLock] = useState(true);
  const [useFingerprint, setUseFingerprint] = useState(true);
  const [usePin, setUsePin] = useState(true);
  const [hasBiometrics, setHasBiometrics] = useState(false);

  // PIN setup state
  const [step, setStep] = useState<SetupStep>('options');
  const [firstPin, setFirstPin] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [pinError, setPinError] = useState('');

  // Animations
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const dotScales = useRef(
    Array.from({ length: PIN_LENGTH }, () => new Animated.Value(1))
  ).current;

  React.useEffect(() => {
    checkBiometrics();
  }, []);

  const checkBiometrics = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setHasBiometrics(compatible && enrolled);
    if (!compatible || !enrolled) setUseFingerprint(false);
  };

  const triggerShake = () => {
    if (Platform.OS !== 'web') Vibration.vibrate(350);
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start();
  };

  const animateDotIn = (index: number) => {
    Animated.spring(dotScales[index], {
      toValue: 1.35,
      tension: 350,
      friction: 8,
      useNativeDriver: true,
    }).start(() => {
      Animated.spring(dotScales[index], {
        toValue: 1,
        tension: 250,
        friction: 8,
        useNativeDriver: true,
      }).start();
    });
  };

  const animateDotOut = (index: number) => {
    Animated.spring(dotScales[index], {
      toValue: 0.75,
      tension: 350,
      friction: 8,
      useNativeDriver: true,
    }).start(() => {
      Animated.spring(dotScales[index], {
        toValue: 1,
        tension: 250,
        friction: 8,
        useNativeDriver: true,
      }).start();
    });
  };

  // Reset dots animation
  const resetDotScales = () => {
    dotScales.forEach(s => s.setValue(1));
  };

  const handlePinDigit = (num: string) => {
    if (currentPin.length >= PIN_LENGTH) return;
    const newPin = currentPin + num;
    animateDotIn(currentPin.length);
    setCurrentPin(newPin);
    setPinError('');

    if (newPin.length === PIN_LENGTH) {
      setTimeout(() => handlePinComplete(newPin), 150);
    }
  };

  const handlePinDelete = () => {
    if (currentPin.length === 0) return;
    animateDotOut(currentPin.length - 1);
    setCurrentPin(p => p.slice(0, -1));
    setPinError('');
  };

  const handlePinComplete = (pin: string) => {
    if (step === 'set-pin') {
      setFirstPin(pin);
      setCurrentPin('');
      resetDotScales();
      setStep('confirm-pin');
    } else if (step === 'confirm-pin') {
      if (pin === firstPin) {
        // PINs match — save and proceed
        const lockType = useFingerprint && hasBiometrics ? 'both' : 'pin';
        updateSettings({ lockEnabled: true, lockType, pin });
        router.replace('/(tabs)');
      } else {
        triggerShake();
        setPinError('PINs do not match. Try again.');
        setCurrentPin('');
        resetDotScales();
        setStep('set-pin');
        setFirstPin('');
      }
    }
  };

  const handleContinue = () => {
    if (!enableLock) {
      updateSettings({ lockEnabled: false });
      router.replace('/(tabs)');
      return;
    }
    if (usePin) {
      setCurrentPin('');
      resetDotScales();
      setStep('set-pin');
    } else {
      // Only biometric
      updateSettings({ lockEnabled: true, lockType: 'fingerprint' });
      router.replace('/(tabs)');
    }
  };

  const handleSkip = () => {
    showAlert(
      'Skip Security Setup?',
      'You can enable it anytime in Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip',
          style: 'destructive',
          onPress: () => {
            updateSettings({ lockEnabled: false });
            router.replace('/(tabs)');
          },
        },
      ]
    );
  };

  const ROWS = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];

  // ── PIN Entry Screen ───────────────────────────────────────────────────────
  if (step === 'set-pin' || step === 'confirm-pin') {
    const isConfirm = step === 'confirm-pin';
    return (
      <View style={[styles.pinContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.pinInner, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 32 }]}>
          {/* Header */}
          <View style={styles.pinHeader}>
            <Pressable onPress={() => { setStep('options'); setCurrentPin(''); setFirstPin(''); }} hitSlop={8}>
              <MaterialIcons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
            <View style={[styles.pinIconRing, { borderColor: colors.primary + '40', backgroundColor: colors.primary + '12' }]}>
              <MaterialIcons name="dialpad" size={36} color={colors.primary} />
            </View>
            <Text style={[styles.pinTitle, { color: colors.text }]}>
              {isConfirm ? 'Confirm PIN' : 'Set Your PIN'}
            </Text>
            <Text style={[styles.pinSubtitle, { color: colors.textSecondary }]}>
              {isConfirm
                ? 'Enter your PIN again to confirm'
                : 'Choose a 4-digit PIN for app lock'}
            </Text>
          </View>

          {/* Dots */}
          <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => {
              const filled = i < currentPin.length;
              const hasError = !!pinError;
              return (
                <Animated.View key={i} style={{ transform: [{ scale: dotScales[i] }] }}>
                  <View
                    style={[
                      styles.dot,
                      filled
                        ? { backgroundColor: hasError ? colors.error : colors.primary, borderColor: hasError ? colors.error : colors.primary }
                        : { backgroundColor: 'transparent', borderColor: hasError ? colors.error + '70' : colors.border },
                    ]}
                  />
                </Animated.View>
              );
            })}
          </Animated.View>

          {pinError ? (
            <Text style={[styles.errorText, { color: colors.error }]}>{pinError}</Text>
          ) : (
            <Text style={[styles.hintText, { color: colors.textTertiary }]}>
              {PIN_LENGTH}-digit PIN
            </Text>
          )}

          {/* Keypad */}
          <View style={styles.keypad}>
            {ROWS.map((row, ri) => (
              <View key={ri} style={styles.keypadRow}>
                {row.map(n => (
                  <SetupKeyBtn
                    key={n}
                    label={String(n)}
                    onPress={() => handlePinDigit(String(n))}
                    colors={colors}
                  />
                ))}
              </View>
            ))}
            <View style={styles.keypadRow}>
              <View style={styles.emptyKey} />
              <SetupKeyBtn label="0" onPress={() => handlePinDigit('0')} colors={colors} />
              <SetupKeyBtn icon="backspace" onPress={handlePinDelete} colors={colors} isDelete />
            </View>
          </View>
        </View>
      </View>
    );
  }

  // ── Options Screen ─────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + SPACING.lg, paddingBottom: insets.bottom + SPACING.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
            <MaterialIcons name="security" size={48} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Secure Your App</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Protect your notes and reminders with biometric or PIN security
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.option}>
            <View style={styles.optionLeft}>
              <MaterialIcons name="lock" size={24} color={colors.primary} />
              <View style={styles.optionTextContent}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>Enable App Lock</Text>
                <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
                  Require authentication to open the app
                </Text>
              </View>
            </View>
            <Switch
              value={enableLock}
              onValueChange={setEnableLock}
              trackColor={{ false: colors.border, true: colors.primary + '80' }}
              thumbColor={enableLock ? colors.primary : colors.textTertiary}
            />
          </View>

          {enableLock && (
            <>
              {hasBiometrics && (
                <View style={[styles.option, styles.optionBorder, { borderTopColor: colors.border }]}>
                  <View style={styles.optionLeft}>
                    <MaterialIcons name="fingerprint" size={24} color={colors.secondary} />
                    <View style={styles.optionTextContent}>
                      <Text style={[styles.optionTitle, { color: colors.text }]}>Fingerprint / Face ID</Text>
                      <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
                        Use biometric authentication
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={useFingerprint}
                    onValueChange={setUseFingerprint}
                    trackColor={{ false: colors.border, true: colors.secondary + '80' }}
                    thumbColor={useFingerprint ? colors.secondary : colors.textTertiary}
                  />
                </View>
              )}

              <View style={[styles.option, styles.optionBorder, { borderTopColor: colors.border }]}>
                <View style={styles.optionLeft}>
                  <MaterialIcons name="dialpad" size={24} color={colors.info} />
                  <View style={styles.optionTextContent}>
                    <Text style={[styles.optionTitle, { color: colors.text }]}>PIN Code (4 digits)</Text>
                    <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
                      Set a custom in-app PIN code
                    </Text>
                  </View>
                </View>
                <Switch
                  value={usePin}
                  onValueChange={val => { if (!val && !useFingerprint) return; setUsePin(val); }}
                  trackColor={{ false: colors.border, true: colors.info + '80' }}
                  thumbColor={usePin ? colors.info : colors.textTertiary}
                />
              </View>

              {usePin && (
                <View style={[styles.pinNote, { backgroundColor: colors.info + '10', borderColor: colors.info + '30' }]}>
                  <MaterialIcons name="info-outline" size={16} color={colors.info} />
                  <Text style={[styles.pinNoteText, { color: colors.info }]}>
                    You will set a 4-digit PIN on the next screen. This PIN is unique to this app and is never your device PIN.
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        <View style={styles.buttonsContainer}>
          <Button title="Skip for Now" onPress={handleSkip} variant="ghost" />
          <Button
            title={usePin && enableLock ? 'Set PIN →' : 'Continue'}
            onPress={handleContinue}
            variant="primary"
            style={styles.continueButton}
          />
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Setup Keypad Button ──────────────────────────────────────────────────────

function SetupKeyBtn({
  label, icon, onPress, colors, isDelete,
}: {
  label?: string;
  icon?: string;
  onPress: () => void;
  colors: any;
  isDelete?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.spring(scale, { toValue: 0.87, tension: 400, friction: 10, useNativeDriver: true }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, tension: 250, friction: 8, useNativeDriver: true }).start();

  return (
    <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut} hitSlop={4}>
      <Animated.View style={[styles.keyBtn, { backgroundColor: colors.surface, borderColor: colors.border, transform: [{ scale }] }]}>
        {icon ? (
          <MaterialIcons name={icon as any} size={24} color={isDelete ? colors.textSecondary : colors.text} />
        ) : (
          <Text style={[styles.keyDigit, { color: colors.text }]}>{label}</Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: SPACING.lg },
  header: { alignItems: 'center', marginBottom: SPACING.xl },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: RADIUS.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  title: { fontSize: TYPOGRAPHY.sizes.xxxl, fontWeight: TYPOGRAPHY.weights.bold, marginBottom: SPACING.sm, textAlign: 'center' },
  subtitle: { fontSize: TYPOGRAPHY.sizes.md, textAlign: 'center', lineHeight: TYPOGRAPHY.sizes.md * 1.5 },
  card: { borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.xl },
  option: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.md },
  optionBorder: { borderTopWidth: 1 },
  optionLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  optionTextContent: { flex: 1 },
  optionTitle: { fontSize: TYPOGRAPHY.sizes.md, fontWeight: TYPOGRAPHY.weights.semibold, marginBottom: 2 },
  optionDescription: { fontSize: TYPOGRAPHY.sizes.sm },
  pinNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginTop: SPACING.sm,
  },
  pinNoteText: { flex: 1, fontSize: TYPOGRAPHY.sizes.xs, lineHeight: 18 },
  buttonsContainer: { gap: SPACING.md },
  continueButton: { width: '100%' },
  // PIN screen
  pinContainer: { flex: 1 },
  pinInner: { flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.xl },
  pinHeader: { alignItems: 'center', gap: SPACING.sm, width: '100%' },
  pinIconRing: { width: 76, height: 76, borderRadius: 38, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginTop: SPACING.lg, marginBottom: SPACING.xs },
  pinTitle: { fontSize: TYPOGRAPHY.sizes.xxl, fontWeight: TYPOGRAPHY.weights.bold, letterSpacing: -0.3 },
  pinSubtitle: { fontSize: TYPOGRAPHY.sizes.sm, textAlign: 'center', lineHeight: 20 },
  dotsRow: { flexDirection: 'row', gap: 22, justifyContent: 'center', alignItems: 'center' },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  errorText: { fontSize: TYPOGRAPHY.sizes.sm, fontWeight: TYPOGRAPHY.weights.semibold, textAlign: 'center' },
  hintText: { fontSize: TYPOGRAPHY.sizes.xs, textAlign: 'center', color: '#999' },
  keypad: { width: '100%', gap: 12, alignItems: 'center' },
  keypadRow: { flexDirection: 'row', gap: 20, justifyContent: 'center', alignItems: 'center' },
  keyBtn: {
    width: 76, height: 76, borderRadius: 38, justifyContent: 'center', alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 2,
  },
  emptyKey: { width: 76, height: 76 },
  keyDigit: { fontSize: 26, fontWeight: '400', includeFontPadding: false },
});
