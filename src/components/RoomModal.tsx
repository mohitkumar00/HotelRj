import React, { useState } from 'react';
import { Room } from '../types';
import { X, Check, Users, Maximize2, Bed, Sparkles, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface RoomModalProps {
  room: Room | null;
  onClose: () => void;
  onBookNow: (room: Room) => void;
}

export const RoomModal: React.FC<RoomModalProps> = ({ room, onClose, onBookNow }) => {
  if (!room) return null;

  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const images = room.galleryImages.length > 0 ? room.galleryImages : [room.heroImage];

  const nextImage = () => {
    setActiveImageIdx((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setActiveImageIdx((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-[#10121a] border border-white/15 rounded-3xl overflow-hidden shadow-2xl my-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center border border-white/10 transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Gallery */}
        <div className="relative aspect-[16/9] w-full bg-black overflow-hidden">
          <img
            src={images[activeImageIdx]}
            alt={`${room.name} image ${activeImageIdx + 1}`}
            className="w-full h-full object-cover transition-all duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#10121a] via-transparent to-black/30" />

          {/* Gallery navigation controls */}
          {images.length > 1 && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center border border-white/20 transition-colors"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center border border-white/20 transition-colors"
                aria-label="Next image"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              {/* Dots */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                {images.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIdx(idx)}
                    className={`h-2 rounded-full transition-all ${
                      idx === activeImageIdx ? 'w-6 bg-gold-400' : 'w-2 bg-white/40'
                    }`}
                  />
                ))}
              </div>
            </>
          )}

          {/* Badges */}
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-black/70 backdrop-blur-md text-gold-300 border border-white/10">
              {room.tier} collection
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-black/50 backdrop-blur-md text-white border border-white/10">
              {room.view}
            </span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
            <div>
              <h2 className="font-serif text-2xl sm:text-3xl text-white font-medium">{room.name}</h2>
              <p className="text-xs sm:text-sm text-gold-300 font-light mt-1">{room.tagline}</p>
            </div>
            <div className="text-left md:text-right">
              <span className="font-mono text-3xl font-bold text-white tracking-tight">
                ${room.pricePerNight.toLocaleString()}
              </span>
              <span className="text-xs text-sand-400/80 ml-1.5">/ night (excl. taxes)</span>
            </div>
          </div>

          {/* Spec Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-6 border-b border-white/10">
            <div className="p-3 rounded-2xl bg-zinc-900/60 border border-white/5">
              <div className="flex items-center gap-2 text-gold-400 text-xs mb-1">
                <Maximize2 className="w-4 h-4" />
                <span className="uppercase tracking-wider text-[10px]">Living Area</span>
              </div>
              <span className="font-mono text-sm font-semibold text-white">{room.sizeSqFt} sq ft / {Math.round(room.sizeSqFt * 0.0929)} m²</span>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-900/60 border border-white/5">
              <div className="flex items-center gap-2 text-gold-400 text-xs mb-1">
                <Users className="w-4 h-4" />
                <span className="uppercase tracking-wider text-[10px]">Max Guests</span>
              </div>
              <span className="font-mono text-sm font-semibold text-white">{room.maxGuests} Adults</span>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-900/60 border border-white/5">
              <div className="flex items-center gap-2 text-gold-400 text-xs mb-1">
                <Bed className="w-4 h-4" />
                <span className="uppercase tracking-wider text-[10px]">Bedding</span>
              </div>
              <span className="font-mono text-sm font-semibold text-white">{room.bedType}</span>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-900/60 border border-white/5">
              <div className="flex items-center gap-2 text-gold-400 text-xs mb-1">
                <Sparkles className="w-4 h-4" />
                <span className="uppercase tracking-wider text-[10px]">Floor / View</span>
              </div>
              <span className="font-mono text-sm font-semibold text-white">{room.view}</span>
            </div>
          </div>

          {/* Description */}
          <div className="py-6">
            <h3 className="text-xs uppercase tracking-widest text-sand-400 font-semibold mb-2">Residency Architecture</h3>
            <p className="text-sm text-sand-200/90 leading-relaxed font-light">{room.description}</p>
          </div>

          {/* All Amenities */}
          <div className="py-6 border-t border-white/10">
            <h3 className="text-xs uppercase tracking-widest text-sand-400 font-semibold mb-4">
              Included In-Suite Amenities & Services
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {room.amenities.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2.5 text-xs text-sand-200">
                  <div className="w-5 h-5 rounded-full bg-gold-400/10 border border-gold-400/30 flex items-center justify-center text-gold-400 shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer CTAs */}
          <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-sand-400">
              Complimentary airport chauffeur & daily breakfast included with direct booking.
            </span>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={onClose}
                className="px-5 py-3 rounded-full text-xs font-semibold uppercase tracking-wider text-sand-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors w-full sm:w-auto"
              >
                Close
              </button>
              <button
                onClick={() => {
                  onClose();
                  onBookNow(room);
                }}
                className="px-7 py-3 rounded-full text-xs font-semibold uppercase tracking-wider text-black bg-gradient-to-r from-gold-300 to-gold-400 hover:from-gold-200 hover:to-gold-300 shadow-lg shadow-gold-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <Calendar className="w-4 h-4" />
                <span>Reserve Residence</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
