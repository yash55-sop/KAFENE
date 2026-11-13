import type { DocsService } from '@affine/core/modules/doc';
import {
  DatabaseBlockDataSource,
  databaseBlockProperties,
} from '@blocksuite/affine/blocks/database';
import type { DatabaseBlockModel } from '@blocksuite/affine/model';
import { type Store, Text } from '@blocksuite/affine/store';
import { propertyPresets } from '@blocksuite/data-view/property-presets';
import type { TableViewData } from '@blocksuite/data-view/view-presets';

export type NativeRow = {
  text: string;
  date?: string;
  area?: string;
  done?: boolean;
  score?: number;
};
export type NativeDatabaseColumn = 'date' | 'focus' | 'done' | 'score';

export type NativeBlock =
  | { kind: 'heading'; text: string; level?: 1 | 2 | 3 }
  | { kind: 'code'; text: string; language?: string }
  | {
      kind: 'paragraph' | 'quote' | 'todo' | 'bullet';
      text: string;
      checked?: boolean;
    }
  | {
      kind: 'callout';
      text: string;
      emoji?: string;
      color?: 'grey' | 'blue' | 'green' | 'yellow' | 'purple' | 'pink';
    }
  | { kind: 'divider' }
  | {
      kind: 'database';
      title: string;
      rows: NativeRow[];
      calendar?: boolean;
      columns?: NativeDatabaseColumn[];
      progress?: boolean;
    };

const nonEmpty = (value: unknown, field: string, max = 2000): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new Error(`${field} must be 1–${max} characters`);
  return value.trim();
};

export function validateBlocks(value: unknown): NativeBlock[] {
  if (!Array.isArray(value) || value.length > 100)
    throw new Error('blocks must contain at most 100 native blocks');
  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object')
      throw new Error(`Block ${index} must be an object`);
    const block = entry as Record<string, unknown>;
    if (block.kind === 'divider') return { kind: 'divider' };
    if (block.kind === 'code') {
      const text = nonEmpty(block.text, 'code', 12000);
      const language =
        block.language === undefined
          ? 'go'
          : nonEmpty(block.language, 'language', 40);
      if (!/^[a-zA-Z0-9+#-]+$/.test(language))
        throw new Error('Invalid code language');
      return { kind: 'code', text, language };
    }
    if (block.kind === 'database') {
      const title = nonEmpty(block.title, 'database title', 200);
      if (!Array.isArray(block.rows) || block.rows.length > 500)
        throw new Error('database rows must contain at most 500 items');
      const rows = block.rows.map((raw, rowIndex) => {
        if (!raw || typeof raw !== 'object')
          throw new Error(`Row ${rowIndex} must be an object`);
        const row = raw as Record<string, unknown>;
        const result: NativeRow = { text: nonEmpty(row.text, 'row text', 500) };
        if (row.date !== undefined) {
          if (
            typeof row.date !== 'string' ||
            !/^\d{4}-\d{2}-\d{2}$/.test(row.date)
          )
            throw new Error('date must be YYYY-MM-DD');
          result.date = row.date;
        }
        if (row.area !== undefined)
          result.area = nonEmpty(row.area, 'area', 80);
        if (row.done !== undefined) result.done = Boolean(row.done);
        if (row.score !== undefined) {
          if (typeof row.score !== 'number' || !Number.isFinite(row.score))
            throw new Error('score must be a finite number');
          result.score = row.score;
        }
        return result;
      });
      const allowed = new Set(['date', 'focus', 'done', 'score']);
      const columns =
        block.columns === undefined
          ? undefined
          : Array.isArray(block.columns) &&
              block.columns.length > 0 &&
              block.columns.length <= 4 &&
              block.columns.every(column => allowed.has(String(column)))
            ? ([...new Set(block.columns)] as NativeDatabaseColumn[])
            : null;
      if (columns === null) throw new Error('Invalid database columns');
      if (block.calendar === true && columns && !columns.includes('date'))
        throw new Error('Calendar requires the date column');
      if (block.progress === true && columns && !columns.includes('done'))
        throw new Error('Progress requires the done column');
      return {
        kind: 'database',
        title,
        rows,
        calendar: block.calendar === true,
        columns,
        progress: block.progress === true,
      };
    }
    const text = nonEmpty(block.text, 'block text');
    if (block.kind === 'heading')
      return {
        kind: 'heading',
        text,
        level: [1, 2, 3].includes(Number(block.level))
          ? (block.level as 1 | 2 | 3)
          : 2,
      };
    if (
      block.kind === 'paragraph' ||
      block.kind === 'quote' ||
      block.kind === 'bullet'
    )
      return { kind: block.kind, text };
    if (block.kind === 'todo')
      return { kind: 'todo', text, checked: block.checked === true };
    if (block.kind === 'callout')
      return {
        kind: 'callout',
        text,
        emoji: typeof block.emoji === 'string' ? block.emoji.slice(0, 8) : '💡',
        color: ['grey', 'blue', 'green', 'yellow', 'purple', 'pink'].includes(
          String(block.color)
        )
          ? (block.color as
              | 'grey'
              | 'blue'
              | 'green'
              | 'yellow'
              | 'purple'
              | 'pink')
          : 'blue',
      };
    throw new Error(`Unsupported native block: ${String(block.kind)}`);
  });
}

export function configureNativeTable(
  source: DatabaseBlockDataSource,
  doneId?: string
) {
  const tableId = source.viewDataList$.value.find(
    view => view.mode === 'table'
  )?.id;
  if (!tableId) return;
  source.viewDataUpdate<TableViewData>(tableId, () => ({
    columns: source.properties$.value.map(id => {
      const name = source.propertyNameGet(id);
      return {
        id,
        width:
          name === 'Title'
            ? 280
            : name === 'Focus'
              ? 180
              : name === 'Date'
                ? 140
                : 120,
        ...(id === doneId ? { statCalcType: 'percent-not-empty' } : {}),
      };
    }),
  }));
}

