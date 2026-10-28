import React from 'react';
import { Sparkles, ArrowDown, Award, Compass } from 'lucide-react';
import { HOTEL_INFO } from '../data/hotelData';

interface HeroProps {
  onExploreSuites: () => void;
  onOpenBooking: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onExploreSuites, onOpenBooking }) => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20 pb-16">
      {/* Background Image with Cinematic Dark Gradient Overlays */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=2200&q=85"
          alt="Hotel RJ Architecture and Ocean Overlook"
          className="w-full h-full object-cover object-center scale-105 animate-pulse duration-1000"
          style={{ animationDuration: '8s' }}
        />
        {/* Multi-layered cinematic gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#090a0c] via-[#090a0c]/60 to-black/70" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-black/60" />
        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gold-500/10 via-transparent to-transparent opacity-60" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center">
        {/* Top Accolade Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-gold-400/30 bg-black/40 backdrop-blur-md mb-8 shadow-lg shadow-black/50">
          <Sparkles className="w-3.5 h-3.5 text-gold-400" />
          <span className="text-[11px] font-medium tracking-[0.2em] uppercase text-sand-200">
            Now Welcoming Guests • Emerald Bay, California
          </span>
        </div>

        {/* Main Title / Editorial Brand Statement */}
        <h1 className="font-serif text-4xl sm:text-6xl md:text-7xl lg:text-8xl tracking-tight text-white font-medium max-w-5xl leading-[1.08] drop-shadow-2xl">
          Where Timeless Luxury <br />
          <span className="italic font-normal font-serif text-transparent bg-clip-text bg-gradient-to-r from-sand-100 via-gold-200 to-gold-400">
            Meets Modern Serenity
          </span>
        </h1>

        <p className="mt-6 text-base sm:text-lg md:text-xl text-sand-200/80 max-w-2xl font-light leading-relaxed">
          Suspended along the dramatic cliffs of Emerald Bay. An architectural sanctuary designed for deep restoration, bespoke gastronomy, and quiet grandeur.
        </p>

        {/* Action Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 w-full sm:w-auto">
          <button
            onClick={onOpenBooking}
            className="w-full sm:w-auto px-8 py-4 rounded-full text-xs font-semibold tracking-[0.2em] uppercase text-black bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 hover:from-gold-200 hover:to-gold-300 shadow-xl shadow-gold-500/20 active:scale-95 transition-all duration-200"
          >
            Check Rates & Availability
          </button>

          <button
            onClick={onExploreSuites}
            className="w-full sm:w-auto px-8 py-4 rounded-full text-xs font-semibold tracking-[0.2em] uppercase text-sand-100 bg-white/5 hover:bg-white/10 border border-white/20 backdrop-blur-md transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 group"
          >
            <span>Explore The Suites</span>
            <ArrowDown className="w-3.5 h-3.5 text-gold-400 group-hover:translate-y-0.5 transition-transform" />
          </button>
        </div>

        {/* Badges / Micro Details */}
        <div className="mt-16 pt-8 border-t border-white/10 w-full grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
          <div className="flex items-center gap-3">
            <Award className="w-5 h-5 text-gold-400 shrink-0" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-sand-400">Michelin Guide</p>
              <p className="text-xs font-medium text-white">Selected Hotel 2026</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Compass className="w-5 h-5 text-gold-400 shrink-0" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-sand-400">Coordinates</p>
              <p className="text-xs font-medium text-white font-mono">36°25'N 121°54'W</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-sand-400">Private Ocean Access</p>
              <p className="text-xs font-medium text-white">Direct Beach Cove</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-gold-400 font-serif font-bold text-sm">4.95★</div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-sand-400">Guest Rating</p>
              <p className="text-xs font-medium text-white">{HOTEL_INFO.reviewCount} Verified Reviews</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
