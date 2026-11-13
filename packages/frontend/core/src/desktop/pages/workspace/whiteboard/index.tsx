import {
  Button,
  Input,
  Menu,
  MenuItem,
  usePromptModal,
} from '@affine/component';
import { useGuard } from '@affine/core/components/guard';
import { Header } from '@affine/core/components/pure/header';
import { type DocRecord, DocsService } from '@affine/core/modules/doc';
import { RecentDocsService } from '@affine/core/modules/quicksearch';
import { readLegacyWhiteboard } from '@affine/core/modules/whiteboard/legacy';
import {
  WHITEBOARD_PROPERTY,
  type WhiteboardScene,
  WhiteboardSceneStore,
} from '@affine/core/modules/whiteboard/scene';
import {
  ViewBody,
  ViewHeader,
  ViewIcon,
  ViewTitle,
  WorkbenchService,
} from '@affine/core/modules/workbench';
import {
  WorkspaceLocalState,
  WorkspaceService,
} from '@affine/core/modules/workspace';
import {
  EdgelessIcon,
  MoreHorizontalIcon,
  PlusIcon,
} from '@blocksuite/icons/rc';
import { useLiveData, useService } from '@toeverything/infra';
import { useEffect, useRef, useState } from 'react';

import * as styles from './whiteboard.css';

type BoardRowProps = {
  record: DocRecord;
  query: string;
  recent: boolean;
  onError: (error: unknown) => void;
};

function BoardEntry(props: BoardRowProps) {
  const kind = useLiveData(props.record.customProperty$(WHITEBOARD_PROPERTY));
  return kind === '1' ? <BoardRow {...props} /> : null;
}

function BoardRow({ record, query, recent, onError }: BoardRowProps) {
  const title = useLiveData(record.title$) || 'Untitled whiteboard';
  const trash = useLiveData(record.trash$);
  const canRead = useGuard('Doc_Read', record.id);
  const canEdit = useGuard('Doc_Update', record.id);
  const canTrash = useGuard('Doc_Trash', record.id);
  const canDuplicate = useGuard('Doc_Duplicate', record.id);
  const canCreate = useGuard('Workspace_CreateDoc');
  const docs = useService(DocsService);
  const workbench = useService(WorkbenchService).workbench;
  const { openPromptModal } = usePromptModal();
  if (trash || !canRead || !title.toLowerCase().includes(query.toLowerCase()))
    return null;
  return (
    <div className={styles.row} data-testid="whiteboard-row">
      <Button
        variant="plain"
        className={styles.openBoard}
        onClick={() => workbench.openDoc(record.id)}
      >
        <EdgelessIcon />
        <span>{title}</span>
        {recent && <small>Recent</small>}
      </Button>
      <Menu
        items={
          <>
            <MenuItem
              disabled={!canEdit}
              onSelect={() =>
                openPromptModal({
                  title: 'Rename whiteboard',
                  label: 'Name',
                  inputOptions: { defaultValue: title },
                  onConfirm: name => {
                    if (name.trim())
                      docs
                        .changeDocTitle(record.id, name.trim())
                        .catch(onError);
                  },
                })
              }
            >
              Rename
            </MenuItem>
            <MenuItem
              disabled={!canCreate || !canDuplicate}
              onSelect={() => {
                docs
                  .duplicate(record.id)
                  .then(id => workbench.openDoc(id))
                  .catch(onError);
              }}
            >
              Duplicate
            </MenuItem>
            <MenuItem
              type="danger"
              disabled={!canTrash}
              onSelect={() => {
                record.moveToTrash().catch(onError);
              }}
            >
              Move to trash
            </MenuItem>
          </>
        }
      >
        <Button variant="plain" aria-label={`Actions for ${title}`}>
          <MoreHorizontalIcon />
        </Button>
      </Menu>
    </div>
  );
}

