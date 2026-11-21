import React, { useState, useRef, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Wifi, ShieldAlert, Camera, CameraOff, CheckCircle2 } from 'lucide-react';
import type { SyncServerInfo } from './types';

export interface SyncModalProps {
  isElectron: boolean;
  setIsSyncModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  syncInfo: SyncServerInfo | null;
  setFirewallStatusMsg: React.Dispatch<React.SetStateAction<string | null>>;
  firewallStatusMsg: string | null;
  isSyncConnected: boolean;
  counterInputUrl: string;
  setCounterInputUrl: React.Dispatch<React.SetStateAction<string>>;
  counterInputToken: string;
  setCounterInputToken: React.Dispatch<React.SetStateAction<string>>;
  syncErrorDetail: string | null;
  setIsSyncConnected: React.Dispatch<React.SetStateAction<boolean>>;
  setCounterSyncUrl: React.Dispatch<React.SetStateAction<string>>;
  performManualSync: (customUrl?: string) => Promise<boolean>;
  counterSyncUrl: string;
  setPrintSuccessMsg: React.Dispatch<React.SetStateAction<string | null>>;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isElectron,
  setIsSyncModalOpen,
  syncInfo,
  setFirewallStatusMsg,
  firewallStatusMsg,
  isSyncConnected,
  counterInputUrl,
  setCounterInputUrl,
  counterInputToken,
  setCounterInputToken,
  syncErrorDetail,
  setIsSyncConnected,
  setCounterSyncUrl,
  performManualSync,
  counterSyncUrl,
  setPrintSuccessMsg,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleScannedValue = async (rawText: string) => {
    stopCamera();
    try {
      const trimmed = rawText.trim();
      let detectedHost = '';
      let detectedToken = '';

      if (trimmed.includes('://')) {
        const parsed = new URL(trimmed);
        detectedHost = parsed.host || `${parsed.hostname}:${parsed.port || 5050}`;
        detectedToken = parsed.searchParams.get('token') || '';
      } else if (trimmed.includes(':')) {
        detectedHost = trimmed;
      }

      if (detectedHost) {
        setCounterInputUrl(detectedHost);
        localStorage.setItem('hotel_rj_counter_sync_url', detectedHost);
        setCounterSyncUrl(detectedHost);
      }
      if (detectedToken) {
        const cleanTok = detectedToken.toUpperCase().trim();
        setCounterInputToken(cleanTok);
        localStorage.setItem('hotel_rj_sync_token', cleanTok);
      }

      if (detectedHost) {
        setPrintSuccessMsg('QR Code detected! Connecting to Counter...');
        const ok = await performManualSync(detectedHost);
        if (ok) {
          setTimeout(() => setIsSyncModalOpen(false), 900);
        }
      }
    } catch {
      setCounterInputUrl(rawText.trim());
    }
  };

