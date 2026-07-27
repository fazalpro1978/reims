'use client';

import { useEffect, useRef, useState } from 'react';

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const onDoneRef             = useRef(onDone);
  const [show,   setShow  ]   = useState(false);
  const [fading, setFading]   = useState(false);

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
      {/* "POWERED BY" label */}
      <p
        style={{
          margin:        '0 0 28px',
          fontSize:      11,
          fontWeight:    500,
          letterSpacing: '.28em',
          textTransform: 'uppercase',
          color:         '#4A6A96',
          fontFamily:    '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
        }}
      >
        Powered by
      </p>

      {/* Static logo — drop propertyscape-logo.png into /public */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/propertyscape-logo.png"
        alt="PropertyScape"
        style={{
          width:     'min(460px, 80vw)',
          height:    'auto',
          display:   'block',
          imageRendering: 'auto',
        }}
      />
    </div>
  );
}
