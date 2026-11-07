import React from 'react';
import { RefreshCw, AlertTriangle, Cloud, Database, Check } from 'lucide-react';
import { CloudSyncPublicConfig } from '../../utils/analyticsApi';
import { PairedDevicesPanel } from '../PairedDevicesPanel';

export interface CloudSyncModalProps {
  setIsCloudModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  cloudConfig: CloudSyncPublicConfig | null;
  handleTriggerCloudSync: () => Promise<void>;
  syncingCloud: boolean;
  handleSaveCloudConfig: (e: React.FormEvent) => Promise<void>;
  inputSupabaseUrl: string;
  setInputSupabaseUrl: React.Dispatch<React.SetStateAction<string>>;
  inputSupabaseKey: string;
  setInputSupabaseKey: React.Dispatch<React.SetStateAction<string>>;
  handleTestCloudConnection: () => Promise<void>;
  testingCloud: boolean;
  testResult: { success?: boolean; message?: string; error?: string; } | null;
  setIsPairOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  setIsCloudModalOpen,
  cloudConfig,
  handleTriggerCloudSync,
  syncingCloud,
  handleSaveCloudConfig,
  inputSupabaseUrl,
  setInputSupabaseUrl,
  inputSupabaseKey,
  setInputSupabaseKey,
  handleTestCloudConnection,
  testingCloud,
  testResult,
  setIsPairOpen,
}) => (
  <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
    <div className="w-full max-w-xl bg-stone-900 border border-stone-700 rounded-2xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
      {/* Modal Header */}
      <div className="flex items-center justify-between border-b border-stone-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Cloud className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Supabase Cloud Sync</h3>
            <p className="text-[11px] text-stone-400">
              Real-time cloud backup of all bills, audit logs & expenses
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsCloudModalOpen(false)}
          className="text-stone-400 hover:text-white p-1 rounded-lg"
        >
          ✕
        </button>
      </div>

      {/* Cloud Status Card */}
      <div className="bg-stone-950 border border-stone-800 rounded-xl p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-stone-400 font-medium">Sync Status:</span>
          <span
            className={`text-xs font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${
              cloudConfig?.connected
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : cloudConfig?.isConfigured
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-stone-800 text-stone-400 border-stone-700'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                cloudConfig?.connected ? 'bg-emerald-400 animate-pulse' : 'bg-stone-400'
              }`}
            />
            {cloudConfig?.connected
              ? 'Connected & Active'
              : cloudConfig?.isConfigured
              ? 'Configured (Offline/Checking)'
              : 'Not Configured (Offline Mode)'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
          <div className="bg-stone-900/60 p-2 rounded-lg border border-stone-800/80">
            <span className="text-stone-400 block">Last Synced:</span>
            <span className="font-semibold text-stone-200">
              {cloudConfig?.lastSyncTime
                ? new Date(cloudConfig.lastSyncTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })
                : 'Never'}
            </span>
          </div>
          <div className="bg-stone-900/60 p-2 rounded-lg border border-stone-800/80">
            <span className="text-stone-400 block">Queued Bills:</span>
            <span className="font-semibold text-stone-200">
              {cloudConfig?.pendingBills ?? 0} bills pending upload
            </span>
          </div>
        </div>

        {cloudConfig?.isConfigured && (
          <div className="pt-1 flex justify-end">
            <button
              type="button"
              onClick={handleTriggerCloudSync}
              disabled={syncingCloud}
              className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingCloud ? 'animate-spin' : ''}`} />
              <span>{syncingCloud ? 'Syncing...' : 'Sync All Records Now'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Supabase Credentials Form */}
      <form onSubmit={handleSaveCloudConfig} className="space-y-3.5 text-xs">
        <div>
          <label className="block text-stone-300 font-semibold mb-1">
            Supabase Project URL
          </label>
          <input
            type="url"
            placeholder="https://your-project-id.supabase.co"
            value={inputSupabaseUrl}
            onChange={(e) => setInputSupabaseUrl(e.target.value)}
            className="w-full py-2.5 px-3 bg-stone-950 border border-stone-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-emerald-400"
          />
          <span className="text-[10px] text-stone-500 mt-1 block">
            Found in: Supabase Dashboard &gt; Project Settings &gt; API &gt; Project URL
          </span>
        </div>

        <div>
          <label className="block text-stone-300 font-semibold mb-1">
            Supabase Anon Public API Key
          </label>
          <textarea
            rows={2}
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            value={inputSupabaseKey}
            onChange={(e) => setInputSupabaseKey(e.target.value)}
            className="w-full py-2 px-3 bg-stone-950 border border-stone-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-emerald-400 resize-none"
          />
          <span className="text-[10px] text-stone-500 mt-1 block">
            Found in: Supabase Dashboard &gt; Project Settings &gt; API &gt; Project API keys &gt; <code className="text-stone-400">anon public</code>
          </span>
        </div>

        {/* Live Test Connection Section */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTestCloudConnection}
            disabled={testingCloud || !inputSupabaseUrl.trim() || !inputSupabaseKey.trim()}
            className="px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 font-semibold flex items-center gap-1.5 transition-all disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testingCloud ? 'animate-spin text-gold-400' : ''}`} />
            <span>{testingCloud ? 'Testing...' : 'Test Connection'}</span>
          </button>

          {testResult && (
            <div
              className={`flex-1 py-1.5 px-2.5 rounded-xl border text-[11px] font-semibold flex items-center gap-1.5 ${
                testResult.success
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              }`}
            >
              {testResult.success ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Connected! Supabase bills table verified.</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="truncate">{testResult.error || 'Connection failed'}</span>
                </>
              )}
            </div>
          )}
        </div>

        <PairedDevicesPanel onPair={() => setIsPairOpen(true)} />

        {/* Free Setup Instructions Box */}
        <div className="bg-stone-950/70 border border-stone-800 rounded-xl p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-gold-400 font-bold text-xs">
            <Database className="w-3.5 h-3.5" />
            <span>Cloud Database Status: Active &amp; Pre-configured</span>
          </div>
          <p className="text-[11px] text-stone-300 leading-relaxed">
            Your Supabase cloud database is pre-configured with project <code className="text-emerald-400 font-mono">kupbuusakxvsfprwdpbr</code>. All 6 tables (<span className="text-stone-200">bills, audit_logs, expenses, menu_items, rooms, tables_config</span>) are synchronized in real-time.
          </p>
          <p className="text-[11px] text-stone-400">
            You can click <strong className="text-emerald-400">Sync All Records Now</strong> anytime to trigger an immediate force sync, or enter custom credentials if migrating to another Supabase project.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => setIsCloudModalOpen(false)}
            className="flex-1 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 font-semibold rounded-xl transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-1.5"
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Save &amp; Enable Sync</span>
          </button>
        </div>
      </form>
    </div>
  </div>
);
