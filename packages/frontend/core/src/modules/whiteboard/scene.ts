import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type {
  AppState,
  BinaryFiles,
  LibraryItems,
} from '@excalidraw/excalidraw/types';
import type { Doc as YDoc, Transaction } from 'yjs';

export const WHITEBOARD_PROPERTY = 'affine:excalidraw';
export const WHITEBOARD_DATA = 'affine:excalidraw:v1';

export type WhiteboardScene = {
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
};

// Only durable settings belong in the document. Selection, dialogs, collaborators,
// DOM references, and the user's AFFiNE theme must never enter shared storage.
export function canvasSettings(state: Partial<AppState>): Partial<AppState> {
  return {
    viewBackgroundColor: state.viewBackgroundColor,
    gridSize: state.gridSize,
    gridStep: state.gridStep,
    gridModeEnabled: state.gridModeEnabled,
    scrollX: state.scrollX,
    scrollY: state.scrollY,
    zoom: state.zoom,
    currentItemStrokeColor: state.currentItemStrokeColor,
    currentItemBackgroundColor: state.currentItemBackgroundColor,
    currentItemFillStyle: state.currentItemFillStyle,
    currentItemStrokeWidth: state.currentItemStrokeWidth,
    currentItemStrokeStyle: state.currentItemStrokeStyle,
    currentItemRoughness: state.currentItemRoughness,
    currentItemOpacity: state.currentItemOpacity,
    currentItemFontFamily: state.currentItemFontFamily,
    currentItemFontSize: state.currentItemFontSize,
  };
}

export class WhiteboardSceneStore {
  private readonly data;
  private knownElements = new Set<string>();
  private knownFiles = new Map<string, BinaryFiles[string]>();
  readonly origin = {};

  constructor(private readonly doc: YDoc) {
    this.data = doc.getMap<string>(WHITEBOARD_DATA);
  }

  read(): WhiteboardScene {
    const elements: ExcalidrawElement[] = [];
    const files: BinaryFiles = {};
    for (const [key, value] of this.data) {
      if (key.startsWith('element:')) elements.push(JSON.parse(value));
      if (key.startsWith('file:')) files[key.slice(5)] = JSON.parse(value);
    }
    // Fractional indices preserve the editor's stacking order, including after
    // Yjs merges changes from another device.
    // Compare indices as ASCII, as Excalidraw's fractional-indexing does.
    elements.sort((a, b) =>
      (a.index ?? '') < (b.index ?? '')
        ? -1
        : (a.index ?? '') > (b.index ?? '')
          ? 1
          : 0
    );
    this.knownElements = new Set(elements.map(element => element.id));
    this.knownFiles = new Map(Object.entries(files));
    return {
      elements,
      files,
      appState: JSON.parse(this.data.get('settings') ?? '{}'),
    };
  }

  write(scene: WhiteboardScene) {
    this.doc.transact(() => {
      const put = (key: string, value: unknown) => {
        const serialized = JSON.stringify(value);
        if (this.data.get(key) !== serialized) this.data.set(key, serialized);
      };
      // Per-element entries avoid rewriting a whole scene or every image on
      // each pointer movement. Deleted elements remain as Excalidraw tombstones.
      for (const element of scene.elements) {
        const key = `element:${element.id}`;
        const existing = this.data.get(key);
        if (existing) {
          const saved = JSON.parse(existing) as ExcalidrawElement;
          if (saved.version > element.version) continue;
          if (saved.version === element.version) {
            if (saved.versionNonce < element.versionNonce) continue;
            if (
              saved.versionNonce === element.versionNonce &&
              saved.index === element.index
            )
              continue;
          }
        }
        put(key, element);
      }
      const incoming = new Set(scene.elements.map(element => element.id));
      // Loading a .excalidraw file replaces a scene. Tombstone elements absent
      // from that replacement so the previous drawing cannot reappear on reopen.
      for (const id of this.knownElements) {
        if (incoming.has(id)) continue;
        const value = this.data.get(`element:${id}`);
        if (!value) continue;
        const element = JSON.parse(value) as ExcalidrawElement;
        if (!element.isDeleted)
          put(`element:${id}`, {
            ...element,
            isDeleted: true,
            version: element.version + 1,
            updated: Date.now(),
          });
      }
      this.knownElements = incoming;
      // Images are self-contained in this synced document. They are written once,
      // not on every scene change, and survive trash, duplication and offline use.
      for (const [id, file] of Object.entries(scene.files)) {
        const saved = this.knownFiles.get(id);
        if (saved?.dataURL === file.dataURL && saved.mimeType === file.mimeType)
          continue;
        put(`file:${id}`, file);
        this.knownFiles.set(id, file);
      }
      put('settings', canvasSettings(scene.appState));
    }, this.origin);
  }

  observe(callback: () => void) {
    const observer = (_event: unknown, transaction: Transaction) => {
      if (transaction.origin !== this.origin) callback();
    };
    this.data.observe(observer);
    return () => this.data.unobserve(observer);
  }

  readLibrary(): LibraryItems {
    return JSON.parse(this.data.get('library') ?? '[]');
  }

  writeLibrary(items: LibraryItems) {
    const value = JSON.stringify(items);
    if (this.data.get('library') !== value) {
      this.doc.transact(() => this.data.set('library', value), this.origin);
    }
  }
}

// Called by AFFiNE's ordinary Duplicate command as well as the board list.
export function copyWhiteboardData(source: YDoc, target: YDoc) {
  const data = source.getMap<string>(WHITEBOARD_DATA);
  if (!data.size) return;
  target.transact(() => {
    const destination = target.getMap<string>(WHITEBOARD_DATA);
    for (const [key, value] of data) destination.set(key, value);
  });
}
