// @vitest-environment jsdom
/**
 * 测试价值
 * - 生产入口与可观察结果：手机伙伴近况的两份数据——「输出内容」列哪些文件（companionGlanceOutputs），
 *   「待办」能否读到宿主第一页（25 条）之后的条目（useCompanionGlanceTodos）。
 * - Bug／规则依据：docs/product-rules/cindy-bots-runtime.md「伙伴近况」；桌面同一入口在 #6681 review 中
 *   被指出只读一页时第 26 条之后看不到、引用不了、删不掉；模拟器目检发现 Hermes 没有 Intl.RelativeTimeFormat，
 *   今天到期的待办让近况整块渲染报错。
 * - 现有覆盖缺口：新入口；顶栏测试只验证打开近况，不覆盖数据。
 * - 最小失败输入：30 条未完成待办；一份含成品、源码、已删文件的完成委派与一份失败委派。
 * - tier：unit（jsdom 驱动真实 hook，device-link 用内存 fake）。
 */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { todoDateLabel, todoLocalDate, type TeammateTodo } from '@cindy/maker-shared/teammate-todo';

const h = vi.hoisted(() => ({ items: [] as unknown[], reads: [] as Array<Record<string, unknown>>, openURL: vi.fn(async () => undefined) }));
vi.mock('react-native', async () => {
  const { createElement } = await import('react');
  return {
    AppState: { addEventListener: () => ({ remove: () => undefined }) },
    View: ({ children }: { children: React.ReactNode }) => createElement('div', {}, children),
    Pressable: ({ children, onPress, accessibilityRole }: { children: React.ReactNode; onPress(): void; accessibilityRole: string }) => createElement('button', { onClick: onPress, role: accessibilityRole }, children),
    Linking: { openURL: h.openURL }, StyleSheet: { create: (value: unknown) => value },
  };
});
vi.mock('@/components/AppText', () => ({ Text: ({ children }: { children: React.ReactNode }) => createElement('span', {}, children) }));
vi.mock('@/theme', () => ({
  useThemedStyles: (factory: (colors: unknown) => unknown) => factory({ textPrimary: 'black', textSecondary: 'gray', textTertiary: 'gray' }),
  spacing: { lg: 16, sm: 8, xs: 4 }, typeScale: { footnote: 13, caption: 12, body: 16 }, lineHeight: { caption: 18, body: 22 },
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (s: string, values?: Record<string, string>) => `${s}${values?.step ?? values?.time ?? ''}`, i18n: { language: 'en' } }) }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: async () => null, setItem: async () => undefined } }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u' }, accountGeneration: 1 }) }));
// Stable like the real context: new functions per render would re-run the read effect forever.
const link = vi.hoisted(() => ({ invoke: () => undefined, openLink: async () => undefined, onRemoteResourceChanged: () => () => undefined }));
vi.mock('@/device-link/DeviceLinkContext', () => ({ useDeviceLink: () => link }));
vi.mock('@/device-link/remoteResources', () => ({
  invokeRemoteResourceAction: vi.fn(),
  getRemoteResource: async (_invoke: unknown, _target: unknown, _ref: unknown, _locale: unknown, _primitives: unknown, query: string) => {
    const q = JSON.parse(query) as { view: string; offset: number; limit: number };
    h.reads.push(q);
    const matching = h.items.filter(item => (item as { status: string }).status === (q.view === 'done' ? 'done' : 'open'));
    return { blocks: [{ primitive: 'teammate-todos', data: { items: matching.slice(q.offset, q.offset + q.limit), total: matching.length } }] };
  },
}));
vi.mock('@/session/useRemoteCompanionQuery', () => ({ useRemoteCompanionQuery: () => ({ value: null }) }));

const { useCompanionGlanceTodos } = await import('@/session/useCompanionGlanceTodos');
const { companionGlanceOutputs } = await import('@/session/companionProfileData');
const { CompanionTodoProgress } = await import('@/session/CompanionTodoProgress');

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let container: HTMLDivElement;
beforeEach(() => { h.items = []; h.reads = []; container = document.createElement('div'); root = createRoot(container); });
afterEach(() => act(() => root.unmount()));

const todo = (id: string, status = 'open') => ({ id, status, title: id, revision: 1, sources: [], history: [] }) as unknown as TeammateTodo;

