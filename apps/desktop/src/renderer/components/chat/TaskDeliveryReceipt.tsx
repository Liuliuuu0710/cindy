import { parseToolName } from '@cindy/maker-shared';
import { useTranslation } from 'react-i18next';

type ReceiptState = 'queued' | 'started' | 'sent' | 'failed' | 'unknown' | 'modify' | 'verify' | 'claimed' | 'released';

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/** Only the helper's structured result (or one MCP text envelope), never assistant prose. */
function payload(text: string): Record<string, unknown> | null {
  if (text.length > 256_000) return null;
  try {
    const outer = record(JSON.parse(text));
    if (typeof outer?.ok === 'boolean') return outer.isError === true && outer.ok ? null : outer;
    if (!Array.isArray(outer?.content) || outer.content.length !== 1) return null;
    const block = record(outer.content[0]);
    if (block?.type !== 'text' || typeof block.text !== 'string') return null;
    const inner = record(JSON.parse(block.text));
    if (outer.isError === true && inner?.ok !== false) return null;
    return typeof inner?.ok === 'boolean' ? inner : null;
  } catch { return null; }
}

export function TaskDeliveryReceipt({ toolName, input, result, running }: {
  toolName: string; input: Record<string, unknown> | null; result: string; running: boolean;
}) {
  const { t } = useTranslation();
  const parsed = parseToolName(toolName);
  const server = parsed.kind === 'mcp' ? parsed.server : parsed.kind === 'dynamic' ? parsed.namespace : undefined;
  if (!server || !['cindy_helper', 'lizi_xdtHelper'].includes(server) || (parsed.kind !== 'mcp' && parsed.kind !== 'dynamic')) return null;
  const name = parsed.tool === 'call_tool' ? input?.name : parsed.tool;
  const args = parsed.tool === 'call_tool' ? record(input?.args) : input;
  if (!['send_to_session', 'continue_workbench_task', 'set_workbench_task_responsibility'].includes(String(name))) return null;
  // Creation is a separate flow. This receipt concerns an existing task only.
  const requestedTask = name === 'send_to_session' ? args?.target_session_id : args?.task_id;
  if (typeof requestedTask !== 'string' || !requestedTask.trim() || running) return null;
  const data = payload(result);
  let state: ReceiptState = 'unknown';
  const responsibility = name === 'set_workbench_task_responsibility';
  const returnedTask = responsibility || name === 'continue_workbench_task' ? data?.task_id : data?.target_session_id;
  // Match the request as the tool resolves it: send_to_session strips only its
  // local:: alias, while workbench tools trim outer whitespace. Keep remote
  // device prefixes intact and require the Host's returned canonical ID exactly.
  const localPrefix = 'local::';
  const expectedTask = name === 'send_to_session'
    ? requestedTask.startsWith(localPrefix) && requestedTask.length > localPrefix.length
      ? requestedTask.slice(localPrefix.length)
      : requestedTask
    : requestedTask.trim();
  // Do not attach a success acknowledgement for a different target to this request.
  if (data?.ok === false) state = 'failed';
  else if (data?.ok === true && returnedTask === expectedTask) {
    if (responsibility && data.responsible === args?.responsible
      && (data.role === undefined || args?.role === undefined || data.role === args.role)) {
      if (data.responsible === false) state = 'released';
      else if (data.responsible === true) state = data.role === 'modify' || data.role === 'verify' ? data.role : 'claimed';
    } else if (!responsibility) {
      const delivery = name === 'send_to_session' ? data.wake_kind : data.delivery;
      if (delivery === 'queued') state = 'queued';
      else if (delivery === 'started' || delivery === 'resumed') state = 'started';
      else if (delivery === 'already-active') state = 'sent';
    }
  }
  return (
    <div data-task-delivery-receipt={state} className="min-w-0 space-y-0.5 px-2 pb-1 pl-[30px] text-12 leading-relaxed text-[var(--text-secondary)]">
      <p>{t('chat.taskDeliveryReceipt.title')} · {t(`chat.taskDeliveryReceipt.${state}`)}</p>
      <p className="break-all">{t('chat.taskDeliveryReceipt.task', { id: requestedTask })}</p>
      <p>{t(`chat.taskDeliveryReceipt.${responsibility ? 'responsibilityNote' : 'deliveryNote'}`)}</p>
    </div>
  );
}
