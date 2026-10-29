import { Copy, MoreHorizontal } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChatReplyIcon } from '@/components/ChatReplyIcon';
import { iconStroke, useThemedStyles, type ThemeColors } from '@/theme';

import { companionMessageActionStyles, companionMessageActionSize, companionMessageActionHitSlop } from './companionMessageAppearance';

export function BotGroupMessageActions({ align = 'left', onCopy, onReply, onMore }: {
  align?: 'left' | 'right';
  onCopy?: () => void;
  onReply?: () => void;
  onMore?: () => void;
}) {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  return <View style={[styles.row, align === 'right' && styles.right]} accessibilityRole="toolbar">
    {onCopy ? <Pressable accessibilityRole="button" accessibilityLabel={t('message.renderer.copyStateCopy')} hitSlop={companionMessageActionHitSlop}
      onPress={onCopy} style={styles.button} testID="botGroup.messageAction.copy">
      <Copy color={styles.icon.color} size={companionMessageActionSize} strokeWidth={iconStroke.regular} />
    </Pressable> : null}
    {onReply ? <Pressable accessibilityRole="button" accessibilityLabel={t('message.renderer.reply')} hitSlop={companionMessageActionHitSlop}
      onPress={onReply} style={styles.button} testID="botGroup.messageAction.reply">
      <ChatReplyIcon size={companionMessageActionSize} color={styles.icon.color} />
    </Pressable> : null}
    {onMore ? <Pressable accessibilityRole="button" accessibilityLabel={t('message.renderer.moreActions')} hitSlop={companionMessageActionHitSlop}
      onPress={onMore} style={styles.button} testID="botGroup.messageAction.more">
      <MoreHorizontal color={styles.icon.color} size={companionMessageActionSize} strokeWidth={iconStroke.regular} />
    </Pressable> : null}
  </View>;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  row: companionMessageActionStyles.row,
  right: { justifyContent: 'flex-end' },
  button: companionMessageActionStyles.button,
  icon: { color: colors.textSecondary },
});
