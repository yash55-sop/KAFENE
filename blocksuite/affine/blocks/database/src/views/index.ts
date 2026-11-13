import type { ViewMeta } from '@blocksuite/data-view';
import { viewConverts, viewPresets } from '@blocksuite/data-view/view-presets';

import { workspaceViewMetas } from './workspace-view.js';

export const databaseBlockViews: ViewMeta[] = [
  viewPresets.tableViewMeta,
  viewPresets.kanbanViewMeta,
  viewPresets.calendarViewMeta,
  ...workspaceViewMetas,
];

export const databaseBlockViewMap = Object.fromEntries(
  databaseBlockViews.map(view => [view.type, view])
);
export const databaseBlockViewConverts = [...viewConverts];
