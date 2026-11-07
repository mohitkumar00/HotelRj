import React from 'react';
import { Share2 } from 'lucide-react';

export interface ShareReportModalProps {
  handleShareWhatsApp: (e: React.FormEvent) => void;
  targetPhone: string;
  setTargetPhone: React.Dispatch<React.SetStateAction<string>>;
  whatsappSummaryText: string;
  setIsShareModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const ShareReportModal: React.FC<ShareReportModalProps> = ({
  handleShareWhatsApp,
  targetPhone,
  setTargetPhone,
  whatsappSummaryText,
  setIsShareModalOpen,
}) => (
  <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
    <div className="w-full max-w-lg bg-stone-900 border border-stone-700 rounded-2xl p-5 shadow-2xl space-y-4">
      <h3 className="text-base font-bold text-white flex items-center gap-2">
        <Share2 className="w-4 h-4 text-emerald-400" />
        <span>Share Daily Business Report on WhatsApp</span>
      </h3>

      <form onSubmit={handleShareWhatsApp} className="space-y-3.5 text-xs">
        <div>
          <label className="block text-stone-400 mb-1">
            Recipient Mobile Number (Optional, leave blank to pick in WhatsApp)
          </label>
          <div className="flex">
            <span className="py-2.5 px-3 bg-stone-800 border border-r-0 border-stone-700 rounded-l-xl text-stone-400 font-mono">
              +91
            </span>
            <input
              type="tel"
              placeholder="Enter owner 10-digit mobile number"
              value={targetPhone}
              onChange={(e) => setTargetPhone(e.target.value)}
              className="flex-1 py-2.5 px-3 bg-stone-950 border border-stone-700 rounded-r-xl text-white font-mono focus:outline-none focus:border-emerald-400"
            />
          </div>
        </div>

        <div>
          <label className="block text-stone-400 mb-1">Message Preview:</label>
          <pre className="p-3 bg-stone-950 border border-stone-800 rounded-xl text-[11px] text-stone-300 font-mono max-h-56 overflow-y-auto whitespace-pre-wrap">
            {whatsappSummaryText}
          </pre>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => setIsShareModalOpen(false)}
            className="flex-1 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 font-semibold rounded-xl transition-all"
          >
            Close
          </button>
          <button
            type="submit"
            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-1.5"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Open WhatsApp</span>
          </button>
        </div>
      </form>
    </div>
  </div>
);
