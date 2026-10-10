'use client';

/**
 * Animated Hot Deals banner — faithful recreation of the reference PNG.
 * Static 3D text on top, animated flames strictly behind.
 * Transparent background.
 */

/* ── Flame with glossy 3D look ── */
function Flame({
  x, baseY, height, width, color, innerColor, delay, duration, lean = 0
}: {
  x: number; baseY: number; height: number; width: number;
  color: string; innerColor: string; delay: string; duration: string; lean?: number;
}) {
  const hw = width / 2;
  const tipY = baseY - height;
  const l = lean;

  return (
    <g style={{ animation: `flicker ${duration} ease-in-out ${delay}s infinite alternate`, transformOrigin: `${x}px ${baseY}px` }}>
      {/* Glow behind flame */}
      <path
        d={`M ${x - hw * 1.15} ${baseY}
          C ${x - hw * 1.4 + l * 4} ${baseY - height * 0.25}
            ${x - hw * 0.6 + l * 6} ${baseY - height * 0.55}
            ${x + l * 3} ${tipY}
          C ${x + hw * 0.6 + l * 6} ${baseY - height * 0.55}
            ${x + hw * 1.4 + l * 4} ${baseY - height * 0.25}
            ${x + hw * 1.15} ${baseY}
          Z`}
        fill={color} opacity="0.35" filter="url(#glow)"
      />
      {/* Main body */}
      <path
        d={`M ${x - hw} ${baseY}
          C ${x - hw * 1.15 + l * 3} ${baseY - height * 0.28}
            ${x - hw * 0.55 + l * 5} ${baseY - height * 0.58}
            ${x + l * 3} ${tipY}
          C ${x + hw * 0.55 + l * 5} ${baseY - height * 0.58}
            ${x + hw * 1.15 + l * 3} ${baseY - height * 0.28}
            ${x + hw} ${baseY}
          Z`}
        fill={color}
      />
      {/* Mid tone */}
      <path
        d={`M ${x - hw * 0.7} ${baseY - 3}
          C ${x - hw * 0.75 + l * 2} ${baseY - height * 0.3}
            ${x - hw * 0.35 + l * 3} ${baseY - height * 0.6}
            ${x + l * 2} ${tipY + height * 0.2}
          C ${x + hw * 0.35 + l * 3} ${baseY - height * 0.6}
            ${x + hw * 0.75 + l * 2} ${baseY - height * 0.3}
            ${x + hw * 0.7} ${baseY - 3}
          Z`}
        fill={innerColor} opacity="0.65"
      />
      {/* Bright core */}
      <path
        d={`M ${x - hw * 0.25} ${baseY - height * 0.15}
          C ${x - hw * 0.3 + l} ${baseY - height * 0.4}
            ${x - hw * 0.12 + l * 2} ${baseY - height * 0.7}
            ${x + l} ${tipY + height * 0.4}
          C ${x + hw * 0.12 + l * 2} ${baseY - height * 0.7}
            ${x + hw * 0.3 + l} ${baseY - height * 0.4}
            ${x + hw * 0.25} ${baseY - height * 0.15}
          Z`}
        fill="#FFF9C4" opacity="0.5"
      />
    </g>
  );
}

