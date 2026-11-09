import React, { useState } from 'react';
import { X, KeyRound, AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { changeManagerPin, isValidPinFormat } from '../../utils/pin';

export interface ChangePinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ChangePinModal: React.FC<ChangePinModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedCurr = currentPin.trim();
    const trimmedNew = newPin.trim();
    const trimmedConf = confirmPin.trim();

    if (!trimmedCurr) {
      setError('Please enter your current PIN (default is 1234).');
      return;
    }
    if (!isValidPinFormat(trimmedNew)) {
      setError('New PIN must be 4 to 6 digits.');
      return;
    }
    if (trimmedNew !== trimmedConf) {
      setError('New PIN and Confirm PIN do not match.');
      return;
    }
    if (trimmedNew === trimmedCurr) {
      setError('New PIN must be different from current PIN.');
      return;
    }

    setLoading(true);
    try {
      const res = await changeManagerPin(trimmedCurr, trimmedNew);
      if (res.ok) {
        setSuccess('✅ Manager PIN updated successfully! It is now active across the system.');
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
        if (onSuccess) onSuccess();
        setTimeout(() => {
          onClose();
        }, 1800);
      } else {
        setError(res.error || 'Failed to update PIN.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error updating PIN.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-[#11131c] border border-amber-500/30 rounded-3xl p-6 w-full max-w-sm shadow-2xl text-sand-50 relative">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 p-1 rounded-full text-sand-400 hover:text-white transition"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-3 shadow">
            <KeyRound className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Change Manager PIN</h3>
          <p className="text-xs text-sand-400 mt-1">
            Keep your executive PIN secure and handy. Default is <span className="font-mono text-amber-300 font-bold">1234</span>.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-semibold text-sand-300 uppercase tracking-wider mb-1">
              Current PIN:
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              placeholder="e.g. 1234"
              value={currentPin}
              onChange={(e) => {
                setCurrentPin(e.target.value);
                setError(null);
              }}
              className="w-full text-center tracking-[0.4em] text-lg font-mono py-2.5 px-3 bg-zinc-900 border border-white/10 rounded-xl focus:border-amber-400 focus:outline-none text-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-sand-300 uppercase tracking-wider mb-1">
              New PIN (4 to 6 Digits):
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••"
              value={newPin}
              onChange={(e) => {
                setNewPin(e.target.value);
                setError(null);
              }}
              className="w-full text-center tracking-[0.4em] text-lg font-mono py-2.5 px-3 bg-zinc-900 border border-white/10 rounded-xl focus:border-amber-400 focus:outline-none text-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-sand-300 uppercase tracking-wider mb-1">
              Confirm New PIN:
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••"
              value={confirmPin}
              onChange={(e) => {
                setConfirmPin(e.target.value);
                setError(null);
              }}
              className="w-full text-center tracking-[0.4em] text-lg font-mono py-2.5 px-3 bg-zinc-900 border border-white/10 rounded-xl focus:border-amber-400 focus:outline-none text-white"
            />
          </div>

          {error && (
            <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{success}</span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-sand-400 hover:text-white font-semibold text-xs transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !currentPin || !newPin || !confirmPin}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-black font-bold text-xs uppercase tracking-wider hover:brightness-110 active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Update PIN</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
