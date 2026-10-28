import React, { useState, useEffect } from 'react';
import { Menu, X, Phone, Calendar, Sparkles } from 'lucide-react';
import { HOTEL_INFO } from '../data/hotelData';

interface NavbarProps {
  onOpenBooking: () => void;
  onSelectNav: (sectionId: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenBooking, onSelectNav }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Suites & Villas', id: 'suites' },
    { label: 'Amenities', id: 'amenities' },
    { label: 'Dining & Lounge', id: 'dining' },
    { label: 'Wellness & Spa', id: 'amenities' },
    { label: 'Location', id: 'location' },
    { label: 'Reviews', id: 'reviews' },
  ];

  const handleLinkClick = (id: string) => {
    onSelectNav(id);
    setMobileMenuOpen(false);
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        scrolled
          ? 'bg-[#0a0c10]/90 backdrop-blur-md border-b border-white/10 py-3.5 shadow-2xl'
          : 'bg-gradient-to-b from-black/80 via-black/40 to-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo / Brand */}
          <a
            href="#"
            className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 rounded-lg p-1"
          >
            <div className="w-10 h-10 rounded-full border border-gold-400/40 bg-gradient-to-br from-gold-500/20 to-transparent flex items-center justify-center text-gold-300 font-serif font-bold text-lg tracking-wider group-hover:border-gold-300 transition-colors">
              RJ
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-lg tracking-[0.25em] font-semibold text-sand-50 uppercase group-hover:text-gold-200 transition-colors">
                Hotel RJ
              </span>
              <span className="text-[10px] tracking-[0.3em] text-sand-300/60 uppercase -mt-0.5">
                Emerald Bay
              </span>
            </div>
          </a>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-8" aria-label="Main Navigation">
            {navLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => handleLinkClick(link.id)}
                className="text-xs uppercase tracking-[0.18em] text-sand-200/80 hover:text-gold-300 transition-colors duration-150 py-1 font-medium hover:scale-[1.02] focus:outline-none focus-visible:text-gold-300"
              >
                {link.label}
              </button>
            ))}
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden sm:flex items-center gap-4">
            <a
              href={`tel:${HOTEL_INFO.phone}`}
              className="text-xs text-sand-300/80 hover:text-white flex items-center gap-2 transition-colors px-2 py-1"
              title="Call Concierge"
            >
              <Phone className="w-3.5 h-3.5 text-gold-400" />
              <span className="hidden xl:inline text-[11px] tracking-wider">{HOTEL_INFO.phone}</span>
            </a>

            <button
              onClick={onOpenBooking}
              className="relative inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full text-xs font-semibold tracking-wider uppercase text-black bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 hover:from-gold-200 hover:to-gold-400 shadow-md shadow-gold-500/10 active:scale-95 transition-all duration-200"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Reserve Stay</span>
            </button>
          </div>

          {/* Mobile Menu Hamburger */}
          <div className="flex items-center gap-2 lg:hidden">
            <button
              onClick={onOpenBooking}
              className="px-3 py-1.5 rounded-full text-[11px] font-semibold tracking-wider uppercase text-black bg-gold-400 hover:bg-gold-300 transition-colors flex items-center gap-1.5"
            >
              <Calendar className="w-3 h-3" />
              <span>Book</span>
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-sand-200 hover:text-white hover:bg-white/10 transition-colors focus:outline-none"
              aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#0e1017]/98 backdrop-blur-xl border-b border-white/10 px-6 py-6 animate-in slide-in-from-top duration-200">
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <span className="text-xs tracking-widest uppercase text-gold-400 font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Experience Hotel RJ
              </span>
              <span className="text-xs text-sand-400">{HOTEL_INFO.location}</span>
            </div>
            {navLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => handleLinkClick(link.id)}
                className="text-left text-sm uppercase tracking-wider text-sand-100 hover:text-gold-300 py-2 border-b border-white/5 transition-colors"
              >
                {link.label}
              </button>
            ))}
            <div className="pt-2 flex flex-col gap-3">
              <a
                href={`tel:${HOTEL_INFO.phone}`}
                className="text-xs text-sand-300 flex items-center gap-2 py-2"
              >
                <Phone className="w-4 h-4 text-gold-400" />
                <span>Direct Concierge: {HOTEL_INFO.phone}</span>
              </a>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenBooking();
                }}
                className="w-full py-3 rounded-xl bg-gold-400 text-black font-semibold text-xs tracking-widest uppercase flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-transform"
              >
                <Calendar className="w-4 h-4" />
                Check Rates & Availability
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
