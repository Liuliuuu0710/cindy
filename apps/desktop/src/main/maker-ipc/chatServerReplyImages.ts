import fs from 'node:fs/promises';
import path from 'node:path';
import { parseBlobUrl, resolveSafe } from '../cindy-media/blobStore.js';
import { sessionCanRead } from '../cindy-media/ledger.js';
import { taskImageReferences, rewriteTaskImageReferences } from '../cindy-media/taskImageMarkdown.js';
import { resolveSafe as resolveLegacyImage } from '../imageCacheStore.js';
import { getDbClient } from '../localDb/client/current.js';
import type { BotGroupAttachment } from '../../shared/botGroupChat.js';
import { BOT_GROUP_ATTACHMENTS_MAX } from '../../shared/botGroupChat.js';

/** A missing/unauthorized local source cannot recover by renewing the execution lease. */
export class ChatReplyImageUnavailableError extends Error {
  constructor() { super('ATTACHMENT_UNAVAILABLE'); }
}

/** Only rendered images explicitly delivered in this reply, never tool history or code examples.
 * The returned text is publishable only AFTER these attachments have uploaded successfully.
 */
export async function prepareChatReplyImages(text: string, sessionId: string, assertCurrent: () => void) {
  const attachments: BotGroupAttachment[] = [];
  const replacements = new Map<string, string>();
  for (const ref of taskImageReferences(text)) {
    if (!/^(cindy-media|xdt-image):\/\//.test(ref.url) || replacements.has(ref.url)) continue;
    // Fail the whole reply before any upload; never silently truncate delivered images.
    if (attachments.length >= BOT_GROUP_ATTACHMENTS_MAX) throw new ChatReplyImageUnavailableError();
    assertCurrent();
    let resolved: { absPath: string; mimeType: string };
    if (ref.url.startsWith('cindy-media://')) {
      const blob = parseBlobUrl(ref.url);
      if (!blob || !await sessionCanRead(blob.hash, sessionId, getDbClient().drizzle))
        throw new ChatReplyImageUnavailableError();
      assertCurrent();
      resolved = resolveSafe(ref.url);
    } else {
      // Frozen task-local legacy images retain their existing safe resolver. A URL
      // into another task or a global legacy cache is not proof of ownership.
      try {
        if (decodeURIComponent(new URL(ref.url).hostname) !== sessionId)
          throw new ChatReplyImageUnavailableError();
        resolved = resolveLegacyImage(ref.url);
      } catch { throw new ChatReplyImageUnavailableError(); }
    }
    if (!resolved.mimeType.startsWith('image/')) throw new ChatReplyImageUnavailableError();
    const stat = await fs.stat(resolved.absPath).catch((error: NodeJS.ErrnoException) => {
      if (['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM'].includes(error.code ?? ''))
        throw new ChatReplyImageUnavailableError();
      throw error;
    });
    assertCurrent();
    if (!stat.isFile() || stat.size <= 0 || stat.size > 100 * 1024 * 1024)
      throw new ChatReplyImageUnavailableError();
    attachments.push({ id: ref.url, name: path.basename(resolved.absPath), category: 'image',
      mimeType: resolved.mimeType, size: stat.size, url: ref.url.startsWith('cindy-media://') ? ref.url : null,
      path: ref.url.startsWith('cindy-media://') ? null : resolved.absPath });
    replacements.set(ref.url, ref.url);
  }
  return { attachments, text: rewriteTaskImageReferences(text, replacements, image =>
    image.alt.replace(/[\\`*_{}[\]<>#!|]/g, '\\$&')) };
}
