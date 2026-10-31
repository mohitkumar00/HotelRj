import React, { useState } from 'react';
import { AMENITIES } from '../data/hotelData';
import { Sparkles, Utensils, Compass, ShieldCheck, HeartPulse, ArrowUpRight } from 'lucide-react';

export const AmenitiesBento: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'comfort' | 'dining' | 'service' | 'events'>('all');

  const getIcon = (name: string) => {
    switch (name) {
      case 'Utensils':
        return <Utensils className="w-5 h-5 text-gold-300" />;
      case 'Sparkles':
        return <Sparkles className="w-5 h-5 text-gold-300" />;
      case 'ShieldCheck':
        return <ShieldCheck className="w-5 h-5 text-gold-300" />;
      case 'Compass':
        return <Compass className="w-5 h-5 text-gold-300" />;
      case 'HeartPulse':
        return <HeartPulse className="w-5 h-5 text-rose-400" />;
      default:
        return <Sparkles className="w-5 h-5 text-gold-300" />;
    }
  };

  const filteredAmenities = activeCategory === 'all'
    ? AMENITIES
    : AMENITIES.filter((a) => a.category === activeCategory);

  return (
    <section id="amenities" className="py-24 sm:py-32 relative bg-[#090a0c]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold-400 mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Facilities & Features</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-white font-medium">
            Amenities Designed for Pure Comfort
          </h2>
          <p className="mt-4 text-sand-300/80 text-sm sm:text-base font-light">
            Everything you need for a comfortable stay and memorable gathering in Bagodar — from our multi-cuisine restaurant to uninterrupted power and ample parking.
          </p>

          {/* Filter Chips */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {[
              { label: 'All Highlights', value: 'all' },
              { label: 'Restaurant & Dining', value: 'dining' },
              { label: 'Banquet & Events', value: 'events' },
              { label: 'Power & Comfort', value: 'comfort' },
              { label: 'Services & Security', value: 'service' },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveCategory(tab.value as any)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium tracking-wider uppercase transition-colors ${
                  activeCategory === tab.value
                    ? 'bg-gold-400 text-black font-semibold'
                    : 'bg-zinc-900/80 text-sand-400 hover:text-white border border-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[340px]">
          {filteredAmenities.map((amenity, index) => {
            const isLarge = activeCategory === 'all' && index === 0;
            return (
              <div
                key={amenity.id}
                className={`group relative rounded-3xl overflow-hidden border border-white/10 bg-zinc-900/60 backdrop-blur-md p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 hover:border-gold-400/40 hover:shadow-2xl hover:shadow-gold-500/5 ${
                  isLarge ? 'md:col-span-2 md:row-span-2 min-h-[500px]' : ''
                }`}
              >
                {/* Background Image with Overlay */}
                <div className="absolute inset-0 z-0 overflow-hidden">
                  <img
                    src={amenity.imageUrl}
                    alt={amenity.title}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 brightness-75 group-hover:brightness-90"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/20" />
                </div>

                {/* Top Section */}
                <div className="relative z-10 flex items-center justify-between">
                  <div className="w-11 h-11 rounded-2xl bg-black/60 backdrop-blur-md border border-white/15 flex items-center justify-center">
                    {getIcon(amenity.iconName)}
                  </div>
                  {amenity.badge && (
                    <span className="px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-gold-400 text-black shadow-md">
                      {amenity.badge}
                    </span>
                  )}
                </div>

                {/* Bottom Content */}
                <div className="relative z-10 pt-8">
                  <span className="text-[10px] uppercase tracking-widest text-gold-300 font-semibold block mb-1">
                    {amenity.category}
                  </span>
                  <h3
                    className={`font-serif text-white font-medium group-hover:text-gold-200 transition-colors ${
                      isLarge ? 'text-2xl sm:text-3xl md:text-4xl' : 'text-xl sm:text-2xl'
                    }`}
                  >
                    {amenity.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-gold-200/90 font-light mt-1">{amenity.subtitle}</p>
                  <p className="mt-3 text-xs sm:text-sm text-sand-300/80 leading-relaxed font-light line-clamp-3">
                    {amenity.description}
                  </p>

                  <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-1.5 text-xs font-semibold text-gold-300 uppercase tracking-wider group-hover:translate-x-1 transition-transform">
                    <span>Learn More</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
