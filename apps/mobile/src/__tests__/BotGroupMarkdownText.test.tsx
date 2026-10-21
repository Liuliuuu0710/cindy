// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

// 把 style 展平进 data-style,断言每个 Text 实际叠了哪些样式。
vi.mock('react-native', async () => {
  const React = await import('react');
  const flat = (style: unknown): Record<string, unknown> =>
    Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
  const host = (tag: string) => ({ children, style }: any) =>
    React.createElement(tag, { 'data-style': JSON.stringify(flat(style)) }, children);
  return {
    View: host('div'),
    Text: host('span'),
    StyleSheet: { create: (s: any) => s, flatten: (s: any) => s, hairlineWidth: 1 },
    Platform: { OS: 'ios', select: (s: any) => s.ios ?? s.default },
  };
});
vi.mock('@/components/AppText', async () => ({ Text: (await import('react-native')).Text }));
vi.mock('@/theme', () => ({
  fontWeight: { semibold: '600', bold: '700' },
  monoFont: 'Menlo',
  useThemedStyles: (make: (colors: any) => any) => make(new Proxy({}, { get: () => '#000' })),
}));

import { BotGroupMarkdownText, BotGroupUserText } from '@/session/BotGroupMessageText';
import { buildBotGroupQuoteCard, buildBotGroupThreadShareCard } from '@cindy/maker-shared/botGroupChat';

const fence = String.fromCharCode(96).repeat(3);
const answer = [
  'Before the answer',
  fence + 'cindy-ui',
  JSON.stringify({ version: 1, seq: 1, op: 'create', id: 'root', kind: 'stack' }),
  JSON.stringify({ seq: 2, op: 'create', id: 'title', kind: 'heading', parent: 'root', props: { text: 'Readable group answer' } }),
  JSON.stringify({ seq: 3, op: 'create', id: 'body', kind: 'markdown', parent: 'root', props: { text: '- First step\n- Second step' } }),
  fence,
  'After the answer',
].join('\n');

let root: Root;
let node: HTMLDivElement;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  node = document.createElement('div');
  document.body.append(node);
  root = createRoot(node);
});
afterEach(() => {
  act(() => root.unmount());
  node.remove();
});

const styleOf = (text: string): Record<string, unknown> => {
  // 取最内层的匹配(强调外层 Text 与内层代码 Text 文本相同)。
  const span = [...node.querySelectorAll('span')].filter((el) => el.textContent === text).at(-1);
  expect(span, `未找到文本 ${text}`).toBeDefined();
  return JSON.parse(span!.getAttribute('data-style')!);
};

it('renders a group bot answer as headings and lists, including after reopening', async () => {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await act(async () => root.render(createElement(BotGroupMarkdownText, { content: answer, authorKind: 'bot' })));
    expect(node.textContent).toContain('Readable group answer');
    expect(node.textContent).toContain('First step');
    expect(node.textContent).toContain('Before the answer');
    expect(node.textContent).toContain('After the answer');
    expect(node.textContent).not.toContain('"op":"create"');
    const heading = [...node.querySelectorAll('span')].find(element => element.textContent === 'Readable group answer');
    expect(JSON.parse(heading!.getAttribute('data-style')!)).toMatchObject({ fontWeight: '600' });
    await act(async () => root.render(null));
  }
});

it('keeps user messages and the cloud private-chat caller unchanged', async () => {
  await act(async () => root.render(createElement(BotGroupUserText, { content: answer, mentionLabels: [] })));
  expect(node.textContent).toBe(answer);
  await act(async () => root.render(createElement(BotGroupMarkdownText, { content: answer })));
  expect(node.textContent).toContain('"op":"create"');
});

it.each(['image', 'video', 'audio'])('keeps an unlabelled %s component visible as its URL', async kind => {
  const url = 'https://example.com/media?first=1&second=2';
  const content = [fence + 'cindy-ui', JSON.stringify({ version: 1, seq: 1, op: 'create',
    id: 'media', kind, props: { src: url } }), fence].join('\n');
  await act(async () => root.render(createElement(BotGroupMarkdownText, { content, authorKind: 'bot' })));
  expect(node.textContent).toContain(url);
  expect(node.textContent).not.toContain('"op":"create"');
  expect(node.querySelector('a, img, video, audio')).toBeNull();
});

