'use client';

/**
 * Animated Hot Deals banner — matches the reference PNG:
 * Bold 3D "HOT DEALS" text with flames rising behind and around it.
 * Flames are proper teardrop shapes (SVG paths), not ellipses.
 * Transparent background. Slow-motion animation.
 */

/* ── Flame path generator ── */
function flamePath(cx: number, baseY: number, height: number, width: number, lean: number): string {
  const hw = width / 2;
  const tipY = baseY - height;
  return `M ${cx - hw} ${baseY}
          C ${cx - hw * 1.3} ${baseY - height * 0.35},
            ${cx - hw * 0.6 + lean} ${tipY + height * 0.25},
            ${cx + lean * 0.5} ${tipY}
          C ${cx + hw * 0.6 + lean} ${tipY + height * 0.25},
            ${cx + hw * 1.3} ${baseY - height * 0.35},
            ${cx + hw} ${baseY}
          Z`;
}

function flamePair(x: number, baseY: number, h: number, w: number, color: string, phase: number, delay: string, dur: string, leanDir: number) {
  return (
    <g key={`${x}-${phase}`}>
      {/* Glow */}
      <path
        d={flamePath(x, baseY, h * 1.15, w * 1.4, leanDir * 8)}
        fill={color}
        opacity="0.35"
        filter="url(#softGlow)"
        style={{ animation: `flameWave ${dur} ease-in-out ${delay}s infinite alternate`, transformOrigin: `${x}px ${baseY}px` }}
      />
      {/* Main flame */}
      <path
        d={flamePath(x, baseY, h, w, leanDir * 5)}
        fill={color}
        opacity="0.85"
        style={{ animation: `flameWave ${dur} ease-in-out ${delay}s infinite alternate`, transformOrigin: `${x}px ${baseY}px` }}
      />
      {/* Inner bright core */}
      <path
        d={flamePath(x - w * 0.08, baseY + 2, h * 0.7, w * 0.55, leanDir * 3)}
        fill="#FFE066"
        opacity="0.6"
        style={{ animation: `flameWave ${dur.replace(/[\d.]+/, (m: string) => String(parseFloat(m) * 0.85))} ease-in-out ${delay}s infinite alternate-reverse`, transformOrigin: `${x}px ${baseY}px` }}
      />
    </g>
  );
}

function sideFlame(x: number, baseY: number, h: number, w: number, color: string, phase: number, delay: string, dur: string) {
  return flamePair(x, baseY, h, w, color, phase, delay, dur, phase % 2 === 0 ? 1 : -1);
}

function sparkle(x: number, y: number, delay: string, r: number) {
  return (
    <circle key={`sp-${x}-${y}`} cx={x} cy={y} r={r} fill="#FFE066" opacity="0"
      style={{ animation: `sparkle 2.2s ease-in-out ${delay}s infinite` }} />
  );
}

