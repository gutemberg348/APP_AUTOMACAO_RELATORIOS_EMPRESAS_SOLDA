import { z } from 'zod';

export const drawingWidth = 1000;
export const drawingHeight = 800;
const coord = z.number().finite().min(0).max(1000);
const xy = { x: coord, y: z.number().finite().min(0).max(drawingHeight) };
const id = z.string().min(1).max(100);
export const drawingSymbols = [
  { code: 'valve', name: 'Válvula', path: 'M-22-13 22 13V-13L-22 13Z M0 0V-28 M-10-28H10' },
  { code: 'flange', name: 'Flange', path: 'M-6-20V20 M6-20V20 M-24 0H-6 M6 0H24' },
  { code: 'reducer', name: 'Redução', path: 'M-24-15 24-7V7L-24 15Z' },
  {
    code: 'support',
    name: 'Suporte',
    path: 'M0-18V12 M-20 12H20 M-15 12-23 22 M0 12-8 22 M15 12 7 22',
  },
  {
    code: 'pump',
    name: 'Bomba',
    path: 'M0-22A22 22 0 1 0 0 22A22 22 0 1 0 0-22 M-12-12 15 0-12 12Z M-30 0H-22 M22 0H35',
  },
  {
    code: 'tank',
    name: 'Tanque',
    path: 'M-30-30Q0-45 30-30V30Q0 45-30 30Z M-30-30Q0-15 30-30 M-30 30Q0 15 30 30',
  },
  { code: 'flow', name: 'Sentido de fluxo', path: 'M-25 0H25 M12-12 25 0 12 12' },
  {
    code: 'ball-valve',
    name: 'Válvula de esfera',
    path: 'M-22-14 22 14V-14L-22 14Z M-27-18V18 M27-18V18 M-7 0A7 7 0 1 0 7 0A7 7 0 1 0-7 0 M0-14V-32H20',
  },
  { code: 'tee', name: 'Conexão em T', path: 'M-30 0H30 M0 0V-30 M-30-7V7 M30-7V7 M-7-30H7' },
  { code: 'elbow', name: 'Curva / cotovelo', path: 'M-30 0H-10Q0 0 0-10V-30 M-30-7V7 M-7-30H7' },
  { code: 'cap', name: 'Tampão', path: 'M-30 0H0 M0-20V20 M7-15Q25 0 7 15' },
  {
    code: 'union',
    name: 'União',
    path: 'M-30 0H-13 M13 0H30 M-13-14H13V14H-13Z M-6-14V14 M6-14V14',
  },
] as const;
const line = { x1: coord, y1: xy.y, x2: coord, y2: xy.y };
export const drawingElementSchema = z.discriminatedUnion('type', [
  z.object({ id, type: z.literal('line'), ...line }).strict(),
  z
    .object({
      id,
      type: z.literal('polyline'),
      points: z.array(z.object(xy).strict()).min(2).max(300),
    })
    .strict(),
  z
    .object({
      id,
      type: z.literal('point'),
      reportPointId: id,
      ...xy,
      labelX: coord.optional(),
      labelY: xy.y.optional(),
    })
    .strict(),
  z
    .object({
      id,
      type: z.literal('marker'),
      number: z.string().trim().min(1).max(100),
      ...xy,
      labelX: coord.optional(),
      labelY: xy.y.optional(),
      acceptable: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      id,
      type: z.literal('text'),
      text: z.string().min(1).max(300),
      ...xy,
      size: z.number().min(10).max(40).optional(),
      rotation: z.number().finite().min(-360).max(360).optional(),
    })
    .strict(),
  z
    .object({
      id,
      type: z.literal('symbol'),
      symbolCode: z.enum(drawingSymbols.map((symbol) => symbol.code)),
      ...xy,
      rotation: z.number().finite().min(-360).max(360),
      scale: z.number().finite().min(0.5).max(3).optional(),
    })
    .strict(),
  z
    .object({
      id,
      type: z.literal('dimension'),
      ...line,
      text: z.string().min(1).max(100),
      offset: z.number().min(-150).max(150).default(35),
    })
    .strict(),
]);
export const drawingDataSchema = z
  .object({
    schemaVersion: z.literal(1),
    title: z.string().max(150).default('Croqui de inspeção'),
    revision: z.string().max(30).default('00'),
    grid: z.enum(['isometric', 'orthogonal', 'none']).default('isometric'),
    notes: z.string().max(2000).default(''),
    elements: z.array(drawingElementSchema).max(600),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (new Set(data.elements.map((e) => e.id)).size !== data.elements.length)
      ctx.addIssue({
        code: 'custom',
        path: ['elements'],
        message: 'Há elementos com identificação repetida no desenho.',
      });
    const points = data.elements.flatMap((e) => (e.type === 'point' ? [e.reportPointId] : []));
    if (new Set(points).size !== points.length)
      ctx.addIssue({
        code: 'custom',
        path: ['elements'],
        message: 'Cada ponto pode aparecer uma vez por prancha.',
      });
  });
