import React, { useRef } from 'react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { Download, ExternalLink, Sparkles } from 'lucide-react';

interface MenuQRCodeProps {
  onOpenMenu?: () => void;
  size?: number;
  showDownload?: boolean;
  className?: string;
}

export const MenuQRCode: React.FC<MenuQRCodeProps> = ({
  onOpenMenu,
  size = 200,
  showDownload = true,
  className = '',
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);

  // Compute live URL with fallback to GitHub Pages address
  const getMenuUrl = () => {
    if (typeof window !== 'undefined') {
      const base = window.location.origin + window.location.pathname.replace(/\/$/, '');
      return `${base}/#menu`;
    }
    return 'https://mohitkumar00.github.io/HotelRJ/#menu';
  };

  const menuUrl = getMenuUrl();

  const handleDownloadQR = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canvasRef.current) return;
    const canvas = canvasRef.current.querySelector('canvas');
    if (!canvas) return;

    // Create a high-res styled image with white padding and Hotel RJ caption for printing
    const printCanvas = document.createElement('canvas');
    const pCtx = printCanvas.getContext('2d');
    if (!pCtx) return;

    const pad = 40;
    const bannerH = 90;
    printCanvas.width = canvas.width + pad * 2;
    printCanvas.height = canvas.height + pad * 2 + bannerH;

    // Background
    pCtx.fillStyle = '#ffffff';
    pCtx.fillRect(0, 0, printCanvas.width, printCanvas.height);

    // Border
    pCtx.strokeStyle = '#d4af37';
    pCtx.lineWidth = 4;
    pCtx.strokeRect(10, 10, printCanvas.width - 20, printCanvas.height - 20);

    // Title
    pCtx.fillStyle = '#1c1917';
    pCtx.font = 'bold 22px serif';
    pCtx.textAlign = 'center';
    pCtx.fillText('HOTEL RJ RESTAURANT', printCanvas.width / 2, 45);

    pCtx.fillStyle = '#b45309';
    pCtx.font = 'bold 12px sans-serif';
    pCtx.fillText('SCAN TO VIEW DIGITAL FOOD MENU', printCanvas.width / 2, 68);

    // Draw QR code
    pCtx.drawImage(canvas, pad, pad + 40);

    // Footer
    pCtx.fillStyle = '#78716c';
    pCtx.font = '11px sans-serif';
    pCtx.fillText('Where Comfort Meets Great Taste • Suriya Road, Bagodar', printCanvas.width / 2, printCanvas.height - 20);

    const a = document.createElement('a');
    a.download = 'hotel-rj-table-qr-menu.png';
    a.href = printCanvas.toDataURL('image/png');
    a.click();
  };

  return (
    <div
      onClick={onOpenMenu}
      className={`group relative bg-white/95 rounded-3xl p-5 shadow-2xl border border-gold-400/30 transition-all duration-300 hover:scale-[1.02] cursor-pointer flex flex-col items-center text-center ${className}`}
      title="Click to open digital food menu"
    >
      {/* Hidden high-res canvas used for crisp table-stand downloads */}
      <div ref={canvasRef} className="hidden">
        <QRCodeCanvas
          value={menuUrl}
          size={512}
          level="H"
          marginSize={2}
          imageSettings={{
            src: './icons/hotel-rj-emblem.png',
            height: 96,
            width: 96,
            excavate: true,
          }}
        />
      </div>

      {/* Decorative badge */}
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-500/10 border border-gold-500/30 text-[10px] font-semibold uppercase tracking-wider text-amber-800 mb-3">
        <Sparkles className="w-3 h-3 text-gold-600" />
        <span>Scan or Click to View</span>
      </div>

      {/* Visible Vector SVG QR Code with Hotel RJ Emblem */}
      <div className="relative p-3 bg-white rounded-2xl shadow-inner border border-stone-200">
        <QRCodeSVG
          value={menuUrl}
          size={size}
          level="H"
          marginSize={1}
          imageSettings={{
            src: './icons/hotel-rj-emblem.png',
            height: Math.round(size * 0.22),
            width: Math.round(size * 0.22),
            excavate: true,
          }}
        />

        {/* Hover overlay hint */}
        <div className="absolute inset-0 rounded-2xl bg-black/70 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-1.5 text-white">
          <ExternalLink className="w-6 h-6 text-gold-300" />
          <span className="text-xs font-semibold uppercase tracking-wider text-gold-200">
            Click to View Menu
          </span>
        </div>
      </div>

      {/* Text caption */}
      <div className="mt-3.5">
        <h4 className="font-serif text-sm font-bold text-stone-900 tracking-wide">
          Digital Food Menu
        </h4>
        <p className="text-[11px] text-stone-600 font-light mt-0.5">
          North Indian • Chinese • Tandoori • Shakes
        </p>
      </div>

      {/* Print download action button */}
      {showDownload && (
        <button
          type="button"
          onClick={handleDownloadQR}
          className="mt-3 w-full py-2 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-[11px] font-semibold flex items-center justify-center gap-1.5 border border-stone-300/80 transition-colors"
          title="Download printable QR Code card for physical dining tables"
        >
          <Download className="w-3.5 h-3.5 text-gold-600" />
          <span>Save Printable QR (for Tables)</span>
        </button>
      )}
    </div>
  );
};
