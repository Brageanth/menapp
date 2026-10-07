'use client';

import type { InventoryItem } from '@/domain/inventory';
import { expiryUrgency, formatDateBadge, formatExpiryLabel } from '@/domain/inventory';

const URGENCY_STYLES: Record<
  string,
  { badgeBg: string; badgeColor: string; badgeBorder?: string; labelColor: string; labelWeight: number; rowBg?: string }
> = {
  vencido: { badgeBg: '#A8412B', badgeColor: '#fff', labelColor: '#A8412B', labelWeight: 600, rowBg: '#F6E4DC' },
  urgente: { badgeBg: '#A8412B', badgeColor: '#fff', labelColor: '#A8412B', labelWeight: 600, rowBg: '#F6E4DC' },
  proximo: { badgeBg: '#F4EBD2', badgeColor: '#7D5A14', badgeBorder: '#7D5A14', labelColor: '#7D5A14', labelWeight: 600, rowBg: '#F4EBD2' },
  normal: { badgeBg: 'transparent', badgeColor: '#2B2724', badgeBorder: '#CFC8BA', labelColor: '#766F64', labelWeight: 500 },
  'sin-fecha': { badgeBg: 'transparent', badgeColor: '#2B2724', badgeBorder: '#CFC8BA', labelColor: '#766F64', labelWeight: 500 },
};

export function InventoryItemRow({
  item,
  now,
  highlighted,
  onClick,
  onFinish,
}: {
  item: InventoryItem;
  now: Date;
  highlighted?: boolean;
  onClick: () => void;
  onFinish: () => void;
}) {
  const urgency = expiryUrgency(item, now);
  const style = URGENCY_STYLES[urgency];
  const badge = formatDateBadge(item, now);
  const label = formatExpiryLabel(item, now);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        padding: highlighted ? '10px 12px 10px 10px' : '12px 0',
        background: highlighted ? style.rowBg ?? 'transparent' : 'transparent',
        borderRadius: highlighted ? 6 : 0,
        borderBottom: highlighted ? 'none' : '1px solid #E3DED3',
        marginBottom: highlighted ? 6 : 0,
        width: '100%',
      }}
    >
      <button
        onClick={onClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 13,
          flex: 1,
          minWidth: 0,
          textAlign: 'left',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
      <span
        style={{
          width: 50,
          height: 54,
          borderRadius: 5,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          background: style.badgeBg,
          color: style.badgeColor,
          boxShadow: style.badgeBorder ? `inset 0 0 0 1px ${style.badgeBorder}` : undefined,
        }}
      >
        <span style={{ fontSize: 10.5, fontWeight: 600, lineHeight: 1, opacity: 0.92 }}>{badge.top}</span>
        <span style={{ fontFamily: 'var(--font-young-serif), Georgia, serif', fontWeight: 400, fontSize: 22, lineHeight: 1.05 }}>
          {badge.bottom}
        </span>
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 500 }}>{item.name}</div>
        <div style={{ fontSize: 12.5, color: highlighted ? '#6E4B40' : '#766F64', marginTop: 1 }}>
          {item.quantity} {item.unit}
        </div>
      </div>
      {label && (
        <span style={{ fontSize: 12, fontWeight: style.labelWeight, color: style.labelColor, whiteSpace: 'nowrap' }}>{label}</span>
      )}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onFinish();
        }}
        aria-label="Marcar como terminado"
        title="Marcar como terminado"
        style={{
          width: 32,
          height: 32,
          borderRadius: 999,
          border: '1px solid #CFC8BA',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          background: 'transparent',
          cursor: 'pointer',
          touchAction: 'manipulation',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#766F64" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </button>
    </div>
  );
}
