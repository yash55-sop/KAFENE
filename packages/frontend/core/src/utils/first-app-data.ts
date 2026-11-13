// the following import is used to ensure the block suite editor effects are run
import '../blocksuite/block-suite-editor';

import { DebugLogger } from '@affine/debug';
import { DEFAULT_WORKSPACE_NAME } from '@affine/env/constant';
import { isKafeneDesktop } from '@affine/i18n';
import onboardingUrl from '@affine/templates/onboarding.zip';
import type { Text } from '@blocksuite/affine/store';
import { ZipTransformer } from '@blocksuite/affine/widgets/linked-doc';

import { DocsService } from '../modules/doc';
import { OrganizeService } from '../modules/organize';
import {
  getAFFiNEWorkspaceSchema,
  type WorkspacesService,
} from '../modules/workspace';

export async function buildShowcaseWorkspace(
  workspacesService: WorkspacesService,
  flavour: string,
  workspaceName: string
) {
  const meta = await workspacesService.create(flavour, async docCollection => {
    docCollection.meta.initialize();
    docCollection.doc.getMap('meta').set('name', workspaceName);
    const blob = await (await fetch(onboardingUrl)).blob();

    const importedDocs = await ZipTransformer.importDocs(
      docCollection,
      getAFFiNEWorkspaceSchema(),
      blob
    );

    if (isKafeneDesktop && flavour === 'local') {
      // Update only the starter copy. The imported guide also credits AFFiNE
      // and links to its source and tutorials.
      for (const doc of importedDocs) {
        for (const block of doc?.getModelsByFlavour('affine:paragraph') ?? []) {
          const text = (block.props as { text: Text }).text;
          const copy = text.toString();
          if (
            copy.startsWith('Welcome to AFFiNE!') ||
            copy === 'Observe what AFFiNE can do'
          ) {
            const index = copy.indexOf('AFFiNE');
            text.applyDelta([
              { retain: index },
              { insert: 'Kafene' },
              { delete: 'AFFiNE'.length },
            ]);
          }
        }
      }
    }
  });

  const { workspace, dispose } = workspacesService.open({ metadata: meta });

  await workspace.engine.doc.waitForDocReady(workspace.id);

  const docsService = workspace.scope.get(DocsService);

  // should jump to "Getting Started"
  const defaultDoc = docsService.list.docs$.value.find(p =>
    p.title$.value.startsWith('Getting Started')
  );
  const folderTutorialDoc = docsService.list.docs$.value.find(p =>
    p.title$.value.startsWith('How to use folder and Tags')
  );

  // create default organize
  if (folderTutorialDoc) {
    const organizeService = workspace.scope.get(OrganizeService);
    const folderId = organizeService.folderTree.rootFolder.createFolder(
      'First Folder',
      organizeService.folderTree.rootFolder.indexAt('after')
    );
    const firstFolderNode =
      organizeService.folderTree.folderNode$(folderId).value;
    firstFolderNode?.createLink(
      'doc',
      folderTutorialDoc.id,
      firstFolderNode.indexAt('after')
    );
  }

  dispose();

  return { meta, defaultDocId: defaultDoc?.id };
}

const logger = new DebugLogger('createFirstAppData');

let firstAppDataPromise:
  | Promise<Awaited<ReturnType<typeof buildShowcaseWorkspace>>>
  | undefined;

export function createFirstAppData(workspacesService: WorkspacesService) {
  if (workspacesService.list.workspaces$.value.length > 0) {
    return;
  }

  if (
    !BUILD_CONFIG.isMobileEdition &&
    localStorage.getItem('is-first-open') !== null
  ) {
    return;
  }

  firstAppDataPromise ??= buildShowcaseWorkspace(
    workspacesService,
    'local',
    DEFAULT_WORKSPACE_NAME
  ).finally(() => {
    firstAppDataPromise = undefined;
  });

  return firstAppDataPromise.then(({ meta, defaultDocId }) => {
    localStorage.setItem('is-first-open', 'false');
    logger.info('create first workspace', defaultDocId);
    return { meta, defaultPageId: defaultDocId };
  });
}
