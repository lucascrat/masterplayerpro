import { useEffect, useState } from 'react';

// ── Tiny toast system ────────────────────────────────────────────────
// Non-blocking replacement for alert(). Call `toast(msg)` from anywhere;
// mount <ToastHost /> once near the app root.

export type ToastKind = 'info' | 'error' | 'success';

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

type Listener = (items: ToastItem[]) => void;

let items: ToastItem[] = [];
const listeners = new Set<Listener>();
let nextId = 1;

function emit() {
  for (const l of listeners) l(items);
}

export function toast(message: string, kind: ToastKind = 'info', ttl = 4500) {
  const id = nextId++;
  items = [...items, { id, message, kind }];
  emit();
  window.setTimeout(() => {
    items = items.filter(t => t.id !== id);
    emit();
  }, ttl);
}

const COLORS: Record<ToastKind, string> = {
  info: '#8B5CF6',
  error: '#ef4444',
  success: '#22c55e',
};

const ICONS: Record<ToastKind, string> = {
  info: 'ℹ',
  error: '⚠',
  success: '✓',
};

export function ToastHost() {
  const [list, setList] = useState<ToastItem[]>(items);

  useEffect(() => {
    listeners.add(setList);
    return () => { listeners.delete(setList); };
  }, []);

  if (!list.length) return null;

  return (
    <div
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        zIndex: 10001, pointerEvents: 'none', padding: '0 1rem',
      }}
    >
      {list.map(t => (
        <div
          key={t.id}
          role="status"
          style={{
            pointerEvents: 'auto',
            maxWidth: 460, width: '100%',
            display: 'flex', alignItems: 'flex-start', gap: 10,
            background: 'rgba(20,20,24,0.96)',
            border: `1px solid ${COLORS[t.kind]}`,
            borderLeft: `4px solid ${COLORS[t.kind]}`,
            borderRadius: 10, padding: '0.7rem 0.9rem',
            color: '#fff', fontSize: '0.86rem', lineHeight: 1.4,
            boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
            animation: 'toast-in 0.25s ease',
          }}
          onClick={() => { items = items.filter(x => x.id !== t.id); emit(); }}
        >
          <span style={{ color: COLORS[t.kind], fontWeight: 700 }}>{ICONS[t.kind]}</span>
          <span style={{ flex: 1 }}>{t.message}</span>
        </div>
      ))}
      <style>{`@keyframes toast-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
