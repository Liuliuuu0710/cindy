/**
 * 群聊消息正文。伙伴的回复是 Markdown：这里只做轻量排版（段落、标题、引用、列表、代码块、
 * 表格、行内强调 / 代码），与伙伴私聊回看同样是只读文本，不加载任务页的完整消息渲染器；链接只
 * 显示文字，不在群聊里打开。用户自己的消息保留原文，`@名字` 画成点名标记。
 */
import { botGroupBodyParts } from '@cindy/maker-shared/botGroupPresentation';
import type { BotGroupAuthorKind } from '@cindy/maker-shared/botGroupChat';
import { useCallback, useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { UITextView } from 'react-native-uitextview';
import { splitBotGroupMentionSegments } from '@cindy/maker-shared/botGroupMentions';
import { MAX_FONT_SIZE_MULTIPLIER, Text } from '@/components/AppText';
import { fontWeight, monoFont, useThemedStyles, type ThemeColors } from '@/theme';
import { lineHeight, radius, spacing, typeScale } from '@/theme/tokens';
import { parseMobileMarkdown, type MobileMarkdownBlock, type MobileMarkdownInline } from './messageMarkdown';
import { buildMessageContentLayout } from './messageContentLayout';
import { buildMobileMarkdownTableColumnWidths } from './messageTableLayout';

type Styles = ReturnType<typeof makeStyles>;

/**
 * Match the ordinary session's selectable message body. RN Text on iOS is a
 * UILabel, so `selectable` only offers whole-block copying; UITextView keeps
 * the native selection handles for partial selection in long replies.
 */
function GroupSelectableText({ selectable = true, children, ...props }: ComponentProps<typeof Text> & { selectable?: boolean }) {
  if (selectable && Platform.OS === 'ios') {
    return <UITextView maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} selectable uiTextView {...props}>{children}</UITextView>;
  }
  return <Text selectable={selectable} {...props}>{children}</Text>;
}

function GroupSelectableSpan(props: ComponentProps<typeof Text>) {
  return Platform.OS === 'ios'
    ? <UITextView maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} {...props} />
    : <Text {...props} />;
}

function renderInlines(inlines: readonly MobileMarkdownInline[], styles: Styles): ReactNode[] {
  return inlines.map((inline, index) => {
    // 强调里的代码等:外层套一层带强调样式的 Text,嵌套 Text 继承样式。强调里的链接按强调
    // 纯文本显示:群聊不打开链接,不加下划线,不做出「看着能点却点不动」的样子(DESIGN.md §14.5)。
    if (inline.marks?.length) {
      const markStyles = { strong: styles.strong, emphasis: styles.emphasis, strikethrough: styles.strike };
      return (
        <GroupSelectableSpan key={index} style={inline.marks.map((mark) => markStyles[mark])}>
          {inline.type === 'link' ? inline.text : renderInlines([{ ...inline, marks: undefined }], styles)}
        </GroupSelectableSpan>
      );
    }
    switch (inline.type) {
      case 'strong': return <GroupSelectableSpan key={index} style={styles.strong}>{inline.text}</GroupSelectableSpan>;
      case 'emphasis': return <GroupSelectableSpan key={index} style={styles.emphasis}>{inline.text}</GroupSelectableSpan>;
      case 'strikethrough': return <GroupSelectableSpan key={index} style={styles.strike}>{inline.text}</GroupSelectableSpan>;
      case 'code': return <GroupSelectableSpan key={index} style={styles.inlineCode}>{inline.text}</GroupSelectableSpan>;
      case 'link': return <GroupSelectableSpan key={index}>{inline.text}</GroupSelectableSpan>;
      case 'image': return <GroupSelectableSpan key={index}>{inline.alt ? `[${inline.alt}]` : ''}</GroupSelectableSpan>;
      default: return <GroupSelectableSpan key={index}>{inline.text}</GroupSelectableSpan>;
    }
  });
}

function BotGroupMarkdownTable({ block, styles }: {
  block: Extract<MobileMarkdownBlock, { type: 'table' }>;
  styles: Styles;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const [availableWidth, setAvailableWidth] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setAvailableWidth(event.nativeEvent.layout.width);
  }, []);
  // This read-only renderer shows image alt text, so measure that same text, not a preview.
  const measureCells = (cells: readonly MobileMarkdownInline[][]) => cells.map(cell => cell.map(
    (inline): MobileMarkdownInline => inline.type === 'image'
      ? { type: 'text', text: inline.alt ? `[${inline.alt}]` : '' }
      : inline,
  ));
  const widths = buildMobileMarkdownTableColumnWidths({
    header: measureCells(block.header), rows: block.rows.map(row => ({ ...row, cells: measureCells(row.cells) })), availableWidth,
    minWidth: buildMessageContentLayout({ screenWidth }).markdownTableCellMinWidth,
  });
  const renderRow = (cells: readonly MobileMarkdownInline[][], key: string, header = false) => (
    <View key={key} style={[styles.tableRow, header && styles.tableHeaderRow]}>
      {widths.map((width, index) => (
        <View key={index} style={[styles.tableCell, { width }]}>
          <GroupSelectableText style={[styles.tableText, header && styles.tableHeaderText]}>
            {renderInlines(cells[index] ?? [], styles)}
          </GroupSelectableText>
        </View>
      ))}
    </View>
  );
  return <ScrollView horizontal style={styles.tableScroll} onLayout={onLayout}>
    <View style={styles.table}>
      {renderRow(block.header, `${block.key}:header`, true)}
      {block.rows.map(row => renderRow(row.cells, row.key))}
    </View>
  </ScrollView>;
}

