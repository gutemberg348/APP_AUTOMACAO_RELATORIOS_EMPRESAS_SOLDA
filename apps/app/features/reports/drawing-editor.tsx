import { useTheme } from '../../utils/theme';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Vibration,
  Keyboard,
  ScrollView,
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle,
  type PanResponderCallbacks,
  type ViewInstance,
} from 'react-native';
import { SvgXml } from 'react-native-svg';
import { DrawingWorkspace } from './drawing-workspace';
import { DrawingSelectionPanel } from './drawing-selection-panel';
import { DrawingSelectionQuickOptions } from './drawing-selection-quick-options';
import {
  drawingGroupMembers,
  drawingUnlocked,
  drawingLayerChange,
  drawingLineEndpoint,
  drawingSnap,
} from '@weldcosta/shared';
import { MediaSourcePicker } from '../../components/media-source-picker';
import { useDrawingImages, drawingImageSize } from './drawing-images';
import { useReportPhotoDrafts } from './report-photo-drafts';
import type { ReportMedia } from '@weldcosta/shared';
import { DrawingToolStrip } from './drawing-tool-strip';
import {
  DrawingStrokePanel,
  strokeStyleLabels,
  type StrokeAppearance,
} from './drawing-stroke-panel';
import { PickerSheet } from '../../components/picker-sheet';
import { InputVisibilityContext } from '../../components/input-visibility';
import { usePageScroll } from '../../components/page-scroll';
import {
  clampPosition,
  constrainPosition,
  drawingId,
  drawingSvg,
  drawingSymbols,
  drawingSymbolDefinition,
  drawingSymbolPreview,
  hasDrawingStroke,
  drawingStrokeWidth,
  drawingStrokeColor,
  drawingStrokeStyle,
  hitElement,
  moveElement,
  transformDrawingElement,
  moveHatchCorner,
  transformHatch,
  newDrawingData,
  nextPointNumber,
  pointKey,
  snapPosition,
  appendStrokePoint,
  sketchElement,
  drawingViewport,
  zoomDrawingAt,
  drawingSelectionBounds,
  selectDrawingLasso,
  transformDrawingSelection,
  normalizeDrawingAngle,
  type SketchTool,
  type DrawingData,
  type DrawingElement,
  type DrawingPosition,
  type ReportDrawing,
  type ReportPoint,
} from '@weldcosta/shared';
import {
  Badge,
  Button,
  Card,
  Field,
  FormCell,
  FormGrid,
  PanelHeader,
  IconButton,
  selectionState,
} from '../../components/ui';
import { SelectField } from '../../components/select-field';
import { ConfirmDialog } from '../../components/confirm-dialog';

import { Icon, type IconName } from '../../components/icon';

// Rotation/translation do not change this measure, unlike an axis-aligned box.
function selectionSize(elements: DrawingElement[]) {
  const size = elements.reduce((total, e) => {
    if (e.type === 'line' || e.type === 'dimension')
      return total + Math.hypot(e.x2 - e.x1, e.y2 - e.y1);
    if (e.type === 'polyline')
      return (
        total +
        e.points
          .slice(1)
          .reduce((sum, p, i) => sum + Math.hypot(p.x - e.points[i]!.x, p.y - e.points[i]!.y), 0)
      );
    if (e.type === 'image') return total + Math.hypot(e.width, e.height);
    if (e.type === 'symbol') return total + (e.scale ?? 1);
    if (e.type === 'text') return total + (e.size ?? 20);
    return total;
  }, 0);
  if (size > 0) return size;
  const dots = elements.filter((e) => e.type === 'point' || e.type === 'marker');
  const origin = dots[0];
  return origin ? dots.reduce((sum, p) => sum + Math.hypot(p.x - origin.x, p.y - origin.y), 0) : 0;
}

type Tool =
  | 'lasso'
  | 'hatch'
  | 'select'
  | 'pipe'
  | 'line'
  | 'point'
  | 'symbol'
  | 'text'
  | 'annotation'
  | 'dimension'
  | 'pan'
  | SketchTool;
