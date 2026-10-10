'use client';

/**
 * Animated Hot Deals banner — faithful recreation of the reference PNG.
 * Flames are SVG paths (teardrop/ribbon shapes) animated to flicker like real fire.
 * Flames rendered STRICTLY behind the text. Transparent background.
 */

/* ── Realistic flame shape generator ── */
function Flame({
  x, baseY, height, width, color, innerColor, delay, duration, lean = 0
}: {
  x: number; baseY: number; height: number; width: number;
  color: string; innerColor: string; delay: string; duration: string; lean?: number;
}) {
  const hw = width / 2;
  const tipY = baseY - height;
  const leanOffset = lean;

  const outerPath = `
    M ${x - hw} ${baseY}
    C ${x - hw * 1.2 + leanOffset * 3} ${baseY - height * 0.3}
      ${x - hw * 0.5 + leanOffset * 5} ${baseY - height * 0.6}
      ${x + leanOffset * 3} ${tipY}
    C ${x + hw * 0.5 + leanOffset * 5} ${baseY - height * 0.6}
      ${x + hw * 1.2 + leanOffset * 3} ${baseY - height * 0.3}
      ${x + hw} ${baseY}
    Z`;

  const innerPath = `
    M ${x - hw * 0.35} ${baseY - 5}
    C ${x - hw * 0.4 + leanOffset * 2} ${baseY - height * 0.35}
      ${x - hw * 0.15 + leanOffset * 3} ${baseY - height * 0.65}
      ${x + leanOffset * 2} ${tipY + height * 0.15}
    C ${x + hw * 0.15 + leanOffset * 3} ${baseY - height * 0.65}
      ${x + hw * 0.4 + leanOffset * 2} ${baseY - height * 0.35}
      ${x + hw * 0.35} ${baseY - 5}
    Z`;

  return (
    <g key={`${x}-${delay}`}>
      {/* Outer glow */}
      <path d={outerPath} fill={color} opacity="0.5" filter="url(#glow)" />
      {/* Main body */}
      <path
        d={outerPath}
        fill={color}
        style={{
          animation: `flicker ${duration} ease-in-out ${delay}s infinite alternate`,
          transformOrigin: `${x}px ${baseY}px`,
        }}
      />
      {/* Inner bright core */}
      <path
        d={innerPath}
        fill={innerColor}
        opacity="0.7"
        style={{
          animation: `flickerInner ${duration.replace(/\d+\.?\d*/, (m) => {
            const v = parseFloat(m) * 0.85;
            return String(v);
          })} ease-in-out ${delay}s infinite alternate-reverse`,
          transformOrigin: `${x}px ${baseY}px`,
        }}
      />
    </g>
  );
}

