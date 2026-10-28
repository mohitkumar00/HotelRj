import React from 'react';
import { Leaf, Sparkles, Compass } from 'lucide-react';

export const StoryPhilosophy: React.FC = () => {
  return (
    <section className="py-24 sm:py-32 relative overflow-hidden bg-[#090a0c]">
      {/* Decorative ambient background glow */}
      <div className="absolute top-1/2 left-0 w-96 h-96 bg-gold-600/5 rounded-full blur-3xl -translate-y-1/2 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column: Image Mosaic */}
          <div className="lg:col-span-6 relative">
            <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
              <img
                src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80"
                alt="Hotel RJ Architecture and Natural Stone Terraces"
                className="w-full h-[480px] sm:h-[560px] object-cover hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

              {/* Floating Stat Overlay */}
              <div className="absolute bottom-6 left-6 right-6 p-6 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-gold-400 font-semibold block">Design Philosophy</span>
                  <span className="font-serif text-lg font-medium text-white">Biophilic Harmony & Tactile Warmth</span>
                </div>
                <div className="w-10 h-10 rounded-full border border-gold-400/40 flex items-center justify-center text-gold-400">
                  <Compass className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Small offset floating badge */}
            <div className="hidden sm:flex absolute -top-6 -right-6 p-4 rounded-2xl bg-zinc-900/90 border border-white/15 backdrop-blur-xl shadow-xl items-center gap-3">
              <Leaf className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-sand-400">Sustainability</p>
                <p className="text-xs font-semibold text-white">100% Geothermal & Solar</p>
              </div>
            </div>
          </div>

          {/* Right Column: Editorial Narrative */}
          <div className="lg:col-span-6 flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold-400 mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              <span>The Sanctuary Concept</span>
            </div>

            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-white font-medium leading-[1.15]">
              Designed not merely as a hotel, but as a{' '}
              <span className="italic font-normal text-gold-300">state of profound calm.</span>
            </h2>

            <p className="mt-6 text-sand-300/80 leading-relaxed text-sm sm:text-base font-light">
              Rooted directly into the rugged granite bluffs of Emerald Bay, Hotel RJ marries raw geological grandeur with refined Scandinavian and Japanese minimalist sensibilities. Every suite is oriented to celebrate the shifting coastal light and the soothing cadence of the tides.
            </p>

            <p className="mt-4 text-sand-300/80 leading-relaxed text-sm sm:text-base font-light">
              Here, true luxury is quiet. It is found in unhurried mornings enveloped in Egyptian cotton, private sunset aperitivos served by your personal butler, and hydrothermal therapies that dissolve all external friction.
            </p>

            {/* Core Pillars */}
            <div className="mt-10 grid grid-cols-2 gap-6 pt-8 border-t border-white/10">
              <div>
                <span className="font-serif text-3xl font-medium text-white block">42</span>
                <span className="text-xs uppercase tracking-wider text-sand-400 mt-1 block">Bespoke Suites & Villas</span>
                <p className="text-xs text-sand-400/80 mt-1">Ensuring absolute privacy, acoustic tranquility, and personalized service.</p>
              </div>

              <div>
                <span className="font-serif text-3xl font-medium text-white block">120ft</span>
                <span className="text-xs uppercase tracking-wider text-sand-400 mt-1 block">Suspended Ocean Pool</span>
                <p className="text-xs text-sand-400/80 mt-1">Heated mineral water seamlessly blending into the open Pacific horizon.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
