import { createIpcError } from '../../../shared/ipc-errors';
import { extractIpcError } from '../../../shared/ipcError';

// Match localDb/ipc/bots.ts readText: trimmed UTF-16 length, never truncate a draft.
export const BOT_PROFILE_TEXT_LIMITS = {
  name: 200,
  description: 12000,
  identitySource: 12000,
} as const;

export type BotProfileTextField = keyof typeof BOT_PROFILE_TEXT_LIMITS;

export function botProfileTextTooLong(field: BotProfileTextField, value: string): boolean {
  return value.trim().length > BOT_PROFILE_TEXT_LIMITS[field];
}

export function validateBotProfileText(draft: Record<BotProfileTextField, string>): void {
  if (
    Object.keys(BOT_PROFILE_TEXT_LIMITS).some((field) =>
      botProfileTextTooLong(field as BotProfileTextField, draft[field as BotProfileTextField]),
    )
  ) {
    throw createIpcError('INVALID_PARAMS', 'Profile text exceeds its limit');
  }
}

/** Whitelisted messages only: IPC exceptions can contain private paths or payloads. */
export function botProfileSaveFeedback(error: unknown): { key: string; retry: boolean } {
  switch (extractIpcError(error)?.code) {
    case 'ALREADY_EXISTS':
      return { key: 'bots.guided.duplicateName', retry: false };
    case 'INVALID_PARAMS':
      return { key: 'bots.autosave.invalidSettings', retry: false };
    case 'NOT_FOUND':
      return { key: 'bots.autosave.notFound', retry: false };
    case 'PRECONDITION_FAILED':
      return { key: 'bots.autosave.preconditionFailed', retry: false };
    default:
      return { key: 'bots.autosave.saveFailed', retry: true };
  }
}
