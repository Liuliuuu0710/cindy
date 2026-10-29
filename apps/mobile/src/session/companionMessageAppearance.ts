import { StyleSheet } from 'react-native';
import { iconSize, radius, spacing, type ThemeColors } from '@/theme';

/** Shared geometry for private and group companion messages. */
export const companionMessageActionSize = iconSize.sm;
export const companionMessageActionHitSlop = { top: 4, bottom: 4, left: 2, right: 2 };
export const companionMessageActionStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', minHeight: 44, paddingVertical: 4, paddingHorizontal: 2 },
  button: { width: 40, height: 36, alignItems: 'center', justifyContent: 'center' },
});

export const companionMessageBubble = (colors: ThemeColors) => ({
  alignSelf: 'flex-start' as const,
  maxWidth: '100%' as const,
  backgroundColor: colors.surfaceElevated,
  borderWidth: 0,
  borderRadius: radius.container,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.md,
  gap: spacing.xs,
});
