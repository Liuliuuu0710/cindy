import { describe, expect, it } from 'vitest';
import { botGroupDisplayText } from '../botGroupDisplayText';
import { botGroupQuoteExcerpt } from '../botGroupChat';
import { richAnswerText } from '../richAnswer';

const fence = String.fromCharCode(96).repeat(3);
const answer = (kind: string, props?: Record<string, unknown>, nested = false) => [
  fence + 'cindy-ui',
  JSON.stringify({ version: 1, seq: 1, op: 'create', id: 'control', kind, props }),
  ...(nested ? [JSON.stringify({ seq: 2, op: 'create', id: 'child', parent: 'control', kind: 'text', props: { text: 'Actual content' } })] : []),
  fence,
].join('\n');

describe('group control projection', () => {
  it.each(['range', 'details', 'check', 'input', 'select', 'tabs'])('keeps a %s with no authored content as source', kind => {
    for (const props of [undefined, {}, { default: null }, { default: ' ' }, { label: ' ', min: 7 }]) {
      const source = answer(kind, props);
      for (const format of ['text', 'markdown'] as const) {
        expect(botGroupDisplayText(source, 'bot', format)).toBe(source);
        const sibling = answer('text', { text: 'Actual content' });
        // Separate empty blocks are preserved, not hidden by a readable neighbor.
        expect(botGroupDisplayText(sibling + '\n' + source, 'bot', format)).toContain(source);
      }
      expect(botGroupQuoteExcerpt(source, 'bot')).toBe(source.replace(/\s+/g, ' ').trim());
    }
  });

  it.each(['range', 'details', 'check'])('omits an implicit %s value beside readable children', kind => {
    if (kind === 'details') expect(botGroupDisplayText(answer(kind, {}, true), 'bot', 'text').trim()).toBe('Actual content');
    const source = [fence + 'cindy-ui',
      JSON.stringify({ version: 1, seq: 1, op: 'create', id: 'empty', kind }),
      JSON.stringify({ seq: 2, op: 'create', id: 'body', kind: 'text', props: { text: 'Actual content' } }), fence].join('\n');
    expect(botGroupDisplayText(source, 'bot', 'text').trim()).toBe('Actual content');
  });

  it.each([
    { kind: 'range', props: { default: 0 }, expected: ': 0' },
    { kind: 'details', props: { default: false }, expected: ': false' },
    { kind: 'check', props: { default: false }, expected: '☐' },
    { kind: 'range', props: { label: 'Amount', min: 7 }, expected: 'Amount: 7' },
    { kind: 'details', props: { label: 'More' }, expected: 'More: false' },
  ])('preserves authored content for $kind: $expected', ({ kind, props, expected }) => {
    const source = answer(kind, props);
    expect(botGroupDisplayText(source, 'bot', 'text').trim()).toBe(expected);
    expect(botGroupQuoteExcerpt(source, 'bot')).toBe(expected);
  });

  it.each([
    { kind: 'range', props: { label: '预算', default: 5, suffix: ' 万元' }, expected: '预算: 5 万元', legacy: '预算: 5' },
    { kind: 'range', props: { label: 'Ratio', min: 0, max: 10, default: 12, suffix: '%' }, expected: 'Ratio: 10%', legacy: 'Ratio: 12' },
    { kind: 'select', props: { label: '方案', default: 'pro', options: [{ value: 'pro', label: '专业版' }] }, expected: '方案: 专业版', legacy: '方案: pro' },
    { kind: 'select', props: { default: '0', options: [{ value: '0', label: 'Zero' }] }, expected: ': Zero', legacy: ': 0' },
  ])('keeps the displayed value for $kind: $expected', ({ kind, props, expected, legacy }) => {
    const source = answer(kind, props);
    expect(botGroupDisplayText(source, 'bot', 'text').trim()).toBe(expected);
    expect(botGroupQuoteExcerpt(source, 'bot')).toBe(expected);
    expect(botGroupDisplayText(source, 'user')).toBe(source);
    expect(richAnswerText(source).trim()).toBe(legacy);
  });

  it.each(['range', 'select'])('escapes %s display decorations only for Markdown', kind => {
    const props = kind === 'range'
      ? { label: 'Value', default: 5, suffix: ' <unit>*' }
      : { label: 'Value', default: 'internal', options: [{ value: 'internal', label: '5 <unit>*' }] };
    const source = answer(kind, props);
    expect(botGroupDisplayText(source, 'bot').trim()).toBe('Value: 5 &#60;unit&#62;&#42;');
    expect(botGroupDisplayText(source, 'bot', 'text').trim()).toBe('Value: 5 <unit>*');
    expect(botGroupQuoteExcerpt(source, 'bot')).toBe('Value: 5 <unit>*');
  });
});
