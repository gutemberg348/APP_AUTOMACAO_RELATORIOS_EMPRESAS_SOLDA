export type DrawingHSV = { h: number; s: number; v: number };
export function hsvColor({ h, s, v }: DrawingHSV) {
  const hue = (((h % 360) + 360) % 360) / 60;
  const c = v * s,
    x = c * (1 - Math.abs((hue % 2) - 1)),
    m = v - c;
  const rgb =
    hue < 1
      ? [c, x, 0]
      : hue < 2
        ? [x, c, 0]
        : hue < 3
          ? [0, c, x]
          : hue < 4
            ? [0, x, c]
            : hue < 5
              ? [x, 0, c]
              : [c, 0, x];
  return (
    '#' +
    rgb
      .map((n) =>
        Math.round(Math.max(0, Math.min(1, n + m)) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
      .toUpperCase()
  );
}
export function colorHSV(color: string): DrawingHSV {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return { h: 210, s: 0.8, v: 0.8 };
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  const h = !d
    ? 0
    : max === r
      ? 60 * (((g - b) / d) % 6)
      : max === g
        ? 60 * ((b - r) / d + 2)
        : 60 * ((r - g) / d + 4);
  return { h: (h + 360) % 360, s: max ? d / max : 0, v: max };
}
