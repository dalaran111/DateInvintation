/** @param {(busy: boolean) => void} onBusy */
export function createTransitionSequence(onBusy) {
  let running = false;
  let active = true;
  return {
    /** @param {() => Promise<unknown>} effect @param {() => unknown} action */
    async run(effect, action) {
      if (running || !active) return false;
      running = true;
      onBusy(true);
      try {
        await effect();
        if (!active) return false;
        await action();
        return true;
      } finally {
        running = false;
        if (active) onBusy(false);
      }
    },
    cancel() { active = false; },
  };
}
