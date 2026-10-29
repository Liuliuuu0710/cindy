/**
 * Opt-in, readable Markdown presentation. The original message is the only
 * persisted source; cards are reconstructed after history loading on both clients.
 * No HTML, script, URLs or host actions are interpreted by this format.
 */
export interface AdviceAnswerItem {
  title: string;
  explanation: string;
  actionLabel: string;
  action: string;
}

export interface AdviceAnswer {
  version: 1;
  title: string;
  introduction: string;
  items: readonly AdviceAnswerItem[];
  note: string;
}

export const ADVICE_ANSWER_START = '<!-- cindy:advice:v1 -->';
export const ADVICE_ANSWER_END = '<!-- /cindy:advice -->';
const MAX_SOURCE_LENGTH = 16_000;

function boundedText(text: string, maxLength: number): boolean {
  return text.length > 0 && text.length <= maxLength;
}

/** Incomplete, unmarked, unsupported or invalid messages keep their Markdown UI. */
export function parseAdviceAnswer(content: string, isStreaming = false): AdviceAnswer | null {
  if (isStreaming || content.length > MAX_SOURCE_LENGTH) return null;
  const source = content.trim().replace(/\r\n/g, '\n');
  if (!source.startsWith(`${ADVICE_ANSWER_START}\n`)
    || !source.endsWith(`\n${ADVICE_ANSWER_END}`)) return null;
  const body = source.slice(ADVICE_ANSWER_START.length, -ADVICE_ANSWER_END.length).trim();
  // Reject nested markers and fenced examples. They must never be mistaken for
  // a real answer. Unsupported Markdown remains readable in the normal renderer.
  if (/<!--|-->|^\s*(?:`{3,}|~{3,})/m.test(body)) return null;
  const lines = body.split('\n');
  const title = /^## ([^#].*)$/.exec(lines[0] ?? '')?.[1]?.trim();
  if (!title || !boundedText(title, 160)) return null;
  const sectionStarts = lines.flatMap((line, index) => /^### [^#]/.test(line) ? [index] : []);
  if (sectionStarts.length !== 3) return null;
  const noteStart = lines.findIndex((line) => line === '---');
  if (noteStart <= sectionStarts[2] || lines.filter((line) => line === '---').length !== 1) return null;
  const introduction = lines.slice(1, sectionStarts[0]).join('\n').trim();
  const note = lines.slice(noteStart + 1).join('\n').trim();
  if (!boundedText(introduction, 2000) || !boundedText(note, 2000)) return null;
  const items: AdviceAnswerItem[] = [];
  for (let index = 0; index < sectionStarts.length; index += 1) {
    const start = sectionStarts[index];
    const end = sectionStarts[index + 1] ?? noteStart;
    const section = lines.slice(start + 1, end);
    const itemTitle = lines[start].slice(4).trim();
    const actionStart = section.findIndex((line) => /^> \*\*[^*]+\*\*\s*$/.test(line));
    if (actionStart < 0) return null;
    const explanation = section.slice(0, actionStart).join('\n').trim();
    const actionLabel = /^> \*\*([^*]+)\*\*\s*$/.exec(section[actionStart])![1].trim();
    const actionLines = section.slice(actionStart + 1);
    while (actionLines.length && !actionLines[actionLines.length - 1].trim()) actionLines.pop();
    if (actionLines.some((line) => !/^>(?: |$)/.test(line))) return null;
    const action = actionLines.map((line) => line.replace(/^> ?/, '')).join('\n').trim();
    if (!boundedText(itemTitle, 160) || !boundedText(explanation, 3000)
      || !boundedText(actionLabel, 80) || !boundedText(action, 3000)) return null;
    items.push({ title: itemTitle, explanation, actionLabel, action });
  }
  return { version: 1, title, introduction, items, note };
}