function addDatabase(
  store: Store,
  noteId: string,
  block: Extract<NativeBlock, { kind: 'database' }>
) {
  const id = store.addBlock(
    'affine:database',
    { title: new Text(block.title) },
    noteId
  );
  const model = store.getModelById(id) as DatabaseBlockModel;
  const source = new DatabaseBlockDataSource(model);
  const tableId = source.viewManager.viewAdd('table');
  const columns = block.columns ?? ['date', 'focus', 'done', 'score'];
  const dateId = columns.includes('date')
    ? source.propertyAdd('end', {
        type: propertyPresets.datePropertyConfig.type,
        name: 'Date',
      })
    : undefined;
  const areaId = columns.includes('focus')
    ? source.propertyAdd('end', {
        type: databaseBlockProperties.richTextColumnConfig.type,
        name: 'Focus',
      })
    : undefined;
  const doneId = columns.includes('done')
    ? source.propertyAdd('end', {
        type: propertyPresets.checkboxPropertyConfig.type,
        name: 'Done',
      })
    : undefined;
  const scoreId = columns.includes('score')
    ? source.propertyAdd('end', {
        type: propertyPresets.numberPropertyConfig.type,
        name: 'Score',
      })
    : undefined;
  configureNativeTable(source, block.progress ? doneId : undefined);
  if (block.calendar && dateId) {
    const calendarId = source.viewManager.viewAdd('calendar');
    source.viewDataUpdate(calendarId, old => ({
      ...old,
      date: { startColumnId: dateId },
    }));
    source.viewManager.setCurrentView(tableId);
  }
  const rowIds = block.rows.map(row => {
    const rowId = store.addBlock(
      'affine:paragraph',
      { text: new Text(row.text) },
      id
    );
    if (dateId && row.date)
      source.cellValueChange(
        rowId,
        dateId,
        new Date(`${row.date}T12:00:00`).getTime()
      );
    if (areaId && row.area)
      source.cellValueChange(rowId, areaId, new Text(row.area));
    if (doneId) source.cellValueChange(rowId, doneId, row.done ?? false);
    if (scoreId && row.score !== undefined)
      source.cellValueChange(rowId, scoreId, row.score);
    return rowId;
  });
  return { id, rowIds };
}

export function appendNativeBlocks(store: Store, blocks: NativeBlock[]) {
  const note = store.getBlocksByFlavour('affine:note')[0];
  if (!note) throw new Error('Native document note not found');
  const ids: string[] = [];
  for (const block of blocks) {
    if (block.kind === 'database') {
      ids.push(addDatabase(store, note.id, block).id);
    } else if (block.kind === 'heading') {
      ids.push(
        store.addBlock(
          'affine:paragraph',
          { type: `h${block.level ?? 2}`, text: new Text(block.text) },
          note.id
        )
      );
    } else if (block.kind === 'code') {
      ids.push(
        store.addBlock(
          'affine:code',
          { text: new Text(block.text), language: block.language ?? 'go' },
          note.id
        )
      );
    } else if (block.kind === 'paragraph' || block.kind === 'quote') {
      ids.push(
        store.addBlock(
          'affine:paragraph',
          {
            type: block.kind === 'quote' ? 'quote' : 'text',
            text: new Text(block.text),
          },
          note.id
        )
      );
    } else if (block.kind === 'todo' || block.kind === 'bullet') {
      ids.push(
        store.addBlock(
          'affine:list',
          {
            type: block.kind === 'todo' ? 'todo' : 'bulleted',
            text: new Text(block.text),
            checked: block.kind === 'todo' && !!block.checked,
          },
          note.id
        )
      );
    } else if (block.kind === 'callout') {
      const id = store.addBlock(
        'affine:callout',
        {
          icon: { type: 'emoji', unicode: block.emoji || '💡' },
          backgroundColorName: block.color || 'blue',
        },
        note.id
      );
      store.addBlock('affine:paragraph', { text: new Text(block.text) }, id);
      ids.push(id);
    } else {
      ids.push(store.addBlock('affine:divider', {}, note.id));
    }
  }
  return ids;
}

export function repairNativeCallouts(store: Store) {
  const note = store.getBlocksByFlavour('affine:note')[0]?.model;
  if (!note) throw new Error('Native document note not found');
  let repaired = 0;
  for (const child of note.children) {
    if (child.flavour !== 'affine:callout' || child.children.length) continue;
    const text = (
      child as unknown as { props: { text: Text } }
    ).props.text.toString();
    if (!text) continue;
    store.addBlock('affine:paragraph', { text: new Text(text) }, child.id);
    repaired++;
  }
  return repaired;
}

export function createNativePage(
  docs: DocsService,
  title: string,
  blocks: NativeBlock[],
  isTemplate = false
) {
  const record = docs.createDoc({
    title: nonEmpty(title, 'title', 200),
    isTemplate,
  });
  const { doc, release } = docs.open(record.id);
  try {
    const store = doc.blockSuiteDoc;
    const note = store.getBlocksByFlavour('affine:note')[0];
    note?.model.children.forEach(child => store.deleteBlock(child));
    appendNativeBlocks(store, blocks);
  } finally {
    release();
  }
  record.setCustomProperty('kafene:native-dashboard', '1');
  return record.id;
}

export function withNativePage<T>(
  docs: DocsService,
  docId: string,
  run: (store: Store) => T
): T {
  if (!docs.list.doc$(docId).value) throw new Error('Document not found');
  const { doc, release } = docs.open(docId);
  try {
    return run(doc.blockSuiteDoc);
  } finally {
    release();
  }
}
