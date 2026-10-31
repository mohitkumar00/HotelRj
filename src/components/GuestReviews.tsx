import React from 'react';
import { REVIEWS, HOTEL_INFO } from '../data/hotelData';
import { Star, Sparkles, Quote, Award } from 'lucide-react';

export const GuestReviews: React.FC = () => {
  return (
    <section id="reviews" className="py-24 sm:py-32 relative bg-[#0c0e14] border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold-400 mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Guest Experiences</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-white font-medium">
            Loved by Travelers & Local Families
          </h2>
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="flex text-gold-400">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-gold-400 text-gold-400" />
              ))}
            </div>
            <span className="text-xs text-sand-300 font-semibold font-mono ml-1">{HOTEL_INFO.rating} / 5.0</span>
            <span className="text-xs text-sand-400">({HOTEL_INFO.reviewCount} Verified Reviews)</span>
          </div>
        </div>

        {/* Accolades Ribbon */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {[
            'Top Rated Lodging in Bagodar',
            'Fresh Multi-Cuisine Family Dining',
            'Grand Banquet & Event Services',
          ].map((highlight, idx) => (
            <div
              key={idx}
              className="p-5 rounded-2xl bg-zinc-900/40 border border-white/10 flex items-center gap-4 hover:border-gold-400/30 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-400 shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <span className="font-serif text-sm text-sand-100 font-medium">{highlight}</span>
            </div>
          ))}
        </div>

        {/* Reviews Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {REVIEWS.map((review) => (
            <div
              key={review.id}
              className="p-8 rounded-3xl bg-[#12141c] border border-white/10 relative flex flex-col justify-between hover:border-white/20 transition-all duration-300 hover:-translate-y-1"
            >
              <Quote className="absolute top-6 right-6 w-8 h-8 text-white/5" />

              <div>
                <div className="flex items-center gap-1 text-gold-400 mb-4">
                  {[...Array(review.rating)].map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-gold-400 text-gold-400" />
                  ))}
                </div>

                <h3 className="font-serif text-lg text-white font-medium mb-3">{review.title}</h3>
                <p className="text-xs sm:text-sm text-sand-300/80 leading-relaxed font-light italic">
                  "{review.comment}"
                </p>
              </div>

              <div className="mt-8 pt-4 border-t border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white">{review.author}</p>
                  <p className="text-[11px] text-sand-400">{review.location}</p>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-gold-400/80 font-medium">
                  {review.source}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
