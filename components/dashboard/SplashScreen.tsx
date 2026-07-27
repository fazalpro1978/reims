'use client';

import { useEffect, useRef, useState } from 'react';

// ── Maths helpers ─────────────────────────────────────────────────────────────

function dotHeight(gi: number, gj: number, HALF: number): number {
  // Ring center is offset OUTSIDE the grid (lower-left), radius chosen so
  // only the upper-right arc is visible → creates the "P" bowl shape.
  const CX = -5, CZ = -5, R = 13;
  const dx = gi - CX, dz = gj - CZ;
  const dist = Math.sqrt(dx * dx + dz * dz);

  const d1 = (dist - R)       / 2.4; const h1 = 0.95 * Math.exp(-(d1 * d1)); // main ridge
  const d2 = (dist - R * 0.6) / 1.9; const h2 = 0.32 * Math.exp(-(d2 * d2)); // inner ring

  // Smooth diamond boundary
  const edge = Math.max(0, 1 - (Math.sqrt(gi * gi + gj * gj) / (HALF * 0.98)) ** 2.2);
  return Math.max(0, (h1 + h2) * edge);
}

function dotColor(gi: number, gj: number, h: number, HALF: number): string {
  // Purple-indigo (#5030E8) → teal (#00D0B8) across the field
  const t  = Math.max(0, Math.min(1, (gi + gj) / (HALF * 1.35) + 0.52));
  const rr = Math.round(80  * (1 - t));
  const gg = Math.round(48  * (1 - t) + 208 * t);
  const bb = Math.round(232 * (1 - t) + 184 * t);
  const br = 0.38 + h * 0.82;
  const a  = 0.32 + h * 0.74;
  return `rgba(${Math.min(255, Math.round(rr * br + 12))},${Math.min(255, Math.round(gg * br + 7))},${Math.min(255, Math.round(bb * br))},${Math.min(1, a)})`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onDoneRef = useRef(onDone);
  const [show,   setShow  ] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => { onDoneRef.current = onDone; });

  useEffect(() => {
    const t1 = setTimeout(() => setShow(true),             80);
    const t2 = setTimeout(() => setFading(true),         3200);
    const t3 = setTimeout(() => onDoneRef.current(),     4100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Fill most of the viewport
    const dpr = window.devicePixelRatio || 1;
    const LW  = Math.min(window.innerWidth  * 0.92, 860);
    const LH  = Math.min(window.innerHeight * 0.60, 480);

    canvas.width  = Math.round(LW * dpr);
    canvas.height = Math.round(LH * dpr);
    canvas.style.width  = `${LW}px`;
    canvas.style.height = `${LH}px`;

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    // Grid scale with canvas width so the mesh always fills the frame
    const HALF    = 15;
    const SPACING = LW / 50;   // scales proportionally
    const TILT    = 0.21;       // very low angle — cinematic/horizontal look
    const YSCALE  = LH * 0.14; // height in pixels

    const cx = LW / 2;
    const cy = LH / 2 + LH * 0.05;

    // Start angle: bowl faces upper-right (matches logo orientation)
    let angle = -0.90;
    let raf: number;

    function frame() {
      ctx.clearRect(0, 0, LW, LH);
      angle += 0.003;

      type Dot = { sx: number; sy: number; depth: number; radius: number; color: string };
      const dots: Dot[] = [];

      for (let gi = -HALF; gi <= HALF; gi++) {
        for (let gj = -HALF; gj <= HALF; gj++) {
          if (Math.abs(gi) + Math.abs(gj) > HALF) continue; // diamond boundary

          const h  = dotHeight(gi, gj, HALF);
          if (h < 0.02) continue; // skip invisible dots — big perf win

          const x3 = gi * SPACING;
          const z3 = gj * SPACING;
          const y3 = h * YSCALE;

          const xr = x3 * Math.cos(angle) + z3 * Math.sin(angle);
          const zr = -x3 * Math.sin(angle) + z3 * Math.cos(angle);

          dots.push({
            sx:     cx + xr,
            sy:     cy + zr * TILT - y3,
            depth:  zr,
            radius: 1.4 + h * 3.2, // much bigger max dot size
            color:  dotColor(gi, gj, h, HALF),
          });
        }
      }

      // Far → near (painter's algorithm)
      dots.sort((a, b) => b.depth - a.depth);

      for (const d of dots) {
        ctx.beginPath();
        ctx.arc(d.sx, d.sy, d.radius, 0, Math.PI * 2);
        ctx.fillStyle = d.color;
        ctx.fill();
      }

      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      aria-hidden="true"
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         9999,
        background:     '#060C18',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            0,
        opacity:        show && !fading ? 1 : 0,
        transition:     'opacity 0.8s ease',
        pointerEvents:  'none',
        userSelect:     'none',
      }}
    >
      {/* "POWERED BY" — clearly legible above the logo */}
      <p
        style={{
          margin:         '0 0 10px',
          fontSize:       11,
          fontWeight:     500,
          letterSpacing:  '.28em',
          textTransform:  'uppercase',
          color:          '#4A6A96',   // clearly visible on dark navy
          fontFamily:     '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
        }}
      >
        Powered by
      </p>

      {/* 3D particle canvas — fills most of viewport */}
      <canvas ref={canvasRef} style={{ display: 'block' }} />

      {/* Wordmark — below canvas, overlapping slightly */}
      <p
        style={{
          margin:       '-18px 0 0',
          fontSize:     28,
          fontWeight:   300,
          letterSpacing:'.07em',
          color:        '#C0D8F4',
          fontFamily:   '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
          whiteSpace:   'nowrap',
        }}
      >
        propertyscape
        <span style={{ color: '#00D0B8', fontWeight: 300 }}>.io</span>
      </p>
    </div>
  );
}
