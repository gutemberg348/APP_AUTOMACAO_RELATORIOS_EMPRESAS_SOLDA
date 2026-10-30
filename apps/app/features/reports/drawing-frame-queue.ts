/** Coalesce visual gesture updates, but flush the last position before committing. */
export function createDrawingFrameQueue<T>(
  apply: (value: T) => void,
  request: (callback: () => void) => number = requestAnimationFrame,
  cancel: (id: number) => void = cancelAnimationFrame,
) {
  let frame: number | undefined;
  let pending: { value: T } | undefined;
  const flush = () => {
    if (frame !== undefined) cancel(frame);
    frame = undefined;
    const next = pending;
    pending = undefined;
    if (next) apply(next.value);
  };
  return {
    push(value: T) {
      pending = { value };
      if (frame === undefined) frame = request(flush);
    },
    flush,
    clear() {
      if (frame !== undefined) cancel(frame);
      frame = undefined;
      pending = undefined;
    },
  };
}
