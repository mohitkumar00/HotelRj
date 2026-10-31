import React from 'react';
import { NEIGHBORHOOD_SPOTS, HOTEL_INFO } from '../data/hotelData';
import { MapPin, Navigation, Compass, ExternalLink, Phone } from 'lucide-react';

export const NeighborhoodGuide: React.FC = () => {
  return (
    <section id="location" className="py-24 sm:py-32 relative bg-[#090a0c]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Text & List */}
          <div className="lg:col-span-6">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold-400 mb-3">
              <Compass className="w-3.5 h-3.5" />
              <span>Location & Key Landmarks</span>
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-white font-medium leading-[1.15]">
              Prime Location on Suriya Road, Bagodar
            </h2>
            <p className="mt-4 text-sand-300/80 text-sm sm:text-base font-light leading-relaxed">
              Hotel RJ is conveniently located on Suriya Road, just moments from the Grand Trunk Road (NH 19). An ideal base for visiting famous pilgrimage landmarks, transit stays, and local business.
            </p>

            <div className="mt-8 space-y-4">
              {NEIGHBORHOOD_SPOTS.map((spot, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-zinc-900/60 border border-white/5 hover:border-gold-400/30 transition-colors flex items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-400 shrink-0 mt-0.5">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">{spot.name}</h4>
                      <p className="text-xs text-sand-400 font-light mt-0.5">{spot.desc}</p>
                      <span className="text-[10px] uppercase tracking-wider text-gold-300/90 font-medium mt-1 inline-block">
                        {spot.type}
                      </span>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-medium text-white px-2.5 py-1 rounded-full bg-white/5 shrink-0 border border-white/10">
                    {spot.distance}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Visual Map Card */}
          <div className="lg:col-span-6 relative">
            <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-[#12141c] p-6 sm:p-8">
              <div className="relative aspect-[16/11] rounded-2xl overflow-hidden border border-white/10 bg-zinc-950">
                <img
                  src="https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=1200&q=80"
                  alt="Hotel RJ Location Map Preview"
                  className="w-full h-full object-cover brightness-75"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/30" />

                {/* Map Pin marker with Hotel Emblem */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-black/80 border-2 border-gold-400 p-1 flex items-center justify-center shadow-2xl ring-4 ring-gold-400/30 animate-bounce">
                    <img
                      src="./icons/hotel-rj-emblem.png"
                      alt="Hotel RJ"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <span className="mt-2 px-3 py-1 rounded-full bg-black/90 backdrop-blur-md text-white text-[11px] font-semibold tracking-wider border border-white/20 whitespace-nowrap">
                    Hotel RJ, Suriya Road
                  </span>
                  <span className="text-[10px] text-gold-300 font-medium">Near Devi Durga Nursing Home</span>
                </div>
              </div>

              {/* Transit & Navigation Actions */}
              <div className="mt-6 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-sand-400 block">Complete Address</span>
                  <p className="text-xs text-white font-medium mt-0.5 leading-relaxed">
                    {HOTEL_INFO.location}
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                  <a
                    href={`tel:${HOTEL_INFO.phone}`}
                    className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-gold-400 transition-colors"
                    title="Call for directions"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                  <a
                    href={HOTEL_INFO.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-gold-300 to-gold-400 hover:from-gold-200 hover:to-gold-300 text-black text-xs font-semibold uppercase tracking-wider transition-all shadow-md"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Get Directions</span>
                    <ExternalLink className="w-3 h-3 text-black/70" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
