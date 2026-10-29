// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseAdviceAnswer } from '@cindy/maker-shared/message-presentation';
import { adviceAnswerMarkdown } from '../../../../../../../packages/maker-shared/src/__tests__/fixtures/adviceAnswer';
import { AdviceAnswerCards } from '../AdviceAnswerCards';
import { AssistantMessage } from '../AssistantMessage';

vi.mock('react-i18next', async (importOriginal) => ({
  ...await importOriginal<typeof import('react-i18next')>(),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../useForkAtMessage', () => ({ useForkAtMessage: () => undefined }));
vi.mock('../useDeleteMessage', () => ({ useDeleteMessage: () => undefined }));
vi.mock('@/hooks/useAgentCapabilities', async (original) => ({
  ...await original<typeof import('@/hooks/useAgentCapabilities')>(),
  useAgentCapabilities: () => ({ capabilities: null }),
}));
vi.mock('../MarkdownRenderer', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => createElement('div', { 'data-testid': 'markdown-fallback' }, content),
}));

afterEach(cleanup);
describe('advice answer view', () => {
  it('keeps every action and qualification visible while explanations expand independently and reset on reload', () => {
    const answer = parseAdviceAnswer(adviceAnswerMarkdown)!;
    const first = render(createElement(AdviceAnswerCards, { answer }));
    for (const item of answer.items) {
      expect(screen.getByText(item.explanation).hidden).toBe(true);
      expect(screen.getByText(item.action, { exact: false }).hidden).toBe(false);
    }
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(buttons[0].getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(answer.items[0].explanation).hidden).toBe(false);
    expect(screen.getByText(answer.items[1].explanation).hidden).toBe(true);
    expect(screen.getByText(answer.note).hidden).toBe(false);
    fireEvent.click(buttons[0]);
    expect(screen.getByText(answer.items[0].explanation).hidden).toBe(true);
    fireEvent.click(buttons[1]);
    first.unmount();
    render(createElement(AdviceAnswerCards, { answer: parseAdviceAnswer(adviceAnswerMarkdown)! }));
    expect(screen.getAllByRole('button').every((button) => button.getAttribute('aria-expanded') === 'false')).toBe(true);
  });
  it('uses the real assistant message branch only after the stream finishes and restores it on remount', () => {
    const props = { workingDir: '/test', content: adviceAnswerMarkdown, messageClientId: 'advice-final' };
    const view = render(createElement(AssistantMessage, { ...props, isStreaming: true }));
    expect(screen.queryByTestId('advice-answer')).toBeNull();
    expect(screen.getByTestId('markdown-fallback').textContent).toBe(adviceAnswerMarkdown);
    view.rerender(createElement(AssistantMessage, { ...props, isStreaming: false }));
    expect(screen.queryByTestId('markdown-fallback')).toBeNull();
    const expected = screen.getByTestId('advice-answer').textContent;
    view.unmount();
    const restored = render(createElement(AssistantMessage, { ...props, isStreaming: false }));
    expect(screen.getByTestId('advice-answer').textContent).toBe(expected);
    restored.rerender(createElement(AssistantMessage, { ...props, content: adviceAnswerMarkdown.replace('<!-- /cindy:advice -->', '') }));
    expect(screen.queryByTestId('advice-answer')).toBeNull();
    expect(screen.getByTestId('markdown-fallback').textContent).toContain('不是对你能力的定论');
  });
  it('recreates the same cards when remounted from persisted Markdown', () => {
    const answer = parseAdviceAnswer(adviceAnswerMarkdown)!;
    const first = render(createElement(AdviceAnswerCards, { answer }));
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText(answer.note)).toBeTruthy();
    const expected = first.container.textContent;
    first.unmount();
    const reloaded = parseAdviceAnswer(JSON.parse(JSON.stringify(adviceAnswerMarkdown)))!;
    render(createElement(AdviceAnswerCards, { answer: reloaded }));
    expect(screen.getByTestId('advice-answer').textContent).toBe(expected);
  });
  it('escapes model HTML and never creates active content', () => {
    const answer = parseAdviceAnswer(adviceAnswerMarkdown)!;
    const hostile = '<img src=x onerror=alert(1)><script>alert(1)</script>';
    const { container } = render(createElement(AdviceAnswerCards, {
      answer: { ...answer, title: hostile, items: answer.items.map((item) => ({ ...item, action: hostile })) },
    }));
    expect(container.textContent).toContain(hostile);
    expect(container.querySelector('script,img,iframe,a')).toBeNull();
    expect(container.querySelectorAll('button')).toHaveLength(3);
  });
});
