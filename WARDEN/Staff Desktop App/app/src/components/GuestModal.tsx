import React, { useState } from 'react';
import { X, User, Hash, Mail, ShieldCheck, Loader2 } from 'lucide-react';

interface Props {
  onClose: () => void;
}

type Step = 'form' | 'sending' | 'sent' | 'error';

export const GuestModal: React.FC<Props> = ({ onClose }) => {
  const [step, setStep] = useState<Step>('form');
  const [form, setForm] = useState({
    name: '',
    room_number: '',
    email: '',
  });
  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep('sending');
    setErrorMsg('');

    try {
      const res = await fetch('http://127.0.0.1:8000/auth/guest/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Server error ${res.status}`);
      }

      setStep('sent');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send OTP. Please try again.');
      setStep('error');
    }
  };

  const isFormValid =
    form.name.trim().length > 0 &&
    form.room_number.trim().length > 0 &&
    form.email.trim().length > 0;

  return (
    /* Backdrop */
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      {/* Modal card */}
      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: 'linear-gradient(135deg, rgba(15,23,42,0.97) 0%, rgba(23,37,64,0.97) 100%)',
        border: '1px solid rgba(59,130,246,0.25)',
        borderRadius: '16px',
        boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 40px rgba(59,130,246,0.08)',
        padding: '28px',
        position: 'relative',
        animation: 'fadeSlideIn 0.2s ease',
      }}>
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px',
            padding: '6px',
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { (e.currentTarget).style.background = 'rgba(255,255,255,0.12)'; }}
          onMouseLeave={e => { (e.currentTarget).style.background = 'rgba(255,255,255,0.06)'; }}
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'rgba(59,130,246,0.15)',
            border: '1px solid rgba(59,130,246,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <ShieldCheck size={22} color="#60a5fa" />
          </div>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 700, color: '#fff', letterSpacing: '0.3px' }}>
              Guest Check-In
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(148,163,184,0.8)', marginTop: '2px' }}>
              Register to receive WARDEN alerts on your device
            </div>
          </div>
        </div>

        {/* ── Form Step ───────────────────────────────── */}
        {(step === 'form' || step === 'sending' || step === 'error') && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {[
              { label: 'Full Name', name: 'name', type: 'text', placeholder: 'e.g. Alex Johnson', icon: <User size={14} /> },
              { label: 'Room Number', name: 'room_number', type: 'text', placeholder: 'e.g. 204', icon: <Hash size={14} /> },
              { label: 'Email Address (Strictly for OTP)', name: 'email', type: 'email', placeholder: 'your@email.com', icon: <Mail size={14} /> },
            ].map(field => (
              <div key={field.name}>
                <label style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.8px',
                  textTransform: 'uppercase',
                  color: 'rgba(148,163,184,0.9)',
                  marginBottom: '6px',
                }}>
                  {field.label}
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'rgba(148,163,184,0.5)',
                    pointerEvents: 'none',
                    display: 'flex',
                  }}>
                    {field.icon}
                  </span>
                  <input
                    type={field.type}
                    name={field.name}
                    value={(form as any)[field.name]}
                    onChange={handleChange}
                    placeholder={field.placeholder}
                    disabled={step === 'sending'}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 12px 10px 34px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: '#e2e8f0',
                      fontSize: '13px',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      opacity: step === 'sending' ? 0.6 : 1,
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                  />
                </div>
              </div>
            ))}

            {step === 'error' && (
              <div style={{
                padding: '10px 14px',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#fca5a5',
              }}>
                ⚠ {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={!isFormValid || step === 'sending'}
              style={{
                marginTop: '4px',
                padding: '12px',
                borderRadius: '10px',
                border: 'none',
                background: isFormValid && step !== 'sending'
                  ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                  : 'rgba(59,130,246,0.2)',
                color: isFormValid && step !== 'sending' ? '#fff' : 'rgba(255,255,255,0.4)',
                fontWeight: 700,
                fontSize: '13px',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                cursor: isFormValid && step !== 'sending' ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: isFormValid && step !== 'sending'
                  ? '0 4px 20px rgba(59,130,246,0.35)'
                  : 'none',
              }}
            >
              {step === 'sending' ? (
                <>
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  Sending OTP…
                </>
              ) : (
                'Send OTP'
              )}
            </button>
          </form>
        )}

        {/* ── Success Step ─────────────────────────────── */}
        {step === 'sent' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(34,197,94,0.15)',
              border: '2px solid rgba(34,197,94,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: '28px',
            }}>
              ✓
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#4ade80', marginBottom: '10px' }}>
              OTP Sent!
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(148,163,184,0.8)', lineHeight: 1.6 }}>
              A one-time password has been sent to<br />
              <strong style={{ color: '#e2e8f0' }}>{form.email}</strong>
            </div>
            <div style={{
              marginTop: '16px',
              padding: '12px 16px',
              background: 'rgba(59,130,246,0.08)',
              border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: '10px',
              fontSize: '12px',
              color: 'rgba(148,163,184,0.9)',
            }}>
              📱 Upon OTP entry, the <strong style={{ color: '#93c5fd' }}>WARDEN Android app</strong> will automatically sync the guest's name and room number.
            </div>
            <button
              onClick={onClose}
              style={{
                marginTop: '20px',
                padding: '10px 28px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.06)',
                color: '#e2e8f0',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { (e.currentTarget).style.background = 'rgba(255,255,255,0.1)'; }}
              onMouseLeave={e => { (e.currentTarget).style.background = 'rgba(255,255,255,0.06)'; }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
