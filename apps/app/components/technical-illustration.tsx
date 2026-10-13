import Svg, {
  Circle,
  Defs,
  G,
  Line,
  Path,
  Pattern,
  Rect,
  LinearGradient,
  Stop,
  Ellipse,
} from 'react-native-svg';
export function TechnicalIllustration({ height = 240 }: { height?: number }) {
  return (
    <Svg width="100%" height={height} viewBox="0 0 620 310" fill="none" aria-hidden>
      <Defs>
        <Pattern
          id="technicalGrid"
          x={0}
          y={0}
          width={46}
          height={26.5}
          patternUnits="userSpaceOnUse"
        >
          <Path d="M0 0 46 26.5M46 0 0 26.5M23 0v26.5" stroke="#446987" strokeWidth={0.6} />
        </Pattern>
        <LinearGradient id="technicalFade" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#112A47" stopOpacity={0.1} />
          <Stop offset="1" stopColor="#1A3E60" stopOpacity={0.5} />
        </LinearGradient>
      </Defs>
      <Rect width={620} height={310} fill="url(#technicalGrid)" opacity={0.27} />
      <G stroke="#87B3D6" strokeWidth={2} fill="none" strokeLinejoin="round">
        <Path d="m48 224 122-71 109 63 171-99 110 64" stroke="#B3D3EB" strokeWidth={6} />
        <Path d="m48 230 122-71 109 63 171-99 110 64" stroke="#213E58" strokeWidth={2} />
        <Path d="M170 153V93l63-36M450 117V52l49-28M279 216v52l57 33" />
        <Path
          d="m134 173 1-21 20 12m-20-12 19 0-1 24M400 148l1-20 20 12m-20-12h19v23"
          fill="#17354E"
        />
        <Path
          d="m233 57 52 30v-42l-52-30-52 30v42l52-30Zm0-42v42m-52-12 52 30 52-30"
          fill="#1C405E"
        />
        <Path d="m499 24 32 18v26l-32-18-32 18V42l32-18Z" />
        <Path d="m208 189 13-8 13 8-13 8-13-8ZM221 181v-20m-7 0h14" fill="#17354E" />
        <Path d="m328 187 11-7 13 8-12 8-12-9ZM340 188v-27" />
        <Circle cx={340} cy={151} r={10} fill="#17354E" />
        <Path d="M334 151h12m-6-6v12" />
      </G>
      {[
        { x: 83, y: 204 },
        { x: 170, y: 153 },
        { x: 279, y: 216 },
        { x: 368, y: 165 },
        { x: 450, y: 117 },
        { x: 526, y: 161 },
      ].map((p, i) => (
        <G key={i}>
          <Circle cx={p.x} cy={p.y} r={10} fill="#2A6796" opacity={0.2} />
          <Circle cx={p.x} cy={p.y} r={4} fill="#A3D5FB" />
          <Circle cx={p.x} cy={p.y} r={8} fill="none" stroke="#5D9FCD" strokeWidth={0.7} />
        </G>
      ))}
      <G stroke="#537B9B" strokeWidth={0.8} strokeDasharray="4 5">
        <Path d="m59 262 111-64 109 63M298 242l163-94M53 136l102-59" />
      </G>
      <G stroke="#7BB8E4" strokeWidth={1}>
        <Line x1={42} y1={52} x2={70} y2={52} />
        <Line x1={56} y1={38} x2={56} y2={66} />
        <Ellipse cx={544} cy={258} rx={33} ry={19} fill="none" />
        <Path d="m511 258 33-19 33 19-33 19-33-19Zm33-19v38" />
      </G>
    </Svg>
  );
}
