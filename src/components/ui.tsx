import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCheck, CheckCircle2, Loader2, Trash2, X, type LucideIcon } from 'lucide-react';

export function PageHeader({
  eyebrow,
  title,
  meta,
  actions,
}: {
  eyebrow: string;
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between pb-6 mb-6 border-b border-line">
      <div className="min-w-0">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="font-display text-[44px] sm:text-[52px] leading-[0.95] tracking-[-0.01em] text-ink mt-2">{title}</h1>
        {meta && <p className="text-sm text-muted mt-3">{meta}</p>}
      </div>
      {actions && <div className="flex gap-2 shrink-0">{actions}</div>}
    </header>
  );
}

/** Native <dialog>: bottom sheet on phones, centered modal on larger screens. */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      d.querySelector<HTMLElement>('input, textarea, select')?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-label={title}
    >
      {open && (
        <div className="p-5 sm:p-6 overflow-y-auto max-h-[inherit]">
          <div className="w-10 h-1 rounded-full bg-line mx-auto -mt-1 mb-4 sm:hidden" />
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h2 className="font-display text-[30px] leading-none">{title}</h2>
              {description && <p className="text-sm text-muted mt-2">{description}</p>}
            </div>
            <button type="button" onClick={onClose} className="icon-btn -mr-2 -mt-1" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function Notice({ type, children }: { type: 'success' | 'error'; children: ReactNode }) {
  const Icon = type === 'success' ? CheckCircle2 : AlertCircle;
  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-sm ${
        type === 'success' ? 'bg-ok-soft text-ok' : 'bg-danger-soft text-danger'
      }`}
    >
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <span className="leading-snug">{children}</span>
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex justify-center py-16 ${className}`} role="status" aria-label="Loading">
      <Loader2 className="w-5 h-5 text-primary animate-spin" />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body?: string }) {
  return (
    <div className="text-center py-14 px-6">
      <Icon className="w-6 h-6 text-faint mx-auto mb-3" strokeWidth={1.5} />
      <p className="font-display text-2xl text-ink">{title}</p>
      {body && <p className="text-sm text-muted mt-1.5 max-w-xs mx-auto">{body}</p>}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex p-1 rounded-lg bg-sunken">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`h-8 px-3 rounded-md text-[13px] font-medium transition-colors duration-150 ${
              active ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink'
            }`}
          >
            {o.label}
            {o.count !== undefined && <span className={`ml-1.5 ${active ? 'text-muted' : 'text-faint'}`}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Two-step delete: first tap arms it, second tap confirms. Disarms after 3s. */
export function ConfirmDelete({ onConfirm, label }: { onConfirm: () => void; label: string }) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);

  if (armed) {
    return (
      <button
        type="button"
        autoFocus
        onClick={onConfirm}
        className="h-9 px-3 rounded-lg text-[13px] font-medium bg-danger text-white hover:bg-danger/90 shrink-0"
      >
        Delete?
      </button>
    );
  }
  return (
    <button type="button" onClick={() => setArmed(true)} className="icon-btn hover:!text-danger" aria-label={label} title={label}>
      <Trash2 className="w-4 h-4" />
    </button>
  );
}

export function BrandMark({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-lg bg-primary text-canvas shrink-0 ${className}`}>
      <CheckCheck className="w-[55%] h-[55%]" strokeWidth={2.25} />
    </span>
  );
}
