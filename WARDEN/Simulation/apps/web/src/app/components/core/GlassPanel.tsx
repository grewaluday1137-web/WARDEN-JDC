'use client';

import { HTMLMotionProps, motion } from 'framer-motion';
import { forwardRef } from 'react';

export const GlassPanel = forwardRef<HTMLDivElement, HTMLMotionProps<"div">>(({ className = '', style, ...props }, ref) => {
  return (
    <motion.div
      ref={ref}
      className={`glass-card ${className}`}
      style={{
        background: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        ...style
      }}
      {...props}
    />
  );
});

GlassPanel.displayName = 'GlassPanel';
