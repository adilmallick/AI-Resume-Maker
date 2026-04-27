import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="modal-overlay" 
      onClick={onClose} 
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        background: 'rgba(0,0,0,0.5)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        zIndex: 1000, 
        backdropFilter: 'blur(4px)',
        padding: '20px'
      }}
    >
      <div 
        className="modal-content glass-card" 
        onClick={e => e.stopPropagation()} 
        style={{ 
          width: '100%', 
          maxWidth: '650px', 
          maxHeight: '85vh', 
          overflowY: 'auto', 
          padding: '30px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--text-main)' }}>{title}</h3>
          <button 
            onClick={onClose} 
            style={{ 
              background: 'none', 
              border: 'none', 
              fontSize: '1.8rem', 
              cursor: 'pointer', 
              color: 'var(--text-muted)',
              lineHeight: 1,
              padding: '0 5px'
            }}
          >
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
