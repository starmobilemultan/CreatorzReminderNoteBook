import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  ScrollView,
  Share,
  Platform,
  Dimensions,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../constants/theme';
import { useSettings } from '../hooks/useSettings';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PROFILE_IMAGE = require('../assets/images/moiz-profile.jpg');

// ─── Types ────────────────────────────────────────────────────────────────────
interface PaymentMethod {
  id: string;
  logoSource: any;
  title: string;
  subtitle: string;
  bankName?: string;        // shown on front face below subtitle
  detail: string;
  detailLabel: string;
  accountName?: string;
  gradientColors: [string, string, string];
  accentColor: string;
  logoStyle?: 'contain' | 'cover';
}

const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 'easypaisa',
    logoSource: require('../assets/images/easypaisa-logo.png'),
    title: 'Easypaisa',
    subtitle: 'Mobile Wallet',
    bankName: 'Bank Transfer: EasyPaisa Bank Limited',
    detail: '03481040494',
    detailLabel: 'Account Number',
    accountName: 'Abdul Moiz Qureshi',
    gradientColors: ['#00A651', '#007A3D', '#005C2E'],
    accentColor: '#00C96B',
    logoStyle: 'contain',
  },
  {
    id: 'paypal',
    logoSource: require('../assets/images/paypal-logo.png'),
    title: 'PayPal',
    subtitle: 'International Transfer',
    detail: 'ansari.ayub7590@gmail.com',
    detailLabel: 'PayPal Email',
    gradientColors: ['#003087', '#0070BA', '#009CDE'],
    accentColor: '#00C2FF',
    logoStyle: 'contain',
  },
  {
    id: 'binance',
    logoSource: require('../assets/images/binance-logo.png'),
    title: 'Binance USDT',
    subtitle: 'Crypto Transfer',
    detail: 'moizqureshiii36@gmail.com',
    detailLabel: 'Binance ID',
    gradientColors: ['#181A1E', '#2B2F36', '#F0B90B'],
    accentColor: '#F0B90B',
    logoStyle: 'contain',
  },
];

// ─── Confetti Particle ────────────────────────────────────────────────────────
function ConfettiParticle({ delay, color }: { delay: number; color: string }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const angle = (Math.random() * Math.PI * 2);
    const distance = 60 + Math.random() * 120;
    const tx = Math.cos(angle) * distance;
    const ty = -(50 + Math.random() * 180);

    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: tx, duration: 800, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: ty, duration: 800, useNativeDriver: true }),
        Animated.timing(rotate, { toValue: 6, duration: 800, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(400),
          Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
      ]),
    ]).start();
  }, []);

  const spin = rotate.interpolate({ inputRange: [0, 6], outputRange: ['0deg', '720deg'] });
  const size = 6 + Math.random() * 8;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: Math.random() > 0.5 ? size / 2 : 2,
        backgroundColor: color,
        transform: [{ translateX }, { translateY }, { rotate: spin }, { scale }],
        opacity,
      }}
    />
  );
}

// ─── Confetti Burst ───────────────────────────────────────────────────────────
const CONFETTI_COLORS = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#A855F7', '#EF4444', '#FFFFFF'];

function ConfettiBurst({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: '40%', left: '50%', zIndex: 999 }}
    >
      {Array.from({ length: 32 }).map((_, i) => (
        <ConfettiParticle
          key={i}
          delay={Math.random() * 200}
          color={CONFETTI_COLORS[i % CONFETTI_COLORS.length]}
        />
      ))}
    </View>
  );
}

