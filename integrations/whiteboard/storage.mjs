const DATABASE = 'affine-whiteboards';
const STORE = 'boards';

export function openBoardDatabase(indexedDB) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error('Close other whiteboard tabs and retry.'));
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

export function readBoard(db, workspace, kind = 'scene') {
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(STORE)
      .objectStore(STORE)
      .get([workspace, kind]);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

export function writeBoard(db, workspace, value, kind = 'scene') {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put(value, [workspace, kind]);
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('Save aborted'));
    transaction.onerror = () => reject(transaction.error);
  });
}

// One write in flight per board. Coalesce rapid pointer changes without a timer,
// so leaving the page never abandons a debounced save.
export function createSaveQueue(write, report = () => {}) {
  let pending;
  let running;
  const drain = async () => {
    report('saving');
    try {
      while (pending !== undefined) {
        const next = pending;
        pending = undefined;
        await write(next);
      }
      report('saved');
    } catch (error) {
      report('error', error);
    } finally {
      running = undefined;
    }
  };
  return {
    save(value) {
      pending = value;
      running ??= drain();
      return running;
    },
    flush: () => running ?? Promise.resolve(),
  };
}
