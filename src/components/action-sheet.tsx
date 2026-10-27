'use client';

import Link from 'next/link';
import { useLockBodyScroll } from '@/hooks/use-lock-body-scroll';

export interface SheetAction {
  label: string;
  hint?: string;
  onClick?: () => void;
  /** Navega en vez de ejecutar `onClick`. */
  href?: string;
  tone?: 'default' | 'accent';
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: '14px 0',
  background: 'transparent',
  borderStyle: 'solid',
  borderWidth: '0 0 1px',
  borderColor: '#E3DED3',
  textAlign: 'left',
  width: '100%',
  minHeight: 48,
};

/** Hoja inferior con una lista de acciones — para lo que se usa de vez en cuando y no merece un botón fijo en pantalla. */
export function ActionSheet({ title, actions, onClose }: { title: string; actions: SheetAction[]; onClose: () => void }) {
  useLockBodyScroll(onClose);

  return (
    <div style={{ position: 'fixed', inset: 0, height: '100dvh', background: 'rgba(43,39,36,0.4)', display: 'flex', alignItems: 'flex-end', zIndex: 60 }} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', background: '#FAF8F4', borderRadius: '16px 16px 0 0', padding: '20px 24px calc(12px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column', maxHeight: '85dvh', overflowY: 'auto' }}
      >
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>{title}</h2>
        {actions.map((action) => {
          const content = (
            <>
              <span style={{ fontSize: 15, fontWeight: 600, color: action.tone === 'accent' ? '#A8412B' : '#2B2724' }}>{action.label}</span>
              {action.hint && <span style={{ fontSize: 12.5, color: '#766F64' }}>{action.hint}</span>}
            </>
          );
          return action.href ? (
            <Link key={action.label} href={action.href} className="press" style={rowStyle}>
              {content}
            </Link>
          ) : (
            <button
              key={action.label}
              className="press"
              onClick={() => {
                onClose();
                action.onClick?.();
              }}
              style={rowStyle}
            >
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );
}
