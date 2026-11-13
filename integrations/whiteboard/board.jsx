import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Excalidraw,
  MainMenu,
  WelcomeScreen,
  serializeAsJSON,
} from '@excalidraw/excalidraw';
import {
  createSaveQueue,
  openBoardDatabase,
  readBoard,
  writeBoard,
} from './storage.mjs';
import './board.css';

const node = document.getElementById('board');
const ownerDocument = node.ownerDocument;
const ownerWindow = ownerDocument.defaultView;
const params = new URLSearchParams(ownerWindow.location.search);
const workspace = params.get('workspace');
ownerWindow.EXCALIDRAW_ASSET_PATH = `${ownerWindow.location.origin}/`;
let lastStatus = 'loading';

function report(status) {
  lastStatus = status;
  ownerWindow.parent.postMessage(
    { type: 'whiteboard:status', workspace, status },
    ownerWindow.location.origin
  );
}

function Board({ db, scene, libraryItems }) {
  const [theme, setTheme] = useState(
    params.get('theme') === 'dark' ? 'dark' : 'light'
  );
  const [failure, setFailure] = useState(false);
  const [persistence] = useState(() => {
    let ready = false;
    let previous = '';
    const pending = new Set();
    const errors = new Set();
    const observe = kind => status => {
      if (status === 'saving') pending.add(kind);
      else pending.delete(kind);
      if (status === 'error') errors.add(kind);
      if (status === 'saved') errors.delete(kind);
      setFailure(errors.size > 0);
      report(errors.size ? 'error' : pending.size ? 'saving' : 'saved');
    };
    const sceneQueue = createSaveQueue(
      value => writeBoard(db, workspace, value),
      observe('scene')
    );
    const libraryQueue = createSaveQueue(
      value => writeBoard(db, workspace, value, 'library'),
      observe('library')
    );
    return {
      initialize() {
        ready = true;
        report('ready');
      },
      change(elements, appState, files) {
        if (!ready) return;
        // Use the editor's serializer to exclude transient DOM/editor state and
        // keep embedded image data, then preserve the viewport for the next visit.
        const value = JSON.parse(
          serializeAsJSON(elements, appState, files, 'local')
        );
        Object.assign(value.appState, {
          scrollX: appState.scrollX,
          scrollY: appState.scrollY,
          zoom: appState.zoom,
        });
        const serialized = JSON.stringify(value);
        if (serialized === previous) return;
        previous = serialized;
        sceneQueue.save(value);
      },
      library(items) {
        if (ready) libraryQueue.save(items);
      },
    };
  });

  useEffect(() => {
    ownerDocument.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    const receive = event => {
      if (
        event.origin !== ownerWindow.location.origin ||
        event.source !== ownerWindow.parent
      )
        return;
      if (
        event.data?.type === 'whiteboard:theme' &&
        ['light', 'dark'].includes(event.data.theme)
      ) {
        setTheme(event.data.theme);
        report(lastStatus);
      }
    };
    ownerWindow.addEventListener('message', receive);
    return () => ownerWindow.removeEventListener('message', receive);
  }, []);

  return (
    <>
      {failure && (
        <div className="save-error" role="alert">
          Unable to save locally. Use the board menu to save a backup before
          leaving.
        </div>
      )}
      <Excalidraw
        ownerDocument={ownerDocument}
        name="Whiteboard"
        theme={theme}
        langCode="en"
        initialData={{
          ...scene,
          libraryItems: libraryItems ?? [],
          appState: {
            viewBackgroundColor: '#ffffff',
            ...scene?.appState,
            exportEmbedScene: true,
          },
        }}
        onInitialize={persistence.initialize}
        onChange={persistence.change}
        onLibraryChange={persistence.library}
        UIOptions={{
          canvasActions: {
            toggleTheme: false,
            export: { saveFileToDisk: true },
          },
        }}
      >
        <MainMenu>
          <MainMenu.DefaultItems.LoadScene />
          <MainMenu.DefaultItems.SaveToActiveFile />
          <MainMenu.DefaultItems.SaveAsImage />
          <MainMenu.Separator />
          <MainMenu.DefaultItems.SearchMenu />
          <MainMenu.DefaultItems.ClearCanvas />
        </MainMenu>
        <WelcomeScreen>
          <WelcomeScreen.Center>
            <div className="board-welcome">
              <h1>Your whiteboard</h1>
              <p>Sketch an idea, map a plan, or start with a shape.</p>
              <span>Drawings save automatically in this browser.</span>
            </div>
            <WelcomeScreen.Center.Menu>
              <WelcomeScreen.Center.MenuItemLoadScene />
            </WelcomeScreen.Center.Menu>
          </WelcomeScreen.Center>
          <WelcomeScreen.Hints.ToolbarHint />
        </WelcomeScreen>
      </Excalidraw>
    </>
  );
}

async function start() {
  if (!workspace)
    throw new Error('Open Whiteboard from your workspace sidebar.');
  const db = await openBoardDatabase(ownerWindow.indexedDB);
  const [scene, libraryItems] = await Promise.all([
    readBoard(db, workspace),
    readBoard(db, workspace, 'library'),
  ]);
  createRoot(node).render(
    <Board db={db} scene={scene} libraryItems={libraryItems} />
  );
}

start().catch(error => {
  report('error');
  const message = ownerDocument.createElement('p');
  message.className = 'loading';
  message.textContent = `Unable to open your saved board. ${error.message} Reload to retry; your saved data has not been replaced.`;
  node.replaceChildren(message);
});
