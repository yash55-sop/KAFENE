import '@excalidraw/excalidraw/index.css';
import './editor.css';

import { Button, Menu, MenuItem } from '@affine/component';
import { useGuard } from '@affine/core/components/guard';
import { Header } from '@affine/core/components/pure/header';
import { TrashPageFooter } from '@affine/core/components/pure/trash-page-footer';
import { DocService, DocsService } from '@affine/core/modules/doc';
import { createWhiteboardAutosave } from '@affine/core/modules/whiteboard/autosave';
import { protectWhiteboardNavigation } from '@affine/core/modules/whiteboard/navigation';
import {
  canvasSettings,
  WhiteboardSceneStore,
} from '@affine/core/modules/whiteboard/scene';
import {
  ViewBody,
  ViewHeader,
  ViewIcon,
  ViewService,
  ViewTitle,
  WorkbenchService,
} from '@affine/core/modules/workbench';
import { EdgelessIcon, MoreHorizontalIcon } from '@blocksuite/icons/rc';
import {
  CaptureUpdateAction,
  Excalidraw,
  exportToBlob,
  exportToSvg,
  loadFromBlob,
  MainMenu,
  reconcileElements,
  restoreElements,
  serializeAsJSON,
} from '@excalidraw/excalidraw';
import type { RemoteExcalidrawElement } from '@excalidraw/excalidraw/data/reconcile';
import type {
  AppState,
  ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types';
import { useLiveData, useService } from '@toeverything/infra';
import { useTheme } from 'next-themes';
import { useEffect, useMemo, useRef, useState } from 'react';

import * as styles from './whiteboard.css';

// Fonts are copied from the pinned package by AFFiNE's regular asset pipeline.
Object.assign(window, { EXCALIDRAW_ASSET_PATH: '/excalidraw/' });

export default function WhiteboardEditor() {
  const doc = useService(DocService).doc;
  const docs = useService(DocsService);
  const workbench = useService(WorkbenchService).workbench;
  const view = useService(ViewService).view;
  const title = useLiveData(doc.title$) || 'Untitled whiteboard';
  const trash = useLiveData(doc.trash$);
  const canEdit = useGuard('Doc_Update', doc.id);
  const canTrash = useGuard('Doc_Trash', doc.id);
  const canDuplicate = useGuard('Doc_Duplicate', doc.id);
  const canCreate = useGuard('Workspace_CreateDoc');
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light';
  const readonly = !canEdit || trash;
  const store = useMemo(() => new WhiteboardSceneStore(doc.yDoc), [doc]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [syncStatus, setSyncStatus] = useState('Loading…');
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const [loadingAttempt, setLoadingAttempt] = useState(0);
  const applying = useRef(false);
  const lastScene = useRef('');
  const diskPending = useRef(false);
  const writeMonitor = useRef<AbortController | null>(null);
  const [storageDelayed, setStorageDelayed] = useState(false);
  const report = (error: unknown) =>
    setError(
      error instanceof Error ? error.message : 'Unable to save the whiteboard.'
    );
  const autosave = useMemo(
    () =>
      createWhiteboardAutosave(
        scene => {
          store.write(scene);
          setError('');
          diskPending.current = true;
          writeMonitor.current?.abort();
          const monitor = new AbortController();
          writeMonitor.current = monitor;
          doc.workspace.engine.doc
            .waitForUpdated(doc.id, monitor.signal)
            .then(() => {
              if (!monitor.signal.aborted) diskPending.current = false;
            })
            .catch(error => {
              if (!monitor.signal.aborted) report(error);
            });
        },
        report,
        setPending
      ),
    [store, doc]
  );

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError('');
    // Never initialize an empty editor until AFFiNE has loaded the stored doc.
    doc
      .waitForSyncReady()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(error => {
        if (!cancelled) report(error);
      });
    return () => {
      cancelled = true;
      autosave.dispose();
      writeMonitor.current?.abort();
      diskPending.current = false;
    };
  }, [doc, autosave, loadingAttempt]);

  useEffect(() => {
    const subscription = doc.workspace.engine.doc
      .docState$(doc.id)
      .subscribe(state => {
        setSyncStatus(
          state.updating
            ? 'Saving…'
            : state.syncRetrying
              ? 'Saved locally · sync retrying'
              : state.synced
                ? 'Saved'
                : 'Saved locally · syncing'
        );
      });
    return () => subscription.unsubscribe();
  }, [doc]);

  useEffect(
    () =>
      protectWhiteboardNavigation(
        view.history,
        autosave.flush,
        () => autosave.pending,
        signal => doc.workspace.engine.doc.waitForUpdated(doc.id, signal),
        report
      ),
    [view, doc, autosave]
  );

  useEffect(() => {
    setStorageDelayed(false);
    if (syncStatus !== 'Saving…') return;
    const timer = setTimeout(() => setStorageDelayed(true), 15000);
    return () => clearTimeout(timer);
  }, [syncStatus]);

  useEffect(() => {
    if (!node) return;
    const ownerWindow = node.ownerDocument.defaultView;
    if (!ownerWindow) return;
    const flush = () => autosave.flush();
    const beforeUnload = (event: BeforeUnloadEvent) => {
      flush();
      if (autosave.pending || diskPending.current || syncStatus === 'Saving…') {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    ownerWindow.addEventListener('pagehide', flush);
    ownerWindow.addEventListener('beforeunload', beforeUnload);
    node.ownerDocument.addEventListener('visibilitychange', flush);
    return () => {
      flush();
      ownerWindow.removeEventListener('pagehide', flush);
      ownerWindow.removeEventListener('beforeunload', beforeUnload);
      node.ownerDocument.removeEventListener('visibilitychange', flush);
    };
  }, [node, autosave, syncStatus]);

  useEffect(() => {
    if (!api || !ready) return;
    return store.observe(() => {
      autosave.flush();
      try {
        const scene = store.read();
        applying.current = true;
        api.addFiles(Object.values(scene.files));
        api.updateScene({
          elements: reconcileElements(
            api.getSceneElementsIncludingDeleted(),
            restoreElements(scene.elements, null) as RemoteExcalidrawElement[],
            api.getAppState()
          ),
          captureUpdate: CaptureUpdateAction.NEVER,
        });
      } catch (error) {
        report(error);
      } finally {
        applying.current = false;
      }
    });
  }, [api, ready, store, autosave]);

  const initialData = useMemo(
    () =>
      ready
        ? { ...store.read(), libraryItems: store.readLibrary() }
        : undefined,
    [store, ready]
  );
  const run = (action: () => Promise<unknown>) => {
    autosave.flush();
    if (autosave.pending) return;
    action().catch(report);
  };
  const exportScene = async (format: 'json' | 'png' | 'svg') => {
    if (!api || !node) return;
    const elements = api.getSceneElements();
    const files = api.getFiles();
    const appState = { ...api.getAppState(), exportEmbedScene: true };
    const blob =
      format === 'json'
        ? new Blob([serializeAsJSON(elements, appState, files, 'local')], {
            type: 'application/json',
          })
        : format === 'png'
          ? await exportToBlob({
              elements,
              appState,
              files,
              mimeType: 'image/png',
            })
          : new Blob(
              [(await exportToSvg({ elements, appState, files })).outerHTML],
              { type: 'image/svg+xml' }
            );
    const ownerWindow = node.ownerDocument.defaultView;
    if (!ownerWindow) return;
    const url = ownerWindow.URL.createObjectURL(blob);
    const link = node.ownerDocument.createElement('a');
    link.href = url;
    link.download = `${title.replace(/[<>:"/\\|?*]/g, '_')}.${format === 'json' ? 'excalidraw' : format}`;
    link.click();
    ownerWindow.setTimeout(() => ownerWindow.URL.revokeObjectURL(url), 1000);
  };
  return (
    <>
      <ViewTitle title={title} />
      <ViewIcon icon="edgeless" />
      <ViewHeader>
        <Header
          left={
            <span className={styles.title}>
              <EdgelessIcon />
              <input
                key={title}
                aria-label="Whiteboard name"
                className={styles.nameInput}
                defaultValue={title}
                disabled={readonly}
                onBlur={event => {
                  const name = event.currentTarget.value.trim();
                  if (name && name !== title)
                    run(() => docs.changeDocTitle(doc.id, name));
                  else event.currentTarget.value = title;
                }}
                onKeyDown={event => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                  if (event.key === 'Escape') {
                    event.currentTarget.value = title;
                    event.currentTarget.blur();
                  }
                  event.stopPropagation();
                }}
              />
            </span>
          }
          right={
            <div className={styles.actions}>
              <span className={styles.status} role="status">
                {error
                  ? 'Needs attention'
                  : pending
                    ? 'Saving…'
                    : readonly
                      ? 'Read only'
                      : syncStatus}
              </span>
              <Menu
                items={
                  <>
                    <MenuItem onSelect={() => workbench.open('/whiteboard')}>
                      All whiteboards
                    </MenuItem>
                    <MenuItem
                      disabled={readonly || !api}
                      onSelect={() => importInput.current?.click()}
                    >
                      Import .excalidraw
                    </MenuItem>
                    <MenuItem
                      disabled={!api}
                      onSelect={() => {
                        exportScene('json').catch(report);
                      }}
                    >
                      Export Excalidraw JSON
                    </MenuItem>
                    <MenuItem
                      disabled={!api}
                      onSelect={() => {
                        exportScene('png').catch(report);
                      }}
                    >
                      Export PNG
                    </MenuItem>
                    <MenuItem
                      disabled={!api}
                      onSelect={() => {
                        exportScene('svg').catch(report);
                      }}
                    >
                      Export SVG
                    </MenuItem>
                    <MenuItem
                      onSelect={() =>
                        api?.scrollToContent(api.getSceneElements(), {
                          fitToContent: true,
                        })
                      }
                    >
                      Zoom to fit
                    </MenuItem>
                    <MenuItem
                      onSelect={() =>
                        api?.updateScene({
                          appState: {
                            zoom: { value: 1 as AppState['zoom']['value'] },
                            scrollX: 0,
                            scrollY: 0,
                          },
                        })
                      }
                    >
                      Reset view
                    </MenuItem>
                    <MenuItem
                      disabled={!canDuplicate || !canCreate || trash}
                      onSelect={() =>
                        run(async () => {
                          const id = await docs.duplicate(doc.id);
                          workbench.openDoc(id);
                        })
                      }
                    >
                      Duplicate
                    </MenuItem>
                    <MenuItem
                      type="danger"
                      disabled={!canTrash || trash}
                      onSelect={() =>
                        run(async () => {
                          await doc.moveToTrash();
                          workbench.open('/whiteboard');
                        })
                      }
                    >
                      Move to trash
                    </MenuItem>
                  </>
                }
              >
                <Button variant="plain" aria-label="Whiteboard actions">
                  <MoreHorizontalIcon />
                </Button>
              </Menu>
            </div>
          }
        />
      </ViewHeader>
      <ViewBody>
        <div
          ref={setNode}
          className={`${styles.board} affine-whiteboard`}
          tabIndex={-1}
          onKeyDown={event => event.stopPropagation()}
          onKeyUp={event => event.stopPropagation()}
        >
          <input
            ref={importInput}
            type="file"
            accept=".excalidraw,.json,image/png,image/svg+xml"
            hidden
            style={{ display: 'none' }}
            onChange={event => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (!file || !api || readonly) return;
              run(async () => {
                const imported = await loadFromBlob(
                  file,
                  api.getAppState(),
                  api.getSceneElementsIncludingDeleted()
                );
                api.addFiles(Object.values(imported.files ?? {}));
                api.updateScene({
                  ...imported,
                  captureUpdate: CaptureUpdateAction.IMMEDIATELY,
                });
              });
            }}
          />
          {storageDelayed && (
            <div className="whiteboard-error" role="alert">
              Workspace storage has not confirmed this save. Export a backup
              before leaving.
            </div>
          )}
          {error && (
            <div role="alert" className="whiteboard-error">
              {error}{' '}
              <Button
                onClick={() =>
                  !ready
                    ? setLoadingAttempt(value => value + 1)
                    : autosave.pending
                      ? autosave.flush()
                      : setError('')
                }
              >
                {!ready || autosave.pending ? 'Retry' : 'Dismiss'}
              </Button>{' '}
              Use the drawing menu to export a backup.
            </div>
          )}
          {!ready ? (
            <div className={styles.message} role="status">
              Loading whiteboard…
            </div>
          ) : (
            <Excalidraw
              key={doc.id}
              name={title}
              theme={theme}
              viewModeEnabled={readonly}
              excalidrawAPI={setApi}
              initialData={initialData}
              handleKeyboardGlobally={false}
              autoFocus
              onLibraryChange={items => {
                if (!readonly) {
                  try {
                    store.writeLibrary(items);
                  } catch (error) {
                    report(error);
                  }
                }
              }}
              onChange={(elements, appState, files) => {
                const signature =
                  elements
                    .map(
                      element =>
                        `${element.id}:${element.version}:${element.versionNonce}:${element.index}`
                    )
                    .join('|') +
                  JSON.stringify(canvasSettings(appState)) +
                  Object.keys(files).sort().join('|');
                if (
                  !readonly &&
                  !applying.current &&
                  signature !== lastScene.current
                ) {
                  lastScene.current = signature;
                  autosave.save({ elements, appState, files });
                }
              }}
              UIOptions={{
                canvasActions: {
                  toggleTheme: false,
                  export: { saveFileToDisk: true },
                },
              }}
            >
              <MainMenu>
                {!readonly && <MainMenu.DefaultItems.LoadScene />}
                <MainMenu.DefaultItems.SaveToActiveFile />
                <MainMenu.DefaultItems.SaveAsImage />
                <MainMenu.DefaultItems.Export />
                <MainMenu.Separator />
                {!readonly && <MainMenu.DefaultItems.ClearCanvas />}
                <MainMenu.DefaultItems.Help />
              </MainMenu>
            </Excalidraw>
          )}
        </div>
        {trash && <TrashPageFooter />}
      </ViewBody>
    </>
  );
}
