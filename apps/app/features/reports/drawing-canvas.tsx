import { memo, useId, useMemo } from 'react';
import Svg, { ClipPath, Defs, G, Image, Rect, SvgXml } from 'react-native-svg';
import {
  drawingImageFrame,
  drawingOrderedElements,
  drawingPageBounds,
  drawingSvg,
  newDrawingData,
  type DrawingData,
  type DrawingElement,
} from '@weldcosta/shared';

type Options = NonNullable<Parameters<typeof drawingSvg>[2]>;
type Points = Parameters<typeof drawingSvg>[1];
const fixedViewBox = '0 0 1000 800';

// Keep decoded image sources and parsed vector nodes mounted during gestures.
// Only the element being edited changes; pan/zoom only changes the outer viewBox.
const CanvasElement = memo(function CanvasElement({
  element,
  points,
  uri,
  selected,
  opacity,
}: {
  element: DrawingElement;
  points: Points;
  uri?: string;
  selected: boolean;
  opacity: number;
}) {
  const id = 'canvas-image-' + useId().replace(/[^a-zA-Z0-9_-]/g, '_');
  const source = useMemo(() => (uri ? { uri } : undefined), [uri]);
  const xml = useMemo(
    () =>
      element.type === 'image'
        ? ''
        : drawingSvg({ ...newDrawingData(), grid: 'none', elements: [element] }, points, {
            showBackground: false,
            showGrid: false,
            viewBox: fixedViewBox,
            selectedId: selected ? element.id : undefined,
            renderElements: true,
            selectionControls: false,
          }),
    [element, points, selected],
  );
  if (element.type !== 'image')
    return (
      <G opacity={opacity}>
        <SvgXml xml={xml} width={1000} height={800} />
      </G>
    );
  const frame = drawingImageFrame(element);
  return (
    <G
      transform={`translate(${element.x} ${element.y}) rotate(${element.rotation})`}
      opacity={opacity}
    >
      <Defs>
        <ClipPath id={id}>
          <Rect
            x={-element.width / 2}
            y={-element.height / 2}
            width={element.width}
            height={element.height}
          />
        </ClipPath>
      </Defs>
      {source ? (
        <G clipPath={`url(#${id})`}>
          <Image href={source} {...frame} preserveAspectRatio="none" />
        </G>
      ) : (
        <Rect
          x={-element.width / 2}
          y={-element.height / 2}
          width={element.width}
          height={element.height}
          fill="#E9EDF2"
          stroke="#64748B"
          strokeDasharray="8 4"
        />
      )}
    </G>
  );
});

export const DrawingCanvas = memo(function DrawingCanvas({
  data,
  points,
  options,
}: {
  data: DrawingData;
  points: Points;
  options: Options;
}) {
  const clipId = 'canvas-page-' + useId().replace(/[^a-zA-Z0-9_-]/g, '_');
  const page = drawingPageBounds(data);
  const background = useMemo(
    () =>
      drawingSvg({ ...newDrawingData(), grid: data.grid, elements: [] }, [], {
        viewBox: fixedViewBox,
      }),
    [data.grid],
  );
  const ordered = useMemo(() => drawingOrderedElements(data.elements), [data.elements]);
  // Overlay never contains image bytes or unrelated geometry.
  const overlay = drawingSvg(
    {
      ...data,
      page: undefined,
      grid: 'none',
      elements: data.elements.filter(
        (e) => e.id === options.selectedId || options.selectedIds?.includes(e.id),
      ),
    },
    points,
    {
      ...options,
      images: undefined,
      viewBox: fixedViewBox,
      showBackground: false,
      showGrid: false,
      renderElements: false,
    },
  );
  return (
    <Svg width="100%" height="100%" viewBox={options.viewBox} pointerEvents="none">
      <Defs>
        <ClipPath id={clipId}>
          <Rect {...page} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clipId})`}>
        <SvgXml xml={background} width={1000} height={800} />
        {ordered.map((element) => {
          const selected =
            element.id === options.selectedId || !!options.selectedIds?.includes(element.id);
          return (
            <CanvasElement
              key={element.id}
              element={element}
              points={points}
              uri={element.type === 'image' ? options.images?.[element.mediaKey] : undefined}
              selected={selected}
              opacity={
                selected && options.selectionFrame && !options.selectedIds?.length
                  ? (options.selectionOpacity ?? 0.5)
                  : 1
              }
            />
          );
        })}
      </G>
      <SvgXml xml={overlay} width={1000} height={800} />
    </Svg>
  );
});
