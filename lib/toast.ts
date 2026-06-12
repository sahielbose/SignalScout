export type ToastVariant = 'default' | 'success' | 'error';
export interface ToastMessage {
  id: number;
  message: string;
  variant: ToastVariant;
}

const listeners = new Set<(t: ToastMessage) => void>();
let counter = 0;

export function toast(message: string, variant: ToastVariant = 'default'): void {
  counter += 1;
  const t: ToastMessage = { id: counter, message, variant };
  listeners.forEach((l) => l(t));
}

export function subscribeToast(cb: (t: ToastMessage) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
