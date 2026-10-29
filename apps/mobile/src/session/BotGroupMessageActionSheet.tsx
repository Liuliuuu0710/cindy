import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, MessageSquarePlus, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { BlurBackdrop } from '@/session/BlurBackdrop';
import { SheetModal } from '@/session/SheetModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontWeight, iconSize, iconStroke, lineHeight, radius, spacing, typeScale, useTheme, useThemedStyles, type ThemeColors } from '@/theme';

export type BotGroupMessageAction = 'reply' | 'copy';

export function BotGroupMessageActionSheet({ visible, canReply, onClose, onAction }: {
  visible: boolean;
  canReply: boolean;
  onClose(): void;
  onAction(action: BotGroupMessageAction): void;
}) {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const pendingAction = useRef<BotGroupMessageAction | null>(null);
  useEffect(() => {
    if (visible) pendingAction.current = null;
  }, [visible]);
  const handleClosed = useCallback(() => {
    const action = pendingAction.current;
    pendingAction.current = null;
    if (action) onAction(action);
  }, [onAction]);
  const closeWithoutAction = useCallback(() => {
    pendingAction.current = null;
    onClose();
  }, [onClose]);
  const items: { id: BotGroupMessageAction; label: string; Icon: LucideIcon }[] = [
    ...(canReply ? [{ id: 'reply' as const, label: t('message.renderer.reply'), Icon: MessageSquarePlus }] : []),
    { id: 'copy', label: t('message.renderer.copyStateCopy'), Icon: Copy },
  ];
  return <SheetModal
    nativePresentation
    visible={visible}
    onRequestClose={closeWithoutAction}
    onBackdropPress={closeWithoutAction}
    onClosed={handleClosed}
    backdropTestID="botGroup.messageActions.backdrop"
  >
    <View style={[styles.cardArea, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <View style={styles.actionCard} testID="botGroup.messageActions.sheet">
        <BlurBackdrop intensity={32} overlayColor={colors.sheetActionSurface} />
        {items.map(({ id, label, Icon }) => <Pressable
          key={id}
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={() => { pendingAction.current = id; onClose(); }}
          style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}
          testID={`botGroup.messageActions.${id}`}
        >
          <Icon color={colors.textPrimary} size={iconSize.lg} strokeWidth={iconStroke.regular} />
          <Text style={styles.actionLabel}>{label}</Text>
        </Pressable>)}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t('session.common.cancel')} onPress={closeWithoutAction}
        style={({ pressed }) => [styles.cancelCard, pressed && styles.pressed]} testID="botGroup.messageActions.cancel">
        <BlurBackdrop intensity={32} overlayColor={colors.sheetActionSurface} />
        <Text style={styles.cancelText}>{t('session.common.cancel')}</Text>
      </Pressable>
    </View>
  </SheetModal>;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  cardArea: { gap: spacing.sm, paddingHorizontal: spacing.md },
  actionCard: { backgroundColor: 'transparent', borderColor: colors.sheetActionBorder, borderRadius: radius.container, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  actionRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 54, paddingHorizontal: spacing.lg },
  actionLabel: { color: colors.textPrimary, flexShrink: 1, fontSize: typeScale.bodySmall, fontWeight: fontWeight.medium, lineHeight: lineHeight.bodySmall },
  cancelCard: { alignItems: 'center', backgroundColor: 'transparent', borderColor: colors.sheetActionBorder, borderRadius: radius.container, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center', minHeight: 54, overflow: 'hidden' },
  cancelText: { color: colors.textPrimary, fontSize: typeScale.bodySmall, fontWeight: fontWeight.medium, lineHeight: lineHeight.bodySmall },
  pressed: { opacity: 0.72 },
});
