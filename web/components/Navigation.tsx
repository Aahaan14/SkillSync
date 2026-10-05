"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, User, BarChart2, BookOpen, LogOut, Target } from 'lucide-react';
import { ApiError, getCurrentUser, isApiError, logout } from '../lib/api';
import { cn } from '../lib/utils';
import type { User as AuthUser } from '../types';
import { ErrorState, LoadingState } from './States';

export function Navigation({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<ApiError | null>(null);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((u) => {
        if (!active) return;
        setUser(u);
        setAuthError(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setUser(null);
        if (isApiError(error) && error.kind === 'unauthorized') {
          // Not signed in (or session expired): go to the sign-in page.
          setAuthError(null);
          if (pathname !== '/') router.replace('/');
        } else {
          // Backend unavailable etc. – do NOT pretend the user is signed out.
          setAuthError(isApiError(error) ? error : new ApiError('unknown', 0, 'Could not verify your session.'));
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [pathname, router, attempt]);

  const retry = () => {
    setIsLoading(true);
    setAttempt((n) => n + 1);
  };

  const handleLogout = async () => {
    setLogoutError(null);
    try {
      await logout();
      setUser(null);
      router.push('/');
    } catch {
      setLogoutError('Sign out failed. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <LoadingState label="Loading SkillSync…" />
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <ErrorState error={authError} onRetry={retry} />
      </div>
    );
  }

  // If not logged in, don't show navigation
  if (!user) {
    // Sign-in page renders bare; any other route is mid-redirect to it.
    return pathname === '/' ? <>{children}</> : <LoadingState label="Checking your session…" />;
  }

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Profile', href: '/profile', icon: User },
    { name: 'Market Intelligence', href: '/market', icon: BarChart2 },
    { name: 'Skill Gaps', href: '/skills', icon: Target },
    { name: 'Learning Roadmap', href: '/roadmap', icon: BookOpen },
  ];

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800/50 bg-zinc-950/50 backdrop-blur-xl flex flex-col">
        <div className="p-6">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-all duration-300">
              <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
            </div>
            <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-100 to-zinc-400">
              SkillSync
            </span>
          </Link>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive 
                    ? "bg-zinc-800/50 text-indigo-400 border border-zinc-700/50 shadow-inner" 
                    : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/30"
                )}
              >
                <item.icon className={cn("w-4 h-4", isActive ? "text-indigo-400" : "text-zinc-500")} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-zinc-800/50">
          <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-zinc-900/50 border border-zinc-800/50 mb-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs border border-indigo-500/30">
              {(user.full_name || user.email).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-200 truncate">{user.full_name || user.email}</p>
              <p className="text-xs text-zinc-500 truncate">{user.email}</p>
            </div>
          </div>
          
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
          {logoutError && <p role="alert" className="mt-2 text-xs text-red-400">{logoutError}</p>}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
        <div className="h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
