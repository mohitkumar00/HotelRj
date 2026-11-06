import React, { useEffect, useState } from 'react';
import { X, Smartphone, ShieldCheck, KeyRound, Loader2 } from 'lucide-react';
import { STORAGE_KEYS } from '../config';
import { readString, writeString } from '../utils/storage';
import {
  isDevicePaired,
  registerThisDevice,
  pairWithCode,
  requestPairingOtp,
  unpairThisDevice,
  verifyPairingOtp,
} from '../utils/deviceAuth';
import { isPinConfigured, isValidPinFormat, setManagerPin } from '../utils/pin';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'email' | 'otp' | 'pin' | 'done';

/** Owner-only flow: verify an OTP once, name the device, set the manager PIN (first device only). */
export const PairDeviceModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState<Step>('email');
  const [paired, setPaired] = useState(false);
  const [emailInput, setEmailInput] = useState(() => readString(STORAGE_KEYS.ownerEmail) || '');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [mode, setMode] = useState<'code' | 'otp'>('code');
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStep('email');
    setError(null);
    setOtp('');
    isDevicePaired().then(setPaired);
  }, [isOpen]);

  if (!isOpen) return null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e: any) {
      setError(e?.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const sendOtp = () =>
    run(async () => {
      const r = await requestPairingOtp(emailInput);
      if (!r.ok) return setError(r.error || 'Could not send OTP.');
      setEmail(r.email!);
      writeString(STORAGE_KEYS.ownerEmail, emailInput.trim());
      setStep('otp');
    });

  const pairByCode = () =>
    run(async () => {
      const r = await pairWithCode(emailInput, code);
      if (!r.ok) return setError(r.error || 'Pairing failed.');
      writeString(STORAGE_KEYS.ownerEmail, emailInput.trim());
      const reg = await registerThisDevice(label || 'Device');
      if (!reg.ok) {
        await unpairThisDevice();
        return setError(reg.error || 'Could not register device.');
      }
      setCode('');
      setPaired(true);
      setStep((await isPinConfigured()) ? 'done' : 'pin');
    });

  const verify = () =>
    run(async () => {
      const r = await verifyPairingOtp(email, otp);
      if (!r.ok) return setError(r.error || 'Incorrect OTP.');
      const reg = await registerThisDevice(label || 'Device');
      if (!reg.ok) {
        // Do not stay half-paired: an unregistered session would be blocked by RLS.
        await unpairThisDevice();
        return setError(reg.error || 'Could not register device.');
      }
      setPaired(true);
      setStep((await isPinConfigured()) ? 'done' : 'pin');
    });

  const savePin = () =>
    run(async () => {
      if (!isValidPinFormat(pin)) return setError('PIN must be 4 to 6 digits.');
      if (pin !== pin2) return setError('PINs do not match.');
      const r = await setManagerPin(pin);
      if (!r.ok) return setError(r.error || 'Could not save PIN.');
      setStep('done');
    });

  const unpair = () =>
    run(async () => {
      await unpairThisDevice();
      setPaired(false);
    });

  const input =
    'w-full py-3 px-4 rounded-xl bg-stone-950 border border-stone-700 text-white focus:outline-none focus:border-gold-400';
  const primary =
    'w-full py-3 rounded-xl bg-gradient-to-r from-gold-500 to-gold-400 text-black font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2';

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md bg-stone-900 border border-gold-500/30 rounded-3xl p-6 space-y-4 text-white">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-gold-400" />
            <h2 className="text-lg font-bold font-serif text-gold-200">Pair this device</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-stone-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'email' && (
          <div className="space-y-3">
            <p className="text-xs text-stone-400">
              Owner only. {mode === 'code' ? 'Enter the pairing code set by the owner.' : 'A 6-digit OTP is emailed to the owner.'} After pairing, staff on this device never need to log in.
              {paired && <span className="text-emerald-400"> This device is already paired.</span>}
            </p>
            <input className={input} type="email" inputMode="email" autoComplete="email" placeholder={mode === 'code' ? 'Pairing account email' : 'Owner email address'} value={emailInput} onChange={(e) => setEmailInput(e.target.value)} />
            {mode === 'code' && (
              <input className={input} type="password" autoComplete="off" placeholder="Pairing code" value={code} onChange={(e) => setCode(e.target.value)} />
            )}
            <input className={input} placeholder="Device name (e.g. Waiter Phone 2)" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} />
            {mode === 'code' ? (
              <button className={primary} disabled={busy || !emailInput.trim() || !code} onClick={pairByCode}>
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Pair this device
              </button>
            ) : (
              <button className={primary} disabled={busy || !emailInput.trim()} onClick={sendOtp}>
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Send OTP
              </button>
            )}
            <button className="w-full py-1 text-[11px] text-stone-400 hover:text-stone-200" onClick={() => { setMode(mode === 'code' ? 'otp' : 'code'); setError(null); }}>
              {mode === 'code' ? 'Use emailed OTP instead' : 'Use pairing code instead'}
            </button>
            {paired && (
              <button className="w-full py-2 text-xs text-rose-400 hover:text-rose-300" disabled={busy} onClick={unpair}>
                Unpair this device
              </button>
            )}
          </div>
        )}

        {step === 'otp' && (
          <div className="space-y-3">
            <p className="text-xs text-stone-400">Enter the 6-digit OTP emailed to {email} (check spam).</p>
            <input className={`${input} text-center tracking-[0.4em] text-xl font-mono`} inputMode="numeric" maxLength={6} autoFocus value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} />
            <button className={primary} disabled={busy || otp.length < 6} onClick={verify}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Verify &amp; Pair
            </button>
            <button className="w-full py-2 text-xs text-stone-400" onClick={() => setStep('email')}>
              Change email
            </button>
          </div>
        )}

        {step === 'pin' && (
          <div className="space-y-3">
            <p className="text-xs text-stone-400 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-gold-400" /> Set the manager PIN (4 to 6 digits). It is shared by all paired devices and replaces the old default PINs.
            </p>
            <input className={`${input} text-center tracking-[0.4em] text-xl font-mono`} type="password" inputMode="numeric" maxLength={6} placeholder="New PIN" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
            <input className={`${input} text-center tracking-[0.4em] text-xl font-mono`} type="password" inputMode="numeric" maxLength={6} placeholder="Confirm PIN" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} />
            <button className={primary} disabled={busy} onClick={savePin}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Save PIN
            </button>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-3 text-center">
            <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto" />
            <p className="text-sm text-stone-300">Device paired. Staff can use this device without logging in.</p>
            <button className={primary} onClick={onClose}>
              Done
            </button>
          </div>
        )}

        {error && <p className="text-xs text-rose-400">{error}</p>}
      </div>
    </div>
  );
};
