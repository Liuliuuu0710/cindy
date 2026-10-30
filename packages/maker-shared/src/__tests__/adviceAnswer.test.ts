import { describe, expect, it } from 'vitest';
import { ADVICE_ANSWER_END, ADVICE_ANSWER_START, parseAdviceAnswer } from '../adviceAnswer.js';
import { isDeliveryProseText } from '../messageRender.js';
import { adviceAnswerMarkdown as source } from './fixtures/adviceAnswer.js';

describe('explicit advice-answer Markdown', () => {
  it('restores three suggestions, actions and qualification from the message', () => {
    const answer = parseAdviceAnswer(source)!;
    expect(answer.version).toBe(1);
    expect(answer.title).toBe('先把注意力放在这三件事上');
    expect(answer.items).toHaveLength(3);
    expect(answer.items[0]).toEqual({
      title: '完成事情的能力',
      explanation: '减少同时启动的新方向，给一个项目留下完成交付的时间。',
      actionLabel: '可以先做',
      action: '选一个已有项目，定义这周可以交付的最小成果。',
    });
    expect(answer.note).toBe('这些建议供你选择和试用，不是对你能力的定论。');
    expect(parseAdviceAnswer('  ' + source.replace(/\n/g, '\r\n') + '  ')).toEqual(answer);
    expect(isDeliveryProseText(source)).toBe(true);
  });

  it('never promotes streaming prefixes or an interrupted message to cards', () => {
    for (let offset = 0; offset < source.length; offset += 1) {
      expect(parseAdviceAnswer(source.slice(0, offset))).toBeNull();
    }
    expect(parseAdviceAnswer(source, true)).toBeNull();
    expect(parseAdviceAnswer(source, false)).not.toBeNull();
  });

  it.each([
    source.replace(ADVICE_ANSWER_START, '<!-- cindy:advice:v2 -->'),
    source.replace(ADVICE_ANSWER_START, ''),
    source.replace(ADVICE_ANSWER_END, ''),
    '以下是格式示例：\n' + source,
    String.fromCharCode(96).repeat(3) + 'markdown\n' + source,
    source.replace('### 完成事情的能力', '## 完成事情的能力'),
    source.replace('> **可以先做**', '**可以先做**'),
    source.replace('> 选一个已有项目，定义这周可以交付的最小成果。', '> '),
    source.replace('### 区分感受与事实的能力', '### 额外建议\n### 区分感受与事实的能力'),
    source.replace('不用同时改变所有事情，把建议落到具体行动上。', ''),
    source.replace('这些建议供你选择和试用，不是对你能力的定论。', ''),
    source.replace('给一个项目留下完成交付的时间。', 'a'.repeat(16_001)),
    source.replace('> 先记下原因，再结合新的事实做决定。', '> 先记下原因。\n不能被静默丢弃的解释。'),
  ])('leaves malformed or unsupported content to normal Markdown: %#', (content) => {
    expect(parseAdviceAnswer(content)).toBeNull();
  });

  it('supports translated labels and multiline text', () => {
    const translated = source.replaceAll('可以先做', 'Try this')
      .replace('> 先记下原因，再结合新的事实做决定。', '> First record the reason.\n>\n> Then review the evidence.');
    expect(parseAdviceAnswer(translated)?.items[2]).toMatchObject({
      actionLabel: 'Try this', action: 'First record the reason.\n\nThen review the evidence.',
    });
  });

  it('rejects links, images, inline code, HTML, bare URLs and emphasis so cards never render dead text', () => {
    const cases = [
      source.replace('选一个已有项目，定义这周可以交付的最小成果。', '按 [指南](https://example.com) 操作。'),
      source.replace('减少同时启动的新方向，给一个项目留下完成交付的时间。', '见 ![配图](https://example.com/a.png) 说明。'),
      source.replace('先把注意力放在这三件事上', '先运行 `npm run setup`'),
      source.replace('这些建议供你选择和试用，不是对你能力的定论。', '注意事项 <b>加粗</b> 说明。'),
      source.replace('选一个已有项目，定义这周可以交付的最小成果。', '去 https://example.com 查看。'),
      source.replace('先把注意力放在这三件事上', '先做 **A** 与 __B__ 两件事'),
    ];
    for (const content of cases) {
      expect(parseAdviceAnswer(content)).toBeNull();
    }
  });
});
