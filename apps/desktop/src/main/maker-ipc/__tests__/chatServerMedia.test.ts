import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const f = vi.hoisted(() => ({ fetch: vi.fn(), read: vi.fn(), ingest: vi.fn(), root: '' }));
vi.mock('electron', () => ({ net: { fetch: f.fetch } }));
vi.mock('../../cindy-media/blobStore.js', () => ({ readFile: f.read, supportedMime: () => true }));
vi.mock('../../imageCacheStore.js', () => ({
  getCacheRoot: () => f.root,
  resolveSafe: (url: string) => ({ absPath: path.join(f.root, new URL(url).hostname, path.basename(new URL(url).pathname)), mimeType: 'image/png' }),
}));
vi.mock('../../cindy-media/ingest.js', () => ({ ingestMedia: f.ingest }));
vi.mock('../../localDb/client/current.js', () => ({ getDbClient: () => ({ drizzle: {} }) }));
vi.mock('../../appSessionState.js', () => ({ ownerScopedUserDataPath: () => '/unused-test-owner' }));
vi.mock('../botGroupAttachments.js', () => ({ safeAttachmentFileName: (name: string) => name }));
import { createChatMedia } from '../chatServerMedia.js';
import { ChatMediaSourceUnavailableError } from '../chatServerErrors.js';
import type { ChatApi } from '../chatServerMigration.js';
import type { BotGroupAttachment } from '../../../shared/botGroupChat.js';
const attachment: BotGroupAttachment = { id: 'file', name: 'picture.png', category: 'image', mimeType: 'image/png', size: 3, url: 'cindy-media://test', path: null };