function renderBlock(block: MobileMarkdownBlock, styles: Styles): ReactNode {
  switch (block.type) {
    case 'heading':
      return <GroupSelectableText key={block.key} style={[styles.text, styles.heading]}>{renderInlines(block.inlines, styles)}</GroupSelectableText>;
    case 'blockquote':
      return <View key={block.key} style={styles.quote}>
        <GroupSelectableText style={[styles.text, styles.quoteText]}>{renderInlines(block.inlines, styles)}</GroupSelectableText>
      </View>;
    case 'list_item':
      return <View key={block.key} style={styles.listItem}>
        <Text style={styles.text}>{block.checked === undefined ? (block.ordered ? block.marker : '•') : block.checked ? '☑' : '☐'}</Text>
        <GroupSelectableText style={[styles.text, styles.listText]}>{renderInlines(block.inlines, styles)}</GroupSelectableText>
      </View>;
    case 'code':
    case 'mermaid':
    case 'math':
      return <View key={block.key} style={styles.codeBlock}>
        <GroupSelectableText style={styles.codeText}>{block.text}</GroupSelectableText>
      </View>;
    case 'table':
      return <BotGroupMarkdownTable key={block.key} block={block} styles={styles} />;
    default:
      return <GroupSelectableText key={block.key} style={styles.text}>{renderInlines(block.inlines, styles)}</GroupSelectableText>;
  }
}

export function BotGroupMarkdownText({ content, authorKind }: { content: string; authorKind?: BotGroupAuthorKind }) {
  const styles = useThemedStyles(makeStyles);
  const blocks = useMemo(() => botGroupBodyParts(content, authorKind).flatMap((part, index): MobileMarkdownBlock[] => part.kind === 'markdown'
    ? parseMobileMarkdown(part.content).map(block => ({ ...block, key: `${index}:${block.key}` }))
    : [{ type: 'paragraph', key: String(index), inlines: [{ type: 'text', text: part.content }] }]), [content, authorKind]);
  return <View style={styles.body}>{blocks.map((block) => renderBlock(block, styles))}</View>;
}

/** The user's own words: plain text with `@name` shown as a mention mark. */
export function BotGroupUserText({ content, mentionLabels }: { content: string; mentionLabels: readonly string[] }) {
  const styles = useThemedStyles(makeStyles);
  const segments = useMemo(() => splitBotGroupMentionSegments(content, mentionLabels), [content, mentionLabels]);
  return <GroupSelectableText style={styles.text}>
    {segments.map((segment, index) => segment.mention
      ? <GroupSelectableSpan key={index} style={styles.mention}>{segment.text}</GroupSelectableSpan>
      : <GroupSelectableSpan key={index}>{segment.text}</GroupSelectableSpan>)}
  </GroupSelectableText>;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  body: { gap: spacing.sm, minWidth: 0 },
  // Conversation message body (mobile guide §3): 17 / 26 regular.
  text: { color: colors.textPrimary, fontSize: typeScale.bodyLarge, lineHeight: lineHeight.bodyLarge },
  heading: { fontWeight: fontWeight.semibold },
  strong: { fontWeight: fontWeight.semibold },
  emphasis: { fontStyle: 'italic' },
  strike: { textDecorationLine: 'line-through' },
  inlineCode: { fontFamily: monoFont, fontSize: typeScale.bodySmall, lineHeight: lineHeight.bodyLarge, backgroundColor: colors.surfaceChip },
  quote: { borderLeftWidth: 2, borderLeftColor: colors.border, paddingLeft: spacing.md },
  quoteText: { color: colors.textSecondary },
  listItem: { flexDirection: 'row', gap: spacing.sm },
  listText: { flex: 1, minWidth: 0 },
  codeBlock: { backgroundColor: colors.chatCodeSurface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.control, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  codeText: { color: colors.textPrimary, fontFamily: monoFont, fontSize: typeScale.bodySmall, lineHeight: lineHeight.bodySmall },
  tableScroll: { maxWidth: '100%' },
  table: { borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.container, overflow: 'hidden' },
  tableRow: { flexDirection: 'row' },
  tableHeaderRow: { backgroundColor: colors.surfaceElevated },
  tableCell: { flexShrink: 0, borderRightColor: colors.border, borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  tableText: { color: colors.textPrimary, fontSize: typeScale.bodySmall, lineHeight: lineHeight.bodySmall },
  tableHeaderText: { color: colors.textSecondary, fontWeight: fontWeight.medium },
  // Match desktop's text-only mention highlight: emphasis comes from the link color, not a chip fill.
  mention: { color: colors.linkText, fontWeight: fontWeight.medium },
});