it.each(['![](<https://example.com/image.png>)', '**![](<https://example.com/image.png>)**',
  '| Media |\n| --- |\n| ![](<https://example.com/image.png>) |'])('keeps unlabelled bot media visible in %s', async content => {
  await act(async () => root.render(createElement(BotGroupMarkdownText, { content, authorKind: 'bot' })));
  expect(node.textContent).toContain('https://example.com/image.png');
  await act(async () => root.render(createElement(BotGroupMarkdownText, { content })));
  if (content.startsWith('**')) expect(node.textContent).toBe('![](<https://example.com/image.png>)');
  else expect(node.textContent).not.toContain('https://example.com/image.png');
});

it('preserves labelled media and captions without fetching the URL', async () => {
  const content = [fence + 'cindy-ui', JSON.stringify({ version: 1, seq: 1, op: 'create',
    id: 'media', kind: 'image', props: { src: 'https://example.com/image.png', alt: 'Diagram', caption: 'Details' } }), fence].join('\n');
  await act(async () => root.render(createElement(BotGroupMarkdownText, { content, authorKind: 'bot' })));
  expect(node.textContent).toContain('[Diagram]');
  expect(node.textContent).toContain('Details');
  expect(node.querySelector('a, img')).toBeNull();
});

it('treats whitespace-only bot media labels as missing while preserving private-chat rendering', async () => {
  const content = '![' + '   ' + '](https://example.com/image.png)';
  await act(async () => root.render(createElement(BotGroupMarkdownText, { content, authorKind: 'bot' })));
  expect(node.textContent).toBe('https://example.com/image.png');
  await act(async () => root.render(createElement(BotGroupMarkdownText, { content })));
  expect(node.textContent).toBe('[   ]');
});

it('keeps component text literal while rendering Markdown components', async () => {
  const literal = '<name> *literal* &lt; [label](https://example.com)';
  const content = [fence + 'cindy-ui',
    JSON.stringify({ version: 1, seq: 1, op: 'create', id: 'plain', kind: 'text', props: { text: literal } }),
    JSON.stringify({ seq: 2, op: 'create', id: 'markdown', kind: 'markdown', props: { text: '**Formatted**' } }), fence].join('\n');
  await act(async () => root.render(createElement(BotGroupMarkdownText, { content, authorKind: 'bot' })));
  expect(node.textContent).toContain(literal);
  expect(node.textContent).toContain('Formatted');
  expect(node.textContent).not.toContain('**Formatted**');
});

it('群聊不打开链接:强调里的链接只保留强调样式,不加下划线', async () => {
  await act(async () => root.render(createElement(BotGroupMarkdownText, {
    content: '**https://a.example/x** ~~https://b.example/y~~ **`a.ts`**',
  })));
  expect(styleOf('https://a.example/x')).toMatchObject({ fontWeight: '600' });
  expect(styleOf('https://a.example/x').textDecorationLine).toBeUndefined();
  expect(styleOf('https://b.example/y').textDecorationLine).toBe('line-through');
  // 强调里的行内代码照常套代码样式。
  expect(styleOf('a.ts')).toMatchObject({ fontFamily: 'Menlo' });
});


it.each(['quote', 'share'])('renders unfamiliar %s card fallback as literal summary text', async kind => {
  const messageId = '10000000-0000-4000-8000-000000000001';
  const text = 'Readable <name> *literal* &lt;';
  const card = kind === 'quote'
    ? buildBotGroupQuoteCard({ messageId, authorName: 'Bot', authorKind: 'bot', excerpt: text, attachmentCount: 0, attachmentName: null, sequence: 1 })
    : buildBotGroupThreadShareCard({ messageId, threadRootId: '10000000-0000-4000-8000-000000000002', authorName: 'Bot', text });
  await act(async () => root.render(createElement(BotGroupMarkdownText, { content: card.fallback })));
  expect(node.textContent).toContain('Bot: ' + text);
  expect(node.textContent).not.toContain('&#');
});
