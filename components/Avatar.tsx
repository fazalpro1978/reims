'use client';

import { getPreset } from '../lib/avatarPresets';

interface AvatarProps {
  size?:     number;
  photoUrl?: string | null;
  preset?:   string | null;
  initials:  string;
  ringColor?: string;
  className?: string;
  style?:     React.CSSProperties;
}

export default function Avatar({
  size = 32,
  photoUrl,
  preset,
  initials,
  ringColor = '#888888',
  className = '',
  style,
}: AvatarProps) {
  const presetDef = getPreset(preset);
  const fontSize  = Math.round(size * 0.37);

  const base: React.CSSProperties = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', ...style,
  };

  if (photoUrl) {
    return (
      <div className={className} style={base}>
        <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
    );
  }

  if (presetDef) {
    return (
      <div className={className} style={{ ...base, background: presetDef.bg }}>
        <span style={{ fontSize, fontWeight: 700, color: presetDef.text, userSelect: 'none', lineHeight: 1 }}>
          {initials}
        </span>
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        ...base,
        background: `${ringColor}18`,
        border:     `1px solid ${ringColor}35`,
      }}
    >
      <span style={{ fontSize, fontWeight: 700, color: ringColor, userSelect: 'none', lineHeight: 1 }}>
        {initials}
      </span>
    </div>
  );
}
