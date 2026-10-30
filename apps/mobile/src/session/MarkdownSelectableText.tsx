import { useContext, useRef, type ComponentProps } from 'react';
import {
  Platform,
  StyleSheet,
  useWindowDimensions,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { UITextView } from 'react-native-uitextview';

import { MAX_FONT_SIZE_MULTIPLIER, Text } from '@/components/AppText';
import { i18n } from '@/i18n';
import {
  handleSelectionQuoteMenuAction,
  SelectionQuoteContext,
  selectionQuoteMenuLabel,
} from '@/session/selectionQuote';
import { SelectionMenuText } from '@/session/SelectionMenuText';
import { selectableTextVerticalOffset } from '@/session/selectableTextAlignment';

export type MarkdownSelectableTextProps = Omit<ComponentProps<typeof Text>, 'selectionColor'> & {
  /**
   * iOS 是否使用可部分选中的 UITextView。普通任务的超长展开正文回退 RN Text:
   * UITextView 在折叠→展开时骤增为超高复用视图会偶发只留下巨高空白容器。
   */
  allowIosUITextView?: boolean;
  /** Decorated table cells must stay on the row grid, including their borders. */
  adjustVerticalAlignment?: boolean;
  /** Include larger inline headings when aligning a combined text run. */
  alignmentTextStyles?: readonly StyleProp<TextStyle>[];
};

/**
 * 与正文同款的选中文本：接回「添加到对话 / 侧边追问」选区菜单。
 * iOS 用真 UITextView（menuActionLabel / onMenuAction），Android 与回退用
 * SelectionMenuText。context 为 null（宿主未启用 / 非会话场景）时零开销走原路径。
 */
export function MarkdownSelectableText({
  allowIosUITextView = true,
  adjustVerticalAlignment = true,
  alignmentTextStyles,
  selectable,
  ...rest
}: MarkdownSelectableTextProps) {
  const quoteCtx = useContext(SelectionQuoteContext);
  const renderedLinesRef = useRef<readonly string[]>([]);
  const { fontScale } = useWindowDimensions();
  if (selectable && allowIosUITextView && Platform.OS === 'ios') {
    const typography = [rest.style, ...(alignmentTextStyles ?? [])]
      .map((style) => StyleSheet.flatten(style) ?? {});
    const top = selectableTextVerticalOffset(typography, rest.allowFontScaling === false ? 1 : fontScale);
    // Position only the selectable root. RN Text already centers its leading;
    // shifting the bubble itself would also shift pending/Android text and chips.
    const alignedStyle: StyleProp<TextStyle> = adjustVerticalAlignment ? [rest.style, { top }] : rest.style;
    if (!quoteCtx) {
      return (
        <UITextView
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          selectable
          uiTextView
          {...rest}
          style={alignedStyle}
        />
      );
    }
    return (
      <UITextView
        maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
        selectable
        uiTextView
        {...rest}
        style={alignedStyle}
        onTextLayout={(e) => {
          // uitextview 自定义 spec 的 lines 是 string[](RN 核心 Text 是对象数组),
          // 双形态防御:确保缓存的是纯字符串行。
          const rawLines = e.nativeEvent.lines as unknown as readonly (string | { text: string })[];
          renderedLinesRef.current = rawLines.map((line) => (typeof line === 'string' ? line : line.text));
          rest.onTextLayout?.(e);
        }}
        {...{
          menuActionLabel: selectionQuoteMenuLabel(),
          sideChatMenuActionLabel: quoteCtx.askInSideChat ? i18n.t('session.sideChat.title') : '',
          onMenuAction: (event: { nativeEvent: { target: number; start: number; end: number } }) => {
            handleSelectionQuoteMenuAction(event, renderedLinesRef.current, quoteCtx);
          },
          onSideChatMenuAction: (event: { nativeEvent: { target: number; start: number; end: number } }) => {
            handleSelectionQuoteMenuAction(event, renderedLinesRef.current, quoteCtx, 'side-chat');
          },
        }}
      />
    );
  }
  return <SelectionMenuText selectable={selectable} {...rest} />;
}