export default function HotDealsBanner() {
  return (
    <div className="relative w-full max-w-[340px] sm:max-w-[460px] lg:max-w-[560px] mx-auto select-none">
      <svg viewBox="0 0 560 340" className="h-auto w-full" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          {/* Text gradient — gold-to-deep-orange like the PNG */}
          <linearGradient id="hotFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFE87C" />
            <stop offset="25%" stopColor="#FFB833" />
            <stop offset="55%" stopColor="#FF8C00" />
            <stop offset="85%" stopColor="#E05500" />
            <stop offset="100%" stopColor="#8B2500" />
          </linearGradient>
          {/* Dark shadow under text */}
          <filter id="hotShadow" x="-8%" y="-8%" width="116%" height="125%">
            <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#1a0000" floodOpacity="0.5" />
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#CC3300" floodOpacity="0.4" />
          </filter>
          <filter id="softGlow">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          {/* Highlight clip */}
          <clipPath id="textClip">
            <text x="280" y="175" textAnchor="middle" fontSize="100" fontWeight="900"
              fontFamily="'Plus Jakarta Sans','Inter',system-ui,sans-serif" letterSpacing="6">
              HOT DEALS
            </text>
          </clipPath>
        </defs>

        {/* ══════ BEHIND-TEXT FLAMES (bottom, rising up) ══════ */}
        <g>
          {/* Bottom large flames — centered behind text */}
          {flamePair(140, 268, 110, 38, '#FF4500', 0, '0s', '3.2s', 1)}
          {flamePair(240, 272, 120, 42, '#FF5500', 1, '0.5s', '3.5s', -1)}
          {flamePair(340, 270, 115, 40, '#FF4500', 2, '1s', '3s', 1)}
          {flamePair(430, 266, 108, 36, '#FF5500', 3, '1.5s', '3.3s', -1)}

          {/* Side flames — left */}
          {sideFlame(55, 258, 90, 32, '#FF6B00', 4, '0.3s', '2.8s')}
          {sideFlame(25, 248, 70, 26, '#FF8C00', 5, '0.8s', '3s')}

          {/* Side flames — right */}
          {sideFlame(505, 258, 90, 32, '#FF6B00', 6, '0.6s', '2.9s')}
          {sideFlame(535, 248, 70, 26, '#FF8C00', 7, '1.1s', '3.1s')}

          {/* Corner flames — top-left */}
          {flamePair(80, 190, 75, 28, '#FF8C00', 8, '0.2s', '2.5s', -1)}
          {flamePair(55, 165, 55, 22, '#FFA500', 9, '0.7s', '2.7s', 1)}

          {/* Corner flames — top-right */}
          {flamePair(480, 190, 75, 28, '#FF8C00', 10, '0.9s', '2.6s', 1)}
          {flamePair(505, 165, 55, 22, '#FFA500', 11, '1.4s', '2.8s', -1)}

          {/* Flames peeking between "HOT" and "DEALS" */}
          {flamePair(280, 210, 85, 30, '#FF6B00', 12, '0.4s', '3.1s', 1)}
        </g>

        {/* ══════ GLOW LAYER (very blurred, behind everything) ══════ */}
        <g opacity="0.4" filter="url(#softGlow)">
          <ellipse cx="200" cy="240" rx="80" ry="50" fill="#FF4500"
            style={{ animation: 'flameGlow 4s ease-in-out infinite alternate', transformOrigin: '200px 240px' }} />
          <ellipse cx="380" cy="240" rx="80" ry="50" fill="#FF5500"
            style={{ animation: 'flameGlow 4s ease-in-out 1s infinite alternate-reverse', transformOrigin: '380px 240px' }} />
        </g>

        {/* ══════ SPARKLES ══════ */}
        <g>
          {sparkle(45, 180, '0s', 2.5)}
          {sparkle(100, 130, '0.6s', 1.8)}
          {sparkle(175, 155, '1.2s', 2.2)}
          {sparkle(260, 110, '0.3s', 2)}
          {sparkle(320, 140, '1.5s', 2.5)}
          {sparkle(400, 120, '0.9s', 1.8)}
          {sparkle(470, 150, '1.8s', 2.2)}
          {sparkle(520, 175, '0.4s', 2)}
        </g>

        {/* ══════ TEXT (always on top, crisp) ══════ */}
        <g>
          {/* Dark outline stroke */}
          <text x="280" y="175" textAnchor="middle" fontSize="100" fontWeight="900"
            fontFamily="'Plus Jakarta Sans','Inter',system-ui,sans-serif" letterSpacing="6"
            fill="none" stroke="#3D0C00" strokeWidth="6" paintOrder="stroke">
            HOT DEALS
          </text>
          {/* Main fill */}
          <text x="280" y="175" textAnchor="middle" fontSize="100" fontWeight="900"
            fontFamily="'Plus Jakarta Sans','Inter',system-ui,sans-serif" letterSpacing="6"
            fill="url(#hotFill)" filter="url(#hotShadow)" paintOrder="stroke">
            HOT DEALS
          </text>
          {/* Gloss highlight stripe */}
          <rect x="0" y="128" width="560" height="26" fill="rgba(255,255,255,0.13)" clipPath="url(#textClip)" />
        </g>
      </svg>

      <style jsx>{`
        @keyframes flameWave {
          0% {
            transform: translateY(0) scaleX(1) scaleY(1);
            opacity: 0.75;
          }
          33% {
            transform: translateY(calc(sin(var(--phase, 0) * 6.283) * -7px)) scaleX(1.08) scaleY(0.93);
            opacity: 0.88;
          }
          66% {
            transform: translateY(calc(sin(calc(var(--phase, 0) * 6.283 + 2.094)) * -5px)) scaleX(0.94) scaleY(1.06);
            opacity: 0.78;
          }
          100% {
            transform: translateY(calc(sin(calc(var(--phase, 0) * 6.283 + 4.189)) * -8px)) scaleX(1.05) scaleY(0.9);
            opacity: 0.82;
          }
        }
        @keyframes flameGlow {
          0% { transform: scaleX(1) scaleY(1); opacity: 0.35; }
          100% { transform: scaleX(1.15) scaleY(0.9); opacity: 0.5; }
        }
        @keyframes sparkle {
          0%, 100% { opacity: 0; r: 0.5; }
          50% { opacity: 0.85; r: 1; }
        }
      `}</style>
    </div>
  );
}
