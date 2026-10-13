export function inputScrollOffset(
  offset: number,
  viewport: { top: number; height: number },
  input: { top: number; height: number },
) {
  if (viewport.height <= 0) return offset;
  const padding = Math.min(12, Math.max(0, (viewport.height - input.height) / 2));
  const delta =
    input.height > viewport.height || input.top < viewport.top + padding
      ? input.top - viewport.top - padding
      : Math.max(0, input.top + input.height - (viewport.top + viewport.height - padding));
  return Math.max(0, offset + delta);
}