describe('chat private media', () => {
  // PR #6644: actual filesystem escapes and check/open replacement must fail
  // before a private byte reaches prepare or PUT. All files stay in one temp tree.
  it.each(['leaf-link', 'session-link', 'leaf-swap', 'parent-swap'])('refuses a legacy cache escape: %s', async scenario => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'cindy-reply-legacy-'));
    f.root = path.join(temp, 'cache');
    const lane = path.join(f.root, 'lane');
    const outside = path.join(temp, 'outside');
    await fs.mkdir(lane, { recursive: true }); await fs.mkdir(outside);
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 42]);
    await fs.writeFile(path.join(outside, 'image.png'), bytes);
    const source = path.join(lane, 'image.png');
    await fs.writeFile(source, bytes);
    // Probe native symlink support; unsupported hosts keep the ordinary file test.
    try {
      if (scenario.startsWith('leaf')) await fs.symlink(path.join(outside, 'image.png'), path.join(temp, 'probe'));
      else await fs.symlink(outside, path.join(temp, 'probe'), 'junction');
    }
    catch (error) { if (['EPERM', 'EACCES', 'ENOTSUP'].includes((error as NodeJS.ErrnoException).code ?? '')) { await fs.rm(temp, { recursive: true, force: true }); return; } throw error; }
    const originalOpen = fs.open.bind(fs);
    let restoreOpen: (() => void) | undefined;
    const swap = async () => {
      if (scenario.startsWith('leaf')) { await fs.unlink(source); await fs.symlink(path.join(outside, 'image.png'), source); }
      else { await fs.rename(lane, path.join(f.root, 'old-lane')); await fs.symlink(outside, lane, 'junction'); }
    };
    const api = vi.fn().mockResolvedValue({ id: 'media', uploadUrl: 'https://upload.example.test/signed' }) as unknown as ChatApi;
    f.fetch.mockClear().mockResolvedValue(new Response(''));
    try {
      if (scenario.endsWith('link')) await swap();
      else {
        const open = vi.spyOn(fs, 'open').mockImplementationOnce(async (...args) => { await swap(); return originalOpen(...args); });
        restoreOpen = () => { open.mockRestore(); };
      }
      await expect(createChatMedia(api, () => true).upload('room', 'reply', [{ ...attachment,
        id: 'xdt-image://lane/image.png', url: null, path: source, size: bytes.length }], 'bot'))
        .rejects.toBeInstanceOf(ChatMediaSourceUnavailableError);
      expect(api).not.toHaveBeenCalled(); expect(f.fetch).not.toHaveBeenCalled();
    } finally { restoreOpen?.(); await fs.rm(temp, { recursive: true, force: true }); }
  });
  it.each([
    { bytes: Buffer.from('not an image'), mime: null },
    { bytes: Buffer.from('OggS audio'), mime: null },
    { bytes: Buffer.from([0xff, 0xd8, 0xff, 42]), mime: 'image/jpeg' },
  ])('validates and uploads the same legacy bytes as $mime', async ({ bytes, mime }) => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'cindy-reply-legacy-'));
    f.root = path.join(temp, 'cache');
    const lane = path.join(f.root, 'lane'); await fs.mkdir(lane, { recursive: true });
    const source = path.join(lane, 'image.png'); await fs.writeFile(source, bytes);
    const api = vi.fn().mockResolvedValue({ id: 'media', uploadUrl: 'https://upload.example.test/signed' }) as unknown as ChatApi;
    f.fetch.mockClear().mockResolvedValue(new Response(''));
    try {
      const upload = createChatMedia(api, () => true).upload('room', 'reply', [{ ...attachment,
        id: 'xdt-image://lane/image.png', url: null, path: source, size: bytes.length }], 'bot');
      if (!mime) {
        await expect(upload).rejects.toBeInstanceOf(ChatMediaSourceUnavailableError);
        expect(api).not.toHaveBeenCalled(); expect(f.fetch).not.toHaveBeenCalled();
      } else {
        await upload;
        expect(api).toHaveBeenCalledWith('/conversations/room/media', 'POST', expect.objectContaining({ type: mime, size: bytes.length }), 'bot');
        expect(f.fetch).toHaveBeenCalledWith('https://upload.example.test/signed', expect.objectContaining({ headers: { 'Content-Type': mime }, body: new Uint8Array(bytes) }));
      }
    } finally { await fs.rm(temp, { recursive: true, force: true }); }
  });
  it.each(['http://upload.example.test/signed', 'broken', undefined])('rejects invalid signed upload URL %s before PUT', async uploadUrl => {
    f.read.mockResolvedValueOnce({ buffer: Buffer.from('png') }); f.fetch.mockClear();
    const api = vi.fn().mockResolvedValue({ id: 'media', uploadUrl }) as unknown as ChatApi;
    await expect(createChatMedia(api, () => true).upload('room', 'reply', [attachment], 'bot')).rejects.toMatchObject({ message: 'INVALID_MEDIA_URL' });
    expect(f.fetch).not.toHaveBeenCalled();
  });
  it('fails a legacy image whose stat succeeds but bytes cannot be read', async () => {
    const stat = vi.spyOn(fs, 'stat').mockResolvedValueOnce({ isFile: () => true, size: 3 } as Awaited<ReturnType<typeof fs.stat>>);
    const read = vi.spyOn(fs, 'readFile').mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'EACCES' }));
    const api = vi.fn() as unknown as ChatApi;
    try {
      await expect(createChatMedia(api, () => true).upload('room', 'reply', [{ ...attachment, url: null, path: '/fixture/image.png' }], 'bot'))
        .rejects.toMatchObject({ code: 'EACCES', message: 'ATTACHMENT_UNAVAILABLE' });
      expect(stat).toHaveBeenCalledOnce();
      expect(read).toHaveBeenCalledOnce();
      expect(api).not.toHaveBeenCalled();
    } finally { stat.mockRestore(); read.mockRestore(); }
  });
  it('does not classify a transport-stage error as an unavailable local source', async () => {
    f.read.mockResolvedValueOnce({ buffer: Buffer.from('png') });
    const error = Object.assign(new Error('transport denied'), { code: 'EACCES' });
    const api = vi.fn().mockRejectedValue(error) as unknown as ChatApi;
    await expect(createChatMedia(api, () => true).upload('room', 'reply', [attachment], 'bot')).rejects.toBe(error);
  });
  it.each(['EACCES', 'EPERM', 'ENOENT', 'ENOTDIR', 'ELOOP', 'ENAMETOOLONG'])('classifies a managed image byte read failure %s before uploading', async code => {
    f.read.mockRejectedValueOnce(Object.assign(new Error('private source'), { code }));
    const api = vi.fn() as unknown as ChatApi;
    await expect(createChatMedia(api, () => true).upload('room', 'reply', [attachment], 'bot'))
      .rejects.toBeInstanceOf(ChatMediaSourceUnavailableError);
    expect(api).not.toHaveBeenCalled();
  });
  it.each(['EBUSY', 'EIO'])('keeps transient byte read error %s retryable', async code => {
    const error = Object.assign(new Error('temporary source failure'), { code, syscall: 'read' });
    f.read.mockRejectedValueOnce(error);
    const api = vi.fn() as unknown as ChatApi;
    await expect(createChatMedia(api, () => true).upload('room', 'reply', [attachment], 'bot')).rejects.toBe(error);
    expect(api).not.toHaveBeenCalled();
  });
  it('lets an independent recipient download and reopen the uploaded image without the sender cache', async () => {
    const bytes = Buffer.from('generated-image-fixture');
    let stored: Uint8Array | undefined;
    let sealed = false;
    let joined = true;
    f.read.mockResolvedValue({ buffer: bytes });
    f.fetch.mockImplementation(async (_url, options) => {
      if (options?.method === 'PUT') { stored = options.body; return new Response(''); }
      if (!sealed || !stored) throw new Error('NOT_SEALED');
      return new Response(new Uint8Array(stored));
    });
    f.ingest.mockImplementation(async input => {
      expect(input.buffer).toEqual(bytes);
      return { url: 'cindy-media://recipient-copy' };
    });
    const senderApi = vi.fn(async (route: string) => {
      if (route.endsWith('/complete')) { sealed = true; return {}; }
      return { id: 'shared-image', uploadUrl: 'https://objects.example.test/upload' };
    }) as unknown as ChatApi;
    const receiverApi = vi.fn(async () => {
      if (!joined) throw new Error('CONVERSATION_NOT_FOUND');
      return { name: 'picture.png', type: 'image/png', size: bytes.length, url: 'https://objects.example.test/download' };
    }) as unknown as ChatApi;
    const blocks = await createChatMedia(senderApi, () => true).upload('room', 'reply', [{ ...attachment, size: bytes.length }], 'sender-bot');
    expect(blocks).toEqual([{ type: 'media', mediaId: 'shared-image', caption: 'picture.png' }]);
    f.read.mockRejectedValue(new Error('sender is offline'));
    const reader = createChatMedia(receiverApi, () => true);
    expect(await reader.download('room', blocks[0].mediaId!)).toMatchObject({ category: 'image', url: 'cindy-media://recipient-copy', size: bytes.length });
    // A fresh recipient adapter has no process cache, as after reopening the app.
    expect(await createChatMedia(receiverApi, () => true).download('room', blocks[0].mediaId!)).toMatchObject({ category: 'image', url: 'cindy-media://recipient-copy' });
    joined = false;
    await expect(reader.download('room', blocks[0].mediaId!)).rejects.toThrow('CONVERSATION_NOT_FOUND');
  });
  it('stops uploading a completed reply when its execution is revoked during prepare', async () => {
    f.read.mockResolvedValue({ buffer: Buffer.from('png') });
    f.fetch.mockClear();
    let active = true;
    const api = vi.fn(async () => { active = false; return { id: 'media', uploadUrl: 'https://upload.example.test/signed' }; }) as unknown as ChatApi;
    await expect(createChatMedia(api, () => true).upload('room', 'op', [attachment], 'actor', () => {
      if (!active) throw new Error('STALE_EXECUTOR');
    })).rejects.toThrow('STALE_EXECUTOR');
    expect(f.fetch).not.toHaveBeenCalled();
  });
  it('uploads the bytes without a Cindy token and seals before returning the message reference', async () => {
    f.read.mockResolvedValue({ buffer: Buffer.from('png'), mimeType: 'image/png' });
    f.fetch.mockResolvedValue(new Response('', { status: 200 }));
    const api = vi.fn(async route => route.endsWith('/media') ? { id: 'media', uploadUrl: 'https://upload.example.test/signed' } : {}) as unknown as ChatApi;
    const media = createChatMedia(api, () => true);
    expect(await media.upload('room', 'operation', [attachment], 'actor')).toEqual([{ type: 'media', mediaId: 'media', caption: 'picture.png' }]);
    expect(f.fetch).toHaveBeenLastCalledWith('https://upload.example.test/signed', expect.objectContaining({ redirect: 'error', headers: { 'Content-Type': 'image/png' } }));
    expect(vi.mocked(api).mock.calls.at(-1)?.[0]).toBe('/conversations/room/media/media/complete');
  });
  it.each(['prepare', 'upload', 'complete'])('reports the failing %s stage without signed URLs or filenames', async (stage) => {
    f.read.mockResolvedValue({ buffer: Buffer.from('png') });
    const log = { warn: vi.fn() };
    f.fetch.mockResolvedValue(new Response('', { status: stage === 'upload' ? 403 : 200 }));
    const api = vi.fn(async (route: string) => {
      if (stage === 'prepare' && route.endsWith('/media') || stage === 'complete' && route.endsWith('/complete'))
        throw Object.assign(new Error('REQUEST_FAILED'), { status: 500 });
      return { id: 'media', uploadUrl: 'https://upload.example.test/private?token=secret' };
    }) as unknown as ChatApi;
    await expect(createChatMedia(api, () => true, log).upload('room', 'operation', [attachment], 'actor')).rejects.toThrow();
    expect(log.warn).toHaveBeenCalledWith('Chat media upload failed', expect.objectContaining({ stage, status: stage === 'upload' ? 403 : 500 }));
    expect(JSON.stringify(log.warn.mock.calls)).not.toMatch(/secret|picture.png|https:/);
  });

  it('does not upload bytes when the owner changes during local file reading', async () => {
    let current = true;
    f.fetch.mockClear();
    f.read.mockImplementation(async () => { current = false; return { buffer: Buffer.from('png') }; });
    const api = vi.fn() as unknown as ChatApi;
    await expect(createChatMedia(api, () => current).upload('room', 'op', [attachment], 'actor')).rejects.toThrow('OWNER_CHANGED');
    expect(api).not.toHaveBeenCalled();
    expect(f.fetch).not.toHaveBeenCalled();
  });
  it('rechecks membership before reusing cached media bytes', async () => {
    f.fetch.mockResolvedValue(new Response('png'));
    f.ingest.mockResolvedValue({ url: 'cindy-media://cached' });
    let allowed = true;
    const api = vi.fn(async () => {
      if (!allowed) throw new Error('CONVERSATION_NOT_FOUND');
      return { name: 'p.png', type: 'image/png', size: 3, url: 'https://download.example.test/signed' };
    }) as unknown as ChatApi;
    const media = createChatMedia(api, () => true);
    expect((await media.download('room', 'media')).url).toBe('cindy-media://cached');
    allowed = false;
    await expect(media.download('room', 'media')).rejects.toThrow('CONVERSATION_NOT_FOUND');
    expect(api).toHaveBeenCalledTimes(2);
  });
  it('keeps the status of a failed download, so a file that is gone is told from a failing server', async () => {
    const api = vi.fn(async () => ({ name: 'p.png', type: 'image/png', size: 3, url: 'https://download.example.test/signed' })) as unknown as ChatApi;
    f.fetch.mockResolvedValueOnce(new Response('', { status: 404 }));
    await expect(createChatMedia(api, () => true).download('room', 'gone')).rejects.toMatchObject({ message: 'MEDIA_DOWNLOAD_FAILED', status: 404 });
    f.fetch.mockResolvedValueOnce(new Response('', { status: 503 }));
    await expect(createChatMedia(api, () => true).download('room', 'later')).rejects.toMatchObject({ message: 'MEDIA_DOWNLOAD_FAILED', status: 503 });
  });

  it('uploads a send\'s files three at a time and keeps their order', async () => {
    f.read.mockResolvedValue({ buffer: Buffer.from('png') });
    f.fetch.mockResolvedValue(new Response('', { status: 200 }));
    const files = ['a', 'b', 'c', 'd'].map(id => ({ ...attachment, id, name: `${id}.png` }));
    let inFlight = 0, most = 0;
    const api = vi.fn(async (route: string, _method: string, body: { name?: string }) => {
      if (!route.endsWith('/media')) return {};
      inFlight += 1; most = Math.max(most, inFlight);
      // The first file is prepared last.
      await new Promise(resolve => setTimeout(resolve, body.name === 'a.png' ? 20 : 1));
      inFlight -= 1;
      return { id: `media-${body.name}`, uploadUrl: 'https://upload.example.test/signed' };
    }) as unknown as ChatApi;
    const blocks = await createChatMedia(api, () => true).upload('room', 'operation', files, 'actor');
    expect(blocks.map(block => block.caption)).toEqual(['a.png', 'b.png', 'c.png', 'd.png']);
    expect(most).toBe(3);
  });
  it('permits exact loopback media only for the explicitly isolated adapter', async () => {
    f.read.mockResolvedValue({ buffer: Buffer.from('png') });f.fetch.mockResolvedValue(new Response('', { status: 200 }));
    let uploadUrl = 'http://127.0.0.1:3018/dev-media/fixture';
    const api = vi.fn(async () => ({ id: 'media', uploadUrl })) as unknown as ChatApi;
    await expect(createChatMedia(api, () => true).upload('room','op',[attachment],'actor')).rejects.toThrow('INVALID_MEDIA_URL');
    await expect(createChatMedia(api, () => true, undefined, { allowLoopback: true }).upload('room','op',[attachment],'actor')).resolves.toHaveLength(1);
    uploadUrl = 'http://127.0.0.1:3019/private';
    await expect(createChatMedia(api, () => true, undefined, { allowLoopback: true }).upload('room','op',[attachment],'actor')).rejects.toThrow('INVALID_MEDIA_URL');
  });

});
