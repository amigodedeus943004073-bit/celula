import React, { useState } from 'react';
import type { CellWing } from '../types/cell';

interface MemberAvatarProps {
  name: string;
  photoDataUrl?: string;
  wing?: CellWing;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<MemberAvatarProps['size']>, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-xs',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-xl',
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'CV';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function MemberAvatar({
  name,
  photoDataUrl,
  wing,
  size = 'md',
  className = '',
}: MemberAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const sizeCls = SIZE_CLASSES[size];
  const hasPhoto = Boolean(photoDataUrl && photoDataUrl.trim()) && !imgError;

  const fallbackBg =
    wing === 'Feminina'
      ? 'bg-teal-700 text-white'
      : 'bg-slate-800 text-white';

  if (hasPhoto) {
    return (
      <img
        src={photoDataUrl}
        alt={`Foto de ${name}`}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className={`${sizeCls} rounded-full object-cover border border-slate-200 shrink-0 bg-slate-100 ${className}`}
      />
    );
  }

  return (
    <div
      aria-label={name}
      className={`${sizeCls} ${fallbackBg} rounded-full font-display font-bold flex items-center justify-center shrink-0 select-none ${className}`}
    >
      {getInitials(name)}
    </div>
  );
}
