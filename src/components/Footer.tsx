import React, { useState } from 'react';
import { HOTEL_INFO } from '../data/hotelData';
import { Mail, Phone, MapPin, ChevronDown, Check } from 'lucide-react';

export const Footer: React.FC = () => {
  const [emailSubscribed, setEmailSubscribed] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'What are the check-in and check-out times?',
      a: 'Check-in commences at 3:00 PM and check-out is at 12:00 PM. Early arrival and late departures can be coordinated with your private concierge subject to availability.',
    },
    {
      q: 'How do airport and helipad transfers work?',
      a: 'We offer complimentary luxury electric SUV transfers from Emerald Regional Airport. Helicopter charter landing clearances can be arranged directly with our flight liaison.',
    },
    {
      q: 'Are children and pets permitted at Hotel RJ?',
      a: 'We welcome guests of all ages. Small companion pets up to 25 lbs are welcome in designated Cliffside Villas with bespoke pet amenities.',
    },
    {
      q: 'What is the cancellation and deposit policy?',
      a: 'Reservations may be modified or cancelled with full deposit refund up to 48 hours prior to arrival date.',
    },
  ];

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailSubscribed(true);
  };

  return (
    <footer className="bg-[#06070a] border-t border-white/10 pt-20 pb-12 text-sand-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* FAQs Section */}
        <div className="mb-20 pb-16 border-b border-white/10 max-w-4xl mx-auto">
          <h3 className="font-serif text-2xl sm:text-3xl text-white text-center font-medium mb-10">
            Frequently Inquired Questions
          </h3>
          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-white/5 bg-zinc-900/40 overflow-hidden transition-colors"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-5 flex items-center justify-between text-left focus:outline-none"
                  >
                    <span className="text-sm font-semibold text-white">{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-gold-400 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-xs text-sand-400 leading-relaxed font-light border-t border-white/5 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Newsletter & Brand */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 pb-16 border-b border-white/10">
          {/* Brand Info */}
          <div className="md:col-span-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full border border-gold-400/40 bg-gold-400/10 flex items-center justify-center text-gold-300 font-serif font-bold text-sm">
                RJ
              </div>
              <span className="font-serif text-xl tracking-[0.2em] font-semibold text-white uppercase">
                Hotel RJ
              </span>
            </div>
            <p className="text-xs text-sand-400 leading-relaxed max-w-sm mb-6">
              A private coastal sanctuary suspended above Emerald Bay. Honoring architectural purity, deep restoration, and world-class culinary craft.
            </p>

            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 text-sand-300">
                <MapPin className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                <span>{HOTEL_INFO.location}</span>
              </div>
              <div className="flex items-center gap-2 text-sand-300">
                <Phone className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                <span>{HOTEL_INFO.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-sand-300">
                <Mail className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                <span>{HOTEL_INFO.email}</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="md:col-span-3">
            <span className="text-[11px] uppercase tracking-widest text-gold-400 font-semibold block mb-4">
              Explore Hotel RJ
            </span>
            <ul className="space-y-2.5 text-xs">
              <li><a href="#suites" className="hover:text-gold-300 transition-colors">Residences & Suites</a></li>
              <li><a href="#amenities" className="hover:text-gold-300 transition-colors">Amenities & Pool</a></li>
              <li><a href="#dining" className="hover:text-gold-300 transition-colors">Aura Fine Dining</a></li>
              <li><a href="#amenities" className="hover:text-gold-300 transition-colors">Sōma Holistic Spa</a></li>
              <li><a href="#location" className="hover:text-gold-300 transition-colors">Emerald Bay & Guide</a></li>
              <li><a href="#reviews" className="hover:text-gold-300 transition-colors">Accreditations & Press</a></li>
            </ul>
          </div>

          {/* Newsletter Box */}
          <div className="md:col-span-4">
            <span className="text-[11px] uppercase tracking-widest text-gold-400 font-semibold block mb-2">
              Private Invitations
            </span>
            <p className="text-xs text-sand-400 leading-relaxed mb-4">
              Subscribe to receive exclusive access to seasonal residency releases, private winemaker dinners, and wellness retreats.
            </p>

            {emailSubscribed ? (
              <div className="p-3.5 rounded-xl bg-gold-400/10 border border-gold-400/30 flex items-center gap-2 text-xs text-gold-300">
                <Check className="w-4 h-4 text-gold-400" />
                <span>You have been added to our private guest registry.</span>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex gap-2">
                <input
                  type="email"
                  required
                  placeholder="Enter your email"
                  className="bg-zinc-900 text-xs text-white px-4 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-gold-400 flex-1"
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gold-400 text-black text-xs font-semibold uppercase tracking-wider hover:bg-gold-300 transition-colors shrink-0"
                >
                  Join
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-[11px] text-sand-400/60 gap-4">
          <p>© {new Date().getFullYear()} Hotel RJ Hospitality Group. All rights reserved.</p>
          <div className="flex items-center space-x-6">
            <a href="#" className="hover:text-sand-200 transition-colors">Privacy Notice</a>
            <a href="#" className="hover:text-sand-200 transition-colors">Terms of Hospitality</a>
            <a href="#" className="hover:text-sand-200 transition-colors">Accessibility Standards</a>
          </div>
        </div>
      </div>
    </footer>
  );
};
