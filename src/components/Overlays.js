import React, { useEffect, useRef, useState } from 'react';
import { Close } from './Icons.js';

export function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const input = ref.current && ref.current.querySelector('input, select, button');
    if (input) input.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Close />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function NewCategoryModal({ transaction, existing, onSave, onClose }) {
  const [name, setName] = useState('');
  const trimmed = name.trim();
  const duplicate = existing.find((c) => c.toLowerCase() === trimmed.toLowerCase());

  const submit = (e) => {
    e.preventDefault();
    if (trimmed) onSave(transaction, duplicate || trimmed);
  };

  return (
    <Modal title="New category" onClose={onClose}>
      <form onSubmit={submit} className="modal-body">
        <p className="muted">
          Move <strong>{transaction.merchant}</strong> from <strong>{transaction.category}</strong> to a new category.
        </p>
        <input className="text-input" value={name} maxLength={40} placeholder="e.g. Coffee, Kids, Gifts" onChange={(e) => setName(e.target.value)} />
        {duplicate ? <p className="small muted">"{duplicate}" already exists and will be used.</p> : null}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!trimmed}>
            Move
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(onDismiss, toast.action ? 8000 : 5000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;
  return (
    <div className={`toast ${toast.tone || ''}`} role="status">
      <span>{toast.message}</span>
      {toast.action ? (
        <button
          className="toast-action"
          onClick={() => {
            toast.action.run();
            onDismiss();
          }}
        >
          {toast.action.label}
        </button>
      ) : null}
      <button className="icon-btn" onClick={onDismiss} aria-label="Dismiss">
        <Close size={16} />
      </button>
    </div>
  );
}
