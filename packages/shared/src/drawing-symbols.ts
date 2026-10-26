export interface DrawingSymbolDefinition {
  code: string;
  name: string;
  path: string;
  bounds?: { x: number; y: number; width: number; height: number };
  dash?: string;
  color?: string;
  accentPath?: string;
  defaultRotation?: number;
  defaultScale?: number;
  defaultStrokeWidth?: number;
}
export const drawingSymbols = [
  {
    code: 'isometric-tank',
    name: 'Tanque cilíndrico isométrico',
    path: 'M-32-66C-32-84 32-102 32-84C32-66-32-48-32-66Z M-32 84C-32 66 32 48 32 66C32 84-32 102-32 84Z M-32-66V84 M32-84V66',
    bounds: { x: -32, y: -90, width: 64, height: 180 },
    dash: '1 3',
    color: '#285580',
    defaultRotation: 0,
    defaultScale: 2,
    defaultStrokeWidth: 1.2,
  },
  {
    code: 'actuated-valve',
    name: 'Válvula com atuador',
    path: 'M-32 18L-22 12 M22-12L32-18 M-26-4V28 M-22-6V26 M22-32V6 M26-34V4 M-18-4L18 6V-25L-18 25Z M-7 0A7 7 0 1 0 7 0A7 7 0 1 0-7 0',
    accentPath: 'M0-7V-45 M-14-39V-73L14-89V-55Z M-14-73C-18-80 12-98 14-89',
    bounds: { x: -32, y: -96, width: 64, height: 124 },
    defaultRotation: 0,
    defaultScale: 1.5,
    defaultStrokeWidth: 1.8,
  },
  {
    code: 'valve-actuator',
    name: 'Atuador separado',
    path: 'M0 30V0 M-14 6V-28L14-44V-10Z M-14-28C-18-35 12-53 14-44',
    bounds: { x: -18, y: -50, width: 36, height: 80 },
    color: '#285580',
    defaultRotation: 0,
    defaultScale: 1.5,
    defaultStrokeWidth: 1.5,
  },
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
] as const satisfies readonly DrawingSymbolDefinition[];

export function drawingSymbolDefinition(
  code: string,
): DrawingSymbolDefinition & { bounds: NonNullable<DrawingSymbolDefinition['bounds']> } {
  const definition: DrawingSymbolDefinition =
    drawingSymbols.find((s) => s.code === code) ?? drawingSymbols.find((s) => s.code === 'valve')!;
  return { ...definition, bounds: definition.bounds ?? { x: -35, y: -35, width: 70, height: 70 } };
}

export function drawingSymbolPreview(code: string, color: string) {
  const symbol = drawingSymbolDefinition(code),
    b = symbol.bounds;
  const stroke = `fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x - 8} ${b.y - 8} ${b.width + 16} ${b.height + 16}"><path d="${symbol.path}" ${stroke}${symbol.dash ? ` stroke-dasharray="${symbol.dash}"` : ''}/>${symbol.accentPath ? `<path d="${symbol.accentPath}" ${stroke}/>` : ''}</svg>`;
}
