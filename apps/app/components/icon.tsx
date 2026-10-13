import { useTheme } from '../utils/theme';
import Svg, { Circle, Path, Rect, Line } from 'react-native-svg';

export type IconName =
  | 'dashboard'
  | 'building'
  | 'folder'
  | 'report'
  | 'plus'
  | 'search'
  | 'arrow-right'
  | 'arrow-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'check'
  | 'check-circle'
  | 'clock'
  | 'archive'
  | 'mail'
  | 'phone'
  | 'pin'
  | 'user'
  | 'logout'
  | 'eye'
  | 'eye-off'
  | 'lock'
  | 'filter'
  | 'close'
  | 'save'
  | 'calendar'
  | 'shield'
  | 'edit'
  | 'alert'
  | 'layers'
  | 'send'
  | 'trash'
  | 'menu'
  | 'tool'
  | 'image'
  | 'download'
  | 'cursor'
  | 'pipe'
  | 'line'
  | 'valve'
  | 'text'
  | 'ruler'
  | 'move'
  | 'undo'
  | 'redo'
  | 'minus'
  | 'expand'
  | 'moon'
  | 'sun'
  | 'book'
  | 'play'
  | 'pencil'
  | 'circle'
  | 'rectangle'
  | 'camera';
export function Icon({
  name,
  size = 20,
  color,
  strokeWidth = 1.7,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const { tokens: t } = useTheme();
  const content = (() => {
    switch (name) {
      case 'camera':
        return (
          <>
            <Path d="M3 7h4l2-3h6l2 3h4v14H3Z" />
            <Circle cx={12} cy={14} r={4} />
          </>
        );
      case 'pencil':
        return (
          <>
            <Path d="m15 3 6 6L9 21H3v-6Z M12 6l6 6 M3 15l6 6" />
            <Path d="M3 3c0 5 6 0 6 4" />
          </>
        );
      case 'circle':
        return <Circle cx={12} cy={12} r={9} />;
      case 'rectangle':
        return <Rect x={3} y={5} width={18} height={14} rx={1} />;
      case 'book':
        return <Path d="M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v15" />;
      case 'play':
        return (
          <>
            <Circle cx={12} cy={12} r={9} />
            <Path d="m10 8 6 4-6 4Z" />
          </>
        );
      case 'moon':
        return <Path d="M20.9 13.1A9 9 0 0 1 10.9 3.1 9 9 0 1 0 20.9 13.1Z" />;
      case 'sun':
        return (
          <>
            <Circle cx={12} cy={12} r={4} />
            <Path d="M12 2v2 M12 20v2 M2 12h2 M20 12h2 M4.93 4.93l1.42 1.42 M17.65 17.65l1.42 1.42 M4.93 19.07l1.42-1.42 M17.65 6.35l1.42-1.42" />
          </>
        );
      case 'expand':
        return <Path d="M9 3H3v6 M15 3h6v6 M3 15v6h6 M21 15v6h-6" />;
      case 'cursor':
        return <Path d="m5 3 14 10-7 1-3 7Z" />;
      case 'pipe':
        return <Path d="m3 16 7-4V5l11 6v8 M7 10l6 4 M17 9l6 4" />;
      case 'line':
        return (
          <>
            <Path d="M5 19 19 5" />
            <Circle cx={5} cy={19} r={2} />
            <Circle cx={19} cy={5} r={2} />
          </>
        );
      case 'valve':
        return <Path d="m3 7 18 10V7L3 17Z M12 12V3 M8 3h8" />;
      case 'text':
        return <Path d="M4 7V4h16v3 M12 4v16 M8 20h8" />;
      case 'ruler':
        return <Path d="m3 16 13-13 5 5L8 21Z M8 11l3 3 M12 7l3 3 M4 15l3 3" />;
      case 'move':
        return (
          <Path d="M12 2v20 M2 12h20 M8 6l4-4 4 4 M8 18l4 4 4-4 M6 8l-4 4 4 4 M18 8l4 4-4 4" />
        );
      case 'undo':
        return <Path d="M8 4 3 9l5 5 M3 9h10a7 7 0 0 1 0 14" />;
      case 'redo':
        return <Path d="m16 4 5 5-5 5 M21 9h-10a7 7 0 0 0 0 14" />;
      case 'minus':
        return <Path d="M4 12h16" />;
      case 'image':
        return (
          <>
            <Rect x={3} y={3} width={18} height={18} rx={3} />
            <Circle cx={8} cy={8} r={1.5} />
            <Path d="m3 17 5-5 4 4 4-6 5 7" />
          </>
        );
      case 'download':
        return <Path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />;
      case 'dashboard':
        return (
          <>
            <Rect x={3} y={3} width={7} height={7} rx={1.5} />
            <Rect x={14} y={3} width={7} height={7} rx={1.5} />
            <Rect x={3} y={14} width={7} height={7} rx={1.5} />
            <Rect x={14} y={14} width={7} height={7} rx={1.5} />
          </>
        );
      case 'building':
        return (
          <>
            <Rect x={5} y={3} width={14} height={18} rx={2} />
            <Path d="M9 7h1m4 0h1M9 11h1m4 0h1M9 15h1m4 0h1M10 21v-3h4v3" />
          </>
        );
      case 'folder':
        return (
          <Path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
        );
      case 'report':
        return (
          <Path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6ZM14 3v6h6M8 13h8M8 17h5" />
        );
      case 'plus':
        return <Path d="M12 5v14M5 12h14" />;
      case 'search':
        return (
          <>
            <Circle cx={10.5} cy={10.5} r={6.5} />
            <Path d="m16 16 4.5 4.5" />
          </>
        );
      case 'arrow-right':
        return <Path d="M4 12h16m-6-6 6 6-6 6" />;
      case 'arrow-left':
        return <Path d="M20 12H4m6-6-6 6 6 6" />;
      case 'chevron-right':
        return <Path d="m9 6 6 6-6 6" />;
      case 'chevron-down':
        return <Path d="m6 9 6 6 6-6" />;
      case 'check':
        return <Path d="m5 12 4 4L19 6" />;
      case 'check-circle':
        return (
          <>
            <Circle cx={12} cy={12} r={9} />
            <Path d="m8 12 3 3 5-6" />
          </>
        );
      case 'clock':
        return (
          <>
            <Circle cx={12} cy={12} r={9} />
            <Path d="M12 7v5l3 2" />
          </>
        );
      case 'archive':
        return (
          <>
            <Rect x={3} y={3} width={18} height={4} rx={1} />
            <Path d="M5 7v13h14V7M9 11h6" />
          </>
        );
      case 'mail':
        return (
          <>
            <Rect x={3} y={5} width={18} height={14} rx={2} />
            <Path d="m3 6 9 7 9-7" />
          </>
        );
      case 'phone':
        return (
          <Path d="M5 3h4l2 5-3 2a15 15 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A18 18 0 0 1 3 5a2 2 0 0 1 2-2Z" />
        );
      case 'pin':
        return (
          <>
            <Path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
            <Circle cx={12} cy={10} r={2.5} />
          </>
        );
      case 'user':
        return (
          <>
            <Circle cx={12} cy={8} r={4} />
            <Path d="M4 21v-2a8 8 0 0 1 16 0v2" />
          </>
        );
      case 'logout':
        return <Path d="M10 3H5v18h5M9 12h12m-4-4 4 4-4 4" />;
      case 'eye':
        return (
          <>
            <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
            <Circle cx={12} cy={12} r={3} />
          </>
        );
      case 'eye-off':
        return (
          <Path d="m3 3 18 18M10 5h2c6.5 0 10 7 10 7a20 20 0 0 1-3 4M6 6a19 19 0 0 0-4 6s3.5 7 10 7a12 12 0 0 0 5-1M9.5 9.5a3.5 3.5 0 0 0 5 5" />
        );
      case 'lock':
        return (
          <>
            <Rect x={5} y={10} width={14} height={11} rx={2} />
            <Path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
          </>
        );
      case 'filter':
        return (
          <>
            <Line x1={4} y1={6} x2={20} y2={6} />
            <Line x1={4} y1={12} x2={20} y2={12} />
            <Line x1={4} y1={18} x2={20} y2={18} />
            <Circle cx={8} cy={6} r={2} fill="white" />
            <Circle cx={16} cy={12} r={2} fill="white" />
            <Circle cx={10} cy={18} r={2} fill="white" />
          </>
        );
      case 'close':
        return <Path d="m6 6 12 12M18 6 6 18" />;
      case 'save':
        return <Path d="M5 3h12l4 4v14H3V3h2ZM7 3v6h10V3M7 21v-7h10v7" />;
      case 'calendar':
        return (
          <>
            <Rect x={3} y={5} width={18} height={16} rx={2} />
            <Path d="M7 3v4m10-4v4M3 11h18M7 15h2m4 0h2M7 18h2" />
          </>
        );
      case 'shield':
        return (
          <>
            <Path d="M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-4Z" />
            <Path d="m8 12 3 3 5-6" />
          </>
        );
      case 'edit':
        return <Path d="m16 3 5 5M3 21l5-1L21 7l-5-5L3 15v6Z" />;
      case 'alert':
        return (
          <>
            <Path d="m12 3 10 18H2L12 3Z" />
            <Path d="M12 9v5m0 3h.01" />
          </>
        );
      case 'layers':
        return <Path d="m12 3 10 6-10 6L2 9l10-6ZM2 13l10 6 10-6M2 17l10 6 10-6" />;
      case 'send':
        return <Path d="m22 2-7 20-4-9L2 9l20-7ZM11 13 22 2" />;
      case 'trash':
        return <Path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />;
      case 'menu':
        return <Path d="M4 6h16M4 12h16M4 18h16" />;
      case 'tool':
        return <Path d="M14 4a6 6 0 0 0-7 7l-5 5 4 4 5-5a6 6 0 0 0 7-7l-4 4-3-3 3-5Z" />;
    }
  })();
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? t.colors.muted}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {content}
    </Svg>
  );
}
