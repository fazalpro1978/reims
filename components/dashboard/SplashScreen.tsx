'use client';

import { useEffect, useRef, useState } from 'react';

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const onDoneRef            = useRef(onDone);
  const [show,   setShow  ]  = useState(false);
  const [fading, setFading]  = useState(false);

  useEffect(() => { onDoneRef.current = onDone; });

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
        background:     '#000',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            28,
        opacity:        show && !fading ? 1 : 0,
        transition:     'opacity 0.9s ease',
        pointerEvents:  'none',
        userSelect:     'none',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/propertyscape_banner_final.png"
        alt="PropertyScape"
        style={{
          width:          'min(92vw, 1100px)',
          height:         'auto',
          objectFit:      'contain',
          display:        'block',
          imageRendering: 'auto',
        }}
      />

      <p className="neon-label">Built on Intelligence. Built for Real Estate.</p>

      <style>{`
        .neon-label {
          margin: 0;
          font-size: 20px;
          font-weight: 300;
          letter-spacing: .06em;
          font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
          color: #00D0B8;
          text-shadow:
            0 0 4px  #00D0B8,
            0 0 10px #00D0B8,
            0 0 22px #00D0B8,
            0 0 45px rgba(0,208,184,0.7),
            0 0 90px rgba(0,208,184,0.35);
          animation: neonPulse 2.8s ease-in-out infinite;
        }
        @keyframes neonPulse {
          0%, 100% {
            text-shadow:
              0 0 4px  #00D0B8,
              0 0 10px #00D0B8,
              0 0 22px #00D0B8,
              0 0 45px rgba(0,208,184,0.7),
              0 0 90px rgba(0,208,184,0.35);
            opacity: 1;
          }
          45% {
            text-shadow:
              0 0 2px  #00D0B8,
              0 0 6px  #00D0B8,
              0 0 14px #00D0B8,
              0 0 30px rgba(0,208,184,0.5),
              0 0 60px rgba(0,208,184,0.2);
            opacity: 0.85;
          }
          50% {
            text-shadow:
              0 0 6px  #00D0B8,
              0 0 14px #00D0B8,
              0 0 28px #00D0B8,
              0 0 55px rgba(0,208,184,0.8),
              0 0 110px rgba(0,208,184,0.4),
              0 0 160px rgba(0,208,184,0.15);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
