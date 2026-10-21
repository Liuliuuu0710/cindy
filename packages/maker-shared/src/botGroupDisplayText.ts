import type { BotGroupAuthorKind } from './botGroupChat.js';
import { richAnswerTextProjection, splitRichAnswer } from './richAnswer.js';

export function botGroupDisplayText(content: string, authorKind?: BotGroupAuthorKind, format: 'markdown' | 'text' = 'markdown'): string {
  if (authorKind !== 'bot') return content;
  const parts = splitRichAnswer(content);
  if (!parts.some(part => part.kind === 'rich')) return content;
  return parts.map((part, partIndex) => {
    const source = content.slice(part.key, parts[partIndex + 1]?.key ?? content.length);
    if (part.kind !== 'rich') return source;
    const { text, hasReadableContent } = richAnswerTextProjection(source, { escapeMarkdown: format === 'markdown', omitEmptyNodes: true, allowPrivilegedMedia: false });
    return hasReadableContent ? text + '\n\n' : source;
  }).join('');
}
