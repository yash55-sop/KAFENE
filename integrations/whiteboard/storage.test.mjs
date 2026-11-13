import assert from 'node:assert/strict';
import { test } from 'node:test';
import { IDBFactory } from 'fake-indexeddb';
import {
  createSaveQueue,
  openBoardDatabase,
  readBoard,
  writeBoard,
} from './storage.mjs';

test('drawings, viewport and image files survive reopening and stay scoped to a workspace', async () => {
  const factory = new IDBFactory();
  const db = await openBoardDatabase(factory);
  const scene = {
    elements: [{ id: 'image', fileId: 'file-1' }],
    appState: { zoom: { value: 1.5 } },
    files: { 'file-1': { dataURL: 'data:image/png;base64,test' } },
  };
  await writeBoard(db, 'workspace-a', scene);
  await writeBoard(db, 'workspace-a', [{ id: 'library-item' }], 'library');
  db.close();
  const reopened = await openBoardDatabase(factory);
  assert.deepEqual(await readBoard(reopened, 'workspace-a'), scene);
  assert.equal(await readBoard(reopened, 'workspace-b'), null);
  assert.deepEqual(await readBoard(reopened, 'workspace-a', 'library'), [
    { id: 'library-item' },
  ]);
  reopened.close();
});

test('rapid drawing updates save the most recent state after an in-flight write', async () => {
  let release;
  const gate = new Promise(resolve => {
    release = resolve;
  });
  const writes = [];
  const queue = createSaveQueue(async value => {
    await gate;
    writes.push(value);
  });
  queue.save('first');
  queue.save('second');
  queue.save('latest');
  release();
  await queue.flush();
  assert.deepEqual(writes, ['first', 'latest']);
});

test('failed saves report an error and subsequent changes can save again', async () => {
  const status = [];
  let fail = true;
  const queue = createSaveQueue(
    async () => {
      if (fail) throw new Error('Quota exceeded');
    },
    state => status.push(state)
  );
  await queue.save('drawing');
  assert.equal(status.at(-1), 'error');
  fail = false;
  await queue.save('next drawing');
  assert.equal(status.at(-1), 'saved');
});