// ─── Animated Coffee Cup ──────────────────────────────────────────────────────
function CoffeeCup({ size = 80 }: { size?: number }) {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const steamAnim1 = useRef(new Animated.Value(0)).current;
  const steamAnim2 = useRef(new Animated.Value(0)).current;
  const steamAnim3 = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -10, duration: 1600, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(steamAnim1, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(steamAnim1, { toValue: 0, duration: 400, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.delay(300),
        Animated.timing(steamAnim2, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(steamAnim2, { toValue: 0, duration: 400, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(steamAnim3, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(steamAnim3, { toValue: 0, duration: 400, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.6, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const steam1Y = steamAnim1.interpolate({ inputRange: [0, 1], outputRange: [0, -22] });
  const steam1Opacity = steamAnim1.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.9, 0] });
  const steam2Y = steamAnim2.interpolate({ inputRange: [0, 1], outputRange: [0, -22] });
  const steam2Opacity = steamAnim2.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.9, 0] });
  const steam3Y = steamAnim3.interpolate({ inputRange: [0, 1], outputRange: [0, -22] });
  const steam3Opacity = steamAnim3.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.9, 0] });

  return (
    <Animated.View style={[coffeeStyles.wrap, { transform: [{ translateY: floatAnim }] }]}>
      <Animated.View style={[coffeeStyles.glow, { opacity: glowAnim, width: size * 1.8, height: size * 1.8, borderRadius: size * 0.9 }]} />
      <View style={[coffeeStyles.steamRow, { bottom: size * 0.9 }]}>
        <Animated.View style={[coffeeStyles.steamLine, { transform: [{ translateY: steam1Y }], opacity: steam1Opacity }]} />
        <Animated.View style={[coffeeStyles.steamLine, { transform: [{ translateY: steam2Y }], opacity: steam2Opacity, marginHorizontal: 8 }]} />
        <Animated.View style={[coffeeStyles.steamLine, { transform: [{ translateY: steam3Y }], opacity: steam3Opacity }]} />
      </View>
      <Text style={{ fontSize: size * 0.78, textAlign: 'center' }}>☕</Text>
    </Animated.View>
  );
}

const coffeeStyles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', backgroundColor: '#6366F130' },
  steamRow: { position: 'absolute', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' },
  steamLine: { width: 3, height: 18, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 2 },
});

// ─── Fixed card height ────────────────────────────────────────────────────────
const CARD_HEIGHT = 178;

