'use client';

import { useEffect, useRef, useState } from 'react';

// ── Terrain constants ─────────────────────────────────────────────────────────
const HALF    = 13;   // diamond half-size — |gi| + |gj| ≤ HALF
const SPACING = 14;   // grid spacing in logical pixels
const TILT    = 0.42; // vertical compression (isometric depth)
const YSCALE  = 30;   // height exaggeration

function dotHeight(gi: number, gj: number): number {
  const r = Math.sqrt(gi * gi + gj * gj);
  // Three concentric rings that decay at the diamond edge
  const d1 = (r - 3.8) / 2.0; const ring1 = 0.90 * Math.exp(-(d1 * d1)); // main vortex ring
  const d2 = (r - 7.0) / 1.8; const ring2 = 0.38 * Math.exp(-(d2 * d2)); // mid ripple
  const d3 = (r - 9.8) / 1.5; const ring3 = 0.20 * Math.exp(-(d3 * d3)); // outer ripple
  const edge  = Math.max(0, 1 - (r / HALF) ** 2.5);        // smooth edge falloff
  return Math.max(0, (ring1 + ring2 + ring3) * edge);
}

function dotColor(gi: number, gj: number, h: number): string {
  // Colour direction: purple-blue (gi+gj negative) → cyan-teal (gi+gj positive)
  const t  = Math.max(0, Math.min(1, (gi + gj) / (HALF * 1.4) + 0.52));
  const r  = Math.round(78  * (1 - t));                  // #4E__ → #00__
  const g  = Math.round(47  * (1 - t) + 200 * t);       // __2F → __C8
  const b  = Math.round(216 * (1 - t) + 176 * t);       // __D8 → __B0
  const br = 0.42 + h * 0.75;                            // height-based brightness
  const a  = 0.38 + h * 0.68;
  return `rgba(${Math.min(255, Math.round(r * br + 14))},${Math.min(255, Math.round(g * br + 8))},${Math.min(255, Math.round(b * br))},${Math.min(1, a)})`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const onDoneRef   = useRef(onDone);
  const [show,   setShow  ] = useState(false);
  const [fading, setFading] = useState(false);

  // Keep onDone ref current so timers don't capture stale closure
  useEffect(() => { onDoneRef.current = onDone; });

  // Fade-in → hold → fade-out → unmount
  useEffect(() => {
    const t1 = setTimeout(() => setShow(true),              80);
    const t2 = setTimeout(() => setFading(true),          2900);
    const t3 = setTimeout(() => onDoneRef.current(),      3700);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  // Canvas 3D particle animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // HiDPI support
    const dpr = window.devicePixelRatio || 1;
    const LW = 380, LH = 300;
    canvas.width  = LW * dpr;
    canvas.height = LH * dpr;
    canvas.style.width  = `${LW}px`;
    canvas.style.height = `${LH}px`;

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    const cx = LW / 2;
    const cy = LH / 2 + 6;
    let angle = -0.55; // start at the angle that matches the logo's orientation
    let raf: number;

    function frame() {
      ctx.clearRect(0, 0, LW, LH);
      angle += 0.004; // slow continuous rotation

      // Build dot list
      type Dot = { sx: number; sy: number; depth: number; radius: number; color: string };
      const dots: Dot[] = [];

      for (let gi = -HALF; gi <= HALF; gi++) {
        for (let gj = -HALF; gj <= HALF; gj++) {
          if (Math.abs(gi) + Math.abs(gj) > HALF) continue; // diamond boundary

          const x3 = gi * SPACING;
          const z3 = gj * SPACING;
          const h  = dotHeight(gi, gj);
          const y3 = h * YSCALE;

          // Rotate around Y axis
          const xr = x3 * Math.cos(angle) + z3 * Math.sin(angle);
          const zr = -x3 * Math.sin(angle) + z3 * Math.cos(angle);

          dots.push({
            sx:     cx + xr,
            sy:     cy + zr * TILT - y3,
            depth:  zr,
            radius: 1.1 + h * 2.0,
            color:  dotColor(gi, gj, h),
          });
        }
      }

      // Painter's algorithm — draw far dots first
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
        position:   'fixed',
        inset:      0,
        zIndex:     9999,
        background: '#070D1A',
        display:    'flex',
        flexDirection: 'column',
        alignItems:    'center',
        justifyContent:'center',
        opacity:    show && !fading ? 1 : 0,
        transition: 'opacity 0.75s ease',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      {/* "Powered by" label */}
      <p
        style={{
          margin: '0 0 6px',
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: '.32em',
          textTransform: 'uppercase',
          color: '#354A68',
          fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
        }}
      >
        Powered by
      </p>

      {/* 3D particle canvas */}
      <canvas ref={canvasRef} style={{ display: 'block' }} />

      {/* Wordmark */}
      <p
        style={{
          margin: '-16px 0 0',
          fontSize: 23,
          fontWeight: 300,
          letterSpacing: '.07em',
          color: '#B0C8E8',
          fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
        }}
      >
        propertyscape
        <span style={{ color: '#00C4B0', fontWeight: 300 }}>.io</span>
      </p>
    </div>
  );
}
