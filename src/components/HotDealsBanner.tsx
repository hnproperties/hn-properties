'use client';

/**
 * Hot Deals banner — SVG flames behind bold text.
 *
 * All flame layers use z-index: 0; text and effects use z-index: 1+,
 * so the flames can never overlap the letters.
 */

const FLAME_COLORS = [
  '#FF4500', // orange-red (outer)
  '#FF6B00', // orange
  '#FF8C00', // dark orange
  '#FFA500', // orange
  '#FFD700', // gold (inner core)
];

function FlameBlob({ cx, cy, rx, ry, rotation, color, opacity }: {
  cx: number; cy: number; rx: number; ry: number;
  rotation: number; color: string; opacity: number;
}) {
  return (
    <ellipse
      cx={cx} cy={cy} rx={rx} ry={ry}
      fill={color}
      opacity={opacity}
      transform={`rotate(${rotation} ${cx} ${cy})`}
    />
  );
}

function FlameGroup({ offsetX, flip, baseY }: {
  offsetX: number; flip: boolean; baseY: number;
}) {
  const dir = flip ? -1 : 1;
  const tx = `translate(${offsetX}, ${baseY}) ${flip ? 'scale(-1,1)' : ''}`;

  return (
    <g transform={tx}>
      {/* Outer glow */}
      <FlameBlob cx={0} cy={20 * dir} rx={30} ry={45} rotation={-10 * dir} color="#FF4500" opacity={0.5} />
      {/* Mid flame body */}
      <FlameBlob cx={5} cy={15 * dir} rx={22} ry={38} rotation={-5 * dir} color="#FF6B00" opacity={0.7} />
      {/* Inner flame */}
      <FlameBlob cx={-3} cy={10 * dir} rx={14} ry={28} rotation={3 * dir} color="#FF8C00" opacity={0.85} />
      {/* Core */}
      <FlameBlob cx={2} cy={5 * dir} rx={8} ry={16} rotation={-8 * dir} color="#FFD700" opacity={0.9} />
    </g>
  );
}

export default function HotDealsBanner() {
  return (
    <div className="relative w-full max-w-[300px] sm:max-w-[420px] lg:max-w-[520px] mx-auto">
      <svg
        viewBox="0 0 520 260"
        className="h-auto w-full drop-shadow-2xl"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          {/* Text shadow for depth */}
          <filter id="textShadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.3" />
            <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#FF4500" floodOpacity="0.6" />
          </filter>
          {/* Flame glow */}
          <filter id="flameGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
          </filter>
          {/* Gradient for the text fill */}
          <linearGradient id="textFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFE066" />
            <stop offset="40%" stopColor="#FFB347" />
            <stop offset="100%" stopColor="#FF6B00" />
          </linearGradient>
        </defs>

        {/* ── BACKGROUND FLAMES (z-0) ── */}
        <g className="flames" style={{ zIndex: 0 }}>
          {/* Bottom row — larger, behind text */}
          <FlameGroup offsetX={40} flip={false} baseY={180} />
          <FlameGroup offsetX={120} flip={true} baseY={175} />
          <FlameGroup offsetX={210} flip={false} baseY={185} />
          <FlameGroup offsetX={300} flip={true} baseY={178} />
          <FlameGroup offsetX={380} flip={false} baseY={182} />
          <FlameGroup offsetX={460} flip={true} baseY={180} />

          {/* Side flames — left */}
          <FlameGroup offsetX={15} flip={false} baseY={190} />
          <FlameGroup offsetX={-5} flip={true} baseY={200} />

          {/* Side flames — right */}
          <FlameGroup offsetX={505} flip={true} baseY={190} />
          <FlameGroup offsetX={525} flip={false} baseY={195} />

          {/* Top accent flames — behind "HOT" */}
          <FlameGroup offsetX={80} flip={false} baseY={130} />
          <FlameGroup offsetX={160} flip={true} baseY={125} />
          <FlameGroup offsetX={340} flip={false} baseY={128} />
          <FlameGroup offsetX={420} flip={true} baseY={132} />

          {/* Top accent flames — behind "DEALS" */}
          <FlameGroup offsetX={100} flip={true} baseY={80} />
          <FlameGroup offsetX={200} flip={false} baseY={75} />
          <FlameGroup offsetX={300} flip={true} baseY={78} />
          <FlameGroup offsetX={400} flip={false} baseY={82} />
        </g>

        {/* ── TEXT (z-1) ── */}
        <g className="text" style={{ zIndex: 1 }}>
          <text
            x="260" y="130"
            textAnchor="middle"
            fontSize="88"
            fontWeight="900"
            fontFamily="'Plus Jakarta Sans', 'Inter', system-ui, sans-serif"
            fill="url(#textFill)"
            filter="url(#textShadow)"
            letterSpacing="4"
          >
            HOT DEALS
          </text>

          {/* Highlight stripe across text */}
          <clipPath id="textClip">
            <text
              x="260" y="130"
              textAnchor="middle"
              fontSize="88"
              fontWeight="900"
              fontFamily="'Plus Jakarta Sans', 'Inter', system-ui, sans-serif"
              letterSpacing="4"
            >
              HOT DEALS
            </text>
          </clipPath>
          <rect
            x="0" y="85"
            width="520" height="22"
            fill="rgba(255,255,255,0.18)"
            clipPath="url(#textClip)"
          />
        </g>
      </svg>
    </div>
  );
}