  const startCameraScanner = async () => {
    setCameraError(null);
    setIsScanning(true);

    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setCameraError('Camera access not supported on this device/browser');
        setIsScanning(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      const BarcodeDetectorAPI = (window as any).BarcodeDetector;
      if (typeof BarcodeDetectorAPI !== 'undefined') {
        const detector = new BarcodeDetectorAPI({ formats: ['qr_code'] });
        scanIntervalRef.current = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes && codes.length > 0 && codes[0].rawValue) {
              handleScannedValue(codes[0].rawValue);
            }
          } catch {}
        }, 300);
      } else {
        setCameraError('Direct QR detector not available in this browser. Please enter IP & code below.');
      }
    } catch (err: any) {
      setCameraError(err?.message || 'Camera permission denied or camera unavailable');
      setIsScanning(false);
    }
  };

  // Build the QR code connect URL with token embedded
  const qrConnectUrl = `http://${syncInfo?.ip || '127.0.0.1'}:5050/?token=${encodeURIComponent(
    syncInfo?.token || ''
  )}&sync=1`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-[#11131c] border border-emerald-500/30 rounded-3xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Wifi className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-sm text-white">
              {isElectron ? 'Counter Wi-Fi Sync Server' : 'Connect to Counter POS'}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              setIsSyncModalOpen(false);
            }}
            className="p-1 rounded-full text-sand-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isElectron ? (
          <>
            <div className="p-3 rounded-2xl bg-zinc-900 border border-white/10 space-y-2 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                ● Server Running on Port 5050
              </span>
              <div className="font-mono text-base font-bold text-white bg-black/40 py-1.5 px-3 rounded-xl border border-white/10 inline-block">
                {syncInfo?.ip || '127.0.0.1'}:5050
              </div>
              <p className="text-[11px] text-sand-400">
                Waiters connect to this Counter IP over the local restaurant Wi-Fi to sync orders live.
              </p>
              {syncInfo?.token && (
                <div className="pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                    Waiter Pairing Code
                  </span>
                  <div className="font-mono text-xl font-black tracking-[0.3em] text-white bg-black/40 py-1.5 px-3 rounded-xl border border-amber-500/30 inline-block select-all">
                    {syncInfo.token}
                  </div>
                  <p className="text-[10px] text-sand-400 mt-1">Enter this code once on each waiter phone.</p>
                </div>
              )}
            </div>

            {/* QR Code with Embedded Auto-Connect Token */}
            <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white space-y-2 shadow-inner">
              <QRCodeSVG value={qrConnectUrl} size={160} level="M" />
              <span className="text-[10px] font-bold text-zinc-800 font-mono text-center">
                http://{syncInfo?.ip || '127.0.0.1'}:5050
              </span>
              <span className="text-[9px] font-semibold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 text-center">
                ⚡ Scan with Camera to Auto-Connect &amp; Open
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-900 border border-white/10 text-[11px] text-sand-300 space-y-1.5">
              <div className="font-bold text-white">📲 Instructions for Waiters:</div>
              <ol className="list-decimal pl-4 space-y-1 text-sand-400">
                <li>Connect phone to same hotel Wi-Fi (turn off Mobile Data 4G/5G).</li>
                <li>
                  <strong>Option A:</strong> Scan QR code with Phone Camera to open and auto-connect in Chrome.
                </li>
                <li>
                  <strong>Option B:</strong> In Hotel RJ Waiter app, tap <strong className="text-white">Scan QR</strong> or enter IP <strong className="text-white font-mono">{syncInfo?.ip || '127.0.0.1'}</strong> &amp; Pairing Code <strong className="text-white font-mono">{syncInfo?.token}</strong>.
                </li>
              </ol>
            </div>

            <div className="pt-2 border-t border-white/10 space-y-2">
              <button
                type="button"
                onClick={async () => {
                  if ((window as any).ElectronAPI?.fixFirewall) {
                    setFirewallStatusMsg('Applying firewall rule (check Windows prompt)...');
                    const res = await (window as any).ElectronAPI.fixFirewall();
                    setFirewallStatusMsg(res?.message || 'Rule applied');
                    setTimeout(() => setFirewallStatusMsg(null), 4000);
                  }
                }}
                className="w-full py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
              >
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Unblock Windows Firewall (Port 5050)</span>
              </button>
              {firewallStatusMsg && (
                <div className="text-[10px] text-center font-mono text-amber-300 bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20">
                  {firewallStatusMsg}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="p-3 rounded-2xl bg-zinc-900 border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-sand-400">Sync Status:</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                    isSyncConnected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-800 text-sand-400'
                  }`}
                >
                  {isSyncConnected ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>Connected to Counter PC</span>
                    </>
                  ) : (
                    <span>○ Offline / Local Mode</span>
                  )}
                </span>
              </div>
            </div>

            {/* In-App Camera QR Scanner */}
            <div className="space-y-2">
              {!isScanning ? (
                <button
                  type="button"
                  onClick={startCameraScanner}
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Camera className="w-4 h-4 text-emerald-400" />
                  <span>Scan Desktop QR Code with Camera</span>
                </button>
              ) : (
                <div className="p-3 rounded-2xl bg-black border border-emerald-500/50 space-y-2 text-center">
                  <div className="relative rounded-xl overflow-hidden bg-zinc-950 aspect-video flex items-center justify-center">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-4 border-2 border-dashed border-emerald-400/70 rounded-lg pointer-events-none animate-pulse" />
                  </div>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="py-1 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-rose-400 text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <CameraOff className="w-3.5 h-3.5" />
                    <span>Stop Camera</span>
                  </button>
                </div>
              )}

              {cameraError && (
                <p className="text-[10px] text-amber-400/90 bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                  {cameraError}
                </p>
              )}
            </div>

            <div className="space-y-2 pt-1 border-t border-white/10">
              <label className="text-[11px] uppercase font-bold text-sand-400 tracking-wider block">
                Counter PC IP Address:
              </label>
              <input
                type="text"
                value={counterInputUrl}
                onChange={(e) => setCounterInputUrl(e.target.value)}
                placeholder="e.g. 192.168.1.15:5050"
                className="w-full text-xs font-mono bg-zinc-900 text-white p-2.5 rounded-xl border border-white/15 focus:border-emerald-400 focus:outline-none"
              />
              <p className="text-[10px] text-sand-400">
                Look at the Counter POS screen on Windows to see the exact IP address.
              </p>
              <label className="text-[11px] uppercase font-bold text-sand-400 tracking-wider block pt-1">
                Pairing Code:
              </label>
              <input
                type="text"
                value={counterInputToken}
                onChange={(e) => setCounterInputToken(e.target.value.toUpperCase())}
                placeholder="8-character code from Counter POS"
                autoCapitalize="characters"
                maxLength={16}
                className="w-full text-xs font-mono tracking-widest bg-zinc-900 text-white p-2.5 rounded-xl border border-white/15 focus:border-emerald-400 focus:outline-none"
              />
            </div>

            {syncErrorDetail && (
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-300 space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-rose-400">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>Sync Troubleshooting</span>
                </div>
                <div className="text-[10px] text-sand-300 font-mono bg-black/40 p-2 rounded-lg border border-white/5 break-words">
                  {syncErrorDetail}
                </div>
                <div className="space-y-1 text-[10px] text-sand-400">
                  <div>1. Ensure phone &amp; PC are on the <strong>same Wi-Fi router</strong>.</div>
                  <div>2. On Desktop Counter POS, click <strong>"Unblock Windows Firewall"</strong>.</div>
                  <div>3. Turn OFF Mobile Data (4G/5G) on phone.</div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={async () => {
                  stopCamera();
                  const target = counterInputUrl.trim();
                  if (!target) {
                    setIsSyncConnected(false);
                    return;
                  }
                  localStorage.setItem('hotel_rj_counter_sync_url', target);
                  localStorage.setItem('hotel_rj_sync_token', counterInputToken.trim());
                  setCounterSyncUrl(target);
                  const ok = await performManualSync(target);
                  if (ok) {
                    setTimeout(() => setIsSyncModalOpen(false), 900);
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase tracking-wider active:scale-95 transition-all"
              >
                Connect &amp; Sync Now
              </button>

              {counterSyncUrl && (
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    localStorage.removeItem('hotel_rj_counter_sync_url');
                    localStorage.removeItem('hotel_rj_sync_token');
                    setCounterSyncUrl('');
                    setCounterInputUrl('');
                    setCounterInputToken('');
                    setIsSyncConnected(false);
                    setPrintSuccessMsg('Disconnected from Counter');
                    setTimeout(() => setPrintSuccessMsg(null), 2500);
                  }}
                  className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-rose-400 text-xs font-semibold"
                >
                  Disconnect
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
