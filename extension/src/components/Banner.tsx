import React from 'react';
import { AlertTriangle, CheckCircle, InfoCircle, XIcon } from './icons';

export type Tone = 'error' | 'warning' | 'info' | 'success';

export interface BannerAction {
  label: string;
  onClick: () => void;
}

const STYLES: Record<Tone, { box: string; icon: string; Icon: typeof InfoCircle }> = {
  error: { box: 'border-rose-500/30 bg-rose-500/10 text-rose-100', icon: 'text-rose-400', Icon: AlertTriangle },
  warning: { box: 'border-amber-500/30 bg-amber-500/10 text-amber-100', icon: 'text-amber-400', Icon: AlertTriangle },
  info: { box: 'border-brand-500/30 bg-brand-500/10 text-brand-100', icon: 'text-brand-400', Icon: InfoCircle },
  success: { box: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100', icon: 'text-emerald-400', Icon: CheckCircle },
};

export const Banner = ({
  tone,
  children,
  action,
  onDismiss,
}: {
  tone: Tone;
  children: React.ReactNode;
  action?: BannerAction;
  onDismiss?: () => void;
}) => {
  const { box, icon, Icon } = STYLES[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`animate-pop flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-[13px] leading-snug ${box}`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${icon}`} />
      <div className="min-w-0 flex-1">
        <div>{children}</div>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="mt-1.5 text-xs font-semibold underline underline-offset-2 hover:no-underline"
          >
            {action.label}
          </button>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="-mr-1 -mt-0.5 rounded-md p-1 opacity-60 hover:bg-white/10 hover:opacity-100"
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};
