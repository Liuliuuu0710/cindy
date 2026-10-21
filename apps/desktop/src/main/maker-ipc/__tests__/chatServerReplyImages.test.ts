import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ stat: vi.fn(), canRead: vi.fn(), resolve: vi.fn(), legacy: vi.fn(), materialize: vi.fn(), db: {} }));
vi.mock('../../cindy-media/taskImageDelivery.js', () => ({ materializeTaskImageTextResult: f.materialize }));
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
  it('accepts 20 distinct images and rejects 21 instead of dropping images', async () => {
    const images = Array.from({ length: 21 }, (_, i) => `![image](cindy-media://blobs/${i.toString(16).padStart(64, '0')}.png)`);
    expect((await prepareChatReplyImages(images.slice(0, 20).join('\n'), 'lane', vi.fn())).attachments).toHaveLength(20);
    await expect(prepareChatReplyImages(images.join('\n'), 'lane', vi.fn())).rejects.toThrow('ATTACHMENT_UNAVAILABLE');
  });
  beforeEach(() => {
    vi.resetAllMocks();
    f.canRead.mockResolvedValue(true);
    f.resolve.mockReturnValue({ absPath: file, mimeType: 'image/png' });
    f.legacy.mockReturnValue({ absPath: file, mimeType: 'image/png' });
    f.stat.mockResolvedValue({ isFile: () => true, size: 123 });
    f.materialize.mockImplementation(async (_sessionId: string, text: string) => ({ text, failures: [], replacements: new Map() }));
  });
  it('deduplicates rendered image references, keeps captions and surrounding Markdown', async () => {
    const result = await prepareChatReplyImages(`**Done**\n![Front](${url})\n![Again][photo]\n\n[photo]: ${url}`, 'lane', vi.fn());
    expect(result.attachments).toEqual([{ id: url, name: `${hash}.png`, category: 'image',
      mimeType: 'image/png', size: 123, url, path: null }]);
    expect(result.text).toBe('**Done**\nFront\nAgain\n\n');
    expect(f.canRead).toHaveBeenCalledExactlyOnceWith(hash, 'lane', f.db);
  });
  it('does not collect code examples, external images or unused definitions', async () => {
    const text = `\`![example](${url})\`\n\n\`\`\`md\n![example](${url})\n\`\`\`\n![web](https://example.test/p.png)\n\n[unused]: ${url}`;
    expect(await prepareChatReplyImages(text, 'lane', vi.fn())).toEqual({ text, attachments: [] });
    expect(f.canRead).not.toHaveBeenCalled();
    expect(f.stat).not.toHaveBeenCalled();
    expect(f.materialize).not.toHaveBeenCalled();
  });
  it.each(['xdt-image:///task/image.png', path.resolve('task', 'image.png')])('imports task-scoped images before checking ownership: %s', async source => {
    const text = `Done\n![Preview](${source})`;
    f.materialize.mockResolvedValue({ text: `Done\n![Preview](${url})`, failures: [], replacements: new Map([[source, url]]) });
    const result = await prepareChatReplyImages(text, 'lane', vi.fn());
    expect(f.materialize).toHaveBeenCalledExactlyOnceWith('lane', text);
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0]).toMatchObject({ url, path: null });
    expect(result.text).toBe('Done\nPreview');
    expect(f.canRead).toHaveBeenCalledExactlyOnceWith(hash, 'lane', f.db);
    expect(f.legacy).not.toHaveBeenCalled();
  });
  it.each(['xdt-image:///outside/image.png', path.resolve('outside', 'image.png')])('rejects local images the task importer cannot authorize: %s', async source => {
    await expect(prepareChatReplyImages(`![private](${source})`, 'lane', vi.fn())).rejects.toThrow('ATTACHMENT_UNAVAILABLE');
    expect(f.legacy).not.toHaveBeenCalled();
    expect(f.stat).not.toHaveBeenCalled();
  });
  it('stops before media authorization when execution changes during import', async () => {
    let active = true;
    f.materialize.mockImplementation(async () => {
      active = false;
      return { text: `![Preview](${url})`, failures: [], replacements: new Map() };
    });
    await expect(prepareChatReplyImages('![Preview](xdt-image:///task/image.png)', 'lane', () => {
      if (!active) throw new Error('STALE_EXECUTOR');
    })).rejects.toThrow('STALE_EXECUTOR');
    expect(f.canRead).not.toHaveBeenCalled();
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
  it.each(['ELOOP', 'ENAMETOOLONG'])('fails a legacy image on permanent stat error %s', async code => {
    f.stat.mockRejectedValue(Object.assign(new Error('private cache path'), { code, syscall: 'stat' }));
    await expect(prepareChatReplyImages('![old](xdt-image://lane/image.png)', 'lane', vi.fn()))
      .rejects.toThrow('ATTACHMENT_UNAVAILABLE');
  });
  it.each(['EBUSY', 'EIO'])('preserves transient stat error %s for delivery retries', async code => {
    const error = Object.assign(new Error('temporary disk failure'), { code, syscall: 'stat' });
    f.stat.mockRejectedValue(error);
    await expect(prepareChatReplyImages('![old](xdt-image://lane/image.png)', 'lane', vi.fn())).rejects.toBe(error);
  });
});
