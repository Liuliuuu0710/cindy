// @vitest-environment jsdom
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseAdviceAnswer } from '@cindy/maker-shared/message-presentation';
import { adviceAnswerMarkdown } from '../../../../packages/maker-shared/src/__tests__/fixtures/adviceAnswer';

const state = vi.hoisted(() => ({ dark: false }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-native', async () => {
  const { createElement } = await import('react');
  return {
    View: ({ children, testID, style }: any) => createElement('div', { 'data-testid': testID, style: Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style }, children),
    Pressable: ({ children, onPress, accessibilityLabel, accessibilityState }: any) => createElement('button', { onClick: onPress, 'aria-label': accessibilityLabel, 'aria-expanded': accessibilityState.expanded }, children),
    StyleSheet: { create: (styles: unknown) => styles },
  };
});
vi.mock('lucide-react-native', () => ({ ChevronDown: () => null }));
vi.mock('@/components/AppText', async () => {
  const { createElement } = await import('react');
  return { Text: ({ children, selectable, style, accessibilityRole }: any) => createElement('span', {
    style, role: accessibilityRole === 'header' ? 'heading' : undefined,
    'data-selectable': String(selectable),
  }, children) };
});
vi.mock('@/theme', async () => {
  const { lightColors, darkColors } = await import('@/theme/tokens');
  return { useThemedStyles: (make: (colors: unknown) => unknown) => make(state.dark ? darkColors : lightColors) };
});

import { AdviceAnswerCards } from '../session/AdviceAnswerCards';
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
afterEach(() => { act(() => root?.unmount()); root = undefined; state.dark = false; });

describe('mobile advice answer', () => {
  it('restores the same selectable text in both themes from saved message content', () => {
    const container = document.createElement('div');
    const answer = parseAdviceAnswer(adviceAnswerMarkdown)!;
    root = createRoot(container);
    act(() => root!.render(createElement(AdviceAnswerCards, { answer })));
    const expected = container.textContent;
    expect(container.querySelectorAll('[role=heading]')).toHaveLength(4);
    expect(container.querySelectorAll('[data-selectable=true]')).toHaveLength(9);
    expect(expected).toContain(answer.note);
    expect(expected).not.toContain(answer.items[0].explanation);
    act(() => container.querySelector('button')!.click());
    expect(container.textContent).toContain(answer.items[0].explanation);
    expect(container.textContent).not.toContain(answer.items[1].explanation);
    expect(container.querySelector('button')!.getAttribute('aria-expanded')).toBe('true');
    act(() => root!.unmount());
    state.dark = true;
    root = createRoot(container);
    const restored = parseAdviceAnswer(JSON.parse(JSON.stringify(adviceAnswerMarkdown)))!;
    act(() => root!.render(createElement(AdviceAnswerCards, { answer: restored })));
    expect(container.textContent).toBe(expected);
    expect(container.querySelector('iframe,script,img')).toBeNull();
    expect(container.querySelectorAll('button[aria-expanded=false]')).toHaveLength(3);
  });
});
