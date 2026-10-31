import React from 'react';
import { Sparkles, ArrowDown, MapPin, Zap, Utensils, Star } from 'lucide-react';
import { HOTEL_INFO } from '../data/hotelData';

interface HeroProps {
  onExploreSuites: () => void;
  onOpenBooking: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onExploreSuites, onOpenBooking }) => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-24 pb-16">
      {/* Real Front View Background with Cinematic Dark Gradient Overlays */}
      <div className="absolute inset-0 z-0">
        <img
          src="./images/hotel-rj-exterior-front.jpg"
          alt="Hotel RJ Building Front View - Banquet Hall, Guest House & Restaurant"
          className="w-full h-full object-cover object-[center_32%] scale-100"
        />
        {/* Multi-layered cinematic gradient overlays ensuring high-contrast readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#090a0c] via-[#090a0c]/65 to-black/75" />
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gold-500/10 via-transparent to-transparent opacity-60" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center">
        {/* Top Location Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-gold-400/30 bg-black/60 backdrop-blur-md mb-8 shadow-lg shadow-black/50">
          <Sparkles className="w-3.5 h-3.5 text-gold-400" />
          <span className="text-[11px] font-medium tracking-[0.2em] uppercase text-sand-200">
            Welcome to Bagodar, Giridih • Jharkhand
          </span>
        </div>

        {/* Main Title / Brand Tagline */}
        <h1 className="font-serif text-4xl sm:text-6xl md:text-7xl lg:text-8xl tracking-tight text-white font-medium max-w-5xl leading-[1.08] drop-shadow-2xl">
          Where Comfort <br />
          <span className="italic font-normal font-serif text-transparent bg-clip-text bg-gradient-to-r from-sand-100 via-gold-200 to-gold-400">
            Meets Great Taste
          </span>
        </h1>

        <p className="mt-6 text-base sm:text-lg md:text-xl text-sand-200/90 max-w-2xl font-light leading-relaxed">
          Experience premium air-conditioned accommodation, rich multi-cuisine dining, and grand banquet celebrations conveniently located on Suriya Road, Bagodar.
        </p>

        {/* Action Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 w-full sm:w-auto">
          <button
            onClick={onOpenBooking}
            className="w-full sm:w-auto px-8 py-4 rounded-full text-xs font-semibold tracking-[0.2em] uppercase text-black bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 hover:from-gold-200 hover:to-gold-300 shadow-xl shadow-gold-500/20 active:scale-95 transition-all duration-200"
          >
            Book Your Stay
          </button>

          <button
            onClick={onExploreSuites}
            className="w-full sm:w-auto px-8 py-4 rounded-full text-xs font-semibold tracking-[0.2em] uppercase text-sand-100 bg-white/5 hover:bg-white/10 border border-white/20 backdrop-blur-md transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 group"
          >
            <span>Explore Rooms & Rates</span>
            <ArrowDown className="w-3.5 h-3.5 text-gold-400 group-hover:translate-y-0.5 transition-transform" />
          </button>
        </div>

        {/* Key Badges & Trust Highlights */}
        <div className="mt-16 pt-8 border-t border-white/10 w-full grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-gold-400 shrink-0" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-sand-400">Prime Location</p>
              <p className="text-xs font-medium text-white">Suriya Road, Bagodar</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Utensils className="w-5 h-5 text-gold-400 shrink-0" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-sand-400">Dining Experience</p>
              <p className="text-xs font-medium text-white">Multi-Cuisine AC Restaurant</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-gold-400 shrink-0" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-sand-400">24/7 Power</p>
              <p className="text-xs font-medium text-white">Silent Generator Backup</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center text-gold-400">
              <Star className="w-4 h-4 fill-gold-400" />
              <span className="font-serif font-bold text-sm ml-1 text-white">4.8</span>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-sand-400">Guest Rating</p>
              <p className="text-xs font-medium text-white">{HOTEL_INFO.reviewCount} Happy Guests</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