// ─── Payment Card with Flip Animation ────────────────────────────────────────
// FRONT: shows method name, logo, subtitle, bankName (for easypaisa), flip hint
//        NO credentials shown — only flip to see details
// BACK:  shows credential label, value, account name, copy & share buttons
function PaymentCard({
  method,
  isFlipped,
  onSelect,
  onCopy,
  onShare,
  colors,
  copiedId,
}: {
  method: PaymentMethod;
  isFlipped: boolean;
  onSelect: () => void;
  onCopy: (detail: string, id: string) => void;
  onShare: (method: PaymentMethod) => void;
  colors: any;
  copiedId: string | null;
}) {
  const flipAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(flipAnim, {
      toValue: isFlipped ? 1 : 0,
      tension: 100,
      friction: 12,
      useNativeDriver: true,
    }).start();
  }, [isFlipped]);

  // Front: 0→90deg hidden at midpoint
  const frontRotate = flipAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '90deg', '90deg'] });
  // Back: starts hidden at -90deg, visible after midpoint
  const backRotate = flipAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-90deg', '-90deg', '0deg'] });
  // Hard visibility cut at midpoint
  const frontOpacity = flipAnim.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [1, 1, 0, 0] });
  const backOpacity = flipAnim.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [0, 0, 1, 1] });
  const isCopied = copiedId === method.id;


  return (
    <View style={cardStyles.wrapper}>
      <View
        style={[
          cardStyles.shell,
          isFlipped && { borderColor: method.accentColor, borderWidth: 2 },
        ]}
      >
        {/* ════ FRONT FACE — Identity only, NO credentials ════ */}
        <Animated.View
          style={[
            cardStyles.face,
            { transform: [{ perspective: 1000 }, { rotateY: frontRotate }], opacity: frontOpacity },
          ]}
        >
          <Pressable onPress={onSelect} style={{ flex: 1 }}>
            <LinearGradient
              colors={method.gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={cardStyles.faceInner}
            >
              {/* Top row: flip hint only */}
              <View style={cardStyles.frontTopRow}>
                <View style={[cardStyles.flipHintBadge, { backgroundColor: 'rgba(255,255,255,0.12)', marginLeft: 'auto' }]}>
                  <MaterialIcons name="flip" size={13} color="rgba(255,255,255,0.7)" />
                  <Text style={cardStyles.flipHintText}>Tap to Flip</Text>
                </View>
              </View>

              {/* CENTER: large logo + big method name — main focus area */}
              <View style={cardStyles.frontCenter}>
                <View style={cardStyles.logoBubbleLarge}>
                  <Image
                    source={method.logoSource}
                    style={cardStyles.logoImageLarge}
                    contentFit={method.logoStyle ?? 'contain'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={cardStyles.methodTitleLarge}>{method.title}</Text>
                  <Text style={cardStyles.methodSubtitleLarge}>{method.subtitle}</Text>
                  {method.bankName ? (
                    <Text style={cardStyles.bankNameText} numberOfLines={2}>
                      {method.bankName}
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* Divider */}
              <View style={cardStyles.dividerLine} />

              {/* Bottom CTA */}
              <View style={cardStyles.frontRevealRow}>
                <MaterialIcons name="lock" size={15} color="rgba(255,255,255,0.55)" />
                <Text style={cardStyles.revealText}>
                  Flip to reveal payment details
                </Text>
                <MaterialIcons name="chevron-right" size={18} color="rgba(255,255,255,0.5)" />
              </View>
            </LinearGradient>
          </Pressable>
        </Animated.View>

        {/* ════ BACK FACE — Full credentials ════ */}
        <Animated.View
          style={[
            cardStyles.face,
            cardStyles.backFaceAbsolute,
            { transform: [{ perspective: 1000 }, { rotateY: backRotate }], opacity: backOpacity },
          ]}
        >
          <Pressable onPress={onSelect} style={{ flex: 1 }}>
            <LinearGradient
              colors={[method.gradientColors[2], method.gradientColors[1], method.gradientColors[0]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={cardStyles.faceInner}
            >
              {/* Back header with logo */}
              <View style={cardStyles.backTopRow}>
                <View style={cardStyles.logoBubbleSmall}>
                  <Image
                    source={method.logoSource}
                    style={cardStyles.logoImageSmall}
                    contentFit={method.logoStyle ?? 'contain'}
                  />
                </View>
                <Text style={cardStyles.backTitle}>{method.title}</Text>
                <View style={[cardStyles.flipHintBadge, { backgroundColor: 'rgba(255,255,255,0.12)', marginLeft: 'auto' }]}>
                  <MaterialIcons name="flip" size={13} color="rgba(255,255,255,0.7)" />
                  <Text style={cardStyles.flipHintText}>Back</Text>
                </View>
              </View>

              {/* Detail box — credentials revealed after flip */}
              <View style={cardStyles.detailBox}>
                <Text style={cardStyles.detailLabel}>{method.detailLabel}</Text>
                <Text style={cardStyles.detailValue} selectable numberOfLines={1}>{method.detail}</Text>
                {method.accountName ? (
                  <View style={cardStyles.accountRow}>
                    <MaterialIcons name="person" size={12} color="rgba(255,255,255,0.65)" />
                    <Text style={cardStyles.accountText} numberOfLines={1}>{method.accountName}</Text>
                  </View>
                ) : null}
              </View>

              {/* Action buttons */}
              <View style={cardStyles.backActions}>
                <Pressable
                  onPress={() => onCopy(method.detail, method.id)}
                  style={({ pressed }) => [
                    cardStyles.actionBtn,
                    cardStyles.actionBtnPrimary,
                    { backgroundColor: isCopied ? '#10B981' : 'rgba(255,255,255,0.2)', opacity: pressed ? 0.75 : 1 },
                  ]}
                >
                  <MaterialIcons name={isCopied ? 'check' : 'content-copy'} size={14} color="#fff" />
                  <Text style={cardStyles.actionBtnText}>{isCopied ? 'Copied! ✅' : 'Copy'}</Text>
                </Pressable>
                <Pressable
                  onPress={() => onShare(method)}
                  style={({ pressed }) => [
                    cardStyles.actionBtn,
                    { borderColor: 'rgba(255,255,255,0.3)', borderWidth: 1, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <MaterialIcons name="share" size={14} color="rgba(255,255,255,0.85)" />
                  <Text style={[cardStyles.actionBtnText, { color: 'rgba(255,255,255,0.85)' }]}>Share</Text>
                </Pressable>
              </View>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  wrapper: {
    marginBottom: SPACING.md,
  },
  shell: {
    height: CARD_HEIGHT,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 8,
  },
  face: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  backFaceAbsolute: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  faceInner: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    justifyContent: 'space-between',
  },
  // Front
  frontTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  // Compact hero row on front face
  frontCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  logoBubbleLarge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  logoImageLarge: {
    width: 58,
    height: 58,
  },
  methodTitleLarge: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
    lineHeight: 26,
  },
  methodSubtitleLarge: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: 'rgba(255,255,255,0.78)',
    marginTop: 3,
    fontWeight: '600',
  },
  bankNameText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.78)',
    marginTop: 3,
    fontWeight: '600',
    lineHeight: 15,
  },
  flipHintBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    flexShrink: 0,
  },
  flipHintText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  dividerLine: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  // Front bottom CTA
  frontRevealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  revealText: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontStyle: 'italic',
    fontWeight: '500',
  },
  // Back
  backTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  logoBubbleSmall: {
    width: 42,
    height: 42,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  logoImageSmall: {
    width: 36,
    height: 36,
  },
  backTitle: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  detailBox: {
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    gap: 3,
  },
  detailLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    paddingTop: 3,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  accountText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
    flex: 1,
  },
  backActions: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
    minHeight: 32,
  },
  actionBtnPrimary: {},
  actionBtnText: {
    color: '#fff',
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: '700',
  },
});

