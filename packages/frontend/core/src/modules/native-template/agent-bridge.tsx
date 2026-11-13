import { DocsService } from '@affine/core/modules/doc';
import { DatabaseBlockDataSource } from '@blocksuite/affine/blocks/database';
import type { DatabaseBlockModel } from '@blocksuite/affine/model';
import { type Store, Text } from '@blocksuite/affine/store';
import { useService } from '@toeverything/infra';
import { useEffect } from 'react';

import {
  appendNativeBlocks,
  configureNativeTable,
  createNativePage,
  repairNativeCallouts,
  validateBlocks,
  withNativePage,
} from './page';

type Command = { action: string; [key: string]: unknown };

const asString = (value: unknown, name: string) => {
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`${name} is required`);
  return value;
};

function pageBlocks(store: Store) {
  const note = store.getBlocksByFlavour('affine:note')[0]?.model;
  if (!note) return [];
  return note.children.map(child => {
    const model = child as unknown as {
      id: string;
      flavour: string;
      text?: Text;
      props?: { type?: string; checked?: boolean; text?: Text };
    };
    if (model.flavour === 'affine:database') {
      const database = child as DatabaseBlockModel;
      const source = new DatabaseBlockDataSource(database);
      const properties = source.properties$.value.map(id => ({
        id,
        name: source.propertyNameGet(id),
      }));
      const rows = database.children.map(row => ({
        id: row.id,
        text: row.text?.toString() ?? '',
        cells: Object.fromEntries(
          properties.map(property => {
            const value = source.cellValueGet(row.id, property.id);
            return [
              property.name,
              value instanceof Text ? value.toString() : (value ?? null),
            ];
          })
        ),
      }));
      return {
        id: model.id,
        kind: 'database',
        title: database.props.title.toString(),
        properties,
        rows,
      };
    }
    return {
      id: model.id,
      kind: model.flavour,
      type: model.props?.type,
      text:
        model.flavour === 'affine:callout'
          ? (child.children[0]?.text?.toString() ??
            model.props?.text?.toString() ??
            '')
          : (model.text?.toString() ?? ''),
      checked: model.props?.checked,
    };
  });
}

function updateCells(
  source: DatabaseBlockDataSource,
  rowId: string,
  input: unknown
) {
  if (input === undefined) return;
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('cells must be an object');
  const cells = input as Record<string, unknown>;
  const changes: { propertyId: string; value: unknown }[] = [];
  for (const propertyId of source.properties$.value) {
    const name = source.propertyNameGet(propertyId);
    if (!(name in cells)) continue;
    let value = cells[name];
    if (name === 'Date') {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
        throw new Error('Date must be YYYY-MM-DD');
      value = new Date(`${value}T12:00:00`).getTime();
    } else if (name === 'Focus') {
      if (typeof value !== 'string') throw new Error('Focus must be text');
      value = new Text(value);
    } else if (name === 'Done') {
      if (typeof value !== 'boolean')
        throw new Error('Done must be true or false');
    } else if (name === 'Score') {
      if (typeof value !== 'number' || !Number.isFinite(value))
        throw new Error('Score must be a finite number');
    } else continue;
    changes.push({ propertyId, value });
  }
  for (const change of changes)
    source.cellValueChange(rowId, change.propertyId, change.value);
}

