import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, NOTE_COLORS, SHADOWS } from '../../constants/theme';
import { useSettings } from '../../hooks/useSettings';

interface QuickAction {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  color?: string;
  onPress: () => void;
  danger?: boolean;
}

interface NoteQuickActionsProps {
  visible: boolean;
  onClose: () => void;
  actions: QuickAction[];
  noteColor?: string;
  onColorChange?: (color: string) => void;
  showColorPicker?: boolean;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function NoteQuickActions({
  visible,
  onClose,
  actions,
  noteColor,
  onColorChange,
  showColorPicker = false,
}: NoteQuickActionsProps) {
  const { currentTheme } = useSettings();
  const colors = COLORS[currentTheme];
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 80,
          friction: 12,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={handleClose}>
      <View style={styles.modalContainer}>
        <Animated.View
          style={[styles.backdrop, { opacity: backdropAnim }]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              transform: [{ translateY: slideAnim }],
            },
            SHADOWS.large,
          ]}
        >
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Color Picker */}
          {showColorPicker && onColorChange && (
            <View style={styles.colorSection}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                Note Color
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.colorRow}
              >
                {NOTE_COLORS.map(c => {
                  const colorKey =
                    c.id === 'default'
                      ? 'surface'
                      : (`note${c.id.charAt(0).toUpperCase()}${c.id.slice(1)}` as keyof typeof colors);
                  const bgColor = (colors as any)[colorKey] || colors.surface;
                  const isSelected = noteColor === c.id;

                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => onColorChange(c.id)}
                      style={({ pressed }) => [
                        styles.colorDot,
                        { backgroundColor: bgColor, borderColor: isSelected ? colors.primary : colors.border },
                        isSelected && styles.colorDotSelected,
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      {isSelected && (
                        <MaterialIcons name="check" size={16} color={colors.primary} />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {showColorPicker && (
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          )}

          {/* Actions */}
          <View style={styles.actionsGrid}>
            {actions.map((action, index) => (
              <Pressable
                key={index}
                onPress={() => {
                  handleClose();
                  setTimeout(action.onPress, 100);
                }}
                style={({ pressed }) => [
                  styles.actionItem,
                  { backgroundColor: colors.surfaceSecondary },
                  pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
                ]}
              >
                <MaterialIcons
                  name={action.icon}
                  size={24}
                  color={action.danger ? colors.error : action.color || colors.primary}
                />
                <Text
                  style={[
                    styles.actionLabel,
                    { color: action.danger ? colors.error : colors.text },
                  ]}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Cancel */}
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [
              styles.cancelButton,
              { backgroundColor: colors.surfaceSecondary },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  colorSection: {
    marginBottom: SPACING.md,
  },
  sectionLabel: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.semibold,
    marginBottom: SPACING.sm,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  colorRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  colorDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorDotSelected: {
    borderWidth: 2.5,
    transform: [{ scale: 1.1 }],
  },
  divider: {
    height: 1,
    marginBottom: SPACING.md,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  actionItem: {
    flex: 1,
    minWidth: '22%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    gap: SPACING.xs,
  },
  actionLabel: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.medium,
    textAlign: 'center',
  },
  cancelButton: {
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
});