// ─── Toast Message ────────────────────────────────────────────────────────────
function Toast({ message, visible }: { message: string; visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(opacity, { toValue: 1, tension: 200, friction: 12, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, tension: 200, friction: 12, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 20, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[toastStyles.container, { opacity, transform: [{ translateY }] }]}
    >
      <MaterialIcons name="check-circle" size={18} color="#10B981" />
      <Text style={toastStyles.text}>{message}</Text>
    </Animated.View>
  );
}

const toastStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: 'rgba(15,23,42,0.92)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 1000,
  },
  text: { color: '#fff', fontSize: TYPOGRAPHY.sizes.sm, fontWeight: '600' },
});

// ─── Thank You Screen ─────────────────────────────────────────────────────────
function ThankYouOverlay({ visible, onClose, colors }: { visible: boolean; onClose: () => void; colors: any }) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const heartBeat = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, tension: 120, friction: 8, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(heartBeat, { toValue: 1.3, duration: 400, useNativeDriver: true }),
          Animated.timing(heartBeat, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.delay(600),
        ])
      ).start();
    } else {
      scale.setValue(0);
      opacity.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[tyStyles.overlay, { opacity }]}>
      <Animated.View style={[tyStyles.card, { transform: [{ scale }], backgroundColor: colors.surface }]}>
        <LinearGradient
          colors={['#6366F1', '#A855F7', '#EC4899']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={tyStyles.gradientBar}
        />
        <Animated.Text style={[tyStyles.heartEmoji, { transform: [{ scale: heartBeat }] }]}>💝</Animated.Text>
        <Text style={[tyStyles.title, { color: colors.text }]}>Thank You!</Text>
        <Text style={[tyStyles.subtitle, { color: colors.textSecondary }]}>
          Your support means the world.{'\n'}Every coffee helps create more amazing content! ✨
        </Text>
        <Text style={[tyStyles.footer, { color: colors.textTertiary }]}>— Moiz Creator</Text>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [tyStyles.closeBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
        >
          <Text style={tyStyles.closeBtnText}>Back to Support</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const tyStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    paddingHorizontal: SPACING.xl,
  },
  card: {
    borderRadius: RADIUS.xl + 4,
    overflow: 'hidden',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xl,
    width: '100%',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
  },
  gradientBar: { height: 5, width: '120%', marginBottom: SPACING.xl },
  heartEmoji: { fontSize: 64, marginBottom: SPACING.md },
  title: { fontSize: TYPOGRAPHY.sizes.xxxl, fontWeight: '800', letterSpacing: -1, marginBottom: SPACING.md },
  subtitle: { fontSize: TYPOGRAPHY.sizes.md, textAlign: 'center', lineHeight: 24, marginBottom: SPACING.sm },
  footer: { fontSize: TYPOGRAPHY.sizes.sm, fontStyle: 'italic', marginBottom: SPACING.xl },
  closeBtn: { paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.lg, width: '100%', alignItems: 'center' },
  closeBtnText: { color: '#fff', fontSize: TYPOGRAPHY.sizes.md, fontWeight: '700' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SupportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentTheme } = useSettings();
  const colors = COLORS[currentTheme];

  const [flippedId, setFlippedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showThankYou, setShowThankYou] = useState(false);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confettiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const headerSlide = useRef(new Animated.Value(-30)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(headerSlide, { toValue: 0, tension: 100, friction: 12, useNativeDriver: true }),
      Animated.timing(headerOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (confettiTimerRef.current) clearTimeout(confettiTimerRef.current);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const handleSelectCard = useCallback((id: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    setFlippedId(prev => (prev === id ? null : id));
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 2500);
  }, []);

  const handleCopy = useCallback(async (detail: string, id: string) => {
    try {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      await Clipboard.setStringAsync(detail);
      setCopiedId(id);
      setShowConfetti(true);
      showToast('Copied! ✅');
      if (confettiTimerRef.current) clearTimeout(confettiTimerRef.current);
      confettiTimerRef.current = setTimeout(() => setShowConfetti(false), 1200);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopiedId(null), 3000);
    } catch {
      showToast('Copy failed — please copy manually');
    }
  }, [showToast]);

  const handleShare = useCallback(async (method: PaymentMethod) => {
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      await Share.share({
        message: `Support Moiz Creator via ${method.title}\n${method.detailLabel}: ${method.detail}${method.accountName ? `\nAccount: ${method.accountName}` : ''}${method.bankName ? `\n${method.bankName}` : ''}\n\n☕ Buy Me a Coffee — powered by Moiz Creator`,
        title: `Support via ${method.title}`,
      });
    } catch {}
  }, []);

  const handleWhatsApp = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    Linking.openURL('https://wa.me/923190667148').catch(() => {
      showToast('WhatsApp not available');
    });
  }, [showToast]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Gradient header bg ─────────────────────────────────────────── */}
      <LinearGradient
        colors={['#4338CA', '#6366F1', '#8B5CF6', '#A855F7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerBg, { paddingTop: insets.top }]}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
          hitSlop={12}
        >
          <MaterialIcons name="arrow-back" size={22} color="#fff" />
        </Pressable>

        <Animated.View
          style={[styles.headerContent, { transform: [{ translateY: headerSlide }], opacity: headerOpacity }]}
        >
          <CoffeeCup size={82} />
          <View style={{ alignItems: 'center', marginTop: SPACING.sm }}>
            <Text style={styles.headerTitle}>Buy Me a Coffee</Text>
            <Text style={styles.headerSub}>Support Moiz Creator ✨</Text>
          </View>
        </Animated.View>

        <View style={styles.headerWave} />
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
      >
        {/* ── Profile Card ──────────────────────────────────────────────── */}
        <View style={[styles.profileCard, { backgroundColor: colors.surface }]}>
          <View style={styles.profileAvatarRow}>
            <View style={styles.avatarImageWrap}>
              <Image
                source={PROFILE_IMAGE}
                style={styles.avatarImage}
                contentFit="cover"
                transition={200}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.profileName, { color: colors.text }]}>Moiz Qureshi</Text>
              <Text style={[styles.profileCreatorBadge, { color: colors.primary }]}>Moiz Creator · The Canva Expert</Text>
              <Text style={[styles.profileProfession, { color: colors.textSecondary }]}>
                Professional Graphics Designer
              </Text>
            </View>
          </View>

          {/* Services */}
          <View style={[styles.servicesWrap, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={[styles.servicesLabel, { color: colors.textTertiary }]}>SERVICES</Text>
            <View style={styles.servicesList}>
              {[
                { icon: 'star', text: 'Canva Pro Subscriptions' },
                { icon: 'brush', text: 'Graphics Designing' },
                { icon: 'description', text: 'Document Engineering' },
              ].map((s, i) => (
                <View key={i} style={styles.serviceItem}>
                  <MaterialIcons name={s.icon as any} size={15} color={colors.primary} />
                  <Text style={[styles.serviceText, { color: colors.text }]}>{s.text}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* WhatsApp */}
          <Pressable
            onPress={handleWhatsApp}
            style={({ pressed }) => [
              styles.whatsappRow,
              { backgroundColor: '#25D36615', borderColor: '#25D36630', opacity: pressed ? 0.78 : 1 },
            ]}
          >
            <View style={[styles.whatsappIconWrap, { backgroundColor: '#25D366' }]}>
              <MaterialIcons name="chat" size={16} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.whatsappLabel, { color: colors.textTertiary }]}>WHATSAPP · Tap to Chat</Text>
              <Text style={[styles.whatsappNumber, { color: colors.text }]}>+92 319 0667148</Text>
            </View>
            <Pressable
              onPress={async () => {
                await Clipboard.setStringAsync('+923190667148');
                showToast('Number Copied! ✅');
              }}
              hitSlop={8}
              style={({ pressed }) => [
                styles.whatsappCopyBtn,
                { backgroundColor: colors.surfaceSecondary, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <MaterialIcons name="content-copy" size={14} color={colors.textSecondary} />
            </Pressable>
            <View style={styles.whatsappOpenBtn}>
              <MaterialIcons name="open-in-new" size={16} color="#25D366" />
            </View>
          </Pressable>

          {/* Tagline */}
          <View style={[styles.taglineWrap, { borderLeftColor: colors.primary }]}>
            <Text style={[styles.taglineText, { color: colors.textSecondary }]}>
              "Through Graphic Designing and Document Engineering, bringing ideas to life ✨"
            </Text>
          </View>
        </View>

        {/* ── Section header ────────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionLine, { backgroundColor: colors.primary }]} />
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            CHOOSE PAYMENT METHOD
          </Text>
          <View style={[styles.sectionLine, { backgroundColor: colors.primary }]} />
        </View>

        <Text style={[styles.sectionHint, { color: colors.textTertiary }]}>
          Tap card to flip · Payment details revealed after flip
        </Text>

        {/* ── Payment Cards ─────────────────────────────────────────────── */}
        <View style={styles.cardsWrap}>
          {PAYMENT_METHODS.map(method => (
            <PaymentCard
              key={method.id}
              method={method}
              isFlipped={flippedId === method.id}
              onSelect={() => handleSelectCard(method.id)}
              onCopy={handleCopy}
              onShare={handleShare}
              colors={colors}
              copiedId={copiedId}
            />
          ))}
        </View>

        {/* ── Thank You Button ──────────────────────────────────────────── */}
        <Pressable
          onPress={() => {
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            }
            setShowThankYou(true);
          }}
          style={({ pressed }) => [styles.thankYouBtn, { opacity: pressed ? 0.85 : 1 }]}
        >
          <LinearGradient
            colors={['#6366F1', '#A855F7', '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.thankYouBtnGradient}
          >
            <Text style={{ fontSize: 20 }}>💝</Text>
            <Text style={styles.thankYouBtnText}>I've Sent Support!</Text>
          </LinearGradient>
        </Pressable>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <View style={styles.footer}>
          <LinearGradient
            colors={['transparent', colors.primary + '30', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.footerLine}
          />
          <Text style={[styles.footerText, { color: colors.textTertiary }]}>
            Powered by Moiz Creator
          </Text>
          <LinearGradient
            colors={['transparent', colors.primary + '30', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.footerLine}
          />
        </View>
      </ScrollView>

      {/* ── Overlays ─────────────────────────────────────────────────────── */}
      <ConfettiBurst active={showConfetti} />
      <Toast message={toastMessage} visible={toastVisible} />
      <ThankYouOverlay
        visible={showThankYou}
        onClose={() => setShowThankYou(false)}
        colors={colors}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBg: { paddingBottom: 36, alignItems: 'center' },
  backBtn: {
    position: 'absolute',
    top: 52,
    left: SPACING.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  headerContent: { alignItems: 'center', paddingTop: SPACING.md, gap: SPACING.sm },
  headerTitle: {
    fontSize: TYPOGRAPHY.sizes.xxl + 4,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  headerSub: { fontSize: TYPOGRAPHY.sizes.md, color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginTop: 4 },
  headerWave: { position: 'absolute', bottom: -1, left: 0, right: 0, height: 32, backgroundColor: 'transparent' },
  scrollContent: { paddingHorizontal: SPACING.md, paddingTop: SPACING.lg, gap: SPACING.md },
  profileCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    gap: SPACING.md,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  profileAvatarRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  avatarImageWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    overflow: 'hidden',
    flexShrink: 0,
    borderWidth: 2.5,
    borderColor: '#6366F1',
  },
  avatarImage: { width: '100%', height: '100%' },
  profileName: { fontSize: TYPOGRAPHY.sizes.lg, fontWeight: '800', letterSpacing: -0.3 },
  profileCreatorBadge: { fontSize: TYPOGRAPHY.sizes.xs, fontWeight: '700', marginTop: 1, letterSpacing: 0.2 },
  profileProfession: { fontSize: TYPOGRAPHY.sizes.xs, marginTop: 2 },
  servicesWrap: { borderRadius: RADIUS.md, padding: SPACING.md, gap: SPACING.sm },
  servicesLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  servicesList: { gap: 8 },
  serviceItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  serviceText: { fontSize: TYPOGRAPHY.sizes.sm, fontWeight: '500' },
  whatsappRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
  },
  whatsappIconWrap: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  whatsappLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  whatsappNumber: { fontSize: TYPOGRAPHY.sizes.sm, fontWeight: '600', marginTop: 1 },
  whatsappCopyBtn: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  whatsappOpenBtn: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  taglineWrap: { borderLeftWidth: 3, paddingLeft: SPACING.md },
  taglineText: { fontSize: TYPOGRAPHY.sizes.sm, fontStyle: 'italic', lineHeight: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm },
  sectionLine: { flex: 1, height: 1, opacity: 0.35 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  sectionHint: { fontSize: TYPOGRAPHY.sizes.xs, textAlign: 'center', marginTop: -SPACING.xs },
  cardsWrap: { gap: 0 },
  thankYouBtn: {
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    marginTop: SPACING.sm,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  thankYouBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md + 2,
  },
  thankYouBtnText: { color: '#fff', fontSize: TYPOGRAPHY.sizes.lg, fontWeight: '800', letterSpacing: -0.3 },
  footer: { alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.md, paddingBottom: SPACING.sm },
  footerLine: { height: 1, width: '80%' },
  footerText: { fontSize: TYPOGRAPHY.sizes.xs, fontStyle: 'italic', letterSpacing: 0.3 },
});
