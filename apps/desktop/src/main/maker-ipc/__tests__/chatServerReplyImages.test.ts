import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ stat: vi.fn(), canRead: vi.fn(), resolve: vi.fn(), legacy: vi.fn(), db: {} }));
vi.mock('node:fs/promises', () => ({ default: { stat: f.stat } }));
vi.mock('../../cindy-media/blobStore.js', async importOriginal => ({
  ...await importOriginal<typeof import('../../cindy-media/blobStore.js')>(), resolveSafe: f.resolve,
}));
vi.mock('../../cindy-media/ledger.js', () => ({ sessionCanRead: f.canRead }));
vi.mock('../../imageCacheStore.js', () => ({ resolveSafe: f.legacy }));
vi.mock('../../localDb/client/current.js', () => ({ getDbClient: () => ({ drizzle: f.db }) }));
import { prepareChatReplyImages } from '../chatServerReplyImages.js';

const hash = 'a'.repeat(64);
const url = `cindy-media://blobs/${hash}.png`;
const file = path.resolve('fixture-media', `${hash}.png`);
describe('ordinary group reply image delivery', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    f.canRead.mockResolvedValue(true);
    f.resolve.mockReturnValue({ absPath: file, mimeType: 'image/png' });
    f.legacy.mockReturnValue({ absPath: file, mimeType: 'image/png' });
    f.stat.mockResolvedValue({ isFile: () => true, size: 123 });
  });
  it('deduplicates rendered image references, keeps captions and surrounding Markdown', async () => {
    const result = await prepareChatReplyImages(`**Done**\n![Front](${url})\n![Again][photo]\n\n[photo]: ${url}`, 'lane', vi.fn());
    expect(result.attachments).toEqual([{ id: url, name: `${hash}.png`, category: 'image',
      mimeType: 'image/png', size: 123, url, path: null }]);
    expect(result.text).toBe('**Done**\nFront\nAgain\n\n');
    expect(f.canRead).toHaveBeenCalledExactlyOnceWith(hash, 'lane', f.db);
  });
  it('does not collect code examples, arbitrary paths, external images or unused definitions', async () => {
    const text = `\`![example](${url})\`\n\n\`\`\`md\n![example](${url})\n\`\`\`\n![web](https://example.test/p.png)\n![local](/private/image.png)\n\n[unused]: ${url}`;
    expect(await prepareChatReplyImages(text, 'lane', vi.fn())).toEqual({ text, attachments: [] });
    expect(f.canRead).not.toHaveBeenCalled();
    expect(f.stat).not.toHaveBeenCalled();
  });
  it('does not read an image belonging to another task', async () => {
    f.canRead.mockResolvedValue(false);
    await expect(prepareChatReplyImages(`![private](${url})`, 'lane', vi.fn())).rejects.toThrow('ATTACHMENT_UNAVAILABLE');
    expect(f.resolve).not.toHaveBeenCalled();
    expect(f.stat).not.toHaveBeenCalled();
  });
  it('rejects malformed managed URLs and non-image blobs', async () => {
    await expect(prepareChatReplyImages(`![bad](${url}?secret=1)`, 'lane', vi.fn())).rejects.toThrow('ATTACHMENT_UNAVAILABLE');
    f.resolve.mockReturnValue({ absPath: file, mimeType: 'video/mp4' });
    await expect(prepareChatReplyImages(`![video](cindy-media://blobs/${hash}.mp4)`, 'lane', vi.fn())).rejects.toThrow('ATTACHMENT_UNAVAILABLE');
    expect(f.stat).not.toHaveBeenCalled();
  });
  it('retains task-local legacy compatibility without borrowing another task cache', async () => {
    const legacy = 'xdt-image://lane/image.png';
    const result = await prepareChatReplyImages(`![old](${legacy})`, 'lane', vi.fn());
    expect(result.attachments[0]).toMatchObject({ path: file, url: null, mimeType: 'image/png' });
    expect(result.text).toBe('old');
    await expect(prepareChatReplyImages('![private](xdt-image://other/image.png)', 'lane', vi.fn())).rejects.toThrow('ATTACHMENT_UNAVAILABLE');
    expect(f.legacy).toHaveBeenCalledOnce();
  });
  it('stops after an owner or execution change during authorization', async () => {
    let active = true;
    f.canRead.mockImplementation(async () => { active = false; return true; });
    await expect(prepareChatReplyImages(`![image](${url})`, 'lane', () => {
      if (!active) throw new Error('STALE_EXECUTOR');
    })).rejects.toThrow('STALE_EXECUTOR');
    expect(f.stat).not.toHaveBeenCalled();
  });
  it('classifies a missing source as unavailable rather than a retryable transport failure', async () => {
    f.stat.mockRejectedValue(Object.assign(new Error('missing private path'), { code: 'ENOENT' }));
    await expect(prepareChatReplyImages(`![image](${url})`, 'lane', vi.fn())).rejects.toThrow('ATTACHMENT_UNAVAILABLE');
  });
});
