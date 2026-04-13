import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Vibration,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useSettings } from '../hooks/useSettings';

const PIN_LENGTH = 4;

export default function LockScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentTheme, settings, unlock } = useSettings();
  const colors = COLORS[currentTheme];

  const [enteredPin, setEnteredPin] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [hasBiometrics, setHasBiometrics] = useState(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const dotScales = useRef(
    Array.from({ length: PIN_LENGTH }, () => new Animated.Value(1))
  ).current;

  useEffect(() => {
    initAuth();
  }, []);

  const initAuth = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    const canUseBio =
      compatible &&
      enrolled &&
      (settings.lockType === 'fingerprint' || settings.lockType === 'both');
    setHasBiometrics(canUseBio);

    if (canUseBio) {
      setTimeout(() => authenticateWithBiometrics(), 400);
    }
  };

  const authenticateWithBiometrics = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Creatorz',
        fallbackLabel: 'Use PIN',
        cancelLabel: 'Cancel',
        disableDeviceFallback: true,
      });
      if (result.success) {
        handleUnlock();
      }
    } catch (err) {
      console.error('Biometric auth error:', err);
    }
  };

  const handleUnlock = () => {
    unlock();
    router.replace('/(tabs)');
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

  const handleNumberPress = (num: string) => {
    if (enteredPin.length >= PIN_LENGTH) return;
    const newPin = enteredPin + num;
    animateDotIn(enteredPin.length);
    setEnteredPin(newPin);
    setError('');

    if (newPin.length === PIN_LENGTH) {
      setTimeout(() => verifyPin(newPin), 150);
    }
  };

  const verifyPin = (pin: string) => {
    const storedPin = settings.pin || '';
    if (pin === storedPin) {
      handleUnlock();
    } else {
      const next = attempts + 1;
      setAttempts(next);
      triggerShake();
      setError(
        next >= 5
          ? 'Too many attempts. Try again.'
          : `Incorrect PIN (${next} of 5 attempts)`
      );
      setEnteredPin('');
    }
  };

  const handleDelete = () => {
    if (enteredPin.length === 0) return;
    animateDotOut(enteredPin.length - 1);
    setEnteredPin(prev => prev.slice(0, -1));
    setError('');
  };

  const ROWS = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.inner,
          { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 32 },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View
            style={[
              styles.iconRing,
              { borderColor: colors.primary + '40', backgroundColor: colors.primary + '12' },
            ]}
          >
            <MaterialIcons name="lock" size={38} color={colors.primary} />
          </View>
          <Text style={[styles.appName, { color: colors.text }]}>Creatorz</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {hasBiometrics
              ? 'Use fingerprint or enter your PIN'
              : 'Enter your PIN to continue'}
          </Text>
        </View>

        {/* PIN Indicator Dots */}
        <Animated.View
          style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}
        >
          {Array.from({ length: PIN_LENGTH }).map((_, i) => {
            const filled = i < enteredPin.length;
            const hasError = !!error;
            return (
              <Animated.View key={i} style={{ transform: [{ scale: dotScales[i] }] }}>
                <View
                  style={[
                    styles.dot,
                    filled
                      ? {
                          backgroundColor: hasError ? colors.error : colors.primary,
                          borderColor: hasError ? colors.error : colors.primary,
                        }
                      : {
                          backgroundColor: 'transparent',
                          borderColor: hasError ? colors.error + '70' : colors.border,
                        },
                  ]}
                />
              </Animated.View>
            );
          })}
        </Animated.View>

        {/* Status text */}
        {error ? (
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        ) : (
          <Text style={[styles.hintText, { color: colors.textTertiary }]}>
            Enter {PIN_LENGTH}-digit PIN
          </Text>
        )}

        {/* Keypad */}
        <View style={styles.keypad}>
          {ROWS.map((row, ri) => (
            <View key={ri} style={styles.keypadRow}>
              {row.map(n => (
                <KeypadKey
                  key={n}
                  label={String(n)}
                  onPress={() => handleNumberPress(String(n))}
                  colors={colors}
                />
              ))}
            </View>
          ))}

          {/* Bottom row */}
          <View style={styles.keypadRow}>
            {hasBiometrics ? (
              <KeypadKey
                icon="fingerprint"
                onPress={authenticateWithBiometrics}
                colors={colors}
                isAccent
              />
            ) : (
              <View style={styles.emptyKey} />
            )}
            <KeypadKey
              label="0"
              onPress={() => handleNumberPress('0')}
              colors={colors}
            />
            <KeypadKey
              icon="backspace"
              onPress={handleDelete}
              colors={colors}
              isDelete
            />
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Keypad Key ───────────────────────────────────────────────────────────────

interface KeypadKeyProps {
  label?: string;
  icon?: string;
  onPress: () => void;
  colors: any;
  isAccent?: boolean;
  isDelete?: boolean;
}

function KeypadKey({ label, icon, onPress, colors, isAccent, isDelete }: KeypadKeyProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.spring(scale, { toValue: 0.87, tension: 400, friction: 10, useNativeDriver: true }).start();
  };

  const pressOut = () => {
    Animated.spring(scale, { toValue: 1, tension: 250, friction: 8, useNativeDriver: true }).start();
  };

  const bg = icon
    ? isAccent
      ? colors.primary + '18'
      : (colors.surfaceSecondary || colors.surface)
    : colors.surface;

  const iconColor = isAccent
    ? colors.primary
    : isDelete
    ? colors.textSecondary
    : colors.text;

  return (
    <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut} hitSlop={4}>
      <Animated.View
        style={[
          styles.keyBtn,
          {
            backgroundColor: bg,
            borderColor: colors.border,
            transform: [{ scale }],
          },
        ]}
      >
        {icon ? (
          <MaterialIcons name={icon as any} size={isDelete ? 24 : 32} color={iconColor} />
        ) : (
          <Text style={[styles.keyDigit, { color: colors.text }]}>{label}</Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
  },
  header: { alignItems: 'center', gap: SPACING.sm },
  iconRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  appName: {
    fontSize: TYPOGRAPHY.sizes.xxxl,
    fontWeight: TYPOGRAPHY.weights.bold,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.sizes.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  errorText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.semibold,
    textAlign: 'center',
  },
  hintText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    textAlign: 'center',
  },
  keypad: {
    width: '100%',
    gap: 12,
    alignItems: 'center',
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyKey: {
    width: 76,
    height: 76,
  },
  keyDigit: {
    fontSize: 26,
    fontWeight: '400',
    includeFontPadding: false,
  },
});
