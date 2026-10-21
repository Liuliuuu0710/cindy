import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { sniffMediaMime } from './sniffMediaMime.js';
import { isPathWithin } from './taskImageMarkdown.js';

/** Read through one handle, rejecting escapes and replacement during validation. */
export async function readTaskImage(
  source: string,
  roots: readonly string[],
  maxImageBytes = 20 * 1024 * 1024,
): Promise<{ buffer: Buffer; mimeType: string }> {
  // Reject Windows UNC / WebDAV / device namespaces before realpath can contact
  // a remote server. Apply to decoded paths too, independent of the host OS.
  if (/^[\\/]{2}|^[\\/]\?\?[\\/]/.test(source))
    throw new Error('task-image: network or device path');
  const real = await fs.realpath(source);
  if (!roots.some((root) => isPathWithin(root, real))) throw new Error('task-image: outside task');
  const handle = await fs.open(
    real,
    constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0),
  );
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.size <= 0 || before.size > maxImageBytes)
      throw new Error('task-image: invalid file');
    const checked = await fs.realpath(source);
    const named = await fs.stat(checked);
    if (
      checked !== real ||
      named.ino !== before.ino ||
      named.dev !== before.dev ||
      !roots.some((root) => isPathWithin(root, checked))
    )
      throw new Error('task-image: changed source');
    const buffer = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
      if (!bytesRead) throw new Error('task-image: truncated');
      offset += bytesRead;
    }
    const after = await handle.stat();
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs)
      throw new Error('task-image: changed source');
    const mimeType = sniffMediaMime(buffer);
    if (!mimeType?.startsWith('image/')) throw new Error('task-image: not an image');
    return { buffer, mimeType };
  } finally {
    await handle.close();
  }
}
