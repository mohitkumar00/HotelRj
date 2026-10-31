import React from 'react';
import { Sparkles, Compass, HeartPulse } from 'lucide-react';

export const StoryPhilosophy: React.FC = () => {
  return (
    <section id="about" className="py-24 sm:py-32 relative overflow-hidden bg-[#090a0c]">
      {/* Decorative ambient background glow */}
      <div className="absolute top-1/2 left-0 w-96 h-96 bg-gold-600/5 rounded-full blur-3xl -translate-y-1/2 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column: Real Hotel Exterior Architecture Card */}
          <div className="lg:col-span-6 relative">
            <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-zinc-950 aspect-[3/4] max-h-[640px] sm:max-h-[700px] mx-auto group">
              <img
                src="./images/hotel-rj-exterior-front.jpg"
                alt="Hotel RJ Building - Banquet Hall, Guest House & Restaurant in Bagodar"
                className="w-full h-full object-cover object-top group-hover:scale-[1.02] transition-transform duration-700"
              />
              {/* Subtle bottom gradient for card legibility, preserving full roofline & illuminated HOTEL RJ sign */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 via-30% to-transparent pointer-events-none" />

              {/* Floating Stat Overlay */}
              <div className="absolute bottom-6 left-6 right-6 p-5 sm:p-6 rounded-2xl bg-black/70 backdrop-blur-md border border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-gold-400 font-semibold block">Modern Architecture</span>
                  <span className="font-serif text-base sm:text-lg font-medium text-white">Banquet Hall • Guest House • Restaurant</span>
                </div>
                <div className="w-10 h-10 rounded-full border border-gold-400/40 flex items-center justify-center text-gold-400 shrink-0 ml-3">
                  <Compass className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Small offset floating badge */}
            <div className="hidden sm:flex absolute -top-6 -right-6 p-4 rounded-2xl bg-zinc-900/90 border border-white/15 backdrop-blur-xl shadow-xl items-center gap-3">
              <HeartPulse className="w-5 h-5 text-rose-400" />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-sand-400">Healthcare Neighbor</p>
                <p className="text-xs font-semibold text-white">Near Devi Durga Nursing Home</p>
              </div>
            </div>
          </div>

          {/* Right Column: Editorial Narrative */}
          <div className="lg:col-span-6 flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold-400 mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              <span>About Hotel RJ</span>
            </div>

            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-white font-medium leading-[1.15]">
              The Finest Hospitality in Bagodar,{' '}
              <span className="italic font-normal text-gold-300">Where Comfort Meets Great Taste.</span>
            </h2>

            <p className="mt-6 text-sand-300/80 leading-relaxed text-sm sm:text-base font-light">
              Situated strategically on Suriya Road, Bagodar (Giridih), Hotel RJ is a state-of-the-art multi-facility destination housing modern air-conditioned guest accommodations, a dedicated family restaurant, and an expansive grand banquet hall for weddings and celebrations.
            </p>

            <p className="mt-4 text-sand-300/80 leading-relaxed text-sm sm:text-base font-light">
              Whether you are visiting the renowned Harihar Dham, embarking on a pilgrimage to Shri Sammed Shikharji (Parasnath), hosting a grand celebration, or resting during transit along the Grand Trunk Road (NH 19), our dedicated team ensures courteous service, spotless rooms, and mouth-watering meals.
            </p>

            {/* Core Pillars */}
            <div className="mt-10 grid grid-cols-2 gap-6 pt-8 border-t border-white/10">
              <div>
                <span className="font-serif text-3xl font-medium text-white block">300+</span>
                <span className="text-xs uppercase tracking-wider text-sand-400 mt-1 block">Banquet Guest Capacity</span>
                <p className="text-xs text-sand-400/80 mt-1">Spacious AC hall for weddings, ring ceremonies, and celebrations.</p>
              </div>

              <div>
                <span className="font-serif text-3xl font-medium text-white block">24/7</span>
                <span className="text-xs uppercase tracking-wider text-sand-400 mt-1 block">Full Power Backup</span>
                <p className="text-xs text-sand-400/80 mt-1">Continuous air conditioning, lighting, and elevator operation.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