export const Component = () => {
  const docs = useService(DocsService);
  const records = useLiveData(docs.list.docs$);
  const ready = useLiveData(docs.list.isReady$);
  const workbench = useService(WorkbenchService).workbench;
  const recent = useService(RecentDocsService)
    .getRecentDocs()
    .map(doc => doc.id);
  const canCreate = useGuard('Workspace_CreateDoc');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const workspace = useService(WorkspaceService).workspace;
  const localState = useService(WorkspaceLocalState);
  const [legacy, setLegacy] = useState<WhiteboardScene | null>(null);
  const active = useRef(true);
  useEffect(() => {
    let cancelled = false;
    active.current = true;
    setLegacy(null);
    if (!localState.get('whiteboard-native-imported')) {
      readLegacyWhiteboard(indexedDB, workspace.id)
        .then(scene => {
          if (!cancelled) setLegacy(scene);
        })
        .catch(error => {
          if (!cancelled) setError(String(error));
        });
    }
    return () => {
      cancelled = true;
      active.current = false;
    };
  }, [workspace, localState]);
  const onError = (error: unknown) =>
    setError(
      error instanceof Error
        ? error.message
        : 'The operation failed. Please try again.'
    );
  const create = async () => {
    setCreating(true);
    setError('');
    try {
      const record = docs.createDoc({ title: 'Untitled whiteboard' });
      record.setCustomProperty(WHITEBOARD_PROPERTY, '1');
      workbench.openDoc(record.id);
    } catch (error) {
      onError(error);
    } finally {
      setCreating(false);
    }
  };
  const ordered = [...records].sort((a, b) => {
    const ai = recent.indexOf(a.id),
      bi = recent.indexOf(b.id);
    return (ai < 0 ? records.length : ai) - (bi < 0 ? records.length : bi);
  });
  return (
    <>
      <ViewTitle title="Whiteboard" />
      <ViewIcon icon="edgeless" />
      <ViewHeader>
        <Header
          left={
            <span className={styles.title}>
              <EdgelessIcon />
              Whiteboard
            </span>
          }
          right={
            <Button
              variant="primary"
              prefix={<PlusIcon />}
              disabled={!canCreate || creating || !ready}
              onClick={() => {
                create().catch(onError);
              }}
            >
              New whiteboard
            </Button>
          }
        />
      </ViewHeader>
      <ViewBody>
        <div className={styles.list}>
          <h1>Whiteboards</h1>
          <p>
            Sketch, plan, and draw alongside your documents. Boards save to this
            workspace.
          </p>
          <Input
            aria-label="Search whiteboards"
            placeholder="Search whiteboards…"
            value={query}
            onChange={setQuery}
          />
          {legacy && (
            <Button
              disabled={!canCreate || creating}
              onClick={() => {
                (async () => {
                  setCreating(true);
                  try {
                    const record = docs.createDoc({
                      title: 'Imported whiteboard',
                    });
                    record.setCustomProperty(WHITEBOARD_PROPERTY, '1');
                    const { doc, release } = docs.open(record.id);
                    try {
                      await doc.waitForSyncReady();
                      new WhiteboardSceneStore(doc.yDoc).write(legacy);
                      await workspace.engine.doc.waitForUpdated(doc.id);
                      localState.set('whiteboard-native-imported', record.id);
                      if (active.current) {
                        setLegacy(null);
                        workbench.openDoc(record.id);
                      }
                    } finally {
                      release();
                    }
                  } catch (error) {
                    onError(error);
                  } finally {
                    setCreating(false);
                  }
                })().catch(onError);
              }}
            >
              Import previous local whiteboard
            </Button>
          )}
          {error && <p role="alert">{error}</p>}
          {!ready && <p role="status">Loading whiteboards…</p>}
          <div className={styles.rows}>
            {ordered.map(record => (
              <BoardEntry
                key={record.id}
                record={record}
                query={query}
                recent={recent.includes(record.id)}
                onError={onError}
              />
            ))}
          </div>
          <p className={styles.hint}>
            Create a board with New whiteboard. Deleted boards can be recovered
            from Trash.
          </p>
        </div>
      </ViewBody>
    </>
  );
};
