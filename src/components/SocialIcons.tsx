import React from 'react';
import { HOTEL_INFO } from '../data/hotelData';

export const FacebookIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"
      clipRule="evenodd"
    />
  </svg>
);

export const InstagramIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

interface SocialLinksProps {
  variant?: 'icons-only' | 'pills' | 'compact';
  className?: string;
}

export const SocialLinks: React.FC<SocialLinksProps> = ({
  variant = 'pills',
  className = '',
}) => {
  if (variant === 'icons-only') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <a
          href={HOTEL_INFO.social.instagram}
          target="_blank"
          rel="noopener noreferrer"
          className="w-8 h-8 rounded-full border border-white/15 hover:border-gold-400 bg-white/5 hover:bg-gradient-to-tr hover:from-amber-600 hover:via-rose-600 hover:to-purple-600 flex items-center justify-center text-sand-200 hover:text-white transition-all shadow-sm active:scale-95"
          title="Follow Hotel RJ on Instagram (@hotelrj.info)"
          aria-label="Follow Hotel RJ on Instagram"
        >
          <InstagramIcon className="w-4 h-4" />
        </a>

        <a
          href={HOTEL_INFO.social.facebook}
          target="_blank"
          rel="noopener noreferrer"
          className="w-8 h-8 rounded-full border border-white/15 hover:border-gold-400 bg-white/5 hover:bg-[#1877f2] flex items-center justify-center text-sand-200 hover:text-white transition-all shadow-sm active:scale-95"
          title="Follow Hotel RJ on Facebook"
          aria-label="Follow Hotel RJ on Facebook"
        >
          <FacebookIcon className="w-4 h-4" />
        </a>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <a
          href={HOTEL_INFO.social.instagram}
          target="_blank"
          rel="noopener noreferrer"
          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-sand-300 hover:text-gold-300 border border-white/10 flex items-center gap-1.5 text-xs transition-colors"
          title="Instagram: @hotelrj.info"
        >
          <InstagramIcon className="w-3.5 h-3.5 text-rose-400" />
          <span className="text-[11px] font-medium">@hotelrj.info</span>
        </a>

        <a
          href={HOTEL_INFO.social.facebook}
          target="_blank"
          rel="noopener noreferrer"
          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-sand-300 hover:text-gold-300 border border-white/10 flex items-center gap-1.5 text-xs transition-colors"
          title="Facebook: Hotel RJ"
        >
          <FacebookIcon className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[11px] font-medium">Facebook</span>
        </a>
      </div>
    );
  }

  // Default 'pills' with badges
  return (
    <div className={`flex flex-wrap items-center gap-2.5 ${className}`}>
      <a
        href={HOTEL_INFO.social.instagram}
        target="_blank"
        rel="noopener noreferrer"
        className="group px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-900/30 via-rose-900/30 to-amber-900/30 hover:from-purple-800/50 hover:via-rose-800/50 hover:to-amber-800/50 border border-rose-500/30 hover:border-rose-400 text-white flex items-center gap-2 text-xs transition-all shadow-sm active:scale-95"
      >
        <span className="w-6 h-6 rounded-lg bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-sm">
          <InstagramIcon className="w-3.5 h-3.5" />
        </span>
        <div className="flex flex-col text-left">
          <span className="text-[9px] uppercase tracking-wider text-rose-300 font-semibold leading-none">
            Instagram
          </span>
          <span className="font-mono text-xs font-bold text-white group-hover:text-gold-200 mt-0.5 leading-none">
            @hotelrj.info
          </span>
        </div>
      </a>

      <a
        href={HOTEL_INFO.social.facebook}
        target="_blank"
        rel="noopener noreferrer"
        className="group px-3.5 py-2 rounded-xl bg-blue-950/40 hover:bg-blue-900/50 border border-blue-500/30 hover:border-blue-400 text-white flex items-center gap-2 text-xs transition-all shadow-sm active:scale-95"
      >
        <span className="w-6 h-6 rounded-lg bg-[#1877f2] flex items-center justify-center text-white shrink-0 shadow-sm">
          <FacebookIcon className="w-3.5 h-3.5" />
        </span>
        <div className="flex flex-col text-left">
          <span className="text-[9px] uppercase tracking-wider text-blue-300 font-semibold leading-none">
            Facebook
          </span>
          <span className="font-sans text-xs font-bold text-white group-hover:text-gold-200 mt-0.5 leading-none">
            Hotel RJ Official
          </span>
        </div>
      </a>
    </div>
  );
};
