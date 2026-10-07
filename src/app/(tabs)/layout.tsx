import { BottomNav } from '@/components/bottom-nav';
import { SyncManager } from '@/components/sync-manager';

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 480,
        margin: '0 auto',
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: '#FAF8F4',
      }}
    >
      <SyncManager />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{children}</div>
      <BottomNav />
    </div>
  );
}