function run(docs: DocsService, command: Command) {
  switch (command.action) {
    case 'list_pages':
      return {
        pages: docs.list.docs$.value
          .filter(record => !record.trash$.value)
          .map(record => ({
            id: record.id,
            title: record.title$.value,
            nativeDashboard:
              record.customProperty$('kafene:native-dashboard').value === '1',
          })),
      };
    case 'get_page':
      return withNativePage(docs, asString(command.docId, 'docId'), store => ({
        blocks: pageBlocks(store),
      }));
    case 'create_page': {
      const id = createNativePage(
        docs,
        asString(command.title, 'title'),
        validateBlocks(command.blocks),
        command.isTemplate === true
      );
      return { id };
    }
    case 'append_blocks':
      return withNativePage(docs, asString(command.docId, 'docId'), store => ({
        ids: appendNativeBlocks(store, validateBlocks(command.blocks)),
      }));
    case 'repair_callouts':
      return withNativePage(docs, asString(command.docId, 'docId'), store => ({
        repaired: repairNativeCallouts(store),
      }));
    case 'tidy_cat_tables':
      return withNativePage(docs, asString(command.docId, 'docId'), store => {
        const note = store.getBlocksByFlavour('affine:note')[0]?.model;
        if (!note) throw new Error('Native document note not found');
        const changed: string[] = [];
        for (const child of note.children) {
          if (child.flavour !== 'affine:database') continue;
          const database = child as DatabaseBlockModel;
          const title = database.props.title.toString();
          if (title !== 'CAT daily plan' && title !== 'Mock results & review')
            continue;
          const source = new DatabaseBlockDataSource(database);
          const properties = source.properties$.value.map(id => ({
            id,
            name: source.propertyNameGet(id),
          }));
          const remove = title === 'CAT daily plan' ? 'Score' : 'Done';
          const unused = properties.find(property => property.name === remove);
          if (unused) source.propertyDelete(unused.id);
          const doneId =
            title === 'CAT daily plan'
              ? properties.find(property => property.name === 'Done')?.id
              : undefined;
          configureNativeTable(source, doneId);
          changed.push(title);
        }
        return { changed };
      });
    case 'update_todo':
      return withNativePage(docs, asString(command.docId, 'docId'), store => {
        const id = asString(command.blockId, 'blockId');
        const block = store.getBlock(id)?.model;
        if (
          !block ||
          block.flavour !== 'affine:list' ||
          (block as unknown as { props: { type?: string } }).props.type !==
            'todo'
        )
          throw new Error('To-do block not found');
        store.updateBlock(block, { checked: command.checked === true });
        return { id, checked: command.checked === true };
      });
    case 'add_database_row':
    case 'update_database_row':
      return withNativePage(docs, asString(command.docId, 'docId'), store => {
        const database = store.getBlock(
          asString(command.databaseId, 'databaseId')
        )?.model as DatabaseBlockModel | undefined;
        if (!database || database.flavour !== 'affine:database')
          throw new Error('Database block not found');
        const adding = command.action === 'add_database_row';
        const id = adding
          ? store.addBlock(
              'affine:paragraph',
              { text: new Text(asString(command.text, 'text')) },
              database.id
            )
          : asString(command.rowId, 'rowId');
        if (!adding) {
          const row = database.children.find(child => child.id === id);
          if (!row) throw new Error('Database row not found');
          if (command.text !== undefined)
            store.updateBlock(row, {
              text: new Text(asString(command.text, 'text')),
            });
        }
        const source = new DatabaseBlockDataSource(database);
        updateCells(source, id, command.cells);
        return { id };
      });
    default:
      throw new Error(`Unknown action: ${command.action}`);
  }
}

export function NativeAgentBridge() {
  const docs = useService(DocsService);
  useEffect(() => {
    if (location.origin !== 'http://127.0.0.1:49327') return;
    let stopped = false;
    const poll = async () => {
      try {
        const response = await fetch('/kafene/agent/next', {
          headers: { 'X-Kafene-Agent': 'renderer' },
        });
        const payload = (await response.json()) as {
          commands: { id: string; command: Command }[];
        };
        for (const item of payload.commands) {
          if (stopped) return;
          let result: object;
          try {
            result = run(docs, item.command);
          } catch (error) {
            result = {
              error: error instanceof Error ? error.message : String(error),
            };
          }
          await fetch(`/kafene/agent/results/${item.id}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Kafene-Agent': 'renderer',
            },
            body: JSON.stringify(result),
          });
        }
      } catch (error) {
        console.warn('Kafene agent bridge', error);
      }
      if (!stopped)
        window.setTimeout(() => {
          poll().catch(console.error);
        }, 500);
    };
    poll().catch(console.error);
    return () => {
      stopped = true;
    };
  }, [docs]);
  return null;
}
