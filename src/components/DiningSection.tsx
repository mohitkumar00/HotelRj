import React, { useState } from 'react';
import { DINING_VENUES } from '../data/hotelData';
import { Clock, Sparkles, Check, Calendar } from 'lucide-react';

export const DiningSection: React.FC = () => {
  const [activeVenueId, setActiveVenueId] = useState(DINING_VENUES[0].id);
  const [tableBooked, setTableBooked] = useState(false);

  const activeVenue = DINING_VENUES.find((v) => v.id === activeVenueId) || DINING_VENUES[0];

  const handleBookTable = () => {
    setTableBooked(true);
    setTimeout(() => setTableBooked(false), 4000);
  };

  return (
    <section id="dining" className="py-24 sm:py-32 relative bg-[#0b0d13] border-t border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold-400 mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Gastronomic Artistry</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-white font-medium">
            Culinary Craft Inspired by the Pacific
          </h2>
          <p className="mt-4 text-sand-300/80 text-sm sm:text-base font-light">
            Hyper-seasonal ingredients sourced from local fishermen, regenerative biodynamic estates, and our own cliffside botanical garden.
          </p>

          {/* Venue Tabs */}
          <div className="mt-8 inline-flex p-1 rounded-full bg-zinc-900 border border-white/10">
            {DINING_VENUES.map((venue) => (
              <button
                key={venue.id}
                onClick={() => setActiveVenueId(venue.id)}
                className={`px-6 py-2.5 rounded-full text-xs font-semibold tracking-wider uppercase transition-all ${
                  activeVenueId === venue.id
                    ? 'bg-gold-400 text-black shadow-md'
                    : 'text-sand-300 hover:text-white'
                }`}
              >
                {venue.name}
              </button>
            ))}
          </div>
        </div>

        {/* Active Venue Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center rounded-3xl bg-[#12141c] border border-white/10 p-6 sm:p-10 lg:p-12">
          {/* Image & Atmosphere */}
          <div className="lg:col-span-6 relative rounded-2xl overflow-hidden aspect-[4/3] lg:aspect-auto lg:h-[460px] border border-white/10">
            <img
              src={activeVenue.heroImage}
              alt={activeVenue.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-6 left-6 right-6">
              <span className="text-[10px] uppercase tracking-widest text-gold-400 font-semibold block">Atmosphere</span>
              <p className="font-serif text-lg text-white font-light italic mt-1">{activeVenue.chefQuote}</p>
            </div>
          </div>

          {/* Details & Signature Menu */}
          <div className="lg:col-span-6 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div>
                  <span className="text-xs uppercase tracking-widest text-gold-400 font-semibold block">{activeVenue.type}</span>
                  <h3 className="font-serif text-3xl text-white font-medium mt-1">{activeVenue.name}</h3>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-wider text-sand-400 block">Dress Code</span>
                  <span className="text-xs font-medium text-white">{activeVenue.dressCode}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-sand-300 mt-3">
                <Clock className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                <span>{activeVenue.hours}</span>
              </div>

              <p className="mt-4 text-xs sm:text-sm text-sand-300/80 leading-relaxed font-light">
                {activeVenue.description}
              </p>

              {/* Signature Dishes */}
              <div className="mt-6 pt-6 border-t border-white/10">
                <h4 className="text-xs uppercase tracking-widest text-sand-400 font-semibold mb-3">
                  Signature Selections
                </h4>
                <div className="space-y-3">
                  {activeVenue.signatureDishes.map((dish, idx) => (
                    <div key={idx} className="flex items-start justify-between gap-4 pb-2 border-b border-white/5">
                      <div>
                        <p className="text-xs font-semibold text-white">{dish.name}</p>
                        <p className="text-[11px] text-sand-400 font-light mt-0.5">{dish.description}</p>
                      </div>
                      <span className="font-mono text-xs font-bold text-gold-300 shrink-0">{dish.price}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Reservation Button */}
            <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-[11px] text-sand-400">
                Private dining salons & sommelier pairings available upon request.
              </span>
              <button
                onClick={handleBookTable}
                className="w-full sm:w-auto px-6 py-3 rounded-full bg-gold-400 hover:bg-gold-300 text-black text-xs font-semibold tracking-wider uppercase transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
              >
                {tableBooked ? (
                  <>
                    <Check className="w-4 h-4 text-black" />
                    <span>Table Inquiry Sent!</span>
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4" />
                    <span>Reserve a Table</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
