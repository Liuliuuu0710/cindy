import { describe, expect, it } from 'vitest';
import { richAnswerText } from '../richAnswer.js';
import {
  botGroupComposerPlanState,
  botGroupDisplayText,
  botGroupErrorVariant,
  botGroupNoticeVariant,
  botGroupPlanFollowUp,
  isBotGroupDivisionBlocked,
  mergeBotGroupMessages,
  projectBotGroupExecutionFailures,
  botGroupExecutionFailureBatches,
  chatGroupMembership,
} from '../botGroupPresentation.js';
import { BOT_GROUP_RUNTIME_FAILURE_CODES, readBotGroupExecutionFailure, type BotGroupErrorCode, type BotGroupExecutionFailureView, type BotGroupMemberView, type BotGroupMessageView, type BotGroupNoticeCode, type BotGroupPlanView } from '../botGroupChat.js';

describe('group answer display text', () => {
  const fence = String.fromCharCode(96).repeat(3);
  const outerFence = String.fromCharCode(96).repeat(4);
  it.each(['text', 'heading', 'stat', 'icon', 'svg', 'input', 'chart', 'check', 'stack', 'markdown'])('escapes literal fields of %s without changing Markdown or legacy export', kind => {
    const literal = '<name> *literal* &lt;';
    const content = [fence + 'cindy-ui', JSON.stringify({ version: 1, seq: 1, op: 'create', id: 'body', kind,
      props: { text: kind === 'markdown' ? '**Formatted**' : literal, label: literal, caption: literal, default: literal },
    }), fence].join('\n');
    expect(botGroupDisplayText(content, 'bot')).toContain('&#60;name&#62; &#42;literal&#42; &#38;lt&#59;');
    expect(botGroupDisplayText(content, 'bot', 'text')).toContain(literal);
    expect(richAnswerText(content)).toContain(literal);
    if (kind === 'markdown') expect(botGroupDisplayText(content, 'bot')).toContain('**Formatted**');
  });
  const answer = [
    fence + 'cindy-ui',
    JSON.stringify({ version: 1, seq: 1, op: 'create', id: 'root', kind: 'stack' }),
    JSON.stringify({ seq: 2, op: 'create', id: 'title', parent: 'root', kind: 'heading', props: { text: 'Draft' } }),
    JSON.stringify({ seq: 3, op: 'patch', id: 'title', props: { text: 'Final answer' } }),
    JSON.stringify({ seq: 4, op: 'create', id: 'body', parent: 'root', kind: 'markdown', props: { text: '- First\n- Second' } }),
    fence,
  ].join('\n');

  it('replays operations and retains text outside each component block', () => {
    const content = ['Before', answer, 'Between', answer, 'After'].join('\n');
    const displayed = botGroupDisplayText(content, 'bot');
    expect(displayed).toContain('Before');
    expect(displayed).toContain('Between');
    expect(displayed).toContain('After');
    expect(displayed.match(/### Final answer/g)).toHaveLength(2);
    expect(displayed).toContain('- First\n- Second');
    expect(displayed).not.toContain('Draft');
    expect(displayed).not.toContain('"op":');
  });

  it.each(['user', 'system', undefined] as const)('keeps %s content unchanged', authorKind => {
    expect(botGroupDisplayText(answer, authorKind)).toBe(answer);
  });

  it.each([
    '',
    '# Normal Markdown\n\n- Item',
    [fence + 'json', '{"example":true}', fence].join('\n'),
    [outerFence + 'markdown', answer, outerFence].join('\n'),
  ])('preserves ordinary Markdown and nested protocol examples: %s', content => {
    expect(botGroupDisplayText(content, 'bot')).toBe(content);
  });

  it.each([
    [fence + 'cindy-ui', '{not valid json}', fence].join('\n'),
    [fence + 'cindy-ui', '{"version":1'].join('\n'),
    [fence + 'cindy-ui', JSON.stringify({ version: 1, seq: 1, op: 'create', id: 'root', kind: 'stack' }), fence].join('\n'),
  ])('does not silently erase an unreadable block, even beside a valid answer: %s', invalid => {
    expect(botGroupDisplayText(invalid, 'bot')).toBe(invalid);
    const displayed = botGroupDisplayText(['Before', answer, invalid, 'After'].join('\n'), 'bot');
    expect(displayed).toContain('### Final answer');
    expect(displayed).toContain(invalid);
    expect(displayed).toContain('After');
  });

  it('shows committed text from a partial answer without exposing its trailing operation', () => {
    const partial = answer.slice(0, -fence.length) + '{"seq":5';
    expect(botGroupDisplayText(partial, 'bot')).toContain('### Final answer');
    expect(botGroupDisplayText(partial, 'bot')).not.toContain('"seq":5');
  });
});

describe('server group membership affordances', () => {
  const self = { actorId: 'self', isSelf: true, isOwned: true, role: 'member' } as BotGroupMemberView;
  const ownBot = { actorId: 'own-bot', actorKind: 'bot', isOwned: true, role: 'owner' } as BotGroupMemberView;
  const otherOwner = { actorId: 'other-owner', isOwned: false, role: 'owner' } as BotGroupMemberView;
  it.each([
    { members: [self, otherOwner], owner: false, manager: false, canLeave: true },
    { members: [{ ...self, role: 'admin' as const }, otherOwner], owner: false, manager: true, canLeave: true },
    { members: [{ ...self, role: 'owner' as const }], owner: true, manager: true, canLeave: false },
    { members: [self, ownBot], owner: true, manager: true, canLeave: false },
    { members: [{ ...self, role: 'owner' as const }, ownBot], owner: true, manager: true, canLeave: false },
    { members: [self, ownBot, otherOwner], owner: true, manager: true, canLeave: true },
    { members: [self, ownBot, { ...otherOwner, isOwned: undefined }], owner: true, manager: true, canLeave: false },
    { members: [otherOwner], owner: false, manager: false, canLeave: false },
  ])('projects owner=$owner, manager=$manager, canLeave=$canLeave for $members', ({ members, ...expected }) => {
    expect(chatGroupMembership({ serverBacked: true, members })).toMatchObject(expected);
  });
  it('does not infer a server permission for a legacy local group', () => {
    expect(chatGroupMembership({ members: [self, ownBot] })).toMatchObject({ owner: false, manager: false, canLeave: false });
  });
});

describe('execution failures are a projection of the current snapshot', () => {
  it('reconciles all loaded sources in bounded deduplicated requests', () => {
    const ids = Array.from({ length: 251 }, (_, n) => `source-${n}`);
    const batches = botGroupExecutionFailureBatches([...ids, ids[0], ids[250]]);
    expect(batches.map(batch => batch.length)).toEqual([100, 100, 51]);
    expect(batches.flat()).toEqual(ids);
    expect(botGroupExecutionFailureBatches([])).toEqual([]);
  });

  const source = { id: 'source', sequence: 4, kind: 'message', authorKind: 'user', authorBotId: null,
    authorName: 'Owner', content: 'Question', mentions: { all: false, botIds: [] }, noticeCode: null,
    planId: null, files: [], attachments: [], createdAt: 1 } as BotGroupMessageView;
  const failure: BotGroupExecutionFailureView = { executionId: 'run', epoch: 1, sourceMessageId: source.id,
    botId: 'bot', botName: 'Bot', code: 'AUTH_REQUIRED', planId: null };

  it('generates all failures beside the source after merging real pages', () => {
    const pages = mergeBotGroupMessages([source], [{ ...source, id: 'latest', sequence: 100 }]);
    expect(projectBotGroupExecutionFailures(pages, [failure, { ...failure, executionId: 'other' }]).map(item => item.id))
      .toEqual(['source', 'execution-failure:run:1', 'execution-failure:other:1', 'latest']);
    expect(pages.map(item => item.id)).toEqual(['source', 'latest']);
  });

  it('removes an old-page failure when the authorized snapshot clears it', () => {
    const pages = mergeBotGroupMessages([source], [{ ...source, id: 'latest', sequence: 100 }]);
    expect(projectBotGroupExecutionFailures(pages, [failure])).toHaveLength(3);
    expect(projectBotGroupExecutionFailures(pages, []).map(item => item.id)).toEqual(['source', 'latest']);
  });

  it('does not anchor a notice on a tombstone even if an older server returns that execution', () => {
    const deleted = { ...source, deleted: true };
    expect(projectBotGroupExecutionFailures([deleted], [failure])).toEqual([deleted]);
  });

  it('shows a new epoch and newly failed old source without reloading that message page', () => {
    expect(projectBotGroupExecutionFailures([source], [])).toEqual([source]);
    expect(projectBotGroupExecutionFailures([source], [{ ...failure, epoch: 2, code: 'QUOTA_EXCEEDED' }])[1])
      .toMatchObject({ id: 'execution-failure:run:2', runtimeFailureCode: 'QUOTA_EXCEEDED' });
    expect(projectBotGroupExecutionFailures([], [failure])).toEqual([]);
  });
});

describe('public failure snapshot decoder', () => {
  const row = { id: 'run', conversation_id: 'room', source_message_id: 'source', bot_id: 'bot', epoch: 2,
    plan_id: 'plan', updated_at: '2026-10-10T00:00:00Z', detail: 'private diagnostic' };
  it.each(BOT_GROUP_RUNTIME_FAILURE_CODES)('reads a new server snapshot without requiring legacy status: %s', code => {
    const view = readBotGroupExecutionFailure({ ...row, failure_code: code }, 'room');
    expect(view).toEqual({ executionId: 'run', epoch: 2, sourceMessageId: 'source', botId: 'bot', botName: '',
      code, planId: 'plan', updatedAt: Date.parse(row.updated_at) });
    expect(JSON.stringify(view)).not.toContain(row.detail);
  });
  it.each([{ status: 'running' }, { conversation_id: 'foreign' }, { epoch: NaN }, { epoch: -1 }, { source_message_id: null }])
    ('rejects inapplicable or malformed execution rows: %j', invalid => {
      expect(readBotGroupExecutionFailure({ ...row, ...invalid }, 'room')).toBeNull();
    });
  it('uses a fixed fallback for unknown categories and drops invalid timestamps', () => {
    expect(readBotGroupExecutionFailure({ ...row, failure_code: 'private diagnostic', updated_at: 'bad-date' }, 'room'))
      .toEqual({ executionId: 'run', epoch: 2, sourceMessageId: 'source', botId: 'bot', botName: '', code: 'RUNTIME_ERROR', planId: 'plan' });
  });
});

const plan = (overrides: Partial<BotGroupPlanView> = {}): BotGroupPlanView => ({
  id: 'p1', status: 'waiting', organizerBotId: 'a', organizerName: 'A', currentStep: 0, workDir: null, branch: null,
  createdAt: 1, updatedAt: 1,
  steps: [
    { position: 0, botId: 'a', botName: 'A', task: 'one', status: 'done' },
    { position: 1, botId: 'b', botName: 'B', task: 'two', status: 'pending' },
  ],
  ...overrides,
});

describe('bot group copy variants (shared by desktop and phone)', () => {
  it('speaks about a step for member notices inside a plan', () => {
    expect(botGroupNoticeVariant('member-joined', false)).toBe('memberJoined');
    expect(botGroupNoticeVariant('member-failed', false)).toBe('memberFailed');
    expect(botGroupNoticeVariant('member-failed', true)).toBe('stepFailed');
    expect(botGroupNoticeVariant('plan-stopped', true)).toBe('planStopped');
    expect(botGroupNoticeVariant(null, true)).toBeNull();
    // Untrusted codes from a newer host fall back to the message text.
    expect(botGroupNoticeVariant('toString' as BotGroupNoticeCode, false)).toBeNull();
  });

  it('names only the refusals the user can act on', () => {
    expect(botGroupErrorVariant('PLAN_OPEN')).toBe('planOpen');
    expect(botGroupErrorVariant('MENTION_UNAVAILABLE')).toBe('mentionUnavailable');
    expect(botGroupErrorVariant('INTERNAL')).toBeNull();
    expect(botGroupErrorVariant('constructor' as BotGroupErrorCode)).toBeNull();
    expect(botGroupErrorVariant(undefined)).toBeNull();
  });
});

describe('plan follow-up and composer state', () => {
  it('offers the next step after a finished one and a retry after a failed one', () => {
    expect(botGroupPlanFollowUp(plan())).toEqual({ kind: 'continue', next: plan().steps[1] });
    const failed = plan({ steps: [{ ...plan().steps[0]!, status: 'failed' }, plan().steps[1]!] });
    expect(botGroupPlanFollowUp(failed)).toEqual({ kind: 'retry', failed: failed.steps[0] });
    expect(botGroupPlanFollowUp(plan({ status: 'running' }))).toBeNull();
  });

  it('blocks a new 安排分工 while a plan runs or waits', () => {
    expect(isBotGroupDivisionBlocked(botGroupComposerPlanState(plan()))).toBe(true);
    expect(isBotGroupDivisionBlocked(botGroupComposerPlanState(plan({ status: 'proposed' })))).toBe(false);
    expect(botGroupComposerPlanState(plan())).toEqual({ kind: 'waiting', botName: 'A', stepDone: true });
  });
});
