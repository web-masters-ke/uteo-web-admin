// Minimal socket stub for Uteo admin
export interface AdminNotification {
  id: string;
  event: string;
  title: string;
  message?: string;
  level: 'info' | 'warn' | 'danger' | 'success';
  createdAt: string;
}

export function getSocket() { return null; }
export function onAdminNotification(_cb: (n: AdminNotification) => void) { return () => {}; }
export function onSocketConnection(_cb: (connected: boolean) => void) { return () => {}; }
