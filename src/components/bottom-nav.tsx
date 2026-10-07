'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  {
    href: '/hoy',
    label: 'Hoy',
    icon: (active: boolean) => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={active ? '#2B2724' : '#766F64'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
    ),
  },
  {
    href: '/semana',
    label: 'Semana',
    icon: (active: boolean) => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={active ? '#2B2724' : '#766F64'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    href: '/despensa',
    label: 'Despensa',
    icon: (active: boolean) => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={active ? '#2B2724' : '#766F64'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="5" rx="1" />
        <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
        <path d="M10 12h4" />
      </svg>
    ),
  },
  {
    href: '/recetas',
    label: 'Recetas',
    icon: (active: boolean) => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={active ? '#2B2724' : '#766F64'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
      </svg>
    ),
  },
  {
    href: '/metas',
    label: 'Metas',
    icon: (active: boolean) => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={active ? '#2B2724' : '#766F64'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '10px 6px calc(10px + env(safe-area-inset-bottom, 0px))',
        borderTop: '1px solid #E3DED3',
        background: '#FAF8F4',
        flexShrink: 0,
      }}
    >
      {TABS.map((tab) => {
        const active = pathname?.startsWith(tab.href) ?? false;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderBottom: active ? '2px solid #A8412B' : '2px solid transparent',
            }}
          >
            {tab.icon(active)}
            <span
              style={{
                fontSize: 11,
                fontWeight: active ? 600 : 500,
                color: active ? '#2B2724' : '#766F64',
              }}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
