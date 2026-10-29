import { forwardRef, memo, useEffect, useImperativeHandle, useRef, useState } from 'react';
import Svg, { Path } from 'react-native-svg';
import {
  drawingStrokeDash,
  drawingBrush,
  createFreehandPathBuilder,
  type DrawingPosition,
} from '@weldcosta/shared';
import type { StrokeAppearance } from './drawing-stroke-panel';

export type LiveInkHandle = {
  draw(points: DrawingPosition[], style: StrokeAppearance): void;
  clear(): void;
};

// Updating this layer never redraws the form, tools or existing SVG elements.
export const DrawingLiveInk = memo(
  forwardRef<LiveInkHandle, { viewBox: string }>(function DrawingLiveInk({ viewBox }, ref) {
    const [ink, setInk] = useState<{ path: string; style: StrokeAppearance }>();
    const pending = useRef<{ points: DrawingPosition[]; style: StrokeAppearance } | undefined>(
      undefined,
    );
    const buildPath = useRef(createFreehandPathBuilder());
    const started = useRef(false);
    const frame = useRef<number | undefined>(undefined);
    useEffect(
      () => () => {
        if (frame.current !== undefined) cancelAnimationFrame(frame.current);
      },
      [],
    );
    useImperativeHandle(
      ref,
      () => ({
        draw(points, style) {
          pending.current = { points, style };
          // Show the beginning immediately; batch subsequent input to the display refresh.
          if (!started.current) {
            started.current = true;
            setInk({ path: buildPath.current(points), style });
            return;
          }
          if (frame.current !== undefined) return;
          frame.current = requestAnimationFrame(() => {
            frame.current = undefined;
            const next = pending.current;
            if (next) setInk({ path: buildPath.current(next.points), style: next.style });
          });
        },
        clear() {
          if (frame.current !== undefined) cancelAnimationFrame(frame.current);
          frame.current = undefined;
          pending.current = undefined;
          started.current = false;
          buildPath.current([]);
          setInk(undefined);
        },
      }),
      [],
    );
    return (
      <Svg
        pointerEvents="none"
        width="100%"
        height="100%"
        viewBox={viewBox}
        style={{ position: 'absolute', left: 0, top: 0 }}
      >
        {ink && (
          <Path
            d={ink.path}
            fill="none"
            stroke={ink.style.strokeColor}
            strokeWidth={ink.style.strokeWidth}
            strokeLinecap={drawingBrush(ink.style.brush).cap}
            strokeOpacity={drawingBrush(ink.style.brush).opacity}
            strokeLinejoin="round"
            strokeDasharray={
              drawingStrokeDash(ink.style.strokeStyle, ink.style.strokeWidth) || undefined
            }
          />
        )}
      </Svg>
    );
  }),
);
