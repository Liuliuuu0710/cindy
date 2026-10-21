// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import ReactMarkdown from 'react-markdown';
import { botGroupQuoteExcerpt, buildBotGroupQuoteCard, readBotGroupQuoteCard, buildBotGroupThreadShareCard } from '@cindy/maker-shared/botGroupChat';
import { botGroupDisplayText } from '@cindy/maker-shared/botGroupPresentation';

afterEach(cleanup);
const messageId = '10000000-0000-4000-8000-000000000001';
const threadRootId = '10000000-0000-4000-8000-000000000002';
const fence = String.fromCharCode(96).repeat(3);
const component = (text: string) => [fence + 'cindy-ui', JSON.stringify({ version: 1, seq: 1, op: 'create', id: 'text', kind: 'text', props: { text } }), fence].join('\n');
const quote = (excerpt: string, authorName = 'Bot') => ({ messageId, authorName, authorKind: 'bot' as const, excerpt, attachmentCount: 0, attachmentName: null, sequence: 1 });
const visible = (fallback: string) => {
  const view = render(<ReactMarkdown skipHtml>{fallback}</ReactMarkdown>);
  expect(view.container.querySelector('em,strong,a,img,script')).toBeNull();
  return view.container.textContent!.trim();
};

it.each(['Readable <name> *literal*', '&lt; **literal** [link](https://example.com)', 'price $5, \u005c\u005c(path\u005c\u005c), ~value~'])('keeps quote fallback literal: %s', text => {
  const excerpt = botGroupQuoteExcerpt(component(text), 'bot');
  const card = buildBotGroupQuoteCard(quote(excerpt));
  expect(visible(card.fallback)).toBe('Bot: ' + text);
  expect(card.data.excerpt).toBe(text);
  expect(readBotGroupQuoteCard(card)?.excerpt).toBe(text);
});

it.each(['Readable <name> *literal*', '&lt; **literal** [link](https://example.com)'])('keeps share fallback literal: %s', text => {
  const preview = botGroupDisplayText(component(text), 'bot', 'text').replace(/\s+/g, ' ').trim();
  const card = buildBotGroupThreadShareCard({ messageId, threadRootId, authorName: 'Bot', text: preview });
  expect(visible(card.fallback)).toBe('↪ Bot: ' + text);
  expect(preview).toBe(text);
  expect(card.data).toEqual({ messageId, threadRootId });
});

it('protects quote author and attachment labels while preserving structured metadata', () => {
  const input = { ...quote('Body', '<Bot> *name*'), attachmentCount: 2, attachmentName: '<file> [x].pdf' };
  const card = buildBotGroupQuoteCard(input);
  expect(visible(card.fallback)).toBe('<Bot> *name*: Body 📎 <file> [x].pdf +1');
  expect(readBotGroupQuoteCard(card)).toEqual(input);
});

it('protects share authors and preserves full Unicode characters at the text limit', () => {
  const text = '😀'.repeat(281);
  const card = buildBotGroupThreadShareCard({ messageId, threadRootId, authorName: '<Bot> *name*', text });
  expect(visible(card.fallback)).toBe('↪ <Bot> *name*: ' + '😀'.repeat(280) + '…');
});

it('bounds escaped quote fallback without cutting an entity or changing its snapshot', () => {
  const input = { ...quote('~'.repeat(280), '~'.repeat(200)), attachmentCount: 100, attachmentName: '~'.repeat(255) };
  const card = buildBotGroupQuoteCard(input);
  expect(card.fallback.length).toBeLessThanOrEqual(4000);
  const text = visible(card.fallback);
  expect(text).not.toMatch(/&#/);
  expect(text).toMatch(/…$/);
  expect(readBotGroupQuoteCard(card)).toEqual(input);
});
