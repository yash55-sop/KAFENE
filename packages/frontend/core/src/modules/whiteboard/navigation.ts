import type { History, Transition } from 'history';

/** Keep the current canvas mounted until its last scene is on AFFiNE storage. */
export function protectWhiteboardNavigation(
  history: Pick<History, 'block'>,
  flush: () => void,
  hasPending: () => boolean,
  waitForSaved: (signal: AbortSignal) => Promise<void>,
  onError: (error: unknown) => void
) {
  let active = true;
  let waiting = false;
  let destination: Transition | undefined;
  const controller = new AbortController();
  const block = (transition: Transition) => {
    destination = transition;
    if (waiting) return;
    waiting = true;
    (async () => {
      do {
        flush();
        if (hasPending())
          throw new Error(
            'The drawing could not be saved. Retry or export a backup before leaving.'
          );
        await waitForSaved(controller.signal);
      } while (active && hasPending());
      if (!active) return;
      // A user may select another destination while a save is in progress.
      const next = destination;
      destination = undefined;
      unblock();
      next?.retry();
      if (active) unblock = history.block(block);
    })()
      .catch(error => {
        if (active && !controller.signal.aborted) onError(error);
      })
      .finally(() => {
        waiting = false;
      });
  };
  let unblock = history.block(block);
  return () => {
    active = false;
    controller.abort();
    unblock();
  };
}
