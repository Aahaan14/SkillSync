import React from 'react';

type IconProps = { className?: string };

const base = (className?: string) => ({
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className,
  'aria-hidden': true,
});

export const LogoMark = ({ className }: IconProps) => (
  <svg viewBox="0 0 32 32" width="28" height="28" className={className} aria-hidden>
    <defs>
      <linearGradient id="sk-logo" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#8b5cf6" />
        <stop offset="1" stopColor="#6366f1" />
      </linearGradient>
    </defs>
    <rect width="32" height="32" rx="9" fill="url(#sk-logo)" />
    <circle cx="16" cy="16" r="5" fill="#fff" />
  </svg>
);

export const ExternalLink = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></svg>
);
export const Linkedin = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" /><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" /></svg>
);
export const Globe = ({ className }: IconProps) => (
  <svg {...base(className)}><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z" /></svg>
);
export const AlertTriangle = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
);
export const CheckCircle = ({ className }: IconProps) => (
  <svg {...base(className)}><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>
);
export const InfoCircle = ({ className }: IconProps) => (
  <svg {...base(className)}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
);
export const XIcon = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
);
export const Eye = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
);
export const EyeOff = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="M17.9 17.9A10.9 10.9 0 0 1 12 19c-6.5 0-10-7-10-7a18 18 0 0 1 4.1-5" /><path d="M9.9 4.2A9.7 9.7 0 0 1 12 4c6.5 0 10 7 10 7a18 18 0 0 1-2.2 3.2" /><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2" /><path d="m2 2 20 20" /></svg>
);
export const Sparkles = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M19 3v4" /><path d="M21 5h-4" /></svg>
);
export const Target = ({ className }: IconProps) => (
  <svg {...base(className)}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
);
export const ScanSearch = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><circle cx="12" cy="12" r="3" /><path d="m16 16-1.9-1.9" /></svg>
);
export const Copy = ({ className }: IconProps) => (
  <svg {...base(className)}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
);
export const RefreshCw = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></svg>
);
