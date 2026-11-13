import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyUpdate, Doc, encodeStateAsUpdate } from 'yjs';

import { createNavigableHistory } from '../../utils/navigable-history';
import { createWhiteboardAutosave } from './autosave';
import { protectWhiteboardNavigation } from './navigation';
import {
  canvasSettings,
  copyWhiteboardData,
  WHITEBOARD_DATA,
  type WhiteboardScene,
  WhiteboardSceneStore,
} from './scene';

const element = (id: string, version = 1) =>
  ({
    id,
    type: 'rectangle',
    version,
    versionNonce: 1,
    index: `a${id}`,
    x: 10,
    y: 20,
    isDeleted: false,
  }) as unknown as ExcalidrawElement;
const scene = (id = '1', version = 1): WhiteboardScene => ({
  elements: [element(id, version)],
  appState: { viewBackgroundColor: '#ffffff', scrollX: 30 },
  files: {},
});

describe('native whiteboard persistence', () => {
  it('keeps Excalidraw conflict ordering for equal versions', () => {
    const doc = new Doc(),
      store = new WhiteboardSceneStore(doc);
    const first = scene();
    store.write(first);
    store.write({
      ...first,
      elements: [{ ...first.elements[0], versionNonce: 2, x: 999 }],
    });
    expect(store.read().elements[0].x).toBe(10);
  });
  it('persists a reusable library and includes it in a duplicate', () => {
    const source = new Doc(),
      target = new Doc();
    const store = new WhiteboardSceneStore(source);
    store.writeLibrary([
      {
        id: 'library-item',
        status: 'unpublished',
        elements: [element('1')],
        created: 1,
      },
    ]);
    copyWhiteboardData(source, target);
    expect(new WhiteboardSceneStore(target).readLibrary()[0].id).toBe(
      'library-item'
    );
  });
  it('round-trips elements, settings and embedded images through AFFiNE Yjs updates', () => {
    const source = new Doc(),
      target = new Doc();
    const value = scene();
    value.files = {
      picture: {
        id: 'picture',
        dataURL: 'data:image/png;base64,abc',
        mimeType: 'image/png',
        created: 1,
      },
    } as unknown as WhiteboardScene['files'];
    new WhiteboardSceneStore(source).write(value);
    applyUpdate(target, encodeStateAsUpdate(source));
    expect(new WhiteboardSceneStore(target).read()).toEqual(value);
  });
  it('does not write unchanged scenes and never serializes transient editor state', () => {
    const doc = new Doc(),
      store = new WhiteboardSceneStore(doc);
    store.write(scene());
    const update = vi.fn();
    doc.on('update', update);
    store.write(scene());
    expect(update).not.toHaveBeenCalled();
    expect(
      canvasSettings({
        theme: 'dark',
        selectedElementIds: { secret: true },
        viewBackgroundColor: '#000',
      })
    ).not.toHaveProperty('selectedElementIds');
    expect(canvasSettings({ theme: 'dark' })).not.toHaveProperty('theme');
  });
  it('preserves other devices elements and does not overwrite newer versions with a stale scene', () => {
    const doc = new Doc(),
      store = new WhiteboardSceneStore(doc);
    store.write(scene('1', 4));
    store.write(scene('1', 2));
    expect(store.read().elements[0].version).toBe(4);
    const remote = new Doc();
    applyUpdate(remote, encodeStateAsUpdate(doc));
    const remoteStore = new WhiteboardSceneStore(remote);
    remoteStore.write(scene('2'));
    applyUpdate(doc, encodeStateAsUpdate(remote));
    expect(store.read().elements.map(element => element.id)).toEqual([
      '1',
      '2',
    ]);
  });
  it('replaces an imported drawing without resurrecting old elements', () => {
    const doc = new Doc(),
      store = new WhiteboardSceneStore(doc);
    store.write(scene('1'));
    store.read();
    store.write(scene('2'));
    expect(
      store
        .read()
        .elements.filter(element => !element.isDeleted)
        .map(element => element.id)
    ).toEqual(['2']);
  });
  it('duplicates all data without sharing mutable scene state', () => {
    const source = new Doc(),
      target = new Doc();
    new WhiteboardSceneStore(source).write(scene());
    copyWhiteboardData(source, target);
    new WhiteboardSceneStore(target).write(scene('1', 2));
    expect(new WhiteboardSceneStore(source).read().elements[0].version).toBe(1);
    expect(target.getMap(WHITEBOARD_DATA).size).toBeGreaterThan(0);
  });
  it('reports only external transactions to the editor', () => {
    const doc = new Doc(),
      store = new WhiteboardSceneStore(doc),
      changed = vi.fn();
    const dispose = store.observe(changed);
    store.write(scene());
    expect(changed).not.toHaveBeenCalled();
    doc.getMap(WHITEBOARD_DATA).set('settings', '{}');
    expect(changed).toHaveBeenCalledOnce();
    dispose();
    doc.getMap(WHITEBOARD_DATA).set('settings', '{"scrollX":5}');
    expect(changed).toHaveBeenCalledOnce();
  });
});

