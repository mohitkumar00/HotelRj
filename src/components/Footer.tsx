import React, { useState } from 'react';
import { HOTEL_INFO } from '../data/hotelData';
import { Mail, Phone, MapPin, ChevronDown, Check, Navigation } from 'lucide-react';

interface FooterProps {
  theme?: 'dark' | 'light';
}

export const Footer: React.FC<FooterProps> = ({ theme = 'dark' }) => {
  const [emailSubscribed, setEmailSubscribed] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'What are the check-in and check-out timings?',
      a: 'Standard check-in is from 12:00 PM and check-out is by 11:00 AM. Early check-in or late check-out can be accommodated based on room availability upon speaking with our front desk.',
    },
    {
      q: 'What are the available room accommodation options?',
      a: 'Hotel RJ provides three distinct room choices: (1) Deluxe King AC Room for 2 guests (120 sq ft, 1 King bed, ₹1,600 + GST), (2) Super Deluxe King Room for 2 guests (180 sq ft, 1 King bed with executive seating, ₹2,200 + GST), and (3) Executive Family Suite for up to 4 guests (400 sq ft, 2 double beds, 4-seater dining lounge, ₹3,000 + GST).',
    },
    {
      q: 'How can I book the Banquet Hall for a wedding, birthday, or family event?',
      a: 'Our AC Banquet Hall comfortably hosts 25 to 300+ guests. You can call us directly at 7004865824 or 7004153034 to view the venue and customize catering packages for your special occasion.',
    },
    {
      q: 'Is there safe parking and continuous power backup available?',
      a: 'Yes, Hotel RJ provides ample on-premise secure parking with 24/7 CCTV surveillance and security staff. We also operate a heavy-duty silent generator ensuring 100% continuous power backup for ACs, elevators, and lights.',
    },
    {
      q: 'How far is Hotel RJ from Harihar Dham Temple and Parasnath?',
      a: 'Harihar Dham is just 5 minutes (2.5 km) away on Suriya Road. Parasnath / Shri Sammed Shikharji is approximately 35 minutes (32 km) drive, making Hotel RJ a convenient stopover.',
    },
  ];

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailSubscribed(true);
  };

  return (
    <footer data-theme={theme} className="bg-[#06070a] border-t border-white/10 pt-20 pb-12 text-sand-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* FAQs Section */}
        <div className="mb-20 pb-16 border-b border-white/10 max-w-4xl mx-auto">
          <h3 className="font-serif text-2xl sm:text-3xl text-white text-center font-medium mb-10">
            Frequently Asked Questions
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

        {/* Brand & Contact Info */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 pb-16 border-b border-white/10">
          {/* Brand Info */}
          <div className="md:col-span-5">
            <div className="flex items-center gap-3 mb-4 select-none">
              <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden shrink-0 shadow-md ring-1 ring-gold-400/30">
                <img
                  src="./icons/hotel-rj-emblem.png"
                  alt="Hotel RJ Emblem"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col text-left">
                <span className="font-serif text-xl sm:text-2xl font-bold tracking-[0.16em] leading-none text-white">
                  HOTEL RJ
                </span>
                <span className="text-[9.5px] sm:text-[10px] tracking-wide uppercase font-medium text-gold-400 mt-1 leading-none font-sans">
                  Where Comfort Meets Great Taste
                </span>
              </div>
            </div>
            <p className="text-xs text-sand-400 leading-relaxed max-w-sm mb-6">
              Where Comfort Meets Great Taste. Offering premier AC accommodation, multi-cuisine family dining, and grand banquet facilities on Suriya Road, Bagodar (Giridih).
            </p>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-start gap-2.5 text-sand-300">
                <MapPin className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{HOTEL_INFO.location}</span>
              </div>
              <div className="flex items-center gap-2.5 text-sand-300">
                <Phone className="w-4 h-4 text-gold-400 shrink-0" />
                <div className="flex items-center gap-3 font-mono">
                  <a href={`tel:${HOTEL_INFO.phone}`} className="hover:text-white transition-colors">{HOTEL_INFO.phone}</a>
                  <span>•</span>
                  <a href={`tel:${HOTEL_INFO.secondaryPhone}`} className="hover:text-white transition-colors">{HOTEL_INFO.secondaryPhone}</a>
                </div>
              </div>
              <div className="flex items-center gap-2.5 text-sand-300">
                <Mail className="w-4 h-4 text-gold-400 shrink-0" />
                <a href={`mailto:${HOTEL_INFO.email}`} className="hover:text-white transition-colors font-mono">{HOTEL_INFO.email}</a>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="md:col-span-3">
            <span className="text-[11px] uppercase tracking-widest text-gold-400 font-semibold block mb-4">
              Explore Hotel RJ
            </span>
            <ul className="space-y-2.5 text-xs">
              <li><a href="#suites" className="hover:text-gold-300 transition-colors">Deluxe King Room (₹1,600)</a></li>
              <li><a href="#suites" className="hover:text-gold-300 transition-colors">Executive Family Suite (₹3,000)</a></li>
              <li><a href="#dining" className="hover:text-gold-300 transition-colors">Multi-Cuisine Restaurant</a></li>
              <li><a href="#amenities" className="hover:text-gold-300 transition-colors">Banquet Hall & Events</a></li>
              <li><a href="#amenities" className="hover:text-gold-300 transition-colors">24/7 Power Backup & Parking</a></li>
              <li><a href="#location" className="hover:text-gold-300 transition-colors">Location & Landmarks</a></li>
              <li><a href="#reviews" className="hover:text-gold-300 transition-colors">Guest Reviews</a></li>
            </ul>
          </div>

          {/* Newsletter / Direct Inquiry Box */}
          <div className="md:col-span-4">
            <span className="text-[11px] uppercase tracking-widest text-gold-400 font-semibold block mb-2">
              Stay Connected
            </span>
            <p className="text-xs text-sand-400 leading-relaxed mb-4">
              Reach out for festival offers, room packages, or banquet catering quotations for your upcoming events.
            </p>

            {emailSubscribed ? (
              <div className="p-3.5 rounded-xl bg-gold-400/10 border border-gold-400/30 flex items-center gap-2 text-xs text-gold-300">
                <Check className="w-4 h-4 text-gold-400" />
                <span>Thank you! We will get in touch with you shortly.</span>
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
                  Send
                </button>
              </form>
            )}

            <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-3">
              <a
                href={HOTEL_INFO.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-gold-400 hover:underline flex items-center gap-1"
              >
                <Navigation className="w-3 h-3" />
                <span>Open in Google Maps</span>
              </a>
              <span className="text-sand-500">•</span>
              <a
                href="https://wa.me/917004865824"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-emerald-400 hover:underline"
              >
                WhatsApp Us
              </a>
            </div>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-[11px] text-sand-400/60 gap-4">
          <p>© {new Date().getFullYear()} Hotel RJ, Bagodar. All rights reserved.</p>
          <div className="flex items-center space-x-6">
            <a href="#" className="hover:text-sand-200 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-sand-200 transition-colors">Terms of Stay</a>
            <a href={HOTEL_INFO.mapUrl} target="_blank" rel="noopener noreferrer" className="hover:text-sand-200 transition-colors">Suriya Road, Bagodar</a>
          </div>
        </div>
      </div>
    </footer>
  );
};
