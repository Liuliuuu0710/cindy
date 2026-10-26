import { mountPage, subscription } from '../../ui-page/harness';
import { BotTaskCollaboration } from '../../../src/renderer/features/bots/BotTaskCollaboration';
import { TaskDeliveryReceipt } from '../../../src/renderer/components/chat/TaskDeliveryReceipt';
import type { Session } from '../../../src/renderer/lib/ccAgent.types';

const session = { id: 'fixture-task', status: 'active', source: 'desktop' } as Session;
mountPage({
  host: (ctx) => ({
    localDb: { bots: { workbench: { followScopes: async () => [
      { botId: 'editor', sessionIds: [session.id], responsibilityRoles: { [session.id]: 'modify' } },
      { botId: 'verifier', sessionIds: [session.id], responsibilityRoles: { [session.id]: ctx.case === 'conflict' ? 'modify' : 'verify' } },
      { botId: 'legacy', sessionIds: [session.id], delegatedSessionIds: [session.id] },
    ] } } },
    maker: { onBotWorkbenchChanged: subscription('responsibility'), onBotDelegationChanged: subscription('delegation') },
  }),
  render: (ctx) => {
    const outcomes = ctx.case === 'conflict'
      ? [{ ok: false, errorCode: 'HOST_NOT_READY' }, { ok: true, task_id: 'different-task', delivery: 'started' }]
      : [{ ok: true, task_id: session.id, delivery: 'queued' }, { ok: true, task_id: session.id, delivery: 'started' }];
    return <main className="mx-auto w-full max-w-xl space-y-5 p-4">
      <BotTaskCollaboration session={session} />
      {outcomes.map((result, index) => <TaskDeliveryReceipt key={index}
        toolName="mcp__cindy_helper__call_tool" input={{ name: 'continue_workbench_task', args: { task_id: session.id } }}
        result={JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(result) }] })} running={false} />)}
      <TaskDeliveryReceipt toolName="mcp__cindy_helper__call_tool"
        input={{ name: 'set_workbench_task_responsibility', args: { task_id: session.id, responsible: true, role: 'verify' } }}
        result={JSON.stringify({ ok: true, task_id: session.id, responsible: true, role: 'verify' })} running={false} />
    </main>;
  },
});
