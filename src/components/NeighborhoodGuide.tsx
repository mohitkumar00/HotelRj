import React from 'react';
import { NEIGHBORHOOD_SPOTS, HOTEL_INFO } from '../data/hotelData';
import { MapPin, Navigation, Compass, ExternalLink } from 'lucide-react';

export const NeighborhoodGuide: React.FC = () => {
  return (
    <section id="location" className="py-24 sm:py-32 relative bg-[#090a0c]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Text & List */}
          <div className="lg:col-span-6">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold-400 mb-3">
              <Compass className="w-3.5 h-3.5" />
              <span>Curated Destination</span>
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-white font-medium leading-[1.15]">
              Emerald Bay & The Surrounding Coastal Bluffs
            </h2>
            <p className="mt-4 text-sand-300/80 text-sm sm:text-base font-light leading-relaxed">
              Situated in an exclusive coastal reserve, Hotel RJ offers effortless seclusion while remaining moments from premier marine sanctuaries, artisanal wineries, and scenic coastal trails.
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
              <div className="relative aspect-[16/11] rounded-2xl overflow-hidden border border-white/10">
                <img
                  src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80"
                  alt="Emerald Bay Aerial Coastline"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                {/* Map Pin marker */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-gold-400 text-black flex items-center justify-center font-serif font-bold text-lg shadow-2xl shadow-gold-500/50 ring-4 ring-gold-400/30 animate-bounce">
                    RJ
                  </div>
                  <span className="mt-2 px-3 py-1 rounded-full bg-black/80 backdrop-blur-md text-white text-[11px] font-semibold tracking-wider border border-white/20 whitespace-nowrap">
                    Hotel RJ Sanctuary
                  </span>
                </div>
              </div>

              {/* Transit & Coordinates Box */}
              <div className="mt-6 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-sand-400 block">Address & Valet</span>
                  <p className="text-xs text-white font-medium mt-0.5">{HOTEL_INFO.location}</p>
                </div>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(HOTEL_INFO.location)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold uppercase tracking-wider text-sand-200 transition-colors"
                >
                  <Navigation className="w-3.5 h-3.5 text-gold-400" />
                  <span>Open Navigation</span>
                  <ExternalLink className="w-3 h-3 text-sand-400" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
