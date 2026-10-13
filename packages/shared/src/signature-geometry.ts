export type SignaturePoint = { x: number; y: number };

// Keep the proportions of the hand movement when converting a phone/tablet canvas to PNG.
export function fitSignatureStrokes(strokes: SignaturePoint[][], height = 500) {
  const points = strokes.flat();
  if (!points.length) return [];
  const minX = Math.min(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const width = Math.max(1, Math.max(...points.map((p) => p.x)) - minX);
  const inkHeight = Math.max(1, Math.max(...points.map((p) => p.y)) - minY);
  const scale = Math.min(900 / width, (height * 0.8) / inkHeight, 2);
  const left = (1000 - width * scale) / 2;
  const top = (height - inkHeight * scale) / 2;
  return strokes.map((stroke) =>
    stroke.map((p) => ({
      x: left + (p.x - minX) * scale,
      y: top + (p.y - minY) * scale,
    })),
  );
}

export function signatureStrokePath(points: SignaturePoint[]) {
  if (points.length < 2) return '';
  const n = (value: number) => Number(value.toFixed(2));
  let path = `M${n(points[0]!.x)} ${n(points[0]!.y)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]!,
      next = points[i + 1]!;
    path += ` Q${n(p.x)} ${n(p.y)} ${n((p.x + next.x) / 2)} ${n((p.y + next.y) / 2)}`;
  }
  const last = points.at(-1)!;
  return path + ` L${n(last.x)} ${n(last.y)}`;
}
