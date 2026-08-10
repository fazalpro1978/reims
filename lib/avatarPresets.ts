export interface AvatarPreset {
  id:    string;
  label: string;
  bg:    string;
  text:  string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'gold',     label: 'Gold',     bg: '#c9a84c', text: '#0f0f0f' },
  { id: 'emerald',  label: 'Emerald',  bg: '#10b981', text: '#ffffff' },
  { id: 'sapphire', label: 'Sapphire', bg: '#3b82f6', text: '#ffffff' },
  { id: 'amethyst', label: 'Amethyst', bg: '#8b5cf6', text: '#ffffff' },
  { id: 'ruby',     label: 'Ruby',     bg: '#ef4444', text: '#ffffff' },
  { id: 'sunset',   label: 'Sunset',   bg: '#f97316', text: '#ffffff' },
  { id: 'ocean',    label: 'Ocean',    bg: '#06b6d4', text: '#0f0f0f' },
  { id: 'slate',    label: 'Slate',    bg: '#475569', text: '#ffffff' },
];

export function getPreset(id: string | null | undefined): AvatarPreset | null {
  if (!id) return null;
  return AVATAR_PRESETS.find(p => p.id === id) ?? null;
}