export const reportDrawingSchema = z
  .object({ id: z.uuid().optional(), data: drawingDataSchema })
  .strict();
export type DrawingElement = z.infer<typeof drawingElementSchema>;
export type DrawingData = z.infer<typeof drawingDataSchema>;
export type ReportDrawing = z.infer<typeof reportDrawingSchema>;
export type DrawingPosition = { x: number; y: number };
export type DrawingPoint = {
  id?: string;
  clientId?: string;
  number: string;
  data?: { acceptable?: boolean };
};
export const newDrawingData = (): DrawingData => ({
  schemaVersion: 1,
  title: 'Croqui de inspeção',
  revision: '00',
  grid: 'isometric',
  notes: '',
  elements: [],
});
export const drawingId = () =>
  'local-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
export const pointKey = (point: DrawingPoint) => point.id ?? point.clientId ?? '';
export function removePointFromDrawings(
  drawings: ReportDrawing[],
  point: DrawingPoint,
  keepInDrawing: boolean,
) {
  return drawings.map((drawing) => ({
    ...drawing,
    data: {
      ...drawing.data,
      elements: drawing.data.elements.flatMap((element): DrawingElement[] => {
        if (element.type !== 'point' || element.reportPointId !== pointKey(point)) return [element];
        return keepInDrawing
          ? [
              {
                id: element.id,
                type: 'marker',
                number: point.number.trim() || '?',
                x: element.x,
                y: element.y,
                labelX: element.labelX,
                labelY: element.labelY,
                ...(typeof point.data?.acceptable === 'boolean'
                  ? { acceptable: point.data.acceptable }
                  : {}),
              },
            ]
          : [];
      }),
    },
  }));
}
export function nextPointNumber(points: { number: string }[]) {
  const last = points
    .at(-1)
    ?.number.trim()
    .match(/^(.*?)(\d+)$/);
  const prefix = last?.[1] ?? '';
  const width = last?.[2]?.length ?? 1;
  let n = last ? BigInt(last[2]!) + 1n : 1n;
  const used = new Set(points.map((p) => p.number.trim().toLocaleUpperCase()));
  const equivalent = new Set(
    points.flatMap((p) => {
      const match = p.number.trim().match(/^(.*?)(\d+)$/);
      return match ? [match[1]!.toLocaleUpperCase() + BigInt(match[2]!).toString()] : [];
    }),
  );
  while (
    used.has((prefix + n.toString().padStart(width, '0')).toLocaleUpperCase()) ||
    equivalent.has(prefix.toLocaleUpperCase() + n.toString())
  )
    n++;
  return prefix + n.toString().padStart(width, '0');
}
export function clampPosition(p: DrawingPosition): DrawingPosition {
  return {
    x: Math.max(0, Math.min(drawingWidth, p.x)),
    y: Math.max(0, Math.min(drawingHeight, p.y)),
  };
}
export function snapPosition(p: DrawingPosition, grid: DrawingData['grid']): DrawingPosition {
  if (grid === 'none') return clampPosition(p);
  if (grid === 'orthogonal')
    return clampPosition({ x: Math.round(p.x / 20) * 20, y: Math.round(p.y / 20) * 20 });
  const dx = 20 * Math.sqrt(3),
    col = Math.round(p.x / dx);
  return clampPosition({ x: col * dx, y: Math.round((p.y - col * 20) / 40) * 40 + col * 20 });
}
export function constrainPosition(
  p: DrawingPosition,
  start: DrawingPosition,
  grid: DrawingData['grid'],
): DrawingPosition {
  if (grid === 'none') return clampPosition(p);
  const angles =
    grid === 'isometric' ? [Math.PI / 6, Math.PI / 2, (5 * Math.PI) / 6] : [0, Math.PI / 2];
  const dx = p.x - start.x,
    dy = p.y - start.y;
  const candidates = angles.map((a) => {
    const len = dx * Math.cos(a) + dy * Math.sin(a);
    return { x: start.x + Math.cos(a) * len, y: start.y + Math.sin(a) * len };
  });
  candidates.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
  const best = candidates[0]!,
    vx = best.x - start.x,
    vy = best.y - start.y;
  const scale = Math.min(
    1,
    vx > 0 ? (drawingWidth - start.x) / vx : vx < 0 ? -start.x / vx : 1,
    vy > 0 ? (drawingHeight - start.y) / vy : vy < 0 ? -start.y / vy : 1,
  );
  return { x: start.x + vx * scale, y: start.y + vy * scale };
}
const distance = (p: DrawingPosition, a: DrawingPosition, b: DrawingPosition) => {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};
export function hitElement(elements: DrawingElement[], p: DrawingPosition, tolerance = 18) {
  return [...elements].reverse().find((e) => {
    if (e.type === 'dimension') {
      const length = Math.hypot(e.x2 - e.x1, e.y2 - e.y1) || 1;
      const dx = (-(e.y2 - e.y1) / length) * e.offset,
        dy = ((e.x2 - e.x1) / length) * e.offset;
      return (
        distance(p, { x: e.x1 + dx, y: e.y1 + dy }, { x: e.x2 + dx, y: e.y2 + dy }) < tolerance
      );
    }
    if (e.type === 'line')
      return distance(p, { x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 }) < tolerance;
    if (e.type === 'polyline') {
      if (e.points.slice(1).some((b, i) => distance(p, e.points[i]!, b) < tolerance)) return true;
      const first = e.points[0]!,
        last = e.points.at(-1)!;
      if (e.points.length < 4 || first.x !== last.x || first.y !== last.y) return false;
      let inside = false;
      for (let i = 0, j = e.points.length - 1; i < e.points.length; j = i++) {
        const a = e.points[i]!,
          b = e.points[j]!;
        if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
          inside = !inside;
      }
      return inside;
    }
    if (
      (e.type === 'point' || e.type === 'marker') &&
      Math.hypot((e.labelX ?? e.x + 32) - p.x, (e.labelY ?? e.y - 32) - p.y) < tolerance + 10
    )
      return true;
    if (e.type === 'text') {
      const angle = ((e.rotation ?? 0) * Math.PI) / 180;
      const dx = p.x - e.x,
        dy = p.y - e.y;
      const x = dx * Math.cos(angle) + dy * Math.sin(angle),
        y = -dx * Math.sin(angle) + dy * Math.cos(angle);
      const lines = e.text.split(/\r?\n/),
        size = e.size ?? 20;
      return (
        x >= -tolerance &&
        x <= Math.max(...lines.map((line) => line.length)) * size * 0.55 + tolerance &&
        y >= -size - tolerance &&
        y <= (lines.length - 1) * size * 1.25 + tolerance
      );
    }
    if (e.type === 'symbol')
      return Math.hypot(e.x - p.x, e.y - p.y) < 35 * (e.scale ?? 1) + tolerance;
    return Math.hypot(e.x - p.x, e.y - p.y) < tolerance + 10;
  });
}
export function moveElement(e: DrawingElement, dx: number, dy: number): DrawingElement {
  const coords =
    e.type === 'line' || e.type === 'dimension'
      ? [
          { x: e.x1, y: e.y1 },
          { x: e.x2, y: e.y2 },
        ]
      : e.type === 'polyline'
        ? e.points
        : [
            { x: e.x, y: e.y },
            ...((e.type === 'point' || e.type === 'marker') &&
            e.labelX !== undefined &&
            e.labelY !== undefined
              ? [{ x: e.labelX, y: e.labelY }]
              : []),
          ];
  dx = Math.max(
    -Math.min(...coords.map((p) => p.x)),
    Math.min(drawingWidth - Math.max(...coords.map((p) => p.x)), dx),
  );
  dy = Math.max(
    -Math.min(...coords.map((p) => p.y)),
    Math.min(drawingHeight - Math.max(...coords.map((p) => p.y)), dy),
  );
  if (e.type === 'line' || e.type === 'dimension')
    return { ...e, x1: e.x1 + dx, y1: e.y1 + dy, x2: e.x2 + dx, y2: e.y2 + dy };
  if (e.type === 'polyline')
    return { ...e, points: e.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
  return {
    ...e,
    x: e.x + dx,
    y: e.y + dy,
    ...((e.type === 'point' || e.type === 'marker') &&
    e.labelX !== undefined &&
    e.labelY !== undefined
      ? { labelX: e.labelX + dx, labelY: e.labelY + dy }
      : {}),
  };
}
const esc = (v: unknown) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const num = (v: number) => Number(v.toFixed(3));
export function drawingSvg(
  data: DrawingData,
  points: DrawingPoint[],
  options: { selectedId?: string; viewBox?: string; showGrid?: boolean } = {},
) {
  const grid = data.grid ?? 'isometric';
  let body = '<rect width="1000" height="800" fill="#fff"/>';
  if (options.showGrid !== false && grid !== 'none') {
    let d = '';
    if (grid === 'orthogonal') {
      for (let x = 0; x <= 1000; x += 20) d += `M${x} 0V800 `;
      for (let y = 0; y <= 800; y += 20) d += `M0 ${y}H1000 `;
    } else {
      const dx = 20 * Math.sqrt(3);
      for (let x = 0; x <= 1000; x += dx) d += `M${num(x)} 0V800 `;
      for (let y = -600; y <= 1400; y += 40)
        d += `M0 ${y}l1000 ${num(1000 / Math.sqrt(3))} M0 ${y}l1000 ${num(-1000 / Math.sqrt(3))} `;
    }
    body += `<path d="${d}" stroke="#E4EAF2" stroke-width=".7" fill="none"/>`;
  }
  for (const e of data.elements) {
    const selected = options.selectedId === e.id,
      color = selected ? '#1764C0' : '#263D52';
    const stroke = `stroke="${color}" stroke-width="${selected ? 4 : 2.6}" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
    if (e.type === 'line')
      body += `<line x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}" ${stroke}/>`;
    if (e.type === 'polyline')
      body += `<polyline points="${e.points.map((p) => p.x + ',' + p.y).join(' ')}" ${stroke}/>`;
    if (e.type === 'symbol')
      body += `<path d="${drawingSymbols.find((s) => s.code === e.symbolCode)?.path ?? ''}" transform="translate(${e.x} ${e.y}) rotate(${e.rotation}) scale(${e.scale ?? 1})" ${stroke}/>`;
    if (e.type === 'text')
      body += `<text x="${e.x}" y="${e.y}" transform="rotate(${e.rotation ?? 0} ${e.x} ${e.y})" font-family="Arial" font-size="${e.size ?? 20}" fill="${selected ? '#1764C0' : '#285580'}">${e.text
        .split(/\r?\n/)
        .map(
          (line, i) =>
            `<tspan x="${e.x}" dy="${i ? (e.size ?? 20) * 1.25 : 0}">${esc(line)}</tspan>`,
        )
        .join('')}</text>`;
    if (e.type === 'dimension') {
      const len = Math.hypot(e.x2 - e.x1, e.y2 - e.y1) || 1,
        nx = -(e.y2 - e.y1) / len,
        ny = (e.x2 - e.x1) / len,
        ox = nx * e.offset,
        oy = ny * e.offset;
      const a = { x: e.x1 + ox, y: e.y1 + oy },
        b = { x: e.x2 + ox, y: e.y2 + oy };
      body += `<path d="M${e.x1} ${e.y1}L${a.x + nx * 8} ${a.y + ny * 8} M${e.x2} ${e.y2}L${b.x + nx * 8} ${b.y + ny * 8} M${a.x} ${a.y}L${b.x} ${b.y} M${a.x - 6} ${a.y - 6}l12 12 M${b.x - 6} ${b.y - 6}l12 12" stroke="${color}" stroke-width="1.2" fill="none"/>`;
      body += `<text x="${(a.x + b.x) / 2}" y="${(a.y + b.y) / 2 - 8}" text-anchor="middle" font-family="Arial" font-size="18" fill="${color}" stroke="white" stroke-width="4" paint-order="stroke">${esc(e.text)}</text>`;
    }
    if (e.type === 'point' || e.type === 'marker') {
      const point =
          e.type === 'point' ? points.find((p) => pointKey(p) === e.reportPointId) : undefined,
        number = e.type === 'marker' ? e.number : point?.number || '?',
        x = e.labelX ?? Math.min(960, e.x + 32),
        y = e.labelY ?? Math.max(26, e.y - 32),
        status = e.type === 'marker' ? e.acceptable : point?.data?.acceptable;
      const tone = selected
        ? '#1764C0'
        : status === false
          ? '#AF302B'
          : status === true
            ? '#16725B'
            : '#1764C0';
      body += `<path d="M${e.x} ${e.y}L${x} ${y}" stroke="${tone}" stroke-width="1.5"/><circle cx="${e.x}" cy="${e.y}" r="5" fill="${tone}" stroke="white" stroke-width="1.5"/><rect x="${x - Math.max(18, number.length * 6 + 6)}" y="${y - 15}" width="${Math.max(36, number.length * 12 + 12)}" height="30" rx="8" fill="white" stroke="${tone}" stroke-width="2"/><text x="${x}" y="${y + 6}" text-anchor="middle" font-family="Arial" font-size="18" font-weight="bold" fill="${tone}">${esc(number)}</text>`;
    }
    if (selected && (e.type === 'line' || e.type === 'dimension'))
      for (const p of [
        { x: e.x1, y: e.y1 },
        { x: e.x2, y: e.y2 },
      ])
        body += `<circle cx="${p.x}" cy="${p.y}" r="5" fill="white" stroke="#1764C0" stroke-width="2"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${options.viewBox ?? '0 0 1000 800'}" width="100%" height="100%">${body}</svg>`;
}
