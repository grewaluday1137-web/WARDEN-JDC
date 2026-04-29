import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Send } from 'lucide-react';

interface BroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (target: 'staff' | 'guests' | 'both', message: string) => void;
}

export const BroadcastModal: React.FC<BroadcastModalProps> = ({ isOpen, onClose, onSend }) => {
  const [target, setTarget] = useState<'staff' | 'guests' | 'both'>('both');
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  const handleSend = () => {
    if (!message.trim()) return;
    onSend(target, message);
    setMessage('');
    onClose();
  };

  const modalContent = (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000
    }}>
      <div style={{
        width: '450px',
        backgroundColor: '#1a1d24',
        border: '1px solid #374151',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        borderTop: '4px solid var(--primary)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 20px rgba(0, 229, 255, 0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="hud-font" style={{ fontSize: '18px', color: 'var(--primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>
            Broadcast Message
          </h2>
          <button 
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--on-surface-variant)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '12px', color: 'var(--on-surface-variant)', textTransform: 'uppercase' }}>Select Target Audience</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['staff', 'guests', 'both'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTarget(t)}
                style={{
                  flex: 1,
                  padding: '8px',
                  backgroundColor: target === t ? 'var(--primary)' : 'rgba(31, 38, 54, 0.6)',
                  color: target === t ? '#000' : 'var(--on-surface)',
                  border: `1px solid ${target === t ? 'var(--primary)' : 'rgba(113, 117, 131, 0.3)'}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: target === t ? 'bold' : 'normal',
                  textTransform: 'uppercase',
                  fontSize: '12px',
                  transition: 'all 0.2s'
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '12px', color: 'var(--on-surface-variant)', textTransform: 'uppercase' }}>Message Body</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Enter transmission data..."
            style={{
              width: '100%',
              minHeight: '100px',
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              border: '1px solid rgba(113, 117, 131, 0.3)',
              borderRadius: '4px',
              padding: '12px',
              color: 'var(--on-surface)',
              fontFamily: 'monospace',
              fontSize: '14px',
              resize: 'vertical',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button 
            className="btn-primary"
            onClick={handleSend}
            disabled={!message.trim()}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              opacity: !message.trim() ? 0.5 : 1,
              cursor: !message.trim() ? 'not-allowed' : 'pointer'
            }}
          >
            <Send size={16} /> SEND
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};