export default function HotDealsBanner() {
  return (
    <div className="relative w-full max-w-[340px] sm:max-w-[460px] lg:max-w-[560px] mx-auto select-none">
      <svg
        viewBox="0 0 560 340"
        className="h-auto w-full"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          {/* Text gradient: bright gold → orange → deep red (matches PNG) */}
          <linearGradient id="textGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFE97A" />
            <stop offset="20%" stopColor="#FFD54F" />
            <stop offset="45%" stopColor="#FFB300" />
            <stop offset="70%" stopColor="#FF8C00" />
            <stop offset="90%" stopColor="#E05500" />
            <stop offset="100%" stopColor="#8B2500" />
          </linearGradient>

          {/* Dark red shadow/outline */}
          <filter id="textShadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#2D0000" floodOpacity="0.6" />
            <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#CC3300" floodOpacity="0.4" />
          </filter>

          {/* Glow for flames */}
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" />
          </filter>

          {/* Inner glow for flames */}
          <filter id="innerGlow">
            <feGaussianBlur stdDeviation="3" />
          </filter>

          {/* Clip for text highlight */}
          <clipPath id="textClip">
            <text x="280" y="185" textAnchor="middle" fontSize="105" fontWeight="900"
              fontFamily="'Plus Jakarta Sans','Inter',system-ui,sans-serif" letterSpacing="4">
              HOT DEALS
            </text>
          </clipPath>
        </defs>

        {/* ═══════════════════════════════════════════
            FLAME LAYERS — ALL BEHIND TEXT
            ═══════════════════════════════════════════ */}

        {/* Far background glow blobs */}
        <g opacity="0.45" filter="url(#glow)">
          <ellipse cx="180" cy="250" rx="90" ry="55" fill="#FF4500" />
          <ellipse cx="380" cy="250" rx="90" ry="55" fill="#FF5500" />
        </g>

        {/* ── BOTTOM FLAMES (tall, behind text body) ── */}
        <g>
          <Flame x={120} baseY={275} height={140} width={45} color="#FF4500" innerColor="#FFB347" delay="0s" duration="2.8s" lean={3} />
          <Flame x={200} baseY={280} height={155} width={50} color="#FF5500" innerColor="#FFC047" delay="0.4s" duration="3.2s" lean={-2} />
          <Flame x={290} baseY={278} height={160} width={52} color="#FF4500" innerColor="#FFB347" delay="0.9s" duration="2.6s" lean={4} />
          <Flame x={380} baseY={276} height={150} width={48} color="#FF5500" innerColor="#FFC047" delay="0.2s" duration="3s" lean={-3} />
          <Flame x={455} baseY={272} height={135} width={44} color="#FF4500" innerColor="#FFB347" delay="0.7s" duration="3.1s" lean={2} />

          {/* Wider base flames */}
          <Flame x={160} baseY={282} height={100} width={65} color="#CC3300" innerColor="#FF8C00" delay="0.5s" duration="3.4s" lean={1} />
          <Flame x={350} baseY={284} height={105} width={62} color="#CC3300" innerColor="#FF8C00" delay="1.1s" duration="3.3s" lean={-1} />
        </g>

        {/* ── LEFT SIDE FLAMES ── */}
        <g>
          <Flame x={55} baseY={265} height={115} width={38} color="#FF6B00" innerColor="#FFD54F" delay="0.3s" duration="2.9s" lean={-5} />
          <Flame x={25} baseY={255} height={80} width={30} color="#FF8C00" innerColor="#FFE97A" delay="0.8s" duration="3.1s" lean={-8} />
          <Flame x={80} baseY={270} height={90} width={35} color="#FF4500" innerColor="#FFB347" delay="1.2s" duration="2.7s" lean={-3} />

          {/* Far left */}
          <Flame x={10} baseY={240} height={70} width={28} color="#FF6B00" innerColor="#FFD54F" delay="0.6s" duration="3s" lean={-10} />
        </g>

        {/* ── RIGHT SIDE FLAMES ── */}
        <g>
          <Flame x={505} baseY={265} height={115} width={38} color="#FF6B00" innerColor="#FFD54F" delay="0.6s" duration="2.9s" lean={5} />
          <Flame x={535} baseY={255} height={80} width={30} color="#FF8C00" innerColor="#FFE97A" delay="1s" duration="3.1s" lean={8} />
          <Flame x={480} baseY={270} height={90} width={35} color="#FF4500" innerColor="#FFB347" delay="0.2s" duration="2.7s" lean={3} />

          {/* Far right */}
          <Flame x={550} baseY={240} height={70} width={28} color="#FF6B00" innerColor="#FFD54F" delay="0.9s" duration="3s" lean={10} />
        </g>

        {/* ── TOP FLAMES (peeking above text behind "HOT") ── */}
        <g>
          <Flame x={130} baseY={200} height={75} width={30} color="#FF8C00" innerColor="#FFE97A" delay="0.1s" duration="2.5s" lean={-4} />
          <Flame x={180} baseY={195} height={60} width={26} color="#FFA500" innerColor="#FFE97A" delay="0.7s" duration="2.7s" lean={-2} />
          <Flame x={380} baseY={198} height={72} width={28} color="#FF8C00" innerColor="#FFE97A" delay="1.3s" duration="2.6s" lean={4} />
          <Flame x={430} baseY={192} height={58} width={25} color="#FFA500" innerColor="#FFE97A" delay="0.4s" duration="2.8s" lean={6} />
        </g>

        {/* ── SMALL ACCENT FLAMES (detail layer) ── */}
        <g opacity="0.8">
          <Flame x={75} baseY={230} height={55} width={22} color="#FFD54F" innerColor="#FFF9C4" delay="0.15s" duration="2.2s" lean={-6} />
          <Flame x={105} baseY={215} height={45} width={20} color="#FFE97A" innerColor="#FFF9C4" delay="0.55s" duration="2.4s" lean={-3} />
          <Flame x={455} baseY={228} height={55} width={22} color="#FFD54F" innerColor="#FFF9C4" delay="0.75s" duration="2.2s" lean={6} />
          <Flame x={485} baseY={218} height={48} width={20} color="#FFE97A" innerColor="#FFF9C4" delay="1.1s" duration="2.4s" lean={3} />
          {/* Between HOT and DEALS */}
          <Flame x={280} baseY={250} height={65} width={26} color="#FF8C00" innerColor="#FFD54F" delay="0.5s" duration="2.6s" lean={0} />
          <Flame x={260} baseY={240} height={50} width={22} color="#FFA500" innerColor="#FFE97A" delay="0.95s" duration="2.3s" lean={-2} />
          <Flame x={305} baseY={238} height={52} width={22} color="#FFA500" innerColor="#FFE97A" delay="0.35s" duration="2.5s" lean={2} />
        </g>

        {/* ═══════════════════════════════════════════
            TEXT — ON TOP OF ALL FLAMES
            ═══════════════════════════════════════════ */}

        {/* Dark outline for depth */}
        <text x="280" y="185" textAnchor="middle" fontSize="105" fontWeight="900"
          fontFamily="'Plus Jakarta Sans','Inter',system-ui,sans-serif" letterSpacing="4"
          fill="#3D0C00" stroke="#3D0C00" strokeWidth="2" strokeLinejoin="round">
          HOT DEALS
        </text>

        {/* Main gradient text with shadow */}
        <text x="280" y="185" textAnchor="middle" fontSize="105" fontWeight="900"
          fontFamily="'Plus Jakarta Sans','Inter',system-ui,sans-serif" letterSpacing="4"
          fill="url(#textGrad)" filter="url(#textShadow)" paintOrder="stroke">
          HOT DEALS
        </text>

        {/* Gloss highlight across the text */}
        <rect x="0" y="130" width="560" height="30" fill="rgba(255,255,255,0.12)" clipPath="url(#textClip)" />
      </svg>

      <style jsx>{`
        @keyframes flicker {
          0%   { transform: translateY(0) scaleX(1) scaleY(1); opacity: 0.8; }
          25%  { transform: translateY(calc(sin(0) * -6px)) scaleX(1.06) scaleY(0.94); opacity: 0.9; }
          50%  { transform: translateY(calc(sin(1.57) * -9px)) scaleX(0.96) scaleY(1.05); opacity: 0.78; }
          75%  { transform: translateY(calc(sin(3.14) * -4px)) scaleX(1.04) scaleY(0.96); opacity: 0.88; }
          100% { transform: translateY(calc(sin(4.71) * -7px)) scaleX(1.02) scaleY(1.03); opacity: 0.82; }
        }
        @keyframes flickerInner {
          0%   { transform: translateY(2px) scaleX(1) scaleY(1); opacity: 0.65; }
          25%  { transform: translateY(calc(sin(0.8) * -5px)) scaleX(1.08) scaleY(0.92); opacity: 0.75; }
          50%  { transform: translateY(calc(sin(2.5) * -8px)) scaleX(0.94) scaleY(1.06); opacity: 0.6; }
          75%  { transform: translateY(calc(sin(3.8) * -3px)) scaleX(1.05) scaleY(0.95); opacity: 0.72; }
          100% { transform: translateY(calc(sin(5.1) * -6px)) scaleX(0.98) scaleY(1.04); opacity: 0.68; }
        }
      `}</style>
    </div>
  );
}
