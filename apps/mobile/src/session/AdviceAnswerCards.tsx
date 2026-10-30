import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Pressable, StyleSheet } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import type { AdviceAnswer } from '@cindy/maker-shared/message-presentation';
import { Text } from '@/components/AppText';
import { MarkdownSelectableText } from '@/session/MarkdownSelectableText';
import { useThemedStyles, type ThemeColors } from '@/theme';
import { fontWeight, iconSize, lineHeight, navigationChrome, radius, spacing, typeScale } from '@/theme/tokens';

function AdviceRow({ item, index, selectable }: { item: AdviceAnswer['items'][number]; index: number; selectable: boolean }) {
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={[styles.row, index > 0 && styles.separator]}>
      <View style={styles.heading}>
        <Text accessible={false} style={styles.number}>{String(index + 1).padStart(2, '0')}</Text>
        <MarkdownSelectableText accessibilityRole="header" selectable={selectable} style={styles.itemTitle}>{item.title}</MarkdownSelectableText>
        <Pressable accessibilityRole="button" accessibilityLabel={expanded ? t('message.renderer.collapseExplanation') : t('message.renderer.expandExplanation')} accessibilityState={{ expanded }} onPress={() => setExpanded((value) => !value)} style={styles.toggle}>
          <ChevronDown size={iconSize.md} color={styles.number.color} style={expanded ? styles.expandedIcon : undefined} />
        </Pressable>
      </View>
      <View style={styles.content}>
        <View style={styles.actionRow}>
          <Text style={styles.actionLabel}>{item.actionLabel}</Text>
          <MarkdownSelectableText selectable={selectable} style={styles.actionBody}>{item.action}</MarkdownSelectableText>
        </View>
        {expanded && <MarkdownSelectableText selectable={selectable} style={styles.explanation}>{item.explanation}</MarkdownSelectableText>}
      </View>
    </View>
  );
}

/** Message text stays selectable; there is no WebView or executable model content. */
export function AdviceAnswerCards({ answer, selectable = true }: {
  answer: AdviceAnswer;
  selectable?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.answer} testID="advice-answer">
      <MarkdownSelectableText accessibilityRole="header" selectable={selectable} style={styles.title}>{answer.title}</MarkdownSelectableText>
      <MarkdownSelectableText selectable={selectable} style={styles.body}>{answer.introduction}</MarkdownSelectableText>
      <View style={styles.card}>
        {answer.items.map((item, index) => <AdviceRow key={index} item={item} index={index} selectable={selectable} />)}
      </View>
      <MarkdownSelectableText selectable={selectable} style={styles.note}>{answer.note}</MarkdownSelectableText>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  answer: { alignSelf: 'stretch', gap: spacing.md },
  title: { fontSize: typeScale.subtitle, lineHeight: lineHeight.subtitle, fontWeight: fontWeight.medium, color: colors.textPrimary },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.container, backgroundColor: colors.surfaceElevated },
  row: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  separator: { borderTopWidth: 1, borderColor: colors.border },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  number: { width: spacing.xl, fontSize: typeScale.caption, lineHeight: lineHeight.caption, fontWeight: fontWeight.regular, color: colors.textTertiary },
  itemTitle: { flex: 1, fontSize: typeScale.body, lineHeight: lineHeight.body, fontWeight: fontWeight.medium, color: colors.textPrimary },
  toggle: { width: navigationChrome.target, height: navigationChrome.target, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  expandedIcon: { transform: [{ rotate: '180deg' }] },
  content: { marginLeft: spacing.xl + spacing.sm, gap: spacing.sm },
  actionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  actionLabel: { fontSize: typeScale.caption, lineHeight: lineHeight.caption, fontWeight: fontWeight.medium, color: colors.textSecondary, backgroundColor: colors.surfaceChip, borderRadius: radius.pill, paddingHorizontal: spacing.sm, overflow: 'hidden' },
  actionBody: { flex: 1, fontSize: typeScale.bodyLarge, lineHeight: lineHeight.bodyLarge, fontWeight: fontWeight.regular, color: colors.textPrimary },
  body: { fontSize: typeScale.bodyLarge, lineHeight: lineHeight.bodyLarge, fontWeight: fontWeight.regular, color: colors.textPrimary },
  explanation: { fontSize: typeScale.footnote, lineHeight: lineHeight.caption, fontWeight: fontWeight.regular, color: colors.textSecondary, borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: spacing.sm },
  note: { fontSize: typeScale.footnote, lineHeight: lineHeight.caption, fontWeight: fontWeight.regular, color: colors.textSecondary },
});
