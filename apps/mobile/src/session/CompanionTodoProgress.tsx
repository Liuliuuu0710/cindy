import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { todoProgressView, type TeammateTodo } from '@cindy/maker-shared/teammate-todo';
import { Text } from '@/components/AppText';
import { lineHeight, spacing, typeScale, useThemedStyles, type ThemeColors } from '@/theme';

function sourceText(todo: TeammateTodo, t: (key: string) => string): string {
  const source = todo.sources[0];
  if (!source || source.kind === 'conversation') return t('devices.glance.source.conversation');
  const kind = t(`devices.glance.source.${source.kind}`);
  return source.label?.trim() && !kind.toLowerCase().includes(source.label.toLowerCase()) ? `${kind} · ${source.label}` : kind;
}

/** Read-only disclosure sits outside the quote/long-press target. */
export function CompanionTodoProgress({ todo }: { todo: TeammateTodo }) {
  const { t, i18n } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const [expanded, setExpanded] = useState(false);
  const [linkFailed, setLinkFailed] = useState(false);
  const view = todoProgressView(todo, i18n.language);
  const evidence = (label: string, href?: string) => href
    ? <Pressable accessibilityRole="link" accessibilityLabel={label} style={styles.evidenceLink}
        onPress={() => { setLinkFailed(false); void Linking.openURL(href).catch(() => setLinkFailed(true)); }}>
        <Text style={styles.linkText}>{label}</Text>
      </Pressable>
    : <Text selectable style={styles.progressText}>{label}</Text>;
  return <View style={styles.progressDetails}>
    {todo.status === 'open' ? <Text style={styles.progressText}>{view.next ? t('devices.glance.nextStep', { step: view.next }) : t('devices.glance.noNext')}</Text> : null}
    <Text style={styles.rowMeta}>{view.updatedAt ? t('devices.glance.recordUpdated', { time: view.updatedAt }) : t('devices.glance.unknownTime')} · {sourceText(todo, t)}</Text>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} style={styles.disclosure} onPress={() => setExpanded(value => !value)}>
      <Text style={styles.disclosureText}>{t('devices.glance.progressDetails')}</Text>
    </Pressable>
    {expanded ? <View style={styles.evidenceBody}>
      {view.progress ? <Text selectable style={styles.progressText}>{view.progress}</Text> : null}
      {view.completion ? <View>
        <Text style={styles.progressText}>{t('devices.glance.completionBasis')}</Text>
        {evidence(view.completion.summary, view.completion.href)}
        <Text style={styles.rowMeta}>{view.completion.at ? t('devices.glance.completedAt', { time: view.completion.at }) : t('devices.glance.unknownTime')}</Text>
      </View> : null}
      {view.sources.map((source, index) => <View key={index}>
        {evidence(source.label, source.href)}
        <Text style={styles.rowMeta}>{source.observedAt ? t('devices.glance.observedAt', { time: source.observedAt }) : t('devices.glance.unknownTime')}</Text>
      </View>)}
      {view.associations.length ? <View><Text style={styles.progressText}>{t('devices.glance.related')}</Text>{view.associations.map((label, index) => <Text key={index} selectable style={styles.progressText}>{label}</Text>)}</View> : null}
      {!view.completion && !view.sources.length ? <Text style={styles.progressText}>{t('devices.glance.noEvidence')}</Text> : null}
      {linkFailed ? <Text accessibilityRole="alert" style={styles.progressText}>{t('devices.glance.openLinkFailed')}</Text> : null}
    </View> : null}
  </View>;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  progressDetails: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.xs },
  progressText: { color: colors.textSecondary, fontSize: typeScale.footnote, lineHeight: lineHeight.caption },
  rowMeta: { color: colors.textTertiary, fontSize: typeScale.caption, lineHeight: lineHeight.caption },
  disclosure: { minHeight: 44, justifyContent: 'center' },
  disclosureText: { color: colors.textSecondary, fontSize: typeScale.body, lineHeight: lineHeight.body },
  evidenceBody: { gap: spacing.sm },
  evidenceLink: { minHeight: 44, justifyContent: 'center' },
  linkText: { color: colors.textPrimary, fontSize: typeScale.footnote, lineHeight: lineHeight.caption, textDecorationLine: 'underline' },
});
