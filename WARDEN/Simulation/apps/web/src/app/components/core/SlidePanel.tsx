import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import React from 'react';

export interface SlidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  width?: number;
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function SlidePanel({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  width = 480,
  headerRight,
  footer,
  children
}: SlidePanelProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="inject-modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ zIndex: 100 }}
      >
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 40 }}
          transition={{ duration: 0.25 }}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: 12, right: 12, bottom: 12,
            width,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 16,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {icon}
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
                {subtitle && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    {subtitle}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {headerRight}
              <button 
                onClick={onClose} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
            {children}
          </div>
          
          {/* Footer */}
          {footer && footer}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
