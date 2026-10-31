import React, { useState, useEffect } from 'react';
import { Menu, X, Phone, Calendar, Sparkles, Sun, Moon, MapPin } from 'lucide-react';
import { HOTEL_INFO } from '../data/hotelData';

interface NavbarProps {
  onOpenBooking: () => void;
  onSelectNav: (sectionId: string) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenBooking, onSelectNav, theme, onToggleTheme }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [phoneDropdownOpen, setPhoneDropdownOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Rooms & Suites', id: 'suites' },
    { label: 'Restaurant & Dining', id: 'dining' },
    { label: 'Banquet & Events', id: 'amenities' },
    { label: 'Amenities', id: 'amenities' },
    { label: 'Location & Guide', id: 'location' },
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
          ? 'bg-[#0a0c10]/95 backdrop-blur-md border-b border-white/10 py-3 shadow-2xl'
          : 'bg-gradient-to-b from-black/85 via-black/50 to-transparent py-4'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo / Brand - Vector Typography & Smooth Anti-Aliased Emblem (Zero Pixel Tearing) */}
          <a
            href="#"
            className="flex items-center gap-2.5 sm:gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 rounded-xl py-1 select-none"
          >
            <div className="relative w-9 h-9 sm:w-11 sm:h-11 rounded-full overflow-hidden shrink-0 shadow-md ring-1 ring-gold-400/30 group-hover:ring-gold-400/60 transition-all duration-200">
              <img
                src="./icons/hotel-rj-emblem.png"
                alt="Hotel RJ Emblem"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-serif text-lg sm:text-xl md:text-2xl font-bold tracking-[0.15em] leading-none text-white group-hover:text-gold-200 transition-colors">
                HOTEL RJ
              </span>
              <span className="text-[8px] sm:text-[9.5px] md:text-[10px] tracking-wide uppercase font-medium text-gold-400 mt-1 leading-none font-sans">
                Where Comfort Meets Great Taste
              </span>
            </div>
          </a>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-7" aria-label="Main Navigation">
            {navLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => handleLinkClick(link.id)}
                className="text-xs uppercase tracking-[0.16em] text-sand-200/85 hover:text-gold-300 transition-colors duration-150 py-1 font-medium hover:scale-[1.02] focus:outline-none focus-visible:text-gold-300"
              >
                {link.label}
              </button>
            ))}
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden sm:flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={onToggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="w-9 h-9 rounded-full border border-white/15 hover:border-gold-400/50 bg-white/5 hover:bg-white/10 flex items-center justify-center text-sand-200 hover:text-gold-300 transition-all active:scale-90"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-gold-300 transition-transform hover:rotate-45" />
              ) : (
                <Moon className="w-4 h-4 text-gold-600 transition-transform -rotate-12" />
              )}
            </button>

            {/* Direct Phone Dropdown */}
            <div className="relative">
              <button
                onClick={() => setPhoneDropdownOpen(!phoneDropdownOpen)}
                className="text-xs text-sand-300/90 hover:text-white flex items-center gap-2 transition-colors px-2.5 py-1.5 rounded-full hover:bg-white/5 border border-transparent hover:border-white/10"
                title="Call Hotel RJ Reception"
              >
                <Phone className="w-3.5 h-3.5 text-gold-400" />
                <span className="text-[11px] font-mono tracking-wider font-semibold">{HOTEL_INFO.phone}</span>
              </button>

              {phoneDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 p-3 glass-dropdown rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
                  <span className="text-[10px] uppercase tracking-wider text-sand-400 block mb-2 px-1">
                    Direct Contact Lines
                  </span>
                  <a
                    href={`tel:${HOTEL_INFO.phone}`}
                    className="flex items-center gap-2 p-2 rounded-xl hover:bg-white/10 text-xs font-mono font-medium text-white transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5 text-gold-400" />
                    <span>{HOTEL_INFO.phone}</span>
                  </a>
                  <a
                    href={`tel:${HOTEL_INFO.secondaryPhone}`}
                    className="flex items-center gap-2 p-2 rounded-xl hover:bg-white/10 text-xs font-mono font-medium text-white transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5 text-gold-400" />
                    <span>{HOTEL_INFO.secondaryPhone}</span>
                  </a>
                  <a
                    href={`https://wa.me/917004865824?text=Hello%20Hotel%20RJ,%20I%20would%20like%20to%20inquire%20about%20room%20availability`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 pt-2 border-t border-white/10 flex items-center gap-2 p-2 rounded-xl hover:bg-emerald-500/20 text-xs font-medium text-emerald-400 transition-colors"
                  >
                    <span>💬 Chat on WhatsApp</span>
                  </a>
                </div>
              )}
            </div>

            <button
              onClick={onOpenBooking}
              className="relative inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold tracking-wider uppercase text-black bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 hover:from-gold-200 hover:to-gold-400 shadow-md shadow-gold-500/10 active:scale-95 transition-all duration-200"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Book Room</span>
            </button>
          </div>

          {/* Mobile Menu Controls */}
          <div className="flex items-center gap-2 lg:hidden">
            {/* Mobile Theme Toggle */}
            <button
              onClick={onToggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="w-8 h-8 rounded-full border border-white/15 bg-white/5 flex items-center justify-center text-sand-200"
            >
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 text-gold-300" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-gold-600" />
              )}
            </button>

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
                <Sparkles className="w-3.5 h-3.5" /> Where Comfort Meets Great Taste
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-sand-400">
              <MapPin className="w-3.5 h-3.5 text-gold-400 shrink-0" />
              <span>Suriya Road, Bagodar (Giridih)</span>
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

            <div className="pt-2 flex flex-col gap-2.5">
              <span className="text-[10px] uppercase tracking-wider text-sand-400 font-medium">Contact Numbers</span>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`tel:${HOTEL_INFO.phone}`}
                  className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-mono font-semibold text-white flex items-center justify-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5 text-gold-400" />
                  <span>{HOTEL_INFO.phone}</span>
                </a>
                <a
                  href={`tel:${HOTEL_INFO.secondaryPhone}`}
                  className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-mono font-semibold text-white flex items-center justify-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5 text-gold-400" />
                  <span>{HOTEL_INFO.secondaryPhone}</span>
                </a>
              </div>

              <a
                href={`https://wa.me/917004865824?text=Hello%20Hotel%20RJ,%20I%20would%20like%20to%20inquire%20about%20booking`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 rounded-xl bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-medium text-xs tracking-wider uppercase flex items-center justify-center gap-2"
              >
                <span>WhatsApp Instant Inquiry</span>
              </a>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenBooking();
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-gold-300 to-gold-400 text-black font-semibold text-xs tracking-widest uppercase flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-transform"
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
