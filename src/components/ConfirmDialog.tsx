'use client';
import React from 'react';
import { Modal } from './Modal';

export function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirm', confirmVariant = 'danger', loading = false }: { isOpen: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string; confirmLabel?: string; confirmVariant?: 'danger' | 'primary'; loading?: boolean }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <p className="text-muted-foreground mb-4">{message}</p>
      <div className="flex justify-end gap-3">
        <button onClick={onClose} disabled={loading} className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted text-sm">Cancel</button>
        <button onClick={onConfirm} disabled={loading} className={`px-4 py-2 rounded-lg text-white text-sm disabled:opacity-50 ${confirmVariant === 'danger' ? 'bg-red-500 hover:bg-red-600' : 'bg-primary-500 hover:bg-primary-600'}`}>{loading ? 'Processing...' : confirmLabel}</button>
      </div>
    </Modal>
  );
}
