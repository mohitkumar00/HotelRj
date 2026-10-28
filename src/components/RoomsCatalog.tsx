import React, { useState, useMemo } from 'react';
import { Room, RoomTier } from '../types';
import { Users, Maximize2, Bed, Sparkles, ArrowRight, Eye, Check } from 'lucide-react';

interface RoomsCatalogProps {
  rooms: Room[];
  selectedTier: RoomTier | 'all';
  onSelectTier: (tier: RoomTier | 'all') => void;
  onOpenRoomModal: (room: Room) => void;
  onReserveRoom: (room: Room) => void;
}

export const RoomsCatalog: React.FC<RoomsCatalogProps> = ({
  rooms,
  selectedTier,
  onSelectTier,
  onOpenRoomModal,
  onReserveRoom,
}) => {
  const [sortBy, setSortBy] = useState<'recommended' | 'price-asc' | 'price-desc' | 'size'>('recommended');

  const filterTabs: { label: string; value: RoomTier | 'all' }[] = [
    { label: 'All Residences', value: 'all' },
    { label: 'The Penthouse', value: 'penthouse' },
    { label: 'Cliffside Villas', value: 'villa' },
    { label: 'Horizon Suites', value: 'suite' },
    { label: 'Deluxe Rooms', value: 'deluxe' },
  ];

  const filteredRooms = useMemo(() => {
    let result = rooms.filter((r) => (selectedTier === 'all' ? true : r.tier === selectedTier));

    if (sortBy === 'price-asc') {
      result.sort((a, b) => a.pricePerNight - b.pricePerNight);
    } else if (sortBy === 'price-desc') {
      result.sort((a, b) => b.pricePerNight - a.pricePerNight);
    } else if (sortBy === 'size') {
      result.sort((a, b) => b.sizeSqFt - a.sizeSqFt);
    }

    return result;
  }, [rooms, selectedTier, sortBy]);

  return (
    <section id="suites" className="py-24 relative bg-[#0c0e14] border-t border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold-400 mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Residences & Sanctuaries</span>
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-white font-medium">
              Curated Suites & Private Villas
            </h2>
            <p className="mt-3 text-sand-300/70 text-sm max-w-xl">
              Each accommodation is individually designed with bespoke furnishings, tactile natural materials, and expansive glass portals framing the Pacific.
            </p>
          </div>

          {/* Sort selector */}
          <div className="mt-6 md:mt-0 flex items-center gap-3">
            <label htmlFor="sort-by-select" className="text-xs uppercase tracking-wider text-sand-400">Sort By:</label>
            <select
              id="sort-by-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-zinc-900 text-xs text-white px-3.5 py-2 rounded-xl border border-white/10 focus:outline-none focus:border-gold-400"
            >
              <option value="recommended">Featured Order</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="size">Residency Size (Sq Ft)</option>
            </select>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 no-scrollbar mb-10">
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => onSelectTier(tab.value)}
              className={`px-5 py-2.5 rounded-full text-xs font-medium tracking-wider uppercase whitespace-nowrap transition-all duration-200 ${
                selectedTier === tab.value
                  ? 'bg-gradient-to-r from-gold-400 to-gold-500 text-black font-semibold shadow-md shadow-gold-500/20'
                  : 'bg-zinc-900/80 text-sand-300 hover:text-white hover:bg-zinc-800 border border-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Rooms Grid */}
        {filteredRooms.length === 0 ? (
          /* Empty State */
          <div className="py-20 text-center rounded-3xl border border-dashed border-white/10 bg-zinc-950/40">
            <p className="text-sand-300 text-base font-serif">No residences found matching this category.</p>
            <button
              onClick={() => onSelectTier('all')}
              className="mt-4 px-6 py-2.5 rounded-full bg-gold-400 text-black text-xs font-semibold uppercase tracking-wider"
            >
              Show All Suites
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredRooms.map((room) => (
              <div
                key={room.id}
                className="group rounded-3xl bg-[#12141c] border border-white/10 overflow-hidden hover:border-gold-400/40 transition-all duration-300 hover:shadow-2xl hover:shadow-gold-500/5 flex flex-col justify-between"
              >
                {/* Image Section */}
                <div className="relative aspect-[16/10] overflow-hidden">
                  <img
                    src={room.heroImage}
                    alt={room.name}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#12141c] via-transparent to-black/30" />

                  {/* Top Badges */}
                  <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-black/60 backdrop-blur-md text-gold-300 border border-white/10">
                      {room.view}
                    </span>
                    {room.featured && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-gold-400 text-black shadow-md">
                        Signature
                      </span>
                    )}
                  </div>

                  {/* Quick View Button on Hover */}
                  <button
                    onClick={() => onOpenRoomModal(room)}
                    className="absolute bottom-4 right-4 px-3.5 py-1.5 rounded-full bg-black/70 hover:bg-black text-sand-100 backdrop-blur-md text-xs font-medium border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Quick View</span>
                  </button>
                </div>

                {/* Content Section */}
                <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="text-[10px] uppercase tracking-widest text-gold-400 font-semibold">
                        {room.tier} collection
                      </span>
                      <div className="text-right">
                        <span className="font-mono text-2xl font-bold text-white tracking-tight">
                          ${room.pricePerNight.toLocaleString()}
                        </span>
                        <span className="text-[11px] text-sand-400/80 ml-1">/ night</span>
                      </div>
                    </div>

                    <h3 className="font-serif text-xl sm:text-2xl font-medium text-white group-hover:text-gold-200 transition-colors">
                      {room.name}
                    </h3>
                    <p className="mt-2 text-xs text-sand-400 leading-relaxed line-clamp-2">
                      {room.description}
                    </p>

                    {/* Specifications Chips */}
                    <div className="mt-5 grid grid-cols-3 gap-2 py-3 border-t border-b border-white/5 text-sand-300 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Maximize2 className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                        <span className="truncate">{room.sizeSqFt} sq ft</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                        <span className="truncate">Up to {room.maxGuests}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Bed className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                        <span className="truncate">King</span>
                      </div>
                    </div>

                    {/* Key Highlights */}
                    <ul className="mt-4 space-y-1.5">
                      {room.amenities.slice(0, 3).map((amenity, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-xs text-sand-300/80">
                          <Check className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                          <span className="truncate">{amenity}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Card Action Buttons */}
                  <div className="mt-6 pt-5 border-t border-white/10 flex items-center gap-3">
                    <button
                      onClick={() => onOpenRoomModal(room)}
                      className="flex-1 py-3 px-4 rounded-xl text-xs font-semibold uppercase tracking-wider text-sand-200 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-center"
                    >
                      Residency Details
                    </button>
                    <button
                      onClick={() => onReserveRoom(room)}
                      className="flex-1 py-3 px-4 rounded-xl text-xs font-semibold uppercase tracking-wider text-black bg-gradient-to-r from-gold-300 to-gold-400 hover:from-gold-200 hover:to-gold-300 shadow-md shadow-gold-500/10 active:scale-95 transition-all text-center flex items-center justify-center gap-1.5"
                    >
                      <span>Reserve</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