export default function HotDealsBanner() {
  return (
    <div className="relative w-full max-w-[360px] sm:max-w-[480px] lg:max-w-[600px] mx-auto select-none">
      <svg viewBox="0 0 600 380" className="h-auto w-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Text gradient — gold to deep red, matches PNG exactly */}
          <linearGradient id="txtGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFE97A" />
            <stop offset="15%" stopColor="#FFD54F" />
            <stop offset="30%" stopColor="#FFC107" />
            <stop offset="50%" stopColor="#FFB300" />
            <stop offset="70%" stopColor="#FF8C00" />
            <stop offset="88%" stopColor="#D84315" />
            <stop offset="100%" stopColor="#7B1A00" />
          </linearGradient>

          {/* Dark red outline/shadow */}
          <filter id="txtShadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#2D0000" floodOpacity="0.55" />
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#BF360C" floodOpacity="0.35" />
          </filter>

          {/* Glow filter for flames */}
          <filter id="glow" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="7" />
          </filter>

          {/* Text clip for highlight */}
          <clipPath id="tc">
            <text x="300" y="208" textAnchor="middle" fontSize="110" fontWeight="900"
              fontFamily="'Plus Jakarta Sans','Inter',system-ui,sans-serif" letterSpacing="5">
              HOT DEALS
            </text>
          </clipPath>
        </defs>

        {/* ═══ BACKGROUND GLOW ═══ */}
        <g opacity="0.4" filter="url(#glow)">
          <ellipse cx="200" cy="270" rx="100" ry="60" fill="#FF4500" />
          <ellipse cx="400" cy="270" rx="100" ry="60" fill="#FF5500" />
        </g>

        {/* ═══ BOTTOM FLAMES (tall, behind text body) ═══ */}
        <g>
          <Flame x={110} baseY={300} height={155} width={50} color="#FF4500" innerColor="#FFB347" delay="0s" duration="2.8s" lean={4} />
          <Flame x={195} baseY={305} height={170} width={55} color="#FF5500" innerColor="#FFC047" delay="0.4s" duration="3.2s" lean={-3} />
          <Flame x={290} baseY={308} height={175} width={58} color="#FF4500" innerColor="#FFB347" delay="0.9s" duration="2.6s" lean={5} />
          <Flame x={385} baseY={306} height={168} width={54} color="#FF5500" innerColor="#FFC047" delay="0.2s" duration="3s" lean={-4} />
          <Flame x={470} baseY={302} height={150} width={48} color="#FF4500" innerColor="#FFB347" delay="0.7s" duration="3.1s" lean={3} />

          {/* Wide base flames */}
          <Flame x={155} baseY={310} height={110} width={72} color="#CC3300" innerColor="#FF8C00" delay="0.5s" duration="3.4s" lean={1} />
          <Flame x={360} baseY={312} height={115} width={68} color="#CC3300" innerColor="#FF8C00" delay="1.1s" duration="3.3s" lean={-2} />
        </g>

        {/* ═══ SIDE FLAMES — LEFT ═══ */}
        <g>
          <Flame x={45} baseY={285} height={125} width={42} color="#FF6B00" innerColor="#FFD54F" delay="0.3s" duration="2.9s" lean={-6} />
          <Flame x={15} baseY={275} height={90} width={34} color="#FF8C00" innerColor="#FFE97A" delay="0.8s" duration="3.1s" lean={-10} />
          <Flame x={75} baseY={290} height={100} width={38} color="#FF4500" innerColor="#FFB347" delay="1.2s" duration="2.7s" lean={-3} />
        </g>

        {/* ═══ SIDE FLAMES — RIGHT ═══ */}
        <g>
          <Flame x={555} baseY={285} height={125} width={42} color="#FF6B00" innerColor="#FFD54F" delay="0.6s" duration="2.9s" lean={6} />
          <Flame x={585} baseY={275} height={90} width={34} color="#FF8C00" innerColor="#FFE97A" delay="1s" duration="3.1s" lean={10} />
          <Flame x={525} baseY={290} height={100} width={38} color="#FF4500" innerColor="#FFB347" delay="0.2s" duration="2.7s" lean={3} />
        </g>

        {/* ═══ TOP FLAMES (above text, behind "HOT") ═══ */}
        <g>
          <Flame x={130} baseY={225} height={80} width={32} color="#FF8C00" innerColor="#FFE97A" delay="0.1s" duration="2.5s" lean={-5} />
          <Flame x={185} baseY={218} height={65} width={28} color="#FFA500" innerColor="#FFE97A" delay="0.7s" duration="2.7s" lean={-2} />
          <Flame x={240} baseY={222} height={70} width={30} color="#FF8C00" innerColor="#FFD54F" delay="1.3s" duration="2.6s" lean={3} />

          <Flame x={365} baseY={220} height={75} width={30} color="#FF8C00" innerColor="#FFE97A" delay="0.4s" duration="2.6s" lean={5} />
          <Flame x={420} baseY={216} height={65} width={28} color="#FFA500" innerColor="#FFE97A" delay="1.1s" duration="2.8s" lean={8} />
          <Flame x={475} baseY={224} height={72} width={30} color="#FF8C00" innerColor="#FFD54F" delay="0.3s" duration="2.5s" lean={4} />
        </g>

        {/* ═══ DETAIL FLAMES (between text, small accents) ═══ */}
        <g opacity="0.85">
          <Flame x={65} baseY={248} height={60} width={24} color="#FFD54F" innerColor="#FFF9C4" delay="0.15s" duration="2.2s" lean={-7} />
          <Flame x={100} baseY={235} height={50} width={22} color="#FFE97A" innerColor="#FFF9C4" delay="0.55s" duration="2.4s" lean={-4} />

          <Flame x={270} baseY={260} height={70} width={28} color="#FF8C00" innerColor="#FFD54F" delay="0.5s" duration="2.6s" lean={0} />
          <Flame x={250} baseY={250} height={55} width={24} color="#FFA500" innerColor="#FFE97A" delay="0.95s" duration="2.3s" lean={-3} />
          <Flame x={310} baseY={255} height={58} width={24} color="#FFA500" innerColor="#FFE97A" delay="0.35s" duration="2.5s" lean={3} />

          <Flame x={500} baseY={248} height={60} width={24} color="#FFD54F" innerColor="#FFF9C4" delay="0.75s" duration="2.2s" lean={7} />
          <Flame x={535} baseY={238} height={50} width={22} color="#FFE97A" innerColor="#FFF9C4" delay="1.1s" duration="2.4s" lean={4} />
        </g>

        {/* ══════════════════════════════════════════════
            TEXT — ALWAYS ON TOP, STATIC, CRISP
            ══════════════════════════════════════════════ */}

        {/* Dark outline (3D depth) */}
        <text x="300" y="208" textAnchor="middle" fontSize="110" fontWeight="900"
          fontFamily="'Plus Jakarta Sans','Inter',system-ui,sans-serif" letterSpacing="5"
          fill="#5D1A00" stroke="#3D0C00" strokeWidth="5" strokeLinejoin="round">
          HOT DEALS
        </text>

        {/* Main gradient text */}
        <text x="300" y="208" textAnchor="middle" fontSize="110" fontWeight="900"
          fontFamily="'Plus Jakarta Sans','Inter',system-ui,sans-serif" letterSpacing="5"
          fill="url(#txtGrad)" filter="url(#txtShadow)" paintOrder="stroke">
          HOT DEALS
        </text>

        {/* Gloss highlight stripe across the middle of letters */}
        <rect x="0" y="152" width="600" height="32" fill="rgba(255,255,255,0.14)" clipPath="url(#tc)" />

        {/* Letter edge highlight */}
        <rect x="0" y="196" width="600" height="8" fill="rgba(255,255,255,0.08)" clipPath="url(#tc)" />
      </svg>

      <style jsx>{`
        @keyframes flicker {
          0%   { transform: translateY(0) scaleX(1) scaleY(1); opacity: 0.82; }
          25%  { transform: translateY(calc(sin(0) * -7px)) scaleX(1.06) scaleY(0.93); opacity: 0.9; }
          50%  { transform: translateY(calc(sin(1.57) * -10px)) scaleX(0.95) scaleY(1.06); opacity: 0.76; }
          75%  { transform: translateY(calc(sin(3.14) * -5px)) scaleX(1.04) scaleY(0.95); opacity: 0.88; }
          100% { transform: translateY(calc(sin(4.71) * -8px)) scaleX(1.03) scaleY(1.02); opacity: 0.84; }
        }
      `}</style>
    </div>
  );
}
