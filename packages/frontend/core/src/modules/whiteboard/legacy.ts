import type { WhiteboardScene } from './scene';

/** Read-only migration source for the old iframe integration. Never creates a DB. */
export function readLegacyWhiteboard(
  factory: IDBFactory,
  workspaceId: string
): Promise<WhiteboardScene | null> {
  return new Promise((resolve, reject) => {
    const request = factory.open('affine-whiteboards');
    let absent = false;
    request.onupgradeneeded = () => {
      absent = true;
      request.transaction?.abort();
    };
    request.onerror = () => (absent ? resolve(null) : reject(request.error));
    request.onblocked = () =>
      reject(
        new Error('Close older whiteboard tabs to import the saved board.')
      );
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('boards')) {
        db.close();
        resolve(null);
        return;
      }
      const transaction = db.transaction('boards', 'readonly');
      const read = transaction
        .objectStore('boards')
        .get([workspaceId, 'scene']);
      transaction.oncomplete = () => {
        db.close();
        const value = read.result;
        if (!value) {
          resolve(null);
          return;
        }
        if (
          !Array.isArray(value.elements) ||
          !value.files ||
          typeof value.files !== 'object'
        ) {
          reject(
            new Error(
              'The previous whiteboard could not be read. Its original data has been preserved.'
            )
          );
          return;
        }
        resolve(value);
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
      transaction.onabort = () => {
        db.close();
        reject(transaction.error);
      };
    };
  });
}