const sketchTools: Tool[] = ['pencil', 'straighten', 'circle', 'rectangle'];
// Screen pixels: the same touch tolerance at any zoom level.
const drawingDragThreshold = 6;
const primaryTools: Tool[] = [
  'straighten',
  'pipe',
  'pencil',
  'select',
  'lasso',
  'point',
  'symbol',
  'text',
  'hatch',
  'circle',
  'rectangle',
  'annotation',
  'dimension',
  'pan',
  'line',
];
const tools: { id: Tool; name: string; icon: IconName; hint: string }[] = [
  {
    id: 'lasso',
    name: 'Laço',
    icon: 'lasso',
    hint: 'Contorne os elementos para mover e girar juntos. Só entra no bloco o que ficar inteiramente dentro do laço.',
  },
  {
    id: 'hatch',
    name: 'Hachura triangular',
    icon: 'layers',
    hint: 'Toque nos três cantos do trecho. Depois ajuste o tamanho e as linhas da hachura. Use Texto ou Cota para informar a medida real.',
  },
  {
    id: 'pencil',
    name: 'Lápis livre',
    icon: 'pencil',
    hint: 'Desenhe com o dedo ou mouse. O traço acompanha sua mão, sem prender à malha.',
  },
  {
    id: 'straighten',
    name: 'Endireitar',
    icon: 'line',
    hint: 'Desenhe à mão. Ao soltar, o traço vira uma linha reta entre o início e o fim.',
  },
  {
    id: 'circle',
    name: 'Círculo',
    icon: 'circle',
    hint: 'Toque no centro e arraste para definir o tamanho do círculo.',
  },
  {
    id: 'rectangle',
    name: 'Retângulo',
    icon: 'rectangle',
    hint: 'Arraste de um canto até o canto oposto para criar a forma.',
  },
  {
    id: 'select',
    name: 'Selecionar',
    icon: 'cursor',
    hint: 'Toque na linha ou dentro da forma para selecionar. Arraste o elemento para mover; no espaço vazio, mova a prancha.',
  },
  {
    id: 'pipe',
    name: 'Tubulação',
    icon: 'pipe',
    hint: 'Arraste para desenhar. Ou toque no início e no fim de cada trecho. A linha acompanha os eixos da malha.',
  },
  {
    id: 'line',
    name: 'Linha',
    icon: 'line',
    hint: 'Arraste do início ao fim ou toque nos dois extremos. Use a malha livre para qualquer direção.',
  },
  {
    id: 'point',
    name: 'Ponto',
    icon: 'pin',
    hint: 'Toque na posição da solda ou medição. A marcação usa o mesmo número das fotos e resultados.',
  },
  {
    id: 'symbol',
    name: 'Símbolos',
    icon: 'valve',
    hint: 'Escolha um componente e toque para inserir. A rotação pode ser ajustada nas propriedades.',
  },
  {
    id: 'text',
    name: 'Texto',
    icon: 'text',
    hint: 'Escreva a identificação e toque no desenho para posicioná-la.',
  },
  {
    id: 'annotation',
    name: 'Anotação',
    icon: 'pencil',
    hint: 'Escreva uma anotação para aparecer abaixo deste desenho no PDF.',
  },
  {
    id: 'dimension',
    name: 'Cota',
    icon: 'ruler',
    hint: 'Informe a medida real e toque nos dois extremos. A cota é informativa; o desenho não calcula medidas de campo.',
  },
  {
    id: 'pan',
    name: 'Mão',
    icon: 'move',
    hint: 'Arraste para mover. Com dois dedos, mova e amplie em qualquer ferramenta. No computador, use a roda do mouse.',
  },
];
tools.sort((a, b) => primaryTools.indexOf(a.id) - primaryTools.indexOf(b.id));
type Snapshot = { drawings: ReportDrawing[]; points: ReportPoint[] };
export function DrawingPreview({
  data,
  points,
  images,
}: {
  data: DrawingData;
  points: ReportPoint[];
  images?: Record<string, string>;
}) {
  const { tokens: t } = useTheme();
  return (
    <View
      style={{
        aspectRatio: 1.25,
        width: '100%',
        borderWidth: 1,
        borderColor: t.colors.line,
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      <SvgXml xml={drawingSvg(data, points, { images })} width="100%" height="100%" />
    </View>
  );
}
function Numeric({
  label,
  value,
  onChange,
  min = 0,
  max = 1000,
}: {
  label: string;
  value: number;
  onChange(v: number): void;
  min?: number;
  max?: number;
}) {
  const [draft, setDraft] = useState<string>(),
    [focused, setFocused] = useState(false);
  return (
    <Field
      label={label}
      keyboardType="decimal-pad"
      value={focused ? (draft ?? String(value)) : String(Math.round(value * 10) / 10)}
      onFocus={() => {
        setDraft(String(Math.round(value * 10) / 10));
        setFocused(true);
      }}
      onBlur={() => setFocused(false)}
      onChangeText={(v) => {
        setDraft(v);
        const n = Number(v.replace(',', '.'));
        if (v.trim() && Number.isFinite(n) && n >= min && n <= max) onChange(n);
      }}
    />
  );
}
function RotationButtons({ value, onChange }: { value: number; onChange(angle: number): void }) {
  const turn = (amount: number) => onChange(((value + amount + 540) % 360) - 180);
  return (
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      <Button title="Girar 15° à esquerda" small secondary icon="undo" onPress={() => turn(-15)} />
      <Button title="Girar 15° à direita" small secondary icon="redo" onPress={() => turn(15)} />
      <Button title="Girar 90°" small secondary onPress={() => turn(90)} />
    </View>
  );
}
export function DrawingEditor({
  value,
  points,
  onChange,
  onPointsChange,
  editable,
  canEditPoints,
  measurement = false,
  savedVersion,
  onRemovePoint,
  onRemovePoints,
  pointPhotoCount,
  reportId,
  media,
  photoDraftKey,
  canUploadImages = false,
}: {
  reportId?: string;
  media?: ReportMedia[];
  photoDraftKey?: string;
  canUploadImages?: boolean;
  value: ReportDrawing[];
  points: ReportPoint[];
  onChange(value: ReportDrawing[]): void;
  onPointsChange(value: ReportPoint[]): void;
  editable: boolean;
  canEditPoints: boolean;
  measurement?: boolean;
  savedVersion?: number;
  onRemovePoint(key: string): boolean;
  onRemovePoints(keys: string[], clearDrawingIndex: number): boolean;
  pointPhotoCount(key: string): number;
}) {
  const { tokens: t, styles } = useTheme();
  const revealInline = usePageScroll();
  const lastCanvasLayout = useRef<{ expanded: boolean; width: number } | undefined>(undefined);
  const [expanded, setExpanded] = useState(false);
  const [imageSourceOpen, setImageSourceOpen] = useState(false);
  const drawingImages = useDrawingImages(reportId, media, photoDraftKey);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [clearMode, setClearMode] = useState<'strokes' | 'points' | 'all' | 'selection'>();
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [selectionOptionsOpen, setSelectionOptionsOpen] = useState(false);
  const [contextOptionsOpen, setContextOptionsOpen] = useState(false);
  const [canvasGestureActive, setCanvasGestureActive] = useState(false);
  const [entry, setEntry] = useState<'point' | 'text'>();
  const [textPosition, setTextPosition] = useState<DrawingPosition>();
  const surface = useRef<ViewInstance>(null);
  const wheelHandler = useRef<(event: WheelEvent) => void>(() => {});
  const multiTouch = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancelHold = useCallback(() => {
    clearTimeout(holdTimer.current);
    holdTimer.current = undefined;
  }, []);
  useEffect(() => () => cancelHold(), [cancelHold]);
  const touchOrigin = useRef({ x: 0, y: 0 });
  const pinch = useRef<
    | {
        distance: number;
        center: DrawingPosition;
        anchor: DrawingPosition;
        view: { x: number; y: number; w: number; h: number };
        width: number;
        height: number;
        angle: number;
        element?: DrawingElement;
        result?: DrawingElement;
        elements?: DrawingElement[];
        results?: DrawingElement[];
      }
    | undefined
  >(undefined);
  const [showProperties, setShowProperties] = useState(false);
  const [directSelection, setDirectSelection] = useState(false);
  const [nearbyIds, setNearbyIds] = useState<string[]>([]);
  const [selectionPickerOpen, setSelectionPickerOpen] = useState(false);
  const [selectionPanelOpen, setSelectionPanelOpen] = useState(false);
  const [lockedImagesOpen, setLockedImagesOpen] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapGuide, setSnapGuide] = useState<ReturnType<typeof drawingSnap>>();
  const endpointGesture = useRef<
    | {
        element: DrawingElement;
        end: 0 | 1;
        start: DrawingPosition;
        ratio: number;
        result?: DrawingElement;
      }
    | undefined
  >(undefined);
  const [blockIds, setBlockIds] = useState<string[]>([]);
  const [blockDraft, setBlockDraft] = useState<DrawingElement[]>();
  const [lassoPath, setLassoPath] = useState<DrawingPosition[]>([]);
  const [rotationDelta, setRotationDelta] = useState<number>();
  const [blockAngle, setBlockAngle] = useState(0);
  const blockGesture = useRef<
    | {
        mode: 'lasso' | 'move' | 'rotate' | 'resize';
        view: { x: number; y: number; w: number; h: number };
        start: DrawingPosition;
        samples: DrawingPosition[];
        elements: DrawingElement[];
        result?: DrawingElement[];
        pivot: DrawingPosition;
        angle: number;
        delta: number;
        ratio: number;
      }
    | undefined
  >(undefined);
  const [stroke, setStroke] = useState<DrawingPosition[]>([]);
  const [height, setHeight] = useState(480);
  const [advanced, setAdvanced] = useState(false);
  const [sheetDetails, setSheetDetails] = useState(false);
  const [precisePosition, setPrecisePosition] = useState(false);
  const [traceEnd, setTraceEnd] = useState<DrawingPosition>();
  const [traceStart, setTraceStart] = useState<DrawingPosition>();
  const [index, setIndex] = useState(0),
    [tool, setTool] = useState<Tool>('pencil'),
    [selected, setSelected] = useState(''),
    [start, setStart] = useState<DrawingPosition>();
  const [draftElement, setDraftElement] = useState<DrawingElement>(),
    [width, setWidth] = useState(600);
  const [view, setView] = useState({ x: 0, y: 0, w: 1000, h: 800 });
  const [pointTarget, setPointTarget] = useState('new'),
    [newNumber, setNewNumber] = useState<string>(),
    [text, setText] = useState(''),
    [dimension, setDimension] = useState('');
  const [textSize, setTextSize] = useState(20);
  const [strokeWidth, setStrokeWidth] = useState(2.6);
  const [strokeColor, setStrokeColor] = useState<string>();
  const [strokeStyle, setStrokeStyle] = useState<StrokeAppearance['strokeStyle']>();
  const [strokePanelOpen, setStrokePanelOpen] = useState(false);
  const [selectionOpacity, setSelectionOpacity] = useState(0.5);
  const [moveStep, setMoveStep] = useState(5);
  const propertiesView = useRef<ViewInstance>(null);
  const [hatchCorners, setHatchCorners] = useState<DrawingPosition[]>([]);
  const [hatchDefaults, setHatchDefaults] = useState({ spacing: 8, angle: 90, strokeWidth: 1.2 });
  const annotationField = useRef<ViewInstance>(null);
  const [textRotation, setTextRotation] = useState(0);
  const [symbolScale, setSymbolScale] = useState(1);
  const [symbol, setSymbol] = useState('valve'),
    [rotation, setRotation] = useState(30),
    [deleteSheet, setDeleteSheet] = useState(false);
  const [history, setHistory] = useState<Snapshot[]>([]),
    [future, setFuture] = useState<Snapshot[]>([]);
  useEffect(() => {
    setHistory([]);
    setFuture([]);
    setStart(undefined);
  }, [savedVersion]);
  const gesture = useRef<
    | {
        start: DrawingPosition;
        original?: DrawingElement;
        view: typeof view;
        width: number;
        samples: DrawingPosition[];
        held?: boolean;
        selectionOnly?: boolean;
        drawingStarted: boolean;
        corner?: number;
        dx: number;
        dy: number;
      }
    | undefined
  >(undefined);
  const [message, setMessage] = useState('');
  const [removingPoint, setRemovingPoint] = useState<{
    key: string;
    elementId: string;
    number: string;
  }>();
  const viewport = drawingViewport(view, width, height);
  const screen = useWindowDimensions();
  const mobile = screen.width < 1000;
  const activeIndex = Math.min(index, Math.max(0, value.length - 1)),
    drawing = value[activeIndex],
    data = drawing?.data;
  const selectedElement = data?.elements.find((e) => e.id === selected);
  const editingSelection =
    !!selectedElement && drawingUnlocked(selectedElement) && (tool === 'select' || directSelection);
  const blockElements =
    data?.elements.filter((e) => blockIds.includes(e.id) && drawingUnlocked(e)) ?? [];
  const editingBlock = blockElements.length > 1;
  useEffect(() => {
    if (!selectedElement?.groupId || !(tool === 'select' || directSelection) || !data) return;
    const members = drawingGroupMembers(data.elements, [selectedElement.id]);
    if (members.length > 1) {
      setSelected('');
      setDirectSelection(false);
      setBlockIds(members.map((e) => e.id));
      setBlockAngle(0);
    }
  }, [selectedElement, data, tool, directSelection]);
  const transformElements = editingBlock
    ? blockElements
    : editingSelection
      ? [selectedElement!]
      : [];
  const visibleTransformElements =
    blockDraft ?? (draftElement && editingSelection ? [draftElement] : transformElements);
  const sizeSelectionKey = transformElements
    .map((e) => e.id)
    .sort()
    .join('|');
  const currentSelectionSize = selectionSize(visibleTransformElements);
  const [sizeReference, setSizeReference] = useState({ key: '', size: 0 });
  useEffect(() => {
    setSizeReference((previous) =>
      previous.key === sizeSelectionKey
        ? previous
        : { key: sizeSelectionKey, size: currentSelectionSize },
    );
  }, [sizeSelectionKey, currentSelectionSize]);
  const selectionPercent =
    sizeReference.key === sizeSelectionKey && sizeReference.size > 0
      ? (currentSelectionSize / sizeReference.size) * 100
      : 100;
  const transformBounds = visibleTransformElements.length
    ? drawingSelectionBounds(visibleTransformElements)
    : undefined;
  const canRotateSelection =
    editingBlock ||
    (editingSelection && selectedElement?.type !== 'point' && selectedElement?.type !== 'marker');
  const rotationHandle =
    transformBounds && editable && canRotateSelection
      ? {
          center: transformBounds.center,
          handle: {
            x: Math.max(
              viewport.x + (24 * viewport.w) / width,
              Math.min(
                viewport.x + viewport.w - (24 * viewport.w) / width,
                transformBounds.center.x,
              ),
            ),
            y: Math.max(
              viewport.y + (28 * viewport.w) / width,
              transformBounds.y - (32 * viewport.w) / width,
            ),
          },
        }
      : undefined;
  const insertedSymbol =
    tool === 'symbol' && selectedElement?.type === 'symbol' ? selectedElement : undefined;
  const strokeTarget =
    selectedElement && hasDrawingStroke(selectedElement) && (editingSelection || insertedSymbol)
      ? selectedElement
      : undefined;
  const currentStrokeWidth = strokeTarget ? drawingStrokeWidth(strokeTarget) : strokeWidth;
  const currentStrokeAppearance: StrokeAppearance = {
    strokeWidth: currentStrokeWidth,
    strokeColor: strokeTarget ? drawingStrokeColor(strokeTarget) : (strokeColor ?? '#263D52'),
    strokeStyle: strokeTarget ? drawingStrokeStyle(strokeTarget) : (strokeStyle ?? 'solid'),
  };
  const updateStrokeAppearance = (patch: Partial<StrokeAppearance>) => {
    if (strokeTarget) updateElement({ ...strokeTarget, ...patch });
    else {
      if (patch.strokeWidth !== undefined) setStrokeWidth(patch.strokeWidth);
      if (patch.strokeColor !== undefined) setStrokeColor(patch.strokeColor);
      if (patch.strokeStyle !== undefined) setStrokeStyle(patch.strokeStyle);
    }
  };
  const showStrokeControls =
    !!strokeTarget ||
    (!editingSelection &&
      [...sketchTools, 'line', 'pipe', 'dimension', 'symbol', 'hatch'].includes(tool));
  const changeStrokeWidth = (amount: number) => {
    const next = Math.round(Math.max(0.5, Math.min(12, currentStrokeWidth + amount)) * 10) / 10;
    if (strokeTarget) updateElement({ ...strokeTarget, strokeWidth: next });
    else setStrokeWidth(next);
  };
  const changeSymbolRotation = (angle: number) => {
    setRotation(angle);
    if (insertedSymbol) updateElement({ ...insertedSymbol, rotation: angle });
  };
  useEffect(() => {
    cancelHold();
    setHatchCorners([]);
    gesture.current = undefined;
    setDraftElement(undefined);
    setBlockDraft(undefined);
    setLassoPath([]);
    setRotationDelta(undefined);
    blockGesture.current = undefined;
    setStroke([]);
    setTraceStart(undefined);
    setTraceEnd(undefined);
  }, [activeIndex, expanded, editable, savedVersion, cancelHold]);
  useEffect(() => {
    setBlockIds([]);
    setBlockAngle(0);
  }, [activeIndex, savedVersion]);
  const linkedPoint =
    selectedElement?.type === 'point'
      ? points.find((p) => pointKey(p) === selectedElement.reportPointId)
      : undefined;
  const markedPointKeys = new Set(
    value.flatMap((sheet) =>
      sheet.data.elements.flatMap((element) =>
        element.type === 'point' ? [element.reportPointId] : [],
      ),
    ),
  );
  const unplacedPoints = points.filter((point) => !markedPointKeys.has(pointKey(point)));
  const duplicateNumber =
    pointTarget === 'new' && newNumber?.trim()
      ? points.find(
          (point) =>
            point.number.trim().toLocaleUpperCase() === newNumber.trim().toLocaleUpperCase(),
        )
      : undefined;
  const removeSelected = () => {
    if (!data || !selectedElement || !editable) return;
    if (selectedElement.type === 'point') {
      Keyboard.dismiss();
      setRemovingPoint({
        key: selectedElement.reportPointId,
        elementId: selectedElement.id,
        number: linkedPoint?.number ?? '?',
      });
      return;
    }
    updateData({ ...data, elements: data.elements.filter((e) => e.id !== selected) });
    finishSelection();
  };
  const deleteSelectionOrClean = () => {
    if (!editable || !data) return;
    resetGesture();
    const ids = editingBlock ? blockIds : editingSelection ? [selectedElement.id] : [];
    if (!ids.length) {
      setCleanupOpen(true);
      return;
    }
    // This shortcut removes drawing objects/markers only. Inspection records
    // and attached photos remain available in the report, and undo restores it.
    updateData({ ...data, elements: data.elements.filter((e) => !ids.includes(e.id)) });
    finishSelection();
  };
  const commit = (drawings: ReportDrawing[], nextPoints = points) => {
    setHistory((old) => [...old.slice(-39), { drawings: value, points }]);
    setFuture([]);
    onChange(drawings);
    if (nextPoints !== points) onPointsChange(nextPoints);
  };
  const updateData = (next: DrawingData, nextPoints = points) =>
    commit(
      value.map((d, i) => (i === activeIndex ? { ...d, data: next } : d)),
      nextPoints,
    );
  const add = (element: DrawingElement, nextPoints = points) => {
    setBlockIds([]);
    if (!data || data.elements.length >= 600) {
      setMessage('Limite de 600 elementos nesta prancha. Crie outra prancha para continuar.');
      return false;
    }
    const next = hasDrawingStroke(element)
      ? {
          ...element,
          strokeWidth: element.strokeWidth ?? strokeWidth,
          ...(strokeColor && element.strokeColor === undefined ? { strokeColor } : {}),
          ...(strokeStyle && element.strokeStyle === undefined ? { strokeStyle } : {}),
        }
      : element;
    updateData({ ...data, elements: [...data.elements, next] }, nextPoints);
    const autoSelect =
      element.type === 'image' ||
      element.type === 'symbol' ||
      element.type === 'text' ||
      (element.type === 'polyline' && ['circle', 'rectangle', 'hatch'].includes(tool));
    setSelected(autoSelect ? element.id : '');
    setDirectSelection(autoSelect);
    if (autoSelect) {
      setShowProperties(false);
      setToolsOpen(false);
    }
    setMessage('');
    return true;
  };
  const updateElement = (element: DrawingElement) =>
    data &&
    updateData({
      ...data,
      elements: data.elements.map((e) => (e.id === element.id ? element : e)),
    });
  const updateBlock = (elements: DrawingElement[]) => {
    if (!data) return;
    const replacements = new Map(elements.map((e) => [e.id, e]));
    updateData({ ...data, elements: data.elements.map((e) => replacements.get(e.id) ?? e) });
  };
  const selectionAction = (
    action: 'group' | 'ungroup' | 'duplicate' | 'front' | 'back' | 'lock',
  ) => {
    if (!data || !editable || !transformElements.length) return;
    const ids = transformElements.map((e) => e.id);
    if (action === 'front' || action === 'back') {
      updateData({ ...data, elements: drawingLayerChange(data.elements, ids, action === 'front') });
      return;
    }
    if (action === 'group' || action === 'ungroup') {
      const groupId = action === 'group' ? drawingId() : undefined;
      updateBlock(transformElements.map((e) => ({ ...e, groupId })));
      setMessage(
        action === 'group'
          ? 'Grupo criado. Toque em qualquer parte para selecionar o conjunto.'
          : 'Grupo separado. Agora cada elemento pode ser selecionado.',
      );
      return;
    }
    if (action === 'lock') {
      const image = transformElements[0];
      if (image?.type === 'image') {
        updateElement({ ...image, locked: true, groupId: undefined });
        finishSelection();
        setMessage('Imagem bloqueada. Use Imagens bloqueadas para liberar.');
      }
      return;
    }
    if (data.elements.length + transformElements.length > 600) {
      setMessage('Não há espaço para essa cópia. Limite de 600 elementos por folha.');
      return;
    }
    if (!canEditPoints && transformElements.some((e) => e.type === 'point')) {
      setMessage('Você precisa de permissão para criar os pontos da cópia.');
      return;
    }
    const nextPoints = [...points],
      groupId = transformElements.length > 1 ? drawingId() : undefined;
    const copies = transformDrawingSelection(transformElements, 0, 24, 24).map((e) => {
      const clone = { ...e, id: drawingId(), groupId };
      if (clone.type === 'point') {
        const point: ReportPoint = {
          clientId: drawingId(),
          number: nextPointNumber(nextPoints),
          type: measurement ? 'MEASUREMENT' : 'WELD',
          data: { discontinuity: '-' },
        };
        nextPoints.push(point);
        return { ...clone, reportPointId: pointKey(point) };
      }
      return clone;
    });
    updateData(
      {
        ...data,
        elements: drawingLayerChange(
          [...data.elements, ...copies],
          copies.map((e) => e.id),
          true,
        ),
      },
      nextPoints,
    );
    setBlockIds(copies.length > 1 ? copies.map((e) => e.id) : []);
    setSelected(copies.length === 1 ? copies[0]!.id : '');
    setDirectSelection(copies.length === 1);
    setTool('select');
    setMessage('Cópia criada e selecionada. Arraste para posicionar.');
  };
  const selectionAngle = editingBlock
    ? blockAngle
    : selectedElement?.type === 'symbol' ||
        selectedElement?.type === 'text' ||
        selectedElement?.type === 'image'
      ? (selectedElement.rotation ?? 0)
      : selectedElement?.type === 'line' || selectedElement?.type === 'dimension'
        ? (Math.atan2(
            selectedElement.y2 - selectedElement.y1,
            selectedElement.x2 - selectedElement.x1,
          ) *
            180) /
          Math.PI
        : blockAngle;
  const shownAngle = normalizeDrawingAngle(selectionAngle + (rotationDelta ?? 0));
  const rotateSelection = (angle: number) => {
    if (!transformElements.length) return;
    const result = transformDrawingSelection(transformElements, angle);
    if (result === transformElements) {
      setMessage('Não há espaço para esse giro. Afaste a seleção da borda do desenho.');
      return;
    }
    updateBlock(result);
    setBlockAngle((old) => normalizeDrawingAngle(old + angle));
  };
  const resizeBlock = (factor: number) => {
    const result = transformDrawingSelection(blockElements, 0, 0, 0, factor);
    if (JSON.stringify(result) === JSON.stringify(blockElements)) {
      setMessage(
        '⚠️ O bloco atingiu o limite da folha ou de um dos objetos. Para ampliar só a visualização, use o zoom com dois dedos.',
      );
      return;
    }
    setMessage('');
    updateBlock(result);
  };
  const resizeSelectionPrecisely = (factor: number) => {
    if (!transformElements.length) return;
    const result = transformDrawingSelection(transformElements, 0, 0, 0, factor);
    if (JSON.stringify(result) === JSON.stringify(transformElements)) {
      setMessage(
        '⚠️ A seleção atingiu o limite da folha ou do objeto. Para ampliar só a visualização, use o zoom com dois dedos sem seleção.',
      );
      return;
    }
    setMessage('');
    updateBlock(result);
  };
  const selectWholeDrawing = () => {
    if (!data?.elements.length) return;
    finishSelection();
    setTool('select');
    const unlocked = data.elements.filter(drawingUnlocked);
    if (unlocked.length === 1) {
      setSelected(unlocked[0]!.id);
      setDirectSelection(true);
    } else setBlockIds(unlocked.map((e) => e.id));
    setToolsOpen(false);
    setShowProperties(false);
    setMessage('');
  };
  const selectTool = (next: Tool) => {
    setContextOptionsOpen(false);
    setSelectionOptionsOpen(false);
    setSelectionPanelOpen(false);
    setNearbyIds([]);
    setSelectionPickerOpen(false);
    setStrokePanelOpen(false);
    setBlockIds([]);
    setBlockAngle(0);
    cancelHold();
    setHatchCorners([]);
    setDirectSelection(false);
    if (next !== 'select') setSelected('');
    Keyboard.dismiss();
    setTool(next);
    setToolsOpen(false);
    if (next === 'point' && !canEditPoints && pointTarget === 'new' && points.length) {
      setPointTarget(pointKey(unplacedPoints[0] ?? points[0]!));
    }
    setStart(undefined);
    setTraceStart(undefined);
    setTraceEnd(undefined);
    setStroke([]);
    gesture.current = undefined;
    if (next === 'text') {
      setTextPosition(undefined);
      setEntry('text');
    }
    if (expanded) setShowProperties(['annotation', 'symbol', 'dimension'].includes(next));
    else if (next === 'annotation') revealInline(annotationField.current);
    setMessage('');
  };
  const finishSelection = () => {
    setContextOptionsOpen(false);
    setSelectionOptionsOpen(false);
    setSelectionPanelOpen(false);
    setNearbyIds([]);
    setSelectionPickerOpen(false);
    setStrokePanelOpen(false);
    setBlockIds([]);
    setBlockAngle(0);
    cancelHold();
    setSelected('');
    setDirectSelection(false);
    setShowProperties(false);
    setStart(undefined);
    setTool('select');
  };
  const undo = (redo = false) => {
    setBlockIds([]);
    setBlockAngle(0);
    cancelHold();
    if (hatchCorners.length && !redo) {
      setHatchCorners(hatchCorners.slice(0, -1));
      setMessage(
        hatchCorners.length > 1
          ? 'Toque no canto ' + hatchCorners.length + '.'
          : 'Toque no primeiro canto da hachura.',
      );
      return;
    }
    const stack = redo ? future : history,
      last = stack.at(-1);
    if (!last) return;
    if (redo) {
      setFuture(stack.slice(0, -1));
      setHistory([...history, { drawings: value, points }]);
    } else {
      setHistory(stack.slice(0, -1));
      setFuture([...future, { drawings: value, points }]);
    }
    onChange(last.drawings);
    if (canEditPoints) onPointsChange(last.points);
    if (editingSelection) finishSelection();
    else setSelected('');
    setStart(undefined);
  };
  const changePoint = (patch: Partial<ReportPoint>) => {
    if (!linkedPoint) return;
    commit(
      value,
      points.map((p) => (pointKey(p) === pointKey(linkedPoint) ? { ...p, ...patch } : p)),
    );
  };
  const smartSnap = (p: DrawingPosition, excluded: string[] = [], show = true) => {
    if (!snapEnabled) {
      if (show) setSnapGuide(undefined);
      return p;
    }
    const guide = drawingSnap(
      p,
      data?.elements.filter((e) => !excluded.includes(e.id)) ?? [],
      (10 * view.w) / width,
    );
    if (show) setSnapGuide(guide);
    return guide.position;
  };
  const moveSnapped = (element: DrawingElement, dx: number, dy: number, show = true) => {
    const center = drawingSelectionBounds([element]).center;
    const target = smartSnap({ x: center.x + dx, y: center.y + dy }, [element.id], show);
    return moveElement(element, target.x - center.x, target.y - center.y);
  };
  const place = (raw: DrawingPosition, origin = start) => {
    if (!data) return;
    if (
      data.elements.length >= 600 &&
      tool !== 'select' &&
      tool !== 'pan' &&
      !(
        tool === 'point' &&
        data.elements.some(
          (element) => element.type === 'point' && element.reportPointId === pointTarget,
        )
      )
    ) {
      setMessage('Limite de 600 elementos nesta prancha. Crie outra prancha para continuar.');
      return;
    }
    const p = smartSnap(snapPosition(raw, data.grid), [], false);
    if (tool === 'hatch') {
      const corners = [...hatchCorners, p];
      if (corners.length < 3) {
        setHatchCorners(corners);
        setMessage('');
        return;
      }
      const [a, b, c] = corners as [DrawingPosition, DrawingPosition, DrawingPosition];
      if (Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) < 20) {
        setMessage(
          'O terceiro canto precisa ficar fora da linha dos dois primeiros. Toque em outra posição.',
        );
        return;
      }
      add({
        id: drawingId(),
        type: 'polyline',
        points: [a, b, c, a],
        hatch: { spacing: hatchDefaults.spacing, angle: hatchDefaults.angle },
        strokeWidth: hatchDefaults.strokeWidth,
      });
      setHatchCorners([]);
      setDirectSelection(true);
      setShowProperties(false);
      return;
    }
    if (tool === 'pipe' || tool === 'line' || tool === 'dimension') {
      if (!origin) {
        setStart(p);
        return;
      }
      origin = smartSnap(origin, [], false);
      const end = smartSnap(
        tool === 'dimension' ? p : constrainPosition(p, origin, data.grid),
        [],
        false,
      );
      if (Math.hypot(origin.x - end.x, origin.y - end.y) < 4) return;
      if (tool === 'dimension' && !dimension.trim()) {
        setMessage('Informe o texto da cota, por exemplo: 1.500 mm.');
        return;
      }
      const line = { id: drawingId(), x1: origin.x, y1: origin.y, x2: end.x, y2: end.y };
      add(
        tool === 'dimension'
          ? { ...line, type: 'dimension', text: dimension.trim(), offset: 35 }
          : { ...line, type: 'line' },
      );
      setStart(tool === 'pipe' ? end : undefined);
      return;
    }
    if (tool === 'point') {
      if (pointTarget === 'new') {
        if (!canEditPoints) {
          setMessage('Selecione um ponto já cadastrado para marcar.');
          return;
        }
        const number = newNumber?.trim() || nextPointNumber(points);
        if (
          points.some((p) => p.number.trim().toLocaleUpperCase() === number.toLocaleUpperCase())
        ) {
          setMessage('Este número já existe. Selecione o ponto existente ou use outro número.');
          return;
        }
        const point: ReportPoint = {
          clientId: drawingId(),
          number,
          type: measurement ? 'MEASUREMENT' : 'WELD',
          value: null,
          unit: measurement ? 'mm' : '',
          data: { discontinuity: '-' },
        };
        add(
          {
            id: drawingId(),
            type: 'point',
            reportPointId: pointKey(point),
            ...p,
          },
          [...points, point],
        );
        setNewNumber(undefined);
        return;
      }
      if (data.elements.some((e) => e.type === 'point' && e.reportPointId === pointTarget)) {
        const existing = data.elements.find(
          (e) => e.type === 'point' && e.reportPointId === pointTarget,
        );
        if (existing?.type !== 'point') return;
        updateElement(moveElement(existing, p.x - existing.x, p.y - existing.y));
        if (canEditPoints) setPointTarget('new');
        setNewNumber(undefined);
        setMessage(
          canEditPoints
            ? 'Marcação reposicionada. A numeração automática está pronta para o próximo ponto.'
            : 'Marcação reposicionada. Use Alterar para escolher outro ponto.',
        );
        return;
      }
      add({
        id: drawingId(),
        type: 'point',
        reportPointId: pointTarget,
        ...p,
      });
      const next = unplacedPoints.find((point) => pointKey(point) !== pointTarget);
      setPointTarget(next ? pointKey(next) : canEditPoints ? 'new' : pointTarget);
      setNewNumber(undefined);
      setMessage(
        next
          ? `Ponto marcado. Agora toque para posicionar o ponto ${next.number}.`
          : canEditPoints
            ? 'Ponto marcado. Continue tocando para criar os próximos números.'
            : 'Ponto marcado. Use Alterar para escolher outro ponto.',
      );
      return;
    }
    if (tool === 'text') {
      if (!text.trim()) {
        setTextPosition(p);
        setEntry('text');
        return;
      }
      add({
        id: drawingId(),
        type: 'text',
        text: text.trim(),
        ...p,
        size: textSize,
        rotation: textRotation,
      });
      setText('');
      setMessage('');
      return;
    }
    if (tool === 'symbol')
      add({
        id: drawingId(),
        type: 'symbol',
        symbolCode: symbol as 'valve',
        rotation,
        scale: symbolScale,
        ...p,
      });
  };
  const resetGesture = () => {
    endpointGesture.current = undefined;
    setSnapGuide(undefined);
    blockGesture.current = undefined;
    setBlockDraft(undefined);
    setLassoPath([]);
    setRotationDelta(undefined);
    cancelHold();
    gesture.current = undefined;
    pinch.current = undefined;
    setDraftElement(undefined);
    setTraceStart(undefined);
    setTraceEnd(undefined);
    setStroke([]);
  };
  wheelHandler.current = (event) => {
    resetGesture();
    event.preventDefault();
    const bounds = (surface.current as unknown as HTMLElement)?.getBoundingClientRect();
    if (!bounds) return;
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1);
    setView((old) =>
      zoomDrawingAt(
        old,
        width,
        height,
        { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
        Math.exp(-Math.max(-200, Math.min(200, delta)) / 400),
      ),
    );
  };
  const onWheel = useRef((event: WheelEvent) => wheelHandler.current(event));
  const setSurface = useCallback((node: ViewInstance | null) => {
    if (Platform.OS === 'web') {
      const previous = surface.current as unknown as HTMLElement | null;
      previous?.removeEventListener?.('wheel', onWheel.current);
      const next = node as unknown as HTMLElement | null;
      next?.addEventListener?.('wheel', onWheel.current, { passive: false });
    }
    surface.current = node;
  }, []);
  const gestureCallbacks = useRef<PanResponderCallbacks>({});
  gestureCallbacks.current = {
    onPanResponderStart: (event, state) => {
      if (event.nativeEvent.touches.length >= 2)
        gestureCallbacks.current.onPanResponderMove?.(event, state);
    },
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (event) => {
      setCanvasGestureActive(true);
      setContextOptionsOpen(false);
      setSelectionOptionsOpen(false);
      cancelHold();
      resetGesture();
      multiTouch.current = false;
      pinch.current = undefined;
      touchOrigin.current = {
        x: event.nativeEvent.pageX - event.nativeEvent.locationX,
        y: event.nativeEvent.pageY - event.nativeEvent.locationY,
      };
      const p = {
        x: viewport.x + (event.nativeEvent.locationX / width) * viewport.w,
        y: viewport.y + (event.nativeEvent.locationY / width) * viewport.w,
      };
      if (editable && editingBlock) {
        const bounds = drawingSelectionBounds(blockElements);
        const corners = [
          { x: bounds.x - 8, y: bounds.y - 8 },
          { x: bounds.x + bounds.width + 8, y: bounds.y - 8 },
          { x: bounds.x + bounds.width + 8, y: bounds.y + bounds.height + 8 },
          { x: bounds.x - 8, y: bounds.y + bounds.height + 8 },
        ];
        if (corners.some((c) => Math.hypot(c.x - p.x, c.y - p.y) <= (18 * viewport.w) / width)) {
          blockGesture.current = {
            mode: 'resize',
            view,
            start: p,
            samples: [],
            elements: blockElements,
            pivot: bounds.center,
            angle: 0,
            delta: 0,
            ratio: viewport.w / width,
          };
          return;
        }
      }
      if (
        editable &&
        editingSelection &&
        (selectedElement.type === 'line' || selectedElement.type === 'dimension')
      ) {
        const ends = [
          { x: selectedElement.x1, y: selectedElement.y1 },
          { x: selectedElement.x2, y: selectedElement.y2 },
        ];
        const end = ends.findIndex(
          (a) => Math.hypot(p.x - a.x, p.y - a.y) <= (16 * viewport.w) / width,
        );
        if (end >= 0) {
          endpointGesture.current = {
            element: selectedElement,
            end: end as 0 | 1,
            start: p,
            ratio: viewport.w / width,
          };
          return;
        }
      }
      if (
        editable &&
        rotationHandle &&
        Math.hypot(p.x - rotationHandle.handle.x, p.y - rotationHandle.handle.y) <=
          (22 * viewport.w) / width
      ) {
        const pivot = drawingSelectionBounds(transformElements).center;
        blockGesture.current = {
          mode: 'rotate',
          view,
          start: p,
          samples: [],
          elements: transformElements,
          pivot,
          angle: (Math.atan2(p.y - pivot.y, p.x - pivot.x) * 180) / Math.PI,
          delta: 0,
          ratio: viewport.w / width,
        };
        setRotationDelta(0);
        return;
      }
      if (editable && editingBlock) {
        const bounds = drawingSelectionBounds(blockElements),
          margin = (12 * viewport.w) / width;
        const inside =
          p.x >= bounds.x - margin &&
          p.x <= bounds.x + bounds.width + margin &&
          p.y >= bounds.y - margin &&
          p.y <= bounds.y + bounds.height + margin;
        blockGesture.current = {
          mode: 'move',
          view,
          start: p,
          samples: [],
          elements: inside ? blockElements : [],
          pivot: bounds.center,
          angle: 0,
          delta: 0,
          ratio: viewport.w / width,
        };
        return;
      }
      if (editable && tool === 'lasso') {
        setSelected('');
        setDirectSelection(false);
        setMessage('');
        blockGesture.current = {
          mode: 'lasso',
          view,
          start: p,
          samples: [p],
          elements: [],
          pivot: p,
          angle: 0,
          delta: 0,
          ratio: viewport.w / width,
        };
        setLassoPath([p]);
        return;
      }
      if (
        editable &&
        !editingSelection &&
        tool !== 'pan' &&
        tool !== 'select' &&
        (p.x < 0 || p.x > 1000 || p.y < 0 || p.y > 800)
      )
        return;
      // Keep drawing objects reachable over photos. Selecting an image requires
      // a deliberate hold; an already selected image can be dragged normally.
      const found = data
        ? (hitElement(
            data.elements.filter((e) => e.type !== 'image'),
            p,
            (14 / width) * view.w,
            points,
          ) ?? hitElement(data.elements, p, (14 / width) * view.w, points))
        : undefined;
      const imageNeedsHold =
        found?.type === 'image' && !(editingSelection && selectedElement.id === found.id);
      const candidates =
        data?.elements
          .filter((e) => hitElement([e], p, (14 / width) * view.w, points))
          .map((e) => e.id) ?? [];
      // Selection owns the entire gesture, including its release. A tap outside
      // must never fall through to the previous insertion/drawing tool.
      const selectionOnly = editable && (editingSelection || tool === 'select');
      if (selectionOnly && found?.groupId && !imageNeedsHold) {
        const members = drawingGroupMembers(data!.elements, [found.id]);
        if (members.length > 1) {
          setSelected('');
          setDirectSelection(false);
          setBlockIds(members.map((e) => e.id));
          setBlockAngle(0);
          blockGesture.current = {
            mode: 'move',
            view,
            start: p,
            samples: [],
            elements: members,
            pivot: drawingSelectionBounds(members).center,
            angle: 0,
            delta: 0,
            ratio: viewport.w / width,
          };
          return;
        }
      }
      if (selectionOnly && found && !imageNeedsHold) {
        setNearbyIds(candidates);
        setSelected(found.id);
        setDirectSelection(true);
      }
      const corner =
        editingSelection && selectedElement?.type === 'polyline' && selectedElement.hatch
          ? selectedElement.points
              .slice(0, 3)
              .findIndex((c) => Math.hypot(c.x - p.x, c.y - p.y) < (16 / width) * view.w)
          : -1;
      const current = {
        start: p,
        original:
          corner >= 0 ? selectedElement : selectionOnly && !imageNeedsHold ? found : undefined,
        corner: corner >= 0 ? corner : undefined,
        view,
        width,
        samples: [p],
        dx: 0,
        dy: 0,
        held: selectionOnly && !!found && !imageNeedsHold,
        selectionOnly,
        drawingStarted: false,
      };
      gesture.current = current;
      if (
        editable &&
        found &&
        (tool !== 'select' || imageNeedsHold) &&
        tool !== 'pan' &&
        corner < 0 &&
        !current.held
      ) {
        holdTimer.current = setTimeout(() => {
          if (
            gesture.current !== current ||
            multiTouch.current ||
            Math.hypot(current.dx, current.dy) > 10
          )
            return;
          current.original = found;
          current.held = true;
          const members = found.groupId ? drawingGroupMembers(data!.elements, [found.id]) : [];
          if (members.length > 1) {
            gesture.current = undefined;
            setSelected('');
            setDirectSelection(false);
            setBlockIds(members.map((e) => e.id));
            setBlockAngle(0);
            blockGesture.current = {
              mode: 'move',
              view,
              start: p,
              samples: [],
              elements: members,
              pivot: drawingSelectionBounds(members).center,
              angle: 0,
              delta: 0,
              ratio: viewport.w / width,
            };
            setStroke([]);
            setTraceStart(undefined);
            setTraceEnd(undefined);
            setStart(undefined);
            Vibration.vibrate(20);
            return;
          }
          setHatchCorners([]);
          setSelected(found.id);
          setNearbyIds(candidates);
          setDirectSelection(true);
          setStart(undefined);
          setStroke([]);
          setTraceStart(undefined);
          setTraceEnd(undefined);
          setDraftElement(found);
          Vibration.vibrate(20);
          setMessage('');
        }, 350);
      }
      if (editable && !selectionOnly && !current.original && sketchTools.includes(tool)) {
        setStroke([p]);
        setTraceStart(p);
        setTraceEnd(p);
      }
      if (
        editable &&
        !selectionOnly &&
        !current.original &&
        data &&
        ['pipe', 'line', 'dimension'].includes(tool)
      ) {
        setTraceStart(start ?? snapPosition(p, data.grid));
        setTraceEnd(p);
      }
    },
    onPanResponderMove: (event, state) => {
      const touches = event.nativeEvent.touches;
      if (touches.length >= 2) {
        const [a, b] = touches;
        const center = { x: (a!.pageX + b!.pageX) / 2, y: (a!.pageY + b!.pageY) / 2 };
        const distance = Math.max(1, Math.hypot(a!.pageX - b!.pageX, a!.pageY - b!.pageY));
        const angle = (Math.atan2(b!.pageY - a!.pageY, b!.pageX - a!.pageX) * 180) / Math.PI;
        if (!pinch.current) {
          // Only transform an element when the first finger started on it.
          // Starting in blank space always keeps the familiar pan/zoom gesture.
          const element = editable ? gesture.current?.original : undefined;
          const initialElement =
            element && draftElement?.id === element.id ? draftElement : element;
          const initialBlock = blockGesture.current?.elements.length
            ? (blockDraft ?? blockGesture.current.elements)
            : undefined;
          resetGesture();
          multiTouch.current = true;
          setStart(undefined);
          pinch.current = {
            distance,
            center,
            anchor: { x: center.x - touchOrigin.current.x, y: center.y - touchOrigin.current.y },
            view,
            width,
            height,
            angle,
            element: initialElement,
            elements: initialBlock,
          };
          if (initialElement) {
            setSelected(initialElement.id);
            setDirectSelection(true);
            setShowProperties(false);
            setToolsOpen(false);
          }
        } else {
          const initial = pinch.current;
          if (initial.elements) {
            const delta = normalizeDrawingAngle(angle - initial.angle);
            initial.results = transformDrawingSelection(
              initial.elements,
              delta,
              ((center.x - initial.center.x) * initial.view.w) / initial.width,
              ((center.y - initial.center.y) * initial.view.w) / initial.width,
              distance / initial.distance,
            );
            setBlockDraft(initial.results);
            setRotationDelta(delta);
          } else if (initial.element) {
            const delta = ((angle - initial.angle + 540) % 360) - 180;
            initial.result = transformDrawingElement(
              initial.element,
              delta,
              ((center.x - initial.center.x) * initial.view.w) / initial.width,
              ((center.y - initial.center.y) * initial.view.w) / initial.width,
              distance / initial.distance,
            );
            setDraftElement(initial.result);
            setRotationDelta(delta);
          } else
            setView(
              zoomDrawingAt(
                initial.view,
                initial.width,
                initial.height,
                initial.anchor,
                distance / initial.distance,
                { x: center.x - initial.center.x, y: center.y - initial.center.y },
              ),
            );
        }
        return;
      }
      if (multiTouch.current) return;
      const endpoint = endpointGesture.current;
      if (endpoint) {
        if (Math.hypot(state.dx, state.dy) < 6) return;
        const p = smartSnap(
          {
            x: endpoint.start.x + state.dx * endpoint.ratio,
            y: endpoint.start.y + state.dy * endpoint.ratio,
          },
          [endpoint.element.id],
        );
        endpoint.result = drawingLineEndpoint(endpoint.element, endpoint.end, p);
        setDraftElement(endpoint.result);
        return;
      }
      const block = blockGesture.current;
      if (block) {
        const p = {
          x: block.start.x + state.dx * block.ratio,
          y: block.start.y + state.dy * block.ratio,
        };
        if (block.mode === 'lasso') {
          block.samples = appendStrokePoint(block.samples, p);
          setLassoPath(block.samples);
        } else if (block.mode === 'resize') {
          if (Math.hypot(state.dx, state.dy) < 6) return;
          const x = block.start.x - block.pivot.x,
            y = block.start.y - block.pivot.y;
          const scale = Math.max(
            0.01,
            ((p.x - block.pivot.x) * x + (p.y - block.pivot.y) * y) / Math.max(1, x * x + y * y),
          );
          block.result = transformDrawingSelection(block.elements, 0, 0, 0, scale, block.pivot);
          setBlockDraft(block.result);
        } else if (block.mode === 'rotate') {
          const nextAngle = (Math.atan2(p.y - block.pivot.y, p.x - block.pivot.x) * 180) / Math.PI;
          block.delta += normalizeDrawingAngle(nextAngle - block.angle);
          block.angle = nextAngle;
          const snapped = Math.round(block.delta / 15) * 15;
          const delta = Math.abs(snapped - block.delta) < 2 ? snapped : block.delta;
          block.result = transformDrawingSelection(block.elements, delta, 0, 0, 1, block.pivot);
          setBlockDraft(block.result);
          setRotationDelta(block.result === block.elements ? 0 : delta);
        } else if (block.elements.length) {
          if (Math.hypot(state.dx, state.dy) < 6) return;
          const center = drawingSelectionBounds(block.elements).center;
          const snapped = smartSnap(
            { x: center.x + state.dx * block.ratio, y: center.y + state.dy * block.ratio },
            block.elements.map((e) => e.id),
          );
          block.result = transformDrawingSelection(
            block.elements,
            0,
            snapped.x - center.x,
            snapped.y - center.y,
          );
          setBlockDraft(block.result);
        } else
          setView({
            ...view,
            x: block.view.x - state.dx * block.ratio,
            y: block.view.y - state.dy * block.ratio,
          });
        return;
      }
      const g = gesture.current;
      if (!g) return;
      g.dx = state.dx;
      g.dy = state.dy;
      if (g.corner !== undefined && g.original) {
        if (Math.hypot(state.dx, state.dy) < 6) return;
        setDraftElement(
          moveHatchCorner(
            g.original,
            g.corner,
            (state.dx / g.width) * g.view.w,
            (state.dy / g.width) * g.view.w,
          ),
        );
        return;
      }
      if (!g.held && Math.hypot(state.dx, state.dy) > 10) cancelHold();
      if (holdTimer.current && !g.held && Math.hypot(state.dx, state.dy) <= 10) return;
      if (g.held && g.original) {
        if (Math.hypot(state.dx, state.dy) < 6) return;
        setDraftElement(
          moveSnapped(g.original, (state.dx / g.width) * g.view.w, (state.dy / g.width) * g.view.w),
        );
        return;
      }
      if (!editable || tool === 'pan' || (g.selectionOnly && !g.original)) {
        setView({
          ...g.view,
          x: g.view.x - (state.dx / g.width) * g.view.w,
          y: g.view.y - (state.dy / g.width) * g.view.w,
        });
        return;
      }
      if (sketchTools.includes(tool) || ['pipe', 'line', 'dimension'].includes(tool)) {
        if (Math.hypot(state.dx, state.dy) >= drawingDragThreshold) g.drawingStarted = true;
        if (!g.drawingStarted) return;
        setTraceStart(sketchTools.includes(tool) ? g.start : snapPosition(g.start, data!.grid));
      }
      if (sketchTools.includes(tool)) {
        const p = clampPosition({
          x: g.start.x + (state.dx / g.width) * g.view.w,
          y: g.start.y + (state.dy / g.width) * g.view.w,
        });
        g.samples = appendStrokePoint(g.samples, p);
        setStroke(g.samples);
        setTraceEnd(tool === 'straighten' ? smartSnap(p) : p);
        return;
      }
      if (data && ['pipe', 'line', 'dimension'].includes(tool)) {
        setTraceEnd(
          smartSnap(
            clampPosition({
              x: g.start.x + (state.dx / g.width) * g.view.w,
              y: g.start.y + (state.dy / g.width) * g.view.w,
            }),
          ),
        );
        return;
      }
      if (tool === 'select' && g.original)
        setDraftElement(
          moveElement(g.original, (state.dx / g.width) * g.view.w, (state.dy / g.width) * g.view.w),
        );
    },
    onPanResponderRelease: (_event, state) => {
      setCanvasGestureActive(false);
      cancelHold();
      if (endpointGesture.current && !multiTouch.current) {
        const endpoint = endpointGesture.current;
        if (endpoint.result && Math.hypot(state.dx, state.dy) >= 6) updateElement(endpoint.result);
        resetGesture();
        return;
      }
      if (multiTouch.current || !editable) {
        if (editable && pinch.current?.results) {
          updateBlock(pinch.current.results);
          setBlockAngle((old) => normalizeDrawingAngle(old + (rotationDelta ?? 0)));
        }
        if (editable && pinch.current?.result) updateElement(pinch.current.result);
        multiTouch.current = false;
        resetGesture();
        return;
      }
      const block = blockGesture.current;
      if (block) {
        if (block.mode === 'lasso') {
          const ids = drawingGroupMembers(
            data?.elements ?? [],
            selectDrawingLasso(data?.elements ?? [], block.samples),
          ).map((e) => e.id);
          setBlockIds(ids.length > 1 ? ids : []);
          setBlockAngle(0);
          setSelected(ids.length === 1 ? ids[0]! : '');
          setDirectSelection(ids.length === 1);
          if (ids.length) {
            setTool('select');
            setShowProperties(false);
            setToolsOpen(false);
            Vibration.vibrate(20);
          } else
            setMessage(
              'Nenhum elemento inteiro dentro do laço. Contorne os itens que deseja selecionar.',
            );
        } else if (
          block.result === block.elements &&
          block.mode === 'rotate' &&
          Math.hypot(state.dx, state.dy) > 3
        ) {
          setMessage('Não há espaço para esse giro. Afaste a seleção da borda do desenho.');
        } else if (block.result && Math.hypot(state.dx, state.dy) >= 6) {
          updateBlock(block.result);
          if (block.mode === 'rotate')
            setBlockAngle((old) => normalizeDrawingAngle(old + (rotationDelta ?? 0)));
        } else if (!block.elements.length && Math.hypot(state.dx, state.dy) < 10) finishSelection();
        resetGesture();
        return;
      }
      const g = gesture.current;
      if (!g) return;
      if (g.corner !== undefined && g.original) {
        if (Math.hypot(state.dx, state.dy) >= 6)
          updateElement(
            moveHatchCorner(
              g.original,
              g.corner,
              (state.dx / g.width) * g.view.w,
              (state.dy / g.width) * g.view.w,
            ),
          );
      } else if (g.held && g.original) {
        if (Math.hypot(state.dx, state.dy) >= 6)
          updateElement(
            moveSnapped(
              g.original,
              (state.dx / g.width) * g.view.w,
              (state.dy / g.width) * g.view.w,
              false,
            ),
          );
      } else if (g.selectionOnly) {
        if (!g.original && Math.hypot(state.dx, state.dy) < 10) finishSelection();
      } else if (sketchTools.includes(tool)) {
        const end = clampPosition({
          x: g.start.x + (state.dx / g.width) * g.view.w,
          y: g.start.y + (state.dy / g.width) * g.view.w,
        });
        const dragged = g.drawingStarted || Math.hypot(state.dx, state.dy) >= drawingDragThreshold;
        const element = dragged
          ? sketchElement(tool as SketchTool, g.start, end, g.samples, drawingId())
          : undefined;
        if (element) {
          if (tool === 'straighten' && element.type === 'line') {
            const a = smartSnap({ x: element.x1, y: element.y1 }, [], false),
              b = smartSnap({ x: element.x2, y: element.y2 }, [], false);
            if (Math.hypot(a.x - b.x, a.y - b.y) >= 2)
              add({ ...element, x1: a.x, y1: a.y, x2: b.x, y2: b.y });
          } else add(element);
        }
        setStroke([]);
      } else if (tool === 'select' && g.original && Math.hypot(state.dx, state.dy) >= 6)
        updateElement(
          moveElement(g.original, (state.dx / g.width) * g.view.w, (state.dy / g.width) * g.view.w),
        );
      else if (
        data &&
        ['pipe', 'line', 'dimension'].includes(tool) &&
        (g.drawingStarted || Math.hypot(state.dx, state.dy) >= drawingDragThreshold)
      ) {
        place(
          clampPosition({
            x: g.start.x + (state.dx / g.width) * g.view.w,
            y: g.start.y + (state.dy / g.width) * g.view.w,
          }),
          snapPosition(g.start, data.grid),
        );
        // A drag is a complete segment. A new drag always starts under the finger.
        setStart(undefined);
      } else if (tool !== 'select' && tool !== 'pan' && Math.hypot(state.dx, state.dy) < 12)
        place(clampPosition(g.start));
      gesture.current = undefined;
      setSnapGuide(undefined);
      setDraftElement(undefined);
      setStroke([]);
      setTraceStart(undefined);
      setTraceEnd(undefined);
    },
    onPanResponderTerminate: () => {
      setCanvasGestureActive(false);
      multiTouch.current = false;
      resetGesture();
    },
  };
  const pan = useMemo(
    () =>
      PanResponder.create({
        onPanResponderStart: (...args) => gestureCallbacks.current.onPanResponderStart?.(...args),
        onStartShouldSetPanResponder: (...args) =>
          gestureCallbacks.current.onStartShouldSetPanResponder?.(...args) ?? false,
        onMoveShouldSetPanResponder: (...args) =>
          gestureCallbacks.current.onMoveShouldSetPanResponder?.(...args) ?? false,
        onPanResponderTerminationRequest: (...args) =>
          gestureCallbacks.current.onPanResponderTerminationRequest?.(...args) ?? false,
        onPanResponderGrant: (...args) => gestureCallbacks.current.onPanResponderGrant?.(...args),
        onPanResponderMove: (...args) => gestureCallbacks.current.onPanResponderMove?.(...args),
        onPanResponderRelease: (...args) =>
          gestureCallbacks.current.onPanResponderRelease?.(...args),
        onPanResponderTerminate: (...args) =>
          gestureCallbacks.current.onPanResponderTerminate?.(...args),
      }),
    [],
  );
  const zoom = (factor: number) =>
    setView((old) =>
      zoomDrawingAt(old, width, height, { x: width / 2, y: height / 2 }, 1 / factor),
    );
  const preview = useMemo(() => {
    if (!data) return '';
    const elements = data.elements.map(
      (e) =>
        blockDraft?.find((d) => d.id === e.id) ?? (draftElement?.id === e.id ? draftElement : e),
    );
    if (hatchCorners.length === 2)
      elements.push({
        id: 'hatch-edge',
        type: 'line',
        x1: hatchCorners[0]!.x,
        y1: hatchCorners[0]!.y,
        x2: hatchCorners[1]!.x,
        y2: hatchCorners[1]!.y,
        strokeWidth,
      });
    if (traceStart && traceEnd) {
      if (sketchTools.includes(tool)) {
        const element = sketchElement(
          tool === 'straighten' ? 'pencil' : (tool as SketchTool),
          traceStart,
          traceEnd,
          stroke,
          'trace-preview',
        );
        if (element && hasDrawingStroke(element))
          elements.push({ ...element, strokeWidth, strokeColor, strokeStyle });
      } else {
        const end =
          tool === 'dimension'
            ? snapPosition(traceEnd, data.grid)
            : constrainPosition(snapPosition(traceEnd, data.grid), traceStart, data.grid);
        elements.push({
          id: 'trace-preview',
          type: 'line',
          strokeWidth,
          strokeColor,
          strokeStyle,
          x1: traceStart.x,
          y1: traceStart.y,
          x2: end.x,
          y2: end.y,
        });
      }
    }
    return drawingSvg({ ...data, elements }, points, {
      anchor: start,
      anchorRadius: (2.5 * viewport.w) / width,
      endpointRadius: (3 * viewport.w) / width,
      snapGuide,
      images: drawingImages.images,
      selectedId: traceEnd ? 'trace-preview' : editable ? selected : undefined,
      selectionFrame: editingSelection && !traceEnd,
      selectionOpacity,
      constructionCorners: hatchCorners,
      selectedIds: editingBlock ? blockIds : undefined,
      resizeHandleRadius: editingBlock ? (3 * viewport.w) / width : undefined,
      lasso: lassoPath,
      rotationControl: rotationHandle
        ? { ...rotationHandle, radius: (11 * viewport.w) / width }
        : undefined,
      viewBox: `${viewport.x} ${viewport.y} ${viewport.w} ${viewport.h}`,
    });
  }, [
    snapGuide,
    drawingImages.images,
    data,
    blockDraft,
    blockIds,
    editingBlock,
    lassoPath,
    rotationHandle,
    points,
    draftElement,
    start,
    selected,
    viewport.x,
    viewport.y,
    viewport.w,
    viewport.h,
    editable,
    traceStart,
    traceEnd,
    tool,
    stroke,
    strokeWidth,
    strokeColor,
    strokeStyle,
    hatchCorners,
    editingSelection,
    selectionOpacity,
  ]);
  const addSheet = () => {
    if (!editable || value.length >= 12) return;
    Keyboard.dismiss();
    let number = value.length + 1;
    while (value.some((d) => d.data.title === 'Desenho ' + String(number).padStart(2, '0')))
      number++;
    commit([
      ...value,
      {
        data: { ...newDrawingData(), title: 'Desenho ' + String(number).padStart(2, '0') },
      },
    ]);
    setIndex(value.length);
    setTool('pencil');
    setSelected('');
    setStart(undefined);
    setSheetDetails(false);
    setStroke([]);
    setDraftElement(undefined);
    setTraceStart(undefined);
    setTraceEnd(undefined);
    gesture.current = undefined;
    setView({ x: 0, y: 0, w: 1000, h: 800 });
  };
  const focusSelection = () => {
    if (!transformElements.length) return;
    const bounds = drawingSelectionBounds(transformElements);
    const w = Math.max(
      150,
      bounds.width * 1.3,
      (bounds.height * 1.3 * width) / Math.max(1, height - 100),
    );
    resetGesture();
    setView({ x: bounds.center.x - w / 2, y: bounds.center.y - w * 0.4, w, h: w * 0.8 });
    setToolsOpen(false);
    setShowProperties(false);
  };
  const elementLabel = (e: DrawingElement) =>
    e.type === 'image'
      ? 'Imagem'
      : e.type === 'text'
        ? 'Texto: ' + e.text
        : e.type === 'symbol'
          ? drawingSymbolDefinition(e.symbolCode).name
          : e.type === 'point'
            ? 'Ponto ' + (points.find((p) => pointKey(p) === e.reportPointId)?.number ?? '')
            : e.type === 'marker'
              ? 'Marcação ' + e.number
              : e.type === 'dimension'
                ? 'Cota: ' + e.text
                : e.type === 'polyline'
                  ? e.hatch
                    ? 'Hachura'
                    : 'Traço / forma'
                  : 'Linha';
  const contextWidth = Math.min(248, width - 16);
  const contextHeight = Math.min(392, height - 80);
  const selectionRight = transformBounds
    ? ((transformBounds.x + transformBounds.width - viewport.x) / viewport.w) * width + 18
    : 8;
  const selectionLeft = transformBounds
    ? ((transformBounds.x - viewport.x) / viewport.w) * width - 62
    : 8;
  const contextX = Math.max(
    8,
    Math.min(width - 52, selectionRight + 44 < width - 8 ? selectionRight : selectionLeft),
  );
  const contextY = Math.max(
    64,
    Math.min(
      height - 60,
      transformBounds ? ((transformBounds.center.y - viewport.y) / viewport.w) * width - 22 : 64,
    ),
  );
  const quickStrokeTarget =
    strokeTarget ?? (editingBlock ? blockElements.find(hasDrawingStroke) : undefined);
  const quickStroke = quickStrokeTarget
    ? {
        strokeWidth: drawingStrokeWidth(quickStrokeTarget),
        strokeColor: drawingStrokeColor(quickStrokeTarget),
        strokeStyle: drawingStrokeStyle(quickStrokeTarget),
      }
    : undefined;
  const canvas = (
    <View
      testID="drawing-canvas"
      onLayout={(e) => {
        setWidth(e.nativeEvent.layout.width);
        setHeight(e.nativeEvent.layout.height);
        const previous = lastCanvasLayout.current;
        const needsFit =
          !previous || previous.expanded !== expanded || previous.width !== screen.width;
        lastCanvasLayout.current = { expanded, width: screen.width };
        if (expanded && needsFit) {
          const w = Math.max(
            1000,
            (800 * e.nativeEvent.layout.width) / Math.max(1, e.nativeEvent.layout.height),
          );
          setView({ x: (1000 - w) / 2, y: (800 - w * 0.8) / 2, w, h: w * 0.8 });
        }
      }}
      style={{
        width: '100%',
        ...(expanded ? { flex: 1, minHeight: 0 } : { aspectRatio: 1.25 }),
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: t.colors.selectionBorder,
        backgroundColor: '#E9EDF2',
      }}
    >
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
      >
        <SvgXml xml={preview} width="100%" height="100%" />
      </View>
      <View
        ref={setSurface}
        {...pan.panHandlers}
        accessibilityRole="image"
        accessibilityLabel="Área de desenho técnico"
        style={
          {
            position: 'absolute',
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            ...(Platform.OS === 'web'
              ? {
                  touchAction: 'none',
                  cursor: tool === 'pan' ? 'grab' : tool === 'select' ? 'default' : 'crosshair',
                }
              : {}),
          } as ViewStyle
        }
      />
      {expanded && !toolsOpen && !showProperties && !message && (
        <View
          testID="drawing-floating-tools"
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            flexDirection: 'row',
            flexWrap: 'wrap',
            maxWidth: width - 16,
            borderRadius: 12,
            padding: 2,
            backgroundColor: t.colors.surface,
            borderWidth: 1,
            borderColor: t.colors.line,
          }}
        >
          {(['pan', 'select'] as const).map((mode) => (
            <Pressable
              key={mode}
              accessibilityRole="button"
              accessibilityLabel={mode === 'pan' ? 'Mover folha' : 'Selecionar elementos'}
              accessibilityState={{ selected: tool === mode && !editingSelection && !editingBlock }}
              onPress={() => selectTool(mode)}
              style={{
                width: 44,
                height: 44,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 10,
                backgroundColor: tool === mode ? t.colors.blueSoft : 'transparent',
              }}
            >
              <Icon
                name={mode === 'pan' ? 'move' : 'cursor'}
                size={20}
                color={tool === mode ? t.colors.blue : t.colors.text}
              />
            </Pressable>
          ))}
          <IconButton
            label="Enquadrar folha inteira"
            icon="expand"
            onPress={() => {
              resetGesture();
              fit();
            }}
          />
          <IconButton
            label="Desfazer última alteração"
            icon="undo"
            disabled={!editable || (!history.length && !hatchCorners.length)}
            onPress={() => undo()}
          />
          {editable && (
            <IconButton
              label="Excluir objeto ou limpar desenho"
              icon="trash"
              onPress={() => {
                deleteSelectionOrClean();
              }}
            />
          )}
          {editable &&
            (['lasso', 'point', 'straighten'] as const).map((mode) => (
              <Pressable
                key={mode}
                accessibilityRole="button"
                accessibilityLabel={
                  mode === 'lasso'
                    ? 'Selecionar com laço'
                    : mode === 'point'
                      ? 'Marcar ponto no desenho'
                      : 'Endireitar traço'
                }
                accessibilityState={{
                  selected: tool === mode && !editingSelection && !editingBlock,
                }}
                onPress={() => selectTool(mode)}
                style={{
                  width: 44,
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 10,
                  backgroundColor: tool === mode ? t.colors.blueSoft : 'transparent',
                }}
              >
                <Icon
                  name={tools.find((item) => item.id === mode)!.icon}
                  size={20}
                  color={tool === mode ? t.colors.blue : t.colors.text}
                />
              </Pressable>
            ))}
        </View>
      )}
      {editable &&
        transformBounds &&
        !canvasGestureActive &&
        !toolsOpen &&
        !showProperties &&
        !message && (
          <View
            testID="drawing-context-options"
            style={{
              position: 'absolute',
              left: contextOptionsOpen
                ? Math.max(8, Math.min(width - contextWidth - 8, contextX))
                : contextX,
              top: contextOptionsOpen
                ? Math.max(60, Math.min(height - contextHeight - 8, contextY))
                : contextY,
              width: contextOptionsOpen ? contextWidth : 44,
              maxHeight: contextOptionsOpen ? contextHeight : 44,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: t.colors.selectionBorder,
              backgroundColor: t.colors.surface,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOpacity: 0.16,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 3 },
              elevation: 5,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {contextOptionsOpen && (
                <Text
                  numberOfLines={1}
                  style={[styles.label, { flex: 1, paddingLeft: 10, fontSize: 12 }]}
                >
                  {editingBlock
                    ? 'Bloco selecionado'
                    : selectedElement
                      ? elementLabel(selectedElement)
                      : 'Seleção'}
                </Text>
              )}
              <IconButton
                label={
                  contextOptionsOpen
                    ? 'Fechar ajustes junto da seleção'
                    : 'Ajustes junto da seleção'
                }
                icon={contextOptionsOpen ? 'close' : 'tool'}
                onPress={() => setContextOptionsOpen(!contextOptionsOpen)}
              />
            </View>
            {contextOptionsOpen && (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                style={{ flexShrink: 1 }}
                contentContainerStyle={{ padding: 8 }}
              >
                <DrawingSelectionQuickOptions
                  stroke={quickStroke}
                  onStroke={(patch) =>
                    editingBlock
                      ? updateBlock(
                          blockElements.map((e) => (hasDrawingStroke(e) ? { ...e, ...patch } : e)),
                        )
                      : updateStrokeAppearance(patch)
                  }
                  onResize={
                    canRotateSelection
                      ? (scale) =>
                          editingBlock
                            ? resizeBlock(scale)
                            : updateElement(
                                transformDrawingElement(selectedElement!, 0, 0, 0, scale),
                              )
                      : undefined
                  }
                  onFullStyle={() => {
                    setContextOptionsOpen(false);
                    setStrokePanelOpen(true);
                  }}
                  onMore={() => {
                    setContextOptionsOpen(false);
                    if (expanded) setSelectionOptionsOpen(true);
                    else setSelectionPanelOpen(true);
                  }}
                />
              </ScrollView>
            )}
          </View>
        )}
      {data?.elements.some((e) => e.type === 'image' && !e.locked) &&
        !editingSelection &&
        !editingBlock &&
        !canvasGestureActive &&
        !contextOptionsOpen && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: 8,
              left: 8,
              right: 8,
              backgroundColor: t.colors.surface,
              borderRadius: 10,
              padding: 10,
              borderWidth: 1,
              borderColor: t.colors.line,
            }}
          >
            <Text style={[styles.muted, { fontSize: 12 }]}>
              ⚠️ Para selecionar a imagem, segure nela. Depois, arraste para mover.
            </Text>
          </View>
        )}
      {!!message && (
        <View
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            right: 8,
            borderRadius: 12,
            padding: 10,
            backgroundColor: t.colors.surface,
            borderWidth: 1,
            borderColor: t.colors.blue,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={[styles.text, { flex: 1, fontSize: 12 }]}
          >
            {message}
          </Text>
          <IconButton
            label="Fechar aviso do desenho"
            icon="close"
            small
            onPress={() => setMessage('')}
          />
        </View>
      )}
      {canRotateSelection &&
        rotationDelta === undefined &&
        !contextOptionsOpen &&
        !canvasGestureActive && (
          <View
            style={{
              position: 'absolute',
              bottom: 8,
              alignSelf: 'center',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              padding: 4,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: t.colors.line,
              backgroundColor: t.colors.surface,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <IconButton
                label="Diminuir seleção 5 por cento"
                icon="minus"
                onPress={() => resizeSelectionPrecisely(0.95)}
              />
              <View style={{ minWidth: 82, alignItems: 'center' }}>
                <Text style={[styles.muted, { fontSize: 10 }]}>Tamanho</Text>
                <Text
                  testID="selection-size"
                  accessibilityLiveRegion="polite"
                  accessibilityLabel={`Tamanho ${Math.round((selectionPercent + 1e-8) * 10) / 10} por cento do início da seleção`}
                  style={[styles.label, { textAlign: 'center' }]}
                >
                  {Math.round((selectionPercent + 1e-8) * 10) / 10}%
                </Text>
              </View>
              <IconButton
                label="Aumentar seleção 5 por cento"
                icon="plus"
                onPress={() => resizeSelectionPrecisely(1.05)}
              />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <IconButton
                label="Girar seleção 15 graus à esquerda"
                icon="undo"
                onPress={() => rotateSelection(-15)}
              />
              <Text
                testID="selection-angle"
                style={[styles.label, { minWidth: 82, textAlign: 'center' }]}
              >
                {Math.round(shownAngle)}°
              </Text>
              <IconButton
                label="Girar seleção 15 graus à direita"
                icon="redo"
                onPress={() => rotateSelection(15)}
              />
            </View>
          </View>
        )}
      {rotationDelta !== undefined && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: 12,
            alignSelf: 'center',
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 8,
            backgroundColor: t.colors.primary,
          }}
        >
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: t.colors.white, fontFamily: t.fonts.bold, fontSize: 18 }}
          >
            {Math.round(shownAngle)}°
          </Text>
        </View>
      )}
    </View>
  );
  const annotation = data ? (
    <View ref={annotationField} collapsable={false} style={{ gap: 6 }}>
      <Field
        label="Anotação abaixo do desenho"
        value={data.notes ?? ''}
        editable={editable}
        onChangeText={(notes) => updateData({ ...data, notes })}
        multiline
        maxLength={2000}
        placeholder="Escreva uma observação para acompanhar este desenho no relatório"
      />
      <Text style={[styles.muted, { fontSize: 12 }]}>Aparece no PDF, abaixo deste desenho.</Text>
    </View>
  ) : null;
  const pointEntry = (
    <>
      {pointTarget === 'new' && canEditPoints && (
        <Field
          label="Número do novo ponto"
          value={newNumber ?? nextPointNumber(points)}
          selectTextOnFocus
          hint="Você pode mudar o número. Depois, toque no desenho para marcar."
          onChangeText={setNewNumber}
          maxLength={100}
        />
      )}
      {!!duplicateNumber && (
        <Text accessibilityRole="alert" style={styles.muted}>
          O ponto {duplicateNumber.number} já existe. Ao continuar, você vai posicionar esse mesmo
          ponto, preservando seus dados e fotos.
        </Text>
      )}
      {pointTarget !== 'new' &&
        data?.elements.some(
          (element) => element.type === 'point' && element.reportPointId === pointTarget,
        ) && (
          <Text style={styles.muted}>
            Este ponto já está neste desenho. O próximo toque muda sua posição.
          </Text>
        )}
      <SelectField
        label="Ponto a marcar"
        value={pointTarget}
        clearable={false}
        options={[
          ...(canEditPoints ? [{ value: 'new', label: 'Criar ponto numerado' }] : []),
          ...points
            .filter((p) => pointKey(p))
            .map((p) => ({
              value: pointKey(p),
              label: 'Ponto ' + p.number,
              description: p.label,
            })),
        ]}
        onChange={setPointTarget}
      />
      {!!unplacedPoints.length && (
        <View style={{ gap: 8 }}>
          <Text style={styles.label}>Pontos cadastrados sem marcação</Text>
          <Text style={styles.muted}>
            Escolha um número e toque no desenho para posicionar. As fotos e resultados serão
            mantidos.
          </Text>
          <View style={[styles.row, { flexWrap: 'wrap' }]}>
            {unplacedPoints.slice(0, 8).map((point) => (
              <Button
                key={pointKey(point)}
                title={'Posicionar ' + point.number}
                icon="pin"
                small
                secondary={pointTarget !== pointKey(point)}
                onPress={() => setPointTarget(pointKey(point))}
              />
            ))}
          </View>
          {unplacedPoints.length > 8 && (
            <Text style={styles.muted}>
              Mais {unplacedPoints.length - 8} pontos disponíveis no campo Ponto a marcar acima.
            </Text>
          )}
        </View>
      )}
    </>
  );
  const textEntry = (
    <>
      <Field
        label="Texto a inserir"
        value={text}
        onChangeText={setText}
        maxLength={300}
        multiline
        placeholder={'Ex.: TQ\nÁGUA IONIZADA'}
      />
      <Numeric label="Tamanho do texto" value={textSize} min={10} max={40} onChange={setTextSize} />
      <SelectField
        label="Inclinação do texto"
        value={String(textRotation)}
        clearable={false}
        options={[
          { value: '0', label: 'Horizontal' },
          { value: '30', label: 'Isométrica · 30°' },
          { value: '-30', label: 'Isométrica · −30°' },
          { value: '90', label: 'Vertical' },
        ]}
        onChange={(value) => setTextRotation(Number(value))}
      />
    </>
  );
  const properties =
    data && editable ? (
      <View
        ref={propertiesView}
        collapsable={false}
        style={{
          width: expanded || mobile ? '100%' : 260,
          gap: 14,
          padding: 16,
          backgroundColor: t.colors.soft,
          borderWidth: 1,
          borderColor: t.colors.line,
          borderRadius: 12,
        }}
      >
        {!expanded && <Text style={[styles.label, { fontSize: 14 }]}>Ajustes do desenho</Text>}
        {tool === 'annotation' && !editingSelection && annotation}
        {tool === 'dimension' && !editingSelection && (
          <Field
            label="Medida da cota"
            value={dimension}
            onChangeText={setDimension}
            placeholder="Ex.: 1.500 mm"
            maxLength={100}
          />
        )}
        {tool === 'symbol' && !editingSelection && (
          <>
            <Text style={styles.label}>Escolha o componente e toque no desenho</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {drawingSymbols.map((item) => (
                <Pressable
                  key={item.code}
                  accessibilityRole="button"
                  accessibilityLabel={'Componente ' + item.name.toLowerCase()}
                  accessibilityState={selectionState(symbol === item.code)}
                  aria-pressed={symbol === item.code}
                  onPress={() => {
                    setSymbol(item.code);
                    const defaults = drawingSymbolDefinition(item.code);
                    if (defaults.defaultRotation !== undefined)
                      setRotation(defaults.defaultRotation);
                    if (defaults.defaultScale !== undefined) setSymbolScale(defaults.defaultScale);
                    if (defaults.defaultStrokeWidth !== undefined)
                      setStrokeWidth(defaults.defaultStrokeWidth);
                    setSelected('');
                    setDirectSelection(false);
                  }}
                  style={{
                    width: '31%',
                    minWidth: 70,
                    padding: 8,
                    gap: 5,
                    alignItems: 'center',
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: symbol === item.code ? t.colors.blue : t.colors.line,
                    backgroundColor: symbol === item.code ? t.colors.blueSoft : t.colors.surface,
                  }}
                >
                  <View pointerEvents="none">
                    <SvgXml
                      xml={drawingSymbolPreview(item.code, t.colors.text)}
                      width={42}
                      height={42}
                    />
                  </View>
                  <Text style={[styles.muted, { fontSize: 10, textAlign: 'center' }]}>
                    {item.name}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Numeric
              label="Tamanho do componente"
              value={symbolScale}
              min={0.5}
              max={3}
              onChange={setSymbolScale}
            />
            <Numeric
              label="Rotação do componente"
              value={insertedSymbol?.rotation ?? rotation}
              min={-360}
              max={360}
              onChange={changeSymbolRotation}
            />
            <RotationButtons
              value={insertedSymbol?.rotation ?? rotation}
              onChange={changeSymbolRotation}
            />
            <Text style={styles.muted}>
              {insertedSymbol
                ? 'A rotação altera este símbolo e vale também para a próxima inserção.'
                : 'Defina o ângulo e toque no desenho para inserir.'}
            </Text>
          </>
        )}
        {editingSelection && selectedElement ? (
          <>
            <SelectField
              label="Visibilidade durante a seleção"
              value={String(selectionOpacity)}
              clearable={false}
              options={[
                { value: '0.25', label: '25% · Mais transparente' },
                { value: '0.5', label: '50% · Equilibrado' },
                { value: '0.75', label: '75% · Mais visível' },
                { value: '1', label: '100% · Sem transparência' },
              ]}
              onChange={(value) => setSelectionOpacity(Number(value))}
            />
            <Text style={[styles.muted, { fontSize: 11 }]}>
              O contorno e a transparência ajudam na edição. O PDF mantém a aparência original.
            </Text>
            <Text style={styles.muted}>
              {tool === 'select'
                ? 'Arraste o elemento para mover.'
                : 'Para mover de novo, segure o elemento por 1 segundo e arraste. Sua ferramenta continua ativa para desenhar em seguida.'}
            </Text>
            <Text style={[styles.label, { color: t.colors.blue }]}>
              {selectedElement.type === 'point'
                ? 'Ponto ' + (linkedPoint?.number ?? '')
                : selectedElement.type === 'marker'
                  ? 'Marcação ' + selectedElement.number + ' · só no desenho'
                  : selectedElement.type === 'line'
                    ? 'Trecho selecionado'
                    : 'Elemento selecionado'}
            </Text>
            {selectedElement.type === 'marker' && (
              <>
                <Text style={styles.muted}>
                  Esta marcação foi mantida só no desenho e não aparece na lista de pontos.
                </Text>
                <Field
                  label="Número da marcação no desenho"
                  value={selectedElement.number}
                  maxLength={100}
                  onChangeText={(number) => {
                    if (number.trim()) updateElement({ ...selectedElement, number });
                  }}
                />
              </>
            )}
            {linkedPoint && canEditPoints && (
              <>
                <Field
                  label="Número do ponto selecionado"
                  value={linkedPoint.number}
                  onChangeText={(number) => changePoint({ number })}
                  maxLength={100}
                />
                <Field
                  label="Identificação do ponto"
                  value={linkedPoint.label ?? ''}
                  onChangeText={(label) => changePoint({ label })}
                />
                <SelectField
                  label="Aceitabilidade do ponto"
                  value={
                    linkedPoint.data?.acceptable === undefined
                      ? ''
                      : String(linkedPoint.data.acceptable)
                  }
                  options={[
                    { value: '', label: 'Não informado' },
                    { value: 'true', label: 'Aceitável' },
                    { value: 'false', label: 'Não aceitável' },
                  ]}
                  onChange={(v) =>
                    changePoint({
                      data: {
                        ...linkedPoint.data,
                        acceptable: v === '' ? undefined : v === 'true',
                      },
                    })
                  }
                />
                <Field
                  label="Descontinuidade do ponto"
                  value={linkedPoint.data?.discontinuity ?? ''}
                  onChangeText={(discontinuity) =>
                    changePoint({ data: { ...linkedPoint.data, discontinuity } })
                  }
                />
              </>
            )}
            {(selectedElement.type === 'text' || selectedElement.type === 'dimension') && (
              <Field
                multiline={selectedElement.type === 'text'}
                label="Texto do elemento"
                value={selectedElement.text}
                onChangeText={(text) => {
                  if (text.trim()) updateElement({ ...selectedElement, text });
                }}
                maxLength={selectedElement.type === 'text' ? 300 : 100}
              />
            )}
            {selectedElement.type === 'text' && (
              <>
                <Numeric
                  label="Tamanho do texto selecionado"
                  value={selectedElement.size ?? 20}
                  min={10}
                  max={40}
                  onChange={(size) => updateElement({ ...selectedElement, size })}
                />
                <Numeric
                  label="Inclinação do texto selecionado"
                  value={selectedElement.rotation ?? 0}
                  min={-360}
                  max={360}
                  onChange={(rotation) => updateElement({ ...selectedElement, rotation })}
                />
                <RotationButtons
                  value={selectedElement.rotation ?? 0}
                  onChange={(rotation) => updateElement({ ...selectedElement, rotation })}
                />
              </>
            )}
            {selectedElement.type === 'symbol' && (
              <>
                <SelectField
                  label="Símbolo selecionado"
                  value={selectedElement.symbolCode}
                  clearable={false}
                  options={drawingSymbols.map((s) => ({ value: s.code, label: s.name }))}
                  onChange={(s) => updateElement({ ...selectedElement, symbolCode: s as 'valve' })}
                />
                <Numeric
                  label="Tamanho do símbolo selecionado"
                  value={selectedElement.scale ?? 1}
                  min={0.5}
                  max={3}
                  onChange={(scale) => updateElement({ ...selectedElement, scale })}
                />
                <Numeric
                  label="Rotação"
                  value={selectedElement.rotation}
                  min={-360}
                  max={360}
                  onChange={(rotation) => updateElement({ ...selectedElement, rotation })}
                />
                <RotationButtons
                  value={selectedElement.rotation}
                  onChange={(rotation) => updateElement({ ...selectedElement, rotation })}
                />
              </>
            )}
            <Button
              title={precisePosition ? 'Ocultar posição precisa' : 'Ajustar posição precisa'}
              small
              secondary
              onPress={() => setPrecisePosition(!precisePosition)}
            />
            {selectedElement.type === 'polyline' && selectedElement.hatch && (
              <View style={{ gap: 10 }}>
                <Text style={styles.label}>Hachura triangular</Text>
                <Text style={styles.muted}>
                  Arraste os cantos para ajustar o triângulo ou arraste pelo meio para mover.
                </Text>
                <View style={[styles.row, { gap: 6 }]}>
                  <Button
                    title="Diminuir triângulo"
                    small
                    secondary
                    onPress={() => updateElement(transformHatch(selectedElement, 0.85, 0.85))}
                  />
                  <Button
                    title="Aumentar triângulo"
                    small
                    secondary
                    onPress={() => updateElement(transformHatch(selectedElement, 1.15, 1.15))}
                  />
                  <Button
                    title="Girar triângulo 15°"
                    small
                    secondary
                    onPress={() => updateElement(transformHatch(selectedElement, 1, 1, 15))}
                  />
                  <Button
                    title="Espelhar triângulo"
                    small
                    secondary
                    onPress={() => updateElement(transformHatch(selectedElement, -1, 1))}
                  />
                </View>
                <Numeric
                  label="Espaçamento das linhas"
                  min={6}
                  max={80}
                  value={selectedElement.hatch.spacing}
                  onChange={(spacing) =>
                    updateElement({
                      ...selectedElement,
                      hatch: { ...selectedElement.hatch!, spacing },
                    })
                  }
                />
                <Numeric
                  label="Inclinação da hachura (graus)"
                  min={-180}
                  max={180}
                  value={selectedElement.hatch.angle}
                  onChange={(angle) =>
                    updateElement({
                      ...selectedElement,
                      hatch: { ...selectedElement.hatch!, angle },
                    })
                  }
                />
                <Text style={styles.muted}>
                  Ajuste cada canto para acompanhar o trecho. As posições são do desenho; informe
                  medidas reais com Texto ou Cota.
                </Text>
                {selectedElement.points.slice(0, 3).map((corner, i) => (
                  <FormGrid key={i}>
                    {(['x', 'y'] as const).map((axis) => (
                      <FormCell key={axis}>
                        <Numeric
                          label={'Canto ' + (i + 1) + ' · ' + axis.toUpperCase()}
                          max={axis === 'x' ? 1000 : 800}
                          value={corner[axis]}
                          onChange={(v) => {
                            updateElement(
                              moveHatchCorner(
                                selectedElement,
                                i,
                                axis === 'x' ? v - corner.x : 0,
                                axis === 'y' ? v - corner.y : 0,
                              ),
                            );
                          }}
                        />
                      </FormCell>
                    ))}
                  </FormGrid>
                ))}
              </View>
            )}
            {precisePosition && (
              <>
                {selectedElement.type === 'line' || selectedElement.type === 'dimension' ? (
                  <>
                    <Numeric
                      label="Início X"
                      value={selectedElement.x1}
                      onChange={(x1) => updateElement({ ...selectedElement, x1 })}
                    />
                    <Numeric
                      label="Início Y"
                      value={selectedElement.y1}
                      max={800}
                      onChange={(y1) => updateElement({ ...selectedElement, y1 })}
                    />
                    <Numeric
                      label="Fim X"
                      value={selectedElement.x2}
                      onChange={(x2) => updateElement({ ...selectedElement, x2 })}
                    />
                    <Numeric
                      label="Fim Y"
                      value={selectedElement.y2}
                      max={800}
                      onChange={(y2) => updateElement({ ...selectedElement, y2 })}
                    />
                    {selectedElement.type === 'dimension' && (
                      <Numeric
                        label="Afastamento da cota"
                        value={selectedElement.offset}
                        min={-150}
                        max={150}
                        onChange={(offset) => updateElement({ ...selectedElement, offset })}
                      />
                    )}
                  </>
                ) : selectedElement.type !== 'polyline' ? (
                  <>
                    <Numeric
                      label="Posição X"
                      value={selectedElement.x}
                      onChange={(x) =>
                        updateElement(moveElement(selectedElement, x - selectedElement.x, 0))
                      }
                    />
                    <Numeric
                      label="Posição Y"
                      value={selectedElement.y}
                      max={800}
                      onChange={(y) =>
                        updateElement(moveElement(selectedElement, 0, y - selectedElement.y))
                      }
                    />
                  </>
                ) : null}
                <Numeric
                  label="Passo do movimento"
                  value={moveStep}
                  min={1}
                  max={100}
                  onChange={setMoveStep}
                />
                <View style={[styles.row, { gap: 5 }]}>
                  {[
                    { name: 'Mover à esquerda', x: -moveStep, y: 0 },
                    { name: 'Mover à direita', x: moveStep, y: 0 },
                    { name: 'Mover acima', x: 0, y: -moveStep },
                    { name: 'Mover abaixo', x: 0, y: moveStep },
                  ].map((m) => (
                    <Button
                      key={m.name}
                      title={m.name}
                      small
                      secondary
                      onPress={() => updateElement(moveElement(selectedElement, m.x, m.y))}
                    />
                  ))}
                </View>
              </>
            )}
            <Button
              title={linkedPoint ? 'Remover ponto' : 'Remover elemento'}
              icon="trash"
              variant="danger"
              small
              onPress={removeSelected}
            />
            {linkedPoint && (
              <Text style={[styles.muted, { fontSize: 11 }]}>
                Escolha excluir o ponto do relatório ou retirar apenas sua marcação.
              </Text>
            )}
          </>
        ) : (
          tool === 'select' && (
            <Text style={styles.muted}>Selecione um elemento no desenho ou na lista abaixo.</Text>
          )
        )}
        {(advanced || expanded) && (
          <SelectField
            label="Malha do desenho"
            value={data.grid}
            clearable={false}
            options={[
              { value: 'isometric', label: 'Isométrica · 30° / 90°' },
              { value: 'orthogonal', label: 'Ortogonal · 0° / 90°' },
              { value: 'none', label: 'Livre · sem alinhamento' },
            ]}
            onChange={(grid) => {
              updateData({ ...data, grid: grid as DrawingData['grid'] });
              setStart(undefined);
            }}
          />
        )}
      </View>
    ) : null;
  const fit = () => {
    const w = expanded ? Math.max(1000, (800 * width) / Math.max(1, height)) : 1000;
    setView({ x: (1000 - w) / 2, y: (800 - w * 0.8) / 2, w, h: w * 0.8 });
  };
  const clearDialog = (
    <ConfirmDialog
      visible={!!clearMode}
      title={
        clearMode === 'selection'
          ? 'Excluir o bloco selecionado?'
          : clearMode === 'points'
            ? 'Limpar os pontos deste desenho?'
            : clearMode === 'strokes'
              ? 'Limpar os traços desta prancha?'
              : 'Limpar todo o desenho desta prancha?'
      }
      description={
        clearMode === 'selection'
          ? 'Os objetos e marcações selecionados serão retirados deste desenho. Os pontos cadastrados, resultados e fotos do relatório serão preservados. Você pode desfazer.'
          : clearMode === 'points'
            ? 'Excluir as marcações deste desenho e os pontos correspondentes da lista de soldas? ' +
              points.filter(
                (point) =>
                  data?.elements.some(
                    (e) => e.type === 'point' && e.reportPointId === pointKey(point),
                  ) &&
                  (pointPhotoCount(pointKey(point)) > 0 ||
                    point.label ||
                    point.value != null ||
                    Object.entries(point.data ?? {}).some(([key, value]) =>
                      key !== 'discontinuity'
                        ? value !== '' && value != null
                        : value !== '-' && value !== '',
                    )),
              ).length +
              ' ponto(s) têm dados ou fotos preenchidos. Os dados, resultados, fotos vinculadas e marcações desses pontos nos outros desenhos também serão excluídos ao salvar. Pontos que não estão neste desenho serão mantidos.'
            : clearMode === 'strokes'
              ? 'Linhas, formas, textos e símbolos serão removidos. As imagens e marcações de pontos ficam no desenho. Você pode desfazer.'
              : 'Todas as figuras e marcações desta prancha serão removidas. Os pontos cadastrados, resultados e fotos do relatório serão preservados. Você pode desfazer.'
      }
      confirmLabel={clearMode === 'selection' ? 'Excluir bloco' : 'Confirmar limpeza'}
      danger
      onClose={() => setClearMode(undefined)}
      onConfirm={() => {
        if (data && editable && clearMode === 'points') {
          const keys = [
            ...new Set(
              data.elements.flatMap((element) =>
                element.type === 'point'
                  ? [element.reportPointId]
                  : element.type === 'marker'
                    ? points
                        .filter((point) => point.number.trim() === element.number.trim())
                        .map(pointKey)
                    : [],
              ),
            ),
          ];
          if (!onRemovePoints(keys, activeIndex)) {
            setClearMode(undefined);
            setMessage('Você precisa de permissão para excluir os pontos, suas fotos e marcações.');
            return;
          }
          // Photo deletion is queued with the report: do not expose an incomplete drawing-only undo.
          setHistory([]);
          setFuture([]);
        } else if (data && editable)
          updateData({
            ...data,
            elements:
              clearMode === 'selection'
                ? data.elements.filter((e) => !blockIds.includes(e.id))
                : clearMode === 'strokes'
                  ? data.elements.filter(
                      (e) => e.type === 'point' || e.type === 'marker' || e.type === 'image',
                    )
                  : [],
          });
        setClearMode(undefined);
        finishSelection();
        setSelected('');
        setPointTarget('new');
        setNewNumber(undefined);
        setMessage('');
        setStart(undefined);
        resetGesture();
      }}
    />
  );
  const cleanupDialog = (
    <PickerSheet
      visible={cleanupOpen}
      title="Excluir ou limpar"
      subtitle="Escolha o que deseja remover do desenho."
      icon="trash"
      onClose={() => setCleanupOpen(false)}
    >
      <Button
        title={editingBlock ? 'Excluir bloco selecionado' : 'Excluir objeto selecionado'}
        icon="trash"
        secondary
        disabled={!editable || (!editingSelection && !editingBlock)}
        onPress={() => {
          setCleanupOpen(false);
          if (editingBlock) setClearMode('selection');
          else removeSelected();
        }}
      />
      {!editingSelection && !editingBlock && (
        <Text style={styles.muted}>Selecione um objeto no desenho para excluir só ele.</Text>
      )}
      <Button
        title="Limpar desenho"
        icon="trash"
        variant="danger"
        disabled={!editable || !data?.elements.length}
        onPress={() => {
          setCleanupOpen(false);
          setClearMode('all');
        }}
      />
      <Text style={styles.muted}>
        Limpar retira todos os objetos desta folha. Os pontos cadastrados, resultados e fotos do
        relatório são mantidos. A limpeza pede confirmação e pode ser desfeita.
      </Text>
    </PickerSheet>
  );
  const deleteDialog = (
    <ConfirmDialog
      visible={deleteSheet}
      title="Excluir este desenho?"
      description={`O desenho ${data?.title || ''} será removido ao salvar o relatório. Os outros desenhos, pontos, resultados e fotos serão preservados.`}
      confirmLabel="Excluir desenho"
      danger
      onClose={() => setDeleteSheet(false)}
      onConfirm={() => {
        if (!editable) return;
        commit(value.filter((_, i) => i !== activeIndex));
        setIndex(Math.max(0, activeIndex - 1));
        setSelected('');
        setStart(undefined);
        setStroke([]);
        setDraftElement(undefined);
        setTraceStart(undefined);
        setTraceEnd(undefined);
        gesture.current = undefined;
        setView({ x: 0, y: 0, w: 1000, h: 800 });
        setDeleteSheet(false);
      }}
    />
  );
  const pointRemovalDialog = (
    <ConfirmDialog
      visible={!!removingPoint}
      title={'Remover ponto ' + (removingPoint?.number ?? '') + '?'}
      description={`Excluir remove este ponto da lista, suas marcações em todos os desenhos, seus resultados e ${removingPoint ? pointPhotoCount(removingPoint.key) : 0} fotos vinculadas ao salvar. Para manter os dados, escolha retirar só a marcação selecionada.`}
      confirmLabel="Excluir ponto e vínculos"
      danger
      alternativeLabel="Retirar só a marcação"
      onAlternative={() => {
        if (data && removingPoint && editable)
          updateData({
            ...data,
            elements: data.elements.filter((e) => e.id !== removingPoint.elementId),
          });
        setRemovingPoint(undefined);
        setSelected('');
      }}
      onClose={() => setRemovingPoint(undefined)}
      onConfirm={() => {
        if (removingPoint && canEditPoints && onRemovePoint(removingPoint.key)) {
          setHistory([]);
          setFuture([]);
          setSelected('');
          resetGesture();
        }
        setRemovingPoint(undefined);
      }}
    />
  );
  const quickActions =
    editable && data ? (
      <DrawingToolStrip label="ações do desenho">
        <Button
          title="Limpar traços"
          small
          secondary
          icon="trash"
          disabled={!data.elements.some((e) => e.type !== 'point' && e.type !== 'marker')}
          onPress={() => setClearMode('strokes')}
        />
        <Button
          title="Limpar desenho"
          small
          secondary
          icon="trash"
          disabled={!data.elements.length}
          onPress={() => setClearMode('all')}
        />

        {expanded && (
          <Button
            title="Limpar pontos do desenho"
            small
            secondary
            icon="pin"
            disabled={!data.elements.some((e) => e.type === 'point' || e.type === 'marker')}
            onPress={() => setClearMode('points')}
          />
        )}
        {editingSelection && selectedElement && selectedElement.type !== 'point' && (
          <Button
            title="Duplicar"
            small
            secondary
            icon="plus"
            onPress={() => add({ ...moveElement(selectedElement, 25, 25), id: drawingId() })}
          />
        )}
        {!!hatchCorners.length && (
          <Button
            title="Cancelar hachura"
            small
            secondary
            icon="close"
            onPress={() => {
              setHatchCorners([]);
              setMessage('');
            }}
          />
        )}
        {showStrokeControls && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Button
              title="Afinar"
              small
              secondary
              icon="minus"
              disabled={currentStrokeWidth <= 0.5}
              onPress={() => changeStrokeWidth(-0.5)}
            />
            <View style={{ alignItems: 'center', gap: 4, minWidth: 85 }}>
              <Text style={[styles.muted, { fontSize: 11 }]}>
                {strokeTarget ? 'Selecionado' : 'Novos traços'} · {currentStrokeWidth.toFixed(1)}
              </Text>
              <View
                style={{
                  width: 40,
                  height: currentStrokeWidth,
                  backgroundColor: t.colors.text,
                  borderRadius: 6,
                }}
              />
            </View>
            <Button
              title="Engrossar"
              small
              secondary
              icon="plus"
              disabled={currentStrokeWidth >= 12}
              onPress={() => changeStrokeWidth(0.5)}
            />
          </View>
        )}
        {expanded && (
          <>
            <Button
              title="Novo desenho"
              small
              secondary
              icon="plus"
              disabled={value.length >= 12}
              onPress={addSheet}
            />
            <Button
              title="Excluir desenho"
              small
              secondary
              icon="trash"
              onPress={() => {
                Keyboard.dismiss();
                setDeleteSheet(true);
              }}
            />
          </>
        )}
      </DrawingToolStrip>
    ) : null;
  const closeEntry = () => {
    Keyboard.dismiss();
    setEntry(undefined);
    setTextPosition(undefined);
  };
  const pointToMark = points.find((point) => pointKey(point) === pointTarget);
  const entryControls =
    editable && !editingSelection && (tool === 'point' || tool === 'text') ? (
      <View style={{ padding: 6, gap: 6 }}>
        <Button
          title={
            tool === 'point'
              ? `Marcar ponto ${pointToMark?.number ?? newNumber ?? nextPointNumber(points)} · Alterar`
              : text.trim()
                ? 'Texto pronto · Editar'
                : 'Escrever texto'
          }
          small
          secondary
          icon={tool === 'point' ? 'pin' : 'edit'}
          onPress={() => {
            setTextPosition(undefined);
            setEntry(tool === 'point' ? 'point' : 'text');
          }}
        />
        {!expanded && (
          <Text style={[styles.muted, { fontSize: 11 }]}>
            {tool === 'point'
              ? 'Toque no desenho para marcar. O próximo número aparece automaticamente.'
              : text.trim()
                ? 'Toque no desenho para posicionar o texto.'
                : 'Escreva acima ou toque primeiro no lugar onde deseja inserir.'}
          </Text>
        )}
      </View>
    ) : null;
  const entryDialog = (
    <PickerSheet
      visible={!!entry}
      title={entry === 'text' ? 'Inserir texto no desenho' : 'Escolher ponto para marcar'}
      icon={entry === 'text' ? 'edit' : 'pin'}
      onClose={closeEntry}
      footer={
        <Button
          title={
            entry === 'text'
              ? textPosition
                ? 'Inserir neste local'
                : 'Posicionar texto no desenho'
              : 'Marcar no desenho'
          }
          icon="check"
          disabled={entry === 'text' && !text.trim()}
          onPress={() => {
            if (entry === 'point' && duplicateNumber) setPointTarget(pointKey(duplicateNumber));
            if (entry === 'text' && textPosition) {
              if (!data || data.elements.length >= 600) {
                closeEntry();
                setMessage('Limite de 600 elementos. Crie outro desenho para continuar.');
                return;
              }
              add({
                id: drawingId(),
                type: 'text',
                text: text.trim(),
                ...textPosition,
                size: textSize,
                rotation: textRotation,
              });
              setText('');
              setMessage('');
            }
            closeEntry();
            if (!expanded) revealInline(surface.current);
          }}
        />
      }
    >
      <View style={{ padding: 16, gap: 14 }}>
        {entry === 'text' ? textEntry : pointEntry}
        {entry === 'point' && canEditPoints && (
          <Button
            title="Voltar à numeração automática"
            secondary
            onPress={() => {
              setPointTarget('new');
              setNewNumber(undefined);
            }}
          />
        )}
      </View>
    </PickerSheet>
  );
  const toolPalette = (
    <DrawingToolStrip label="ferramentas" rows={2}>
      {tools.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={'Ferramenta ' + item.name.toLowerCase()}
          aria-pressed={tool === item.id}
          accessibilityState={selectionState(tool === item.id)}
          onPress={() => selectTool(item.id)}
          style={{
            minHeight: 44,
            paddingHorizontal: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            borderRadius: 8,
            backgroundColor: tool === item.id ? t.colors.primary : t.colors.soft,
            borderWidth: 1,
            borderColor: tool === item.id ? t.colors.blue : t.colors.line,
          }}
        >
          <Icon
            name={item.icon}
            size={18}
            color={tool === item.id ? t.colors.white : t.colors.text}
          />
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontFamily: t.fonts.semibold,
              fontSize: 12,
              color: tool === item.id ? t.colors.white : t.colors.text,
            }}
          >
            {item.name}
          </Text>
        </Pressable>
      ))}
    </DrawingToolStrip>
  );
  const selectedHatch =
    editingSelection && selectedElement?.type === 'polyline' && selectedElement.hatch
      ? selectedElement
      : undefined;
  const hatchSettings = selectedHatch
    ? { ...selectedHatch.hatch!, strokeWidth: drawingStrokeWidth(selectedHatch) }
    : hatchDefaults;
  const updateHatchSettings = (patch: Partial<typeof hatchDefaults>) => {
    const next = { ...hatchSettings, ...patch };
    setHatchDefaults(next);
    if (selectedHatch)
      updateElement({
        ...selectedHatch,
        strokeWidth: next.strokeWidth,
        hatch: { spacing: next.spacing, angle: next.angle },
      });
  };
  const hatchControls =
    selectedHatch || (tool === 'hatch' && !editingSelection) ? (
      <View testID="hatch-quick-controls" style={{ gap: 4, paddingHorizontal: 8 }}>
        {!selectedHatch && (
          <Text style={[styles.muted, { fontSize: 11 }]}>
            Toque no canto {hatchCorners.length + 1} de 3 do triângulo.
          </Text>
        )}
        <DrawingToolStrip label="Direção dos traços da hachura">
          {[
            { label: 'Vertical', angle: 90 },
            { label: 'Horizontal', angle: 0 },
            { label: 'Diagonal /', angle: -45 },
            { label: 'Diagonal \\', angle: 45 },
          ].map((direction) => (
            <Pressable
              key={direction.angle}
              accessibilityRole="button"
              accessibilityLabel={'Hachura ' + direction.label.toLowerCase()}
              accessibilityState={{
                selected:
                  ((hatchSettings.angle % 180) + 180) % 180 ===
                  ((direction.angle % 180) + 180) % 180,
              }}
              onPress={() => updateHatchSettings({ angle: direction.angle })}
              style={{
                minHeight: 36,
                paddingHorizontal: 12,
                justifyContent: 'center',
                borderRadius: 8,
                borderWidth: 1,
                borderColor: t.colors.line,
                backgroundColor:
                  ((hatchSettings.angle % 180) + 180) % 180 ===
                  ((direction.angle % 180) + 180) % 180
                    ? t.colors.blueSoft
                    : t.colors.surface,
              }}
            >
              <Text style={[styles.text, { fontSize: 12 }]}>{direction.label}</Text>
            </Pressable>
          ))}
        </DrawingToolStrip>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.muted, { fontSize: 11 }]}>
              Traço {Math.max(0.5, hatchSettings.strokeWidth * 0.45).toFixed(2)}
            </Text>
            <IconButton
              label="Afinar traços da hachura"
              icon="minus"
              small
              disabled={hatchSettings.strokeWidth <= 1.2}
              onPress={() =>
                updateHatchSettings({ strokeWidth: Math.max(1.2, hatchSettings.strokeWidth - 0.5) })
              }
            />
            <IconButton
              label="Engrossar traços da hachura"
              icon="plus"
              small
              disabled={hatchSettings.strokeWidth >= 12}
              onPress={() =>
                updateHatchSettings({ strokeWidth: Math.min(12, hatchSettings.strokeWidth + 0.5) })
              }
            />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.muted, { fontSize: 11 }]}>Espaço {hatchSettings.spacing}</Text>
            <IconButton
              label="Aproximar traços da hachura"
              icon="minus"
              small
              disabled={hatchSettings.spacing <= 6}
              onPress={() =>
                updateHatchSettings({ spacing: Math.max(6, hatchSettings.spacing - 2) })
              }
            />
            <IconButton
              label="Afastar traços da hachura"
              icon="plus"
              small
              disabled={hatchSettings.spacing >= 80}
              onPress={() =>
                updateHatchSettings({ spacing: Math.min(80, hatchSettings.spacing + 2) })
              }
            />
          </View>
        </View>
      </View>
    ) : null;
  const selectionControls = (
    <>
      {(editingSelection || editingBlock) && (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            paddingHorizontal: 8,
            gap: 8,
          }}
        >
          <Button
            title="Editar seleção"
            small
            secondary
            icon="tool"
            onPress={() => setSelectionPanelOpen(true)}
          />
          <Button
            title="Enquadrar seleção"
            small
            secondary
            icon="expand"
            onPress={focusSelection}
          />
          {editingSelection &&
            nearbyIds.filter((id) => data?.elements.some((e) => e.id === id)).length > 1 && (
              <Button
                title="Sobrepostos"
                small
                secondary
                icon="layers"
                onPress={() => setSelectionPickerOpen(true)}
              />
            )}
        </View>
      )}
      {editingBlock ? (
        <View style={{ paddingHorizontal: 8, gap: 4 }}>
          <Text style={[styles.muted, { fontSize: 11 }]}>
            {blockElements.length} elementos no bloco · Arraste para mover. Puxe os cantos para
            aumentar ou diminuir. Dois dedos para girar.
          </Text>
          <View style={[styles.row, { gap: 8, flexWrap: 'wrap' }]}>
            <Button
              title="Diminuir bloco"
              small
              secondary
              icon="minus"
              onPress={() => resizeBlock(1 / 1.15)}
            />
            <Button
              title="Aumentar bloco"
              small
              secondary
              icon="plus"
              onPress={() => resizeBlock(1.15)}
            />
          </View>
          <View style={[styles.row, { gap: 8, flexWrap: 'wrap' }]}>
            <Button
              title="Selecionar tudo"
              small
              secondary
              icon="cursor"
              onPress={selectWholeDrawing}
            />
            <IconButton label="Novo laço" small icon="lasso" onPress={() => selectTool('lasso')} />
            <Button title="Soltar bloco" small secondary icon="check" onPress={finishSelection} />
          </View>
        </View>
      ) : editingSelection ? (
        <View
          style={{
            paddingHorizontal: 8,
            gap: 2,
            ...(screen.width >= 600 ? { flexDirection: 'row', alignItems: 'center' } : {}),
          }}
        >
          <Text style={[styles.muted, { fontSize: 11 }, screen.width >= 600 && { flex: 1 }]}>
            {selectedElement.type === 'point' || selectedElement.type === 'marker'
              ? 'Arraste a marcação para mudar de lugar. O vínculo com o ponto é mantido.'
              : 'Arraste para mover. Alça ↻: girar no lugar. Dois dedos: tamanho e rotação.'}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 8,
            }}
          >
            {selectedElement.type !== 'point' && selectedElement.type !== 'marker' && (
              <>
                <IconButton
                  label="Diminuir selecionado"
                  icon="minus"
                  small
                  disabled={
                    (selectedElement.type === 'symbol' && (selectedElement.scale ?? 1) <= 0.5) ||
                    (selectedElement.type === 'text' && (selectedElement.size ?? 20) <= 10)
                  }
                  onPress={() =>
                    updateElement(transformDrawingElement(selectedElement, 0, 0, 0, 1 / 1.15))
                  }
                />
                <IconButton
                  label="Aumentar selecionado"
                  icon="plus"
                  small
                  disabled={
                    (selectedElement.type === 'symbol' && (selectedElement.scale ?? 1) >= 3) ||
                    (selectedElement.type === 'text' && (selectedElement.size ?? 20) >= 40)
                  }
                  onPress={() =>
                    updateElement(transformDrawingElement(selectedElement, 0, 0, 0, 1.15))
                  }
                />
              </>
            )}
            <IconButton
              label="Ajustar selecionado"
              icon="tool"
              small
              onPress={() => {
                if (expanded) setShowProperties(true);
                else revealInline(propertiesView.current);
              }}
            />
            <IconButton
              label="Excluir selecionado"
              icon="trash"
              small
              onPress={deleteSelectionOrClean}
            />
            <IconButton label="Concluir ajuste" icon="check" small onPress={finishSelection} />
          </View>
          {selectedElement.type === 'image' && (
            <Button
              title="Selecionar imagem e marcações"
              small
              secondary
              icon="lasso"
              onPress={selectWholeDrawing}
            />
          )}
        </View>
      ) : (
        entryControls
      )}
      {editable && tool === 'lasso' && !editingBlock && (
        <View style={{ paddingHorizontal: 8 }}>
          <Button
            title="Selecionar tudo"
            small
            secondary
            icon="cursor"
            disabled={!data?.elements.length}
            onPress={selectWholeDrawing}
          />
        </View>
      )}
      {hatchControls}
      {editable &&
        showStrokeControls &&
        !editingBlock &&
        (!expanded || toolsOpen || editingSelection) && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Estilo da linha"
            onPress={() => setStrokePanelOpen(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 12,
              paddingVertical: 8,
              marginHorizontal: 8,
              borderWidth: 1,
              borderColor: t.colors.line,
              borderRadius: 10,
            }}
          >
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: currentStrokeAppearance.strokeColor,
                borderWidth: 1,
                borderColor: t.colors.line,
              }}
            />
            <Text style={[styles.text, { flex: 1, fontSize: 12 }]}>
              {strokeTarget ? 'Linha selecionada' : 'Próximos traços'} ·{' '}
              {strokeStyleLabels[currentStrokeAppearance.strokeStyle]} ·{' '}
              {currentStrokeWidth.toFixed(1)}
            </Text>
            <Icon name="tool" size={18} />
          </Pressable>
        )}
    </>
  );
  const strokeDialog = (
    <DrawingStrokePanel
      visible={strokePanelOpen}
      value={editingBlock && quickStroke ? quickStroke : currentStrokeAppearance}
      selected={!!strokeTarget || editingBlock}
      onChange={(patch) =>
        editingBlock
          ? updateBlock(blockElements.map((e) => (hasDrawingStroke(e) ? { ...e, ...patch } : e)))
          : updateStrokeAppearance(patch)
      }
      onClose={() => setStrokePanelOpen(false)}
    />
  );
  const imageAction =
    editable && canUploadImages && photoDraftKey && data ? (
      <IconButton
        label="Inserir imagem no desenho"
        icon="image"
        onPress={() => setImageSourceOpen(true)}
      />
    ) : null;
  const selectionDialog = (
    <PickerSheet
      visible={selectionPickerOpen}
      title="Selecionar elemento"
      subtitle="Escolha qual item deste local você quer ajustar."
      icon="layers"
      onClose={() => setSelectionPickerOpen(false)}
    >
      <View style={{ padding: 16, gap: 8 }}>
        {data?.elements
          .filter((e) => nearbyIds.includes(e.id))
          .reverse()
          .map((e) => (
            <Button
              key={e.id}
              title={elementLabel(e)}
              secondary={e.id !== selected}
              icon={e.id === selected ? 'check' : 'cursor'}
              onPress={() => {
                resetGesture();
                const members = drawingGroupMembers(data!.elements, [e.id]);
                setBlockIds(members.length > 1 ? members.map((e) => e.id) : []);
                setSelected(members.length > 1 ? '' : e.id);
                setDirectSelection(members.length === 1);
                setTool('select');
                setShowProperties(false);
                setToolsOpen(false);
                setSelectionPickerOpen(false);
              }}
            />
          ))}
      </View>
    </PickerSheet>
  );
  const professionalToolbar = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 8 }}>
      <Button
        title={snapEnabled ? 'Encaixe: ligado' : 'Encaixe: desligado'}
        small
        secondary
        icon="pin"
        onPress={() => {
          setSnapEnabled(!snapEnabled);
          setSnapGuide(undefined);
        }}
      />
      {data?.elements.some((e) => e.type === 'image' && e.locked) && (
        <Button
          title="Imagens bloqueadas"
          small
          secondary
          icon="lock"
          onPress={() => setLockedImagesOpen(true)}
        />
      )}
    </View>
  );
  const professionalDialog = (
    <>
      <DrawingSelectionPanel
        visible={selectionPanelOpen}
        elements={transformElements}
        onClose={() => setSelectionPanelOpen(false)}
        onApply={updateBlock}
        onAction={selectionAction}
      />
      <PickerSheet
        visible={lockedImagesOpen}
        title="Imagens bloqueadas"
        icon="lock"
        onClose={() => setLockedImagesOpen(false)}
      >
        <View style={{ padding: 16, gap: 8 }}>
          {data?.elements
            .filter((e) => e.type === 'image' && e.locked)
            .map((e, i) => (
              <Button
                key={e.id}
                title={'Desbloquear imagem ' + (i + 1)}
                secondary
                icon="lock"
                onPress={() => {
                  if (e.type !== 'image') return;
                  updateElement({ ...e, locked: false });
                  setLockedImagesOpen(false);
                  setSelected(e.id);
                  setDirectSelection(true);
                  setTool('select');
                  setToolsOpen(false);
                  setMessage('');
                }}
              />
            ))}
        </View>
      </PickerSheet>
    </>
  );
  const imageDialog = (
    <>
      {!!drawingImages.error && (
        <View style={{ padding: 6 }}>
          <Text style={styles.muted}>Não foi possível carregar uma imagem do desenho.</Text>
          <Button title="Recarregar imagens" small secondary onPress={drawingImages.retry} />
        </View>
      )}
      <MediaSourcePicker
        visible={imageSourceOpen}
        contextLabel="Inserir imagem no desenho"
        onClose={() => setImageSourceOpen(false)}
        onSelect={async (asset, progress) => {
          if (!data || !photoDraftKey || !canUploadImages) return;
          if (data.elements.length >= 600)
            throw new Error('Limite de 600 elementos. Crie outra folha.');
          progress('Preparando imagem para o desenho…');
          const size = await drawingImageSize(asset);
          const mediaKey = 'drawing-image-' + drawingId();
          const element: DrawingElement = {
            id: drawingId(),
            type: 'image',
            mediaKey,
            x: 500,
            y: 400,
            ...size,
            rotation: 0,
          };
          if (!add(element)) throw new Error('Não foi possível inserir a imagem. Tente novamente.');
          useReportPhotoDrafts.getState().update(photoDraftKey, (draft) => ({
            ...draft,
            photos: [
              ...draft.photos,
              { id: mediaKey, pointKey: null, sectionKey: 'drawing', asset, caption: '' },
            ],
          }));
          setTool('select');
          setToolsOpen(false);
        }}
      />
    </>
  );
  const content = (
    <View style={{ gap: 18 }}>
      <PanelHeader
        title="Desenho técnico"
        subtitle="Desenhos de inspeção com pontos vinculados às fotos e aos resultados."
        icon="layers"
        action={
          !data && (
            <Button
              title={expanded ? 'Concluir desenho' : 'Tela cheia'}
              small
              secondary
              icon={expanded ? 'check' : 'expand'}
              onPress={() => setExpanded(!expanded)}
            />
          )
        }
      />
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <View style={[styles.row, { gap: 6 }]}>
          {value.map((d, i) => (
            <Button
              key={d.id ?? i}
              title={'Desenho ' + (i + 1)}
              small
              secondary={activeIndex !== i}
              onPress={() => {
                setIndex(i);
                setSelected('');
                setStart(undefined);
                setStroke([]);
                setDraftElement(undefined);
                setTraceStart(undefined);
                setTraceEnd(undefined);
                gesture.current = undefined;
                setView({ x: 0, y: 0, w: 1000, h: 800 });
              }}
            />
          ))}
        </View>
        {editable && (
          <Button
            title="Novo desenho"
            icon="plus"
            small
            secondary
            disabled={value.length >= 12}
            onPress={addSheet}
          />
        )}
      </View>
      {data && editable && (
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            title="Excluir desenho"
            variant="ghost"
            icon="trash"
            small
            onPress={() => {
              Keyboard.dismiss();
              setDeleteSheet(true);
            }}
          />
        </View>
      )}
      {!data ? (
        <Card style={{ backgroundColor: t.colors.soft, alignItems: 'center', paddingVertical: 34 }}>
          <Icon name="pipe" size={42} color={t.colors.blue} />
          <Text style={[styles.text, { fontFamily: t.fonts.bold }]}>
            Desenhe a linha. Identifique cada ponto.
          </Text>
          <Text style={[styles.muted, { textAlign: 'center', maxWidth: 440 }]}>
            Monte o croqui em malha isométrica ou ortogonal. Cada número acompanha a solda ou
            medição até o PDF final.
          </Text>
          {editable && <Button title="Criar primeiro desenho" icon="plus" onPress={addSheet} />}
        </Card>
      ) : (
        <>
          {imageAction}
          <Button
            title={
              sheetDetails
                ? 'Ocultar identificação do desenho'
                : data.title + ' · Rev. ' + data.revision + ' · Editar'
            }
            small
            secondary
            onPress={() => setSheetDetails(!sheetDetails)}
          />
          {sheetDetails && (
            <FormGrid>
              <FormCell>
                <Field
                  label="Nome do desenho"
                  value={data.title}
                  editable={editable}
                  onChangeText={(title) => updateData({ ...data, title })}
                  maxLength={150}
                />
              </FormCell>
              <FormCell>
                <Field
                  label="Revisão do desenho"
                  value={data.revision}
                  editable={editable}
                  onChangeText={(revision) => updateData({ ...data, revision })}
                  maxLength={30}
                />
              </FormCell>
            </FormGrid>
          )}
          {editable && (
            <>
              {toolPalette}
              {professionalToolbar}
              {quickActions}
              <View style={styles.row}>
                <Button
                  title="Desfazer"
                  small
                  secondary
                  icon="undo"
                  disabled={!history.length && !hatchCorners.length}
                  onPress={() => undo()}
                />
                <Button
                  title="Refazer"
                  small
                  secondary
                  icon="redo"
                  disabled={!future.length}
                  onPress={() => undo(true)}
                />
                <Button
                  title={advanced ? 'Menos ajustes' : 'Mais ajustes'}
                  small
                  secondary
                  onPress={() => setAdvanced(!advanced)}
                />
              </View>
            </>
          )}
          <View
            style={{ flexDirection: mobile ? 'column' : 'row', gap: 16, alignItems: 'flex-start' }}
          >
            <View
              style={{
                flex: mobile ? undefined : 1,
                width: mobile ? '100%' : undefined,
                minWidth: 0,
                gap: 10,
              }}
            >
              <View style={[styles.row, { justifyContent: 'space-between', gap: 8 }]}>
                <Badge
                  label={
                    (data.grid === 'isometric'
                      ? 'ISOMÉTRICO'
                      : data.grid === 'orthogonal'
                        ? 'ORTOGONAL'
                        : 'LIVRE') + ' · SEM ESCALA'
                  }
                  tone="blue"
                  dot={false}
                />
                <View style={[styles.row, { gap: 4, flexShrink: 1 }]}>
                  <IconButton label="Diminuir zoom" icon="minus" small onPress={() => zoom(1.25)} />
                  <Text style={styles.muted}>{Math.round(100000 / view.w)}%</Text>
                  <IconButton label="Ampliar zoom" icon="plus" small onPress={() => zoom(0.8)} />
                  <Button title="Ajustar" small secondary onPress={fit} />
                </View>
              </View>
              <Button title="Tela cheia" icon="expand" onPress={() => setExpanded(true)} />
              {selectionControls}
              {canvas}
              {annotation}
              <Text style={[styles.muted, { fontSize: 11 }]}>
                Segure brevemente para selecionar e arraste. Dois dedos no selecionado: girar, mover
                e redimensionar · Mouse: roda para zoom
              </Text>
              <View style={[styles.row, { justifyContent: 'space-between' }]}>
                <Text style={[styles.muted, { fontSize: 11 }]}>
                  {data.elements.length} elementos ·{' '}
                  {data.elements.filter((e) => e.type === 'point' || e.type === 'marker').length}{' '}
                  pontos marcados
                </Text>
                {editable && (
                  <Button
                    title="Limpar pontos do desenho"
                    small
                    secondary
                    icon="pin"
                    disabled={!data.elements.some((e) => e.type === 'point' || e.type === 'marker')}
                    onPress={() => setClearMode('points')}
                  />
                )}
                <Text style={[styles.muted, { fontSize: 11 }]}>
                  Azul: pendente · Verde: aceitável · Vermelho: não aceitável
                </Text>
              </View>
            </View>
            {editable &&
              (advanced || ['symbol', 'dimension'].includes(tool) || editingSelection) && (
                <InputVisibilityContext.Provider value={revealInline}>
                  {properties}
                </InputVisibilityContext.Provider>
              )}
          </View>
          <View style={{ gap: 10 }}>
            <PanelHeader
              title="Pontos neste desenho"
              subtitle="O número é único no relatório e pode ser alterado sem perder os vínculos."
            />
            <View style={styles.row}>
              {data.elements
                .filter((e) => e.type === 'point' || e.type === 'marker')
                .map((e) => {
                  const p =
                    e.type === 'point'
                      ? points.find((p) => pointKey(p) === e.reportPointId)
                      : undefined;
                  return (
                    <Button
                      key={e.id}
                      title={
                        e.type === 'marker' ? 'Marcação ' + e.number : 'Ponto ' + (p?.number ?? '?')
                      }
                      icon="pin"
                      small
                      secondary={selected !== e.id}
                      onPress={() => {
                        setSelected(e.id);
                        selectTool('select');
                      }}
                    />
                  );
                })}
            </View>
            {!data.elements.some((e) => e.type === 'point' || e.type === 'marker') && (
              <Text style={styles.muted}>
                Use a ferramenta Ponto para numerar as soldas e medições.
              </Text>
            )}
            {!!unplacedPoints.length && editable && (
              <View style={{ gap: 8 }}>
                <Text style={styles.label}>
                  {unplacedPoints.length} pontos ainda sem marcação no relatório
                </Text>
                <Text style={styles.muted}>
                  Eles continuam cadastrados. Selecione abaixo e toque no desenho para incluir o
                  número no PDF.
                </Text>
                <View style={[styles.row, { flexWrap: 'wrap' }]}>
                  {unplacedPoints.map((point) => (
                    <Button
                      key={pointKey(point)}
                      title={'Posicionar ponto ' + point.number}
                      icon="pin"
                      small
                      secondary
                      onPress={() => {
                        selectTool('point');
                        setPointTarget(pointKey(point));
                        revealInline(surface.current);
                      }}
                    />
                  ))}
                </View>
              </View>
            )}
          </View>
          {editable && advanced && (
            <>
              <SelectField
                label="Selecionar elemento pela lista"
                value={selected}
                options={data.elements.map((e, i) => ({
                  value: e.id,
                  label:
                    (e.type === 'marker'
                      ? 'Marcação ' + e.number
                      : e.type === 'point'
                        ? 'Ponto ' +
                          (points.find((p) => pointKey(p) === e.reportPointId)?.number ?? '?')
                        : e.type === 'symbol'
                          ? drawingSymbols.find((s) => s.code === e.symbolCode)?.name
                          : e.type === 'text' || e.type === 'dimension'
                            ? e.text
                            : e.type === 'line'
                              ? 'Linha'
                              : 'Polilinha') +
                    ' · ' +
                    (i + 1),
                }))}
                onChange={(id) => {
                  setSelected(id);
                  selectTool('select');
                }}
              />
            </>
          )}
        </>
      )}
      {entryDialog}
      {selectionDialog}
      {professionalDialog}
      {imageDialog}
      {strokeDialog}
      {clearDialog}
      {cleanupDialog}
      {deleteDialog}
      {pointRemovalDialog}
    </View>
  );
  return expanded ? (
    <DrawingWorkspace
      imageAction={imageAction}
      title={data?.title ?? 'Desenho técnico'}
      toolName={
        editingBlock
          ? 'Bloco selecionado'
          : editingSelection && selectedElement
            ? selectedElement.type === 'image'
              ? 'Imagem selecionada'
              : selectedElement.type === 'symbol'
                ? 'Símbolo selecionado'
                : selectedElement.type === 'text'
                  ? 'Texto selecionado'
                  : 'Elemento selecionado'
            : (tools.find((item) => item.id === tool)?.name ?? 'Desenho')
      }
      hint={
        (tools.find((item) => item.id === tool)?.hint ?? '') + ' Segure brevemente para selecionar.'
      }
      message={message}
      toolsOpen={toolsOpen}
      onToolsChange={(open) => {
        setSelectionOptionsOpen(false);
        setToolsOpen(open);
        if (open) setShowProperties(false);
      }}
      tools={
        data && editable ? (
          <>
            {professionalToolbar}
            {toolPalette}
          </>
        ) : null
      }
      actions={data ? quickActions : null}
      selection={data ? selectionControls : null}
      hasSelectionControls={
        !!data &&
        editable &&
        (editingSelection ||
          editingBlock ||
          ['point', 'text', 'lasso', 'hatch'].includes(tool) ||
          showStrokeControls)
      }
      selectionOptionsOpen={selectionOptionsOpen}
      onSelectionOptionsChange={setSelectionOptionsOpen}
      canvas={
        data ? (
          canvas
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
            {content}
          </ScrollView>
        )
      }
      inspector={properties}
      showInspector={showProperties && editable && !!data}
      onInspectorChange={setShowProperties}
      onClose={() => {
        setExpanded(false);
        selectTool(tool);
        setEntry(undefined);
        setShowProperties(false);
      }}
      dialogs={
        <>
          {entryDialog}
          {selectionDialog}
          {professionalDialog}
          {imageDialog}
          {strokeDialog}
          {data ? clearDialog : null}
          {cleanupDialog}
          {deleteDialog}
          {pointRemovalDialog}
        </>
      }
      footer={
        <View style={{ gap: 4 }}>
          <ScrollView
            horizontal
            style={{ flexGrow: 0, flexShrink: 0, minHeight: 44 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 4, alignItems: 'center' }}
            showsHorizontalScrollIndicator={false}
          >
            <IconButton
              label="Desfazer"
              icon="undo"
              disabled={!editable || (!history.length && !hatchCorners.length)}
              onPress={() => undo()}
            />
            <IconButton
              label="Refazer"
              icon="redo"
              disabled={!editable || !future.length}
              onPress={() => undo(true)}
            />
            <IconButton label="Diminuir zoom" icon="minus" onPress={() => zoom(1.25)} />
            <IconButton label="Ampliar zoom" icon="plus" onPress={() => zoom(0.8)} />
            {screen.width >= 360 ? (
              <Button title="Ajustar" small secondary onPress={fit} style={{ minHeight: 44 }} />
            ) : (
              <IconButton label="Ajustar" icon="expand" onPress={fit} />
            )}
            {editable &&
              (screen.width >= 360 ? (
                <Button
                  title={showProperties ? 'Fechar ajustes' : 'Ajustes'}
                  small
                  secondary
                  icon="tool"
                  style={{ minHeight: 44 }}
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowProperties(!showProperties);
                  }}
                />
              ) : (
                <IconButton
                  label={showProperties ? 'Fechar ajustes' : 'Ajustes'}
                  icon="tool"
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowProperties(!showProperties);
                  }}
                />
              ))}
            {start && <Button title="Concluir traçado" small onPress={() => setStart(undefined)} />}
          </ScrollView>
        </View>
      }
    />
  ) : (
    content
  );
}