describe('autosave lifecycle', () => {
  afterEach(() => vi.useRealTimers());
  it('coalesces edits and flushes the newest scene on navigation', () => {
    vi.useFakeTimers();
    const write = vi.fn(),
      save = createWhiteboardAutosave(write, vi.fn(), vi.fn());
    save.save(scene('1', 1));
    save.save(scene('1', 2));
    expect(write).not.toHaveBeenCalled();
    save.dispose();
    expect(write).toHaveBeenCalledOnce();
    expect(write.mock.calls[0][0].elements[0].version).toBe(2);
    vi.runAllTimers();
    expect(write).toHaveBeenCalledOnce();
  });
  it('commits continuous drawing at least every second', () => {
    vi.useFakeTimers();
    const write = vi.fn(),
      save = createWhiteboardAutosave(write, vi.fn(), vi.fn());
    for (let version = 1; version <= 10; version++) {
      save.save(scene('1', version));
      vi.advanceTimersByTime(100);
    }
    expect(write).toHaveBeenCalledOnce();
    expect(save.pending).toBe(false);
  });
  it('retains a failed save for retry and never retries an older snapshot', () => {
    const write = vi.fn().mockImplementationOnce(() => {
        throw new Error('disk');
      }),
      error = vi.fn();
    const save = createWhiteboardAutosave(write, error, vi.fn());
    save.save(scene('1', 1));
    save.flush();
    expect(save.pending).toBe(true);
    save.save(scene('1', 2));
    save.flush();
    expect(save.pending).toBe(false);
    expect(error).toHaveBeenCalledOnce();
    expect(write.mock.calls[1][0].elements[0].version).toBe(2);
  });
});

describe('navigation waits for durable storage', () => {
  it('also saves edits made while navigation is waiting on storage', async () => {
    const history = createNavigableHistory({ initialEntries: ['/board'] });
    const completions: (() => void)[] = [];
    let pending = false;
    const flush = vi.fn(() => {
      pending = false;
    });
    const wait = vi.fn(
      () =>
        new Promise<void>(resolve => {
          completions.push(resolve);
        })
    );
    const dispose = protectWhiteboardNavigation(
      history,
      flush,
      () => pending,
      wait,
      vi.fn()
    );
    history.push('/all');
    pending = true;
    completions[0]();
    await vi.waitFor(() => expect(wait).toHaveBeenCalledTimes(2));
    expect(history.location.pathname).toBe('/board');
    completions[1]();
    await vi.waitFor(() => expect(history.location.pathname).toBe('/all'));
    expect(flush).toHaveBeenCalledTimes(2);
    dispose();
  });
  it('keeps the canvas available when the storage engine rejects its write', async () => {
    const history = createNavigableHistory({ initialEntries: ['/board'] }),
      error = vi.fn();
    const dispose = protectWhiteboardNavigation(
      history,
      vi.fn(),
      () => false,
      () => Promise.reject(new Error('Storage unavailable')),
      error
    );
    history.push('/all');
    await vi.waitFor(() => expect(error).toHaveBeenCalledOnce());
    expect(history.location.pathname).toBe('/board');
    dispose();
  });
  it('keeps the editor mounted until saved and honours the latest destination', async () => {
    const history = createNavigableHistory({ initialEntries: ['/board'] });
    let complete!: () => void;
    const saved = new Promise<void>(resolve => {
      complete = resolve;
    });
    const flush = vi.fn(),
      error = vi.fn();
    const dispose = protectWhiteboardNavigation(
      history,
      flush,
      () => false,
      () => saved,
      error
    );
    history.push('/all');
    history.push('/whiteboard');
    expect(history.location.pathname).toBe('/board');
    complete();
    await vi.waitFor(() =>
      expect(history.location.pathname).toBe('/whiteboard')
    );
    expect(flush).toHaveBeenCalledOnce();
    expect(error).not.toHaveBeenCalled();
    dispose();
  });
  it('retains the board on failure instead of discarding an unsaved scene', async () => {
    const history = createNavigableHistory({ initialEntries: ['/board'] }),
      error = vi.fn();
    const dispose = protectWhiteboardNavigation(
      history,
      vi.fn(),
      () => true,
      vi.fn(),
      error
    );
    history.push('/all');
    await vi.waitFor(() => expect(error).toHaveBeenCalledOnce());
    expect(history.location.pathname).toBe('/board');
    dispose();
  });
  it('does not apply an asynchronous navigation after its workspace is disposed', async () => {
    const history = createNavigableHistory({ initialEntries: ['/board'] });
    let complete!: () => void;
    const saved = new Promise<void>(resolve => {
      complete = resolve;
    });
    const dispose = protectWhiteboardNavigation(
      history,
      vi.fn(),
      () => false,
      () => saved,
      vi.fn()
    );
    history.push('/all');
    dispose();
    complete();
    await Promise.resolve();
    await Promise.resolve();
    expect(history.location.pathname).toBe('/board');
    history.push('/other');
    expect(history.location.pathname).toBe('/other');
  });
});
