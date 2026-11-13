import type { DatabaseBlockModel } from '@blocksuite/affine-model';
import type { SingleView } from '@blocksuite/data-view';
import { createIdentifier } from '@blocksuite/global/di';
import type { EditorHost } from '@blocksuite/std';

export const EditorHostKey = createIdentifier<EditorHost>('editor-host');

export const WorkspaceDatabaseSourceKey = createIdentifier<{
  ownerId: string;
  getView: (model: DatabaseBlockModel) => SingleView | undefined;
}>('workspace-database-source');
