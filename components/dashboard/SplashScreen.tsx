'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const onDoneRef              = useRef(onDone);
  const [show,    setShow  ]   = useState(false);
  const [fading,  setFading]   = useState(false);
  const [logoSize, setLogoSize] = useState({ w: 0, h: 0 });

  useEffect(() => { onDoneRef.current = onDone; });

  // Measure viewport and size the logo to fill it like the dashboard does
  const measure = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Match the dashboard's max-width (1400px) with comfortable vertical headroom
    const w = Math.min(vw * 0.82, 1400 * 0.6);
    const h = Math.min(vh * 0.68, w);          // square-ish — logo is 1:1
    setLogoSize({ w: Math.round(w), h: Math.round(h) });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  useEffect(() => {
    const t1 = setTimeout(() => setShow(true),         80);
    const t2 = setTimeout(() => setFading(true),     2800);
    const t3 = setTimeout(() => onDoneRef.current(), 3700);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
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
      {/* Neon tagline */}
      <p className="neon-label">
        Built on Intelligence. Built for Real Estate.
      </p>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/propertyscape-logo.png"
        alt="PropertyScape"
        style={{
          width:          logoSize.w || 'min(560px, 82vw)',
          height:         logoSize.h || 'auto',
          objectFit:      'contain',
          display:        'block',
          imageRendering: 'auto',
        }}
      />

      <style>{`
        .neon-label {
          margin: 0 0 28px;
          font-size: 13px;
          font-weight: 300;
          letter-spacing: .06em;
          font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
          color: #00D0B8;
          text-shadow:
            0 0 4px  #00D0B8,
            0 0 10px #00D0B8,
            0 0 22px #00D0B8,
            0 0 45px rgba(0, 208, 184, 0.7),
            0 0 90px rgba(0, 208, 184, 0.35);
          animation: neonPulse 2.8s ease-in-out infinite;
        }

        @keyframes neonPulse {
          0%, 100% {
            text-shadow:
              0 0 4px  #00D0B8,
              0 0 10px #00D0B8,
              0 0 22px #00D0B8,
              0 0 45px rgba(0, 208, 184, 0.7),
              0 0 90px rgba(0, 208, 184, 0.35);
            opacity: 1;
          }
          45% {
            text-shadow:
              0 0 2px  #00D0B8,
              0 0 6px  #00D0B8,
              0 0 14px #00D0B8,
              0 0 30px rgba(0, 208, 184, 0.5),
              0 0 60px rgba(0, 208, 184, 0.2);
            opacity: 0.85;
          }
          50% {
            text-shadow:
              0 0 6px  #00D0B8,
              0 0 14px #00D0B8,
              0 0 28px #00D0B8,
              0 0 55px rgba(0, 208, 184, 0.8),
              0 0 110px rgba(0, 208, 184, 0.4),
              0 0 160px rgba(0, 208, 184, 0.15);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