// #6966: the real mobile disclosure must reveal recorded evidence without quoting/sending,
// and surface a link-open failure. Existing tests covered reads only, not this UI (unit).
it('shows pending acceptance and opens only recorded HTTPS evidence, with a visible link failure', async () => {
  const item = { ...todo('reading'), progress: 'CI passed; phone acceptance pending',
    next: { label: 'Check on a phone', kind: 'advance', instruction: 'MODEL ONLY' },
    updatedAt: '2026-10-26T02:24:00Z', associations: [{ kind: 'pr', id: 'opaque', label: 'Reading PR' }],
    sources: [{ kind: 'github', id: 'opaque', label: 'CI evidence', ref: 'https://example.test/ci', observedAt: '2026-10-26T02:23:00Z' }],
  } as TeammateTodo;
  await act(async () => root.render(createElement(CompanionTodoProgress, { todo: item })));
  expect(container.textContent).toContain('Check on a phone');
  expect(container.querySelector('[role="link"]')).toBeNull();
  await act(async () => container.querySelector('button')!.click());
  expect(container.textContent).toContain('CI evidence');
  expect(container.textContent).toContain('Reading PR');
  expect(container.textContent).not.toContain('MODEL ONLY');
  h.openURL.mockRejectedValueOnce(new Error('offline'));
  await act(async () => container.querySelector<HTMLButtonElement>('[role="link"]')!.click());
  expect(h.openURL).toHaveBeenCalledWith('https://example.test/ci');
  expect(container.textContent).toContain('devices.glance.openLinkFailed');
});

it('reads every page of open todos, not just the host first page of 25', async () => {
  h.items = Array.from({ length: 30 }, (_, index) => todo(`o${index}`));
  let latest: ReturnType<typeof useCompanionGlanceTodos> | null = null;
  function Probe() { latest = useCompanionGlanceTodos({ deviceId: 'pc', deviceName: 'PC', botId: 'bot', enabled: true }); return null; }
  await act(async () => root.render(createElement(Probe)));
  await act(async () => { await Promise.resolve(); });
  expect(latest!.todos.open).toHaveLength(30);
  expect(latest!.todos.openTotal).toBe(30);
  expect(h.reads.filter(read => read.view === 'open').map(read => read.offset)).toEqual([0, 25]);
});

it('keeps the newest completed todos past the 200 cap', async () => {
  h.items = Array.from({ length: 230 }, (_, index) => todo(`d${String(index).padStart(3, '0')}`, 'done'));
  let latest: ReturnType<typeof useCompanionGlanceTodos> | null = null;
  function Probe() { latest = useCompanionGlanceTodos({ deviceId: 'pc', deviceName: 'PC', botId: 'bot', enabled: true }); return null; }
  await act(async () => root.render(createElement(Probe)));
  await act(async () => { await Promise.resolve(); });
  const done = latest!.todos.done;
  expect(done).toHaveLength(200);
  expect(done[0].id).toBe('d229');
  expect(done.some(item => item.id === 'd029')).toBe(false);
  expect(latest!.todos.doneTotal).toBe(230);
});

it("lists only this teammate's finished deliverables, newest first, each opening its source task", () => {
  const outputs = companionGlanceOutputs({
    ok: true,
    delegations: [
      { id: 'd1', requestingBotId: 'bot', status: 'completed', title: 'Weekly report', childSessionId: 'c1', completedAt: 2, updatedAt: 2,
        artifacts: [{ path: 'out/report.docx', status: 'added' }, { path: 'src/app.ts', status: 'modified' }, { path: 'old.pdf', status: 'deleted' }] },
      { id: 'd2', requestingBotId: 'bot', status: 'completed', title: 'Deck', childSessionId: 'c2', completedAt: 5, updatedAt: 5,
        artifacts: [{ path: 'deck.pptx', status: 'added' }, { path: 'previews/shot.png', status: 'added' }] },
      { id: 'd3', requestingBotId: 'bot', status: 'failed', title: 'x', childSessionId: 'c3', completedAt: 9, updatedAt: 9,
        artifacts: [{ path: 'fail.pdf', status: 'added' }] },
      { id: 'd4', requestingBotId: 'other', status: 'completed', title: 'y', childSessionId: 'c4', completedAt: 9, updatedAt: 9,
        artifacts: [{ path: 'theirs.pdf', status: 'added' }] },
    ],
  } as never, 'bot');
  expect(outputs.map(file => [file.name, file.childSessionId])).toEqual([['deck.pptx', 'c2'], ['report.docx', 'c1']]);
});

it('labels a todo due today with its date where the engine has no relative-time formatting (Hermes)', () => {
  const original = Intl.RelativeTimeFormat;
  const today = todoLocalDate(new Date(), 'UTC');
  const due = { ...todo('t'), sourceDeadline: { kind: 'date', date: today, timeZone: 'UTC' }, deadlineOverride: null } as unknown as TeammateTodo;
  try {
    (Intl as { RelativeTimeFormat?: unknown }).RelativeTimeFormat = undefined;
    expect(todoDateLabel(due, 'zh-CN')).toBe(new Intl.DateTimeFormat('zh-CN', { timeZone: 'UTC', month: 'numeric', day: 'numeric' })
      .format(new Date(`${today}T12:00:00Z`)));
  } finally {
    (Intl as { RelativeTimeFormat?: unknown }).RelativeTimeFormat = original;
  }
});
