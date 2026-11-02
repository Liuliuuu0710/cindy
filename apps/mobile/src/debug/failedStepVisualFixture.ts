import { BOT_GROUP_CHAT_PRIMITIVE, BOT_GROUP_REMOTE_COLLECTION_ID, BOT_GROUP_REMOTE_RESOURCE_KIND } from '@cindy/maker-shared/botGroupChat';

/** Synthetic failed work for the existing --mock native/browser preview. */
export function failedStepVisualFixture(channel: string, args: unknown[], now: number): unknown {
  const request = args[0] as { ref?: { collectionId?: string; id?: string } } | undefined;
  const id = request?.ref?.id;
  if (channel !== 'maker:remote-resources:get' || request?.ref?.collectionId !== BOT_GROUP_REMOTE_COLLECTION_ID
    || !id?.startsWith('visual-failed-step')) return undefined;
  const members = [
    { botId: 'cindy-default', name: 'Cindy', status: 'active', actorKind: 'bot' },
    { botId: 'visual-bot-dash', name: 'Dash', status: 'active', actorKind: 'bot' },
  ];
  const plan = {
    id: 'failed-plan', kind: 'work', status: 'waiting', canManage: true,
    organizerBotId: 'cindy-default', organizerName: 'Cindy', currentStep: 1,
    workDir: null, branch: null, createdAt: now, updatedAt: now,
    steps: [
      { position: 0, botId: 'cindy-default', botName: 'Cindy', task: '整理已经完成的改动', status: 'done', resultMessageId: null },
      { position: 1, botId: 'visual-bot-dash', botName: 'Dash', task: '核对结果并补齐发版说明', status: 'failed', resultMessageId: null },
    ],
  };
  const group = {
    id, name: '失败步骤验收 · 示例数据', members: id.endsWith('no-candidates') ? members.slice(1) : members,
    createdAt: now, updatedAt: now, plans: [plan],
    openPlan: { id: plan.id, status: 'waiting', currentStep: 1, stepCount: 2, currentBotName: 'Dash', currentStepStatus: 'failed' },
    round: { status: 'idle', speakers: [], canContinue: false },
    messages: [{ id: 'failed-plan-card', sequence: 1, kind: 'plan', planId: plan.id,
      authorKind: 'bot', authorBotId: 'cindy-default', authorName: 'Cindy', content: '', createdAt: now }],
  };
  return {
    ref: { collectionId: BOT_GROUP_REMOTE_COLLECTION_ID, kind: BOT_GROUP_REMOTE_RESOURCE_KIND, id },
    revision: 'failed-step-preview-1', display: { title: group.name }, actions: [], links: [],
    blocks: [{ id: 'chat', primitive: BOT_GROUP_CHAT_PRIMITIVE, fallbackMarkdown: group.name, data: group }],
  };
}
