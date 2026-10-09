import React, { useEffect, useRef, useState } from 'react';
import type { SnapshotUser } from '../api/session';
import { ExternalLink, LogoMark } from './icons';

export const Header = ({
  user,
  dashboardUrl,
  onLogout,
}: {
  user: SnapshotUser | null;
  dashboardUrl: string;
  onLogout: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const initial = (user?.full_name || user?.email || '?').trim().charAt(0).toUpperCase();

  return (
    <header className="relative flex h-14 shrink-0 items-center justify-between border-b border-zinc-800/80 px-4">
      <div className="flex items-center gap-2.5">
        <LogoMark />
        <span className="text-[15px] font-semibold tracking-tight text-zinc-50">SkillSync</span>
      </div>

      {user && (
        <div ref={menuRef} className="relative">
          <button
            type="button"
            aria-label="Account menu"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/20 text-sm font-semibold text-brand-300 ring-1 ring-brand-500/30 transition hover:bg-brand-500/30"
          >
            {initial}
          </button>
          {open && (
            <div
              role="menu"
              className="animate-pop absolute right-0 top-10 z-20 w-60 overflow-hidden rounded-xl border border-zinc-700/80 bg-zinc-900 shadow-2xl shadow-black/50"
            >
              <div className="border-b border-zinc-800 px-3.5 py-3">
                <p className="truncate text-sm font-medium text-zinc-100">{user.full_name || 'Signed in'}</p>
                <p className="truncate text-xs text-zinc-400">{user.email}</p>
              </div>
              <a
                role="menuitem"
                href={dashboardUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between px-3.5 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800"
              >
                Open dashboard <ExternalLink className="h-3.5 w-3.5 text-zinc-400" />
              </a>
              <button
                type="button"
                role="menuitem"
                onClick={onLogout}
                className="block w-full px-3.5 py-2.5 text-left text-sm text-rose-300 hover:bg-zinc-800"
              >
                Log out
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
