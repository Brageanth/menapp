import { BottomNav } from '@/components/bottom-nav';

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 480,
        margin: '0 auto',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: '#FAF8F4',
      }}
    >
      <div style={{ flex: 1, overflowY: 'auto' }}>{children}</div>
      <BottomNav />
    </div>
  );
}
