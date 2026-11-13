import type { DatabaseBlockModel } from '@blocksuite/affine-model';
import { getSelectedModelsCommand } from '@blocksuite/affine-shared/commands';
import { TelemetryProvider } from '@blocksuite/affine-shared/services';
import { isInsideBlockByFlavour } from '@blocksuite/affine-shared/utils';
import {
  type SlashMenuActionItem,
  type SlashMenuConfig,
} from '@blocksuite/affine-widget-slash-menu';
import { viewPresets } from '@blocksuite/data-view/view-presets';
import {
  DatabaseKanbanViewIcon,
  DatabaseTableViewIcon,
  TodayIcon,
} from '@blocksuite/icons/lit';
import { Text } from '@blocksuite/store';

import { insertDatabaseBlockCommand } from '../commands';
import {
  DatabaseBlockDataSource,
  databaseViewInitTemplate,
} from '../data-source';
import {
  workspaceViewIcon,
  workspaceViews,
} from '../views/workspace-view-types';
import { KanbanViewTooltip, TableViewTooltip } from './tooltips';

const canInsertDatabase: NonNullable<SlashMenuActionItem['when']> = ({
  model,
}) => model.store.getParent(model)?.flavour === 'affine:note';

const insertView =
  (viewType: string): SlashMenuActionItem['action'] =>
  ({ model, std }) => {
    std.command.exec(insertDatabaseBlockCommand, {
      selectedModels: [model],
      viewType,
      place: 'after',
      removeEmptyLine: true,
    });
  };

const workspaceItems: SlashMenuActionItem[] = workspaceViews
  .filter(([type]) => type !== 'linked-source')
  .map(([type, name, icon], index) => ({
    name,
    icon: workspaceViewIcon(icon),
    group: `7_Database@${3 + index}`,
    searchAlias: [
      'database',
      type === 'map' || type === 'form' ? type : 'chart',
    ],
    when: canInsertDatabase,
    action: insertView(type),
  }));

const linkedSource = workspaceViews[7];

export const databaseSlashMenuConfig: SlashMenuConfig = {
  disableWhen: ({ model }) => model.flavour === 'affine:database',
  items: [
    {
      name: 'Table View',
      description: 'Display items in a table format.',
      searchAlias: ['database'],
      icon: DatabaseTableViewIcon(),
      tooltip: {
        figure: TableViewTooltip,
        caption: 'Table View',
      },
      group: '7_Database@0',
      when: ({ model }) =>
        !isInsideBlockByFlavour(model.store, model, 'affine:edgeless-text'),
      action: ({ std }) => {
        std.command
          .chain()
          .pipe(getSelectedModelsCommand)
          .pipe(insertDatabaseBlockCommand, {
            viewType: viewPresets.tableViewMeta.type,
            place: 'after',
            removeEmptyLine: true,
          })
          .pipe(({ insertedDatabaseBlockId }) => {
            if (insertedDatabaseBlockId) {
              const telemetry = std.getOptional(TelemetryProvider);
              telemetry?.track('BlockCreated', {
                blockType: 'affine:database',
              });
            }
          })
          .run();
      },
    },

    {
      name: 'Calendar View',
      description: 'Display items by date in a calendar.',
      searchAlias: ['database', 'calendar'],
      icon: TodayIcon(),
      group: '7_Database@1',
      when: ({ model }) =>
        !isInsideBlockByFlavour(model.store, model, 'affine:edgeless-text'),
      action: ({ std }) => {
        std.command
          .chain()
          .pipe(getSelectedModelsCommand)
          .pipe(insertDatabaseBlockCommand, {
            viewType: viewPresets.calendarViewMeta.type,
            place: 'after',
            removeEmptyLine: true,
          })
          .pipe(({ insertedDatabaseBlockId }) => {
            if (insertedDatabaseBlockId) {
              const telemetry = std.getOptional(TelemetryProvider);
              telemetry?.track('BlockCreated', {
                blockType: 'affine:database',
              });
            }
          })
          .run();
      },
    },

    {
      name: 'Kanban View',
      description: 'Visualize data in a dashboard.',
      searchAlias: ['database'],
      icon: DatabaseKanbanViewIcon(),
      tooltip: {
        figure: KanbanViewTooltip,
        caption: 'Kanban View',
      },
      group: '7_Database@2',
      when: ({ model }) =>
        !isInsideBlockByFlavour(model.store, model, 'affine:edgeless-text'),
      action: ({ std }) => {
        std.command
          .chain()
          .pipe(getSelectedModelsCommand)
          .pipe(insertDatabaseBlockCommand, {
            viewType: viewPresets.kanbanViewMeta.type,
            place: 'after',
            removeEmptyLine: true,
          })
          .pipe(({ insertedDatabaseBlockId }) => {
            if (insertedDatabaseBlockId) {
              const telemetry = std.getOptional(TelemetryProvider);
              telemetry?.track('BlockCreated', {
                blockType: 'affine:database',
              });
            }
          })
          .run();
      },
    },
    ...workspaceItems,
    {
      name: 'Database - Inline',
      icon: DatabaseTableViewIcon(),
      group: '7_Database@10',
      searchAlias: ['database', 'inline'],
      when: canInsertDatabase,
      action: insertView('table'),
    },
    {
      name: 'Database - Full page',
      icon: DatabaseTableViewIcon(),
      group: '7_Database@11',
      searchAlias: ['database', 'full page'],
      when: canInsertDatabase,
      action: ({ model, std }) => {
        const title = 'Untitled database';
        const page = std.workspace.createDoc();
        const store = page.getStore();
        store.load(() => {
          const root = store.addBlock('affine:page', {
            title: new Text(title),
          });
          store.addBlock('affine:surface', {}, root);
          const note = store.addBlock('affine:note', {}, root);
          const id = store.addBlock('affine:database', {}, note);
          const database = store.getModelById(id) as DatabaseBlockModel;
          databaseViewInitTemplate(
            new DatabaseBlockDataSource(database),
            'table'
          );
        });
        std.workspace.meta.setDocMeta(page.id, { title });
        std.store.captureSync();
        std.store.addSiblingBlocks(
          model,
          [
            {
              flavour: 'affine:embed-linked-doc',
              pageId: page.id,
              style: 'vertical',
            },
          ],
          'after'
        );
        if (model.text?.length === 0) std.store.deleteBlock(model);
      },
    },
    {
      name: linkedSource[1],
      icon: workspaceViewIcon(linkedSource[2]),
      group: '7_Database@12',
      searchAlias: ['database', 'linked'],
      when: canInsertDatabase,
      action: insertView(linkedSource[0]),
    },
  ],
};
