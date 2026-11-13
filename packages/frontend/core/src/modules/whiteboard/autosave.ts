import type { WhiteboardScene } from './scene';

/** Synchronous Yjs commits; AFFiNE's engine owns disk writes and sync retries. */
export function createWhiteboardAutosave(
  write: (scene: WhiteboardScene) => void,
  onError: (error: unknown) => void,
  onPending: (pending: boolean) => void
) {
  let pending: WhiteboardScene | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let maximum: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    clearTimeout(timer);
    clearTimeout(maximum);
    timer = maximum = undefined;
    if (!pending) return;
    try {
      write(pending);
      pending = undefined;
      onPending(false);
    } catch (error) {
      // Retain the latest scene so Retry or the next edit can commit it.
      onError(error);
    }
  };
  return {
    save(scene: WhiteboardScene) {
      pending = scene;
      onPending(true);
      clearTimeout(timer);
      timer = setTimeout(flush, 200);
      maximum ??= setTimeout(flush, 1000);
    },
    flush,
    get pending() {
      return !!pending;
    },
    dispose() {
      flush();
    },
  };
}
