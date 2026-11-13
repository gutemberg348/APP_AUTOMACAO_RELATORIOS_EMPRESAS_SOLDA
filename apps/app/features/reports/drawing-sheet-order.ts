/** Destination is the final, zero-based position after removing the moved sheet. */
export function moveDrawingSheet<T>(sheets: T[], from: number, destination: number): T[] {
  if (from < 0 || from >= sheets.length || destination < 0 || destination >= sheets.length)
    return sheets;
  if (from === destination) return sheets;
  const next = [...sheets];
  const [sheet] = next.splice(from, 1);
  next.splice(destination, 0, sheet!);
  return next;
}

export function insertDrawingSheet<T>(sheets: T[], sheet: T, position: number): T[] {
  const next = [...sheets];
  next.splice(Math.max(0, Math.min(sheets.length, position)), 0, sheet);
  return next;
}
