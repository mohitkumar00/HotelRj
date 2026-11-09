import React from 'react';
import { AlertTriangle, Lock, KeyRound } from 'lucide-react';

export interface ManagerPinPromptModalProps {
  handleManagerPinSubmit: (e?: React.FormEvent) => Promise<void>;
  managerPinInput: string;
  setManagerPinInput: React.Dispatch<React.SetStateAction<string>>;
  setManagerPinError: React.Dispatch<React.SetStateAction<string | null>>;
  managerPinError: string | null;
  setIsManagerPinPromptOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setTargetManagerAction: React.Dispatch<React.SetStateAction<'insights' | 'menu' | 'banquet' | 'bills' | 'printer' | 'logs' | null>>;
  isCheckingManagerPin: boolean;
  onOpenChangePin?: () => void;
}

export const ManagerPinPromptModal: React.FC<ManagerPinPromptModalProps> = ({
  handleManagerPinSubmit,
  managerPinInput,
  setManagerPinInput,
  setManagerPinError,
  managerPinError,
  setIsManagerPinPromptOpen,
  setTargetManagerAction,
  isCheckingManagerPin,
  onOpenChangePin,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
    <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl">
      <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 mb-4 shadow">
        <Lock className="w-7 h-7" />
      </div>
      <h3 className="text-lg font-black text-white">Manager Authorization</h3>
      <p className="text-xs text-zinc-400 mt-1 mb-4">
        Enter the Master PIN to access executive insights, menu editing, rooms &amp; banquet calendar.
      </p>

      <form onSubmit={handleManagerPinSubmit} className="space-y-3">
        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoFocus
          placeholder="Enter 4-Digit PIN"
          value={managerPinInput}
          onChange={(e) => {
            setManagerPinInput(e.target.value);
            setManagerPinError(null);
          }}
          className={`w-full text-center tracking-widest text-lg font-mono py-2.5 rounded-xl bg-zinc-900 border text-white focus:outline-none ${
            managerPinError ? 'border-rose-500 text-rose-300' : 'border-zinc-700 focus:border-amber-400'
          }`}
        />

        {managerPinError && (
          <div className="text-xs text-rose-400 font-semibold flex items-center justify-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{managerPinError}</span>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              setIsManagerPinPromptOpen(false);
              setTargetManagerAction(null);
              setManagerPinInput('');
            }}
            className="flex-1 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isCheckingManagerPin || !managerPinInput.trim()}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-black text-xs font-black shadow disabled:opacity-50"
          >
            {isCheckingManagerPin ? 'Verifying...' : 'Unlock Portal'}
          </button>
        </div>

        {onOpenChangePin && (
          <div className="pt-2.5 border-t border-zinc-900 mt-2">
            <button
              type="button"
              onClick={() => {
                setIsManagerPinPromptOpen(false);
                setTargetManagerAction(null);
                setManagerPinInput('');
                onOpenChangePin();
              }}
              className="text-[11px] text-amber-400/90 hover:text-amber-300 font-medium flex items-center justify-center gap-1.5 mx-auto transition"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Change Manager PIN</span>
            </button>
          </div>
        )}
      </form>
    </div>
  </div>
);
