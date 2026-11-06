import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { BookingBar } from './components/BookingBar';
import { StoryPhilosophy } from './components/StoryPhilosophy';
import { RoomsCatalog } from './components/RoomsCatalog';
import { RoomModal } from './components/RoomModal';
import { AmenitiesBento } from './components/AmenitiesBento';
import { DiningSection } from './components/DiningSection';
import { NeighborhoodGuide } from './components/NeighborhoodGuide';
import { GuestReviews } from './components/GuestReviews';
import { ReservationDrawer } from './components/ReservationDrawer';
import { Footer } from './components/Footer';
import { ROOMS } from './data/hotelData';
import { Capacitor } from '@capacitor/core';
import { Room, RoomTier, BookingDetails } from './types';
import { readString, writeString } from './utils/storage';
import { localDateString } from './utils/dates';

// Staff tools and the digital menu are only needed on demand; keep them out of the public landing bundle.
const WaiterPOS = lazy(() => import('./components/WaiterPOS').then((m) => ({ default: m.WaiterPOS })));
const DigitalMenuPage = lazy(() => import('./pages/DigitalMenuPage').then((m) => ({ default: m.DigitalMenuPage })));

const RouteFallback: React.FC = () => (
  <div className="min-h-screen bg-[#090a0c] flex items-center justify-center text-sand-300 text-sm">Loading…</div>
);

/** Exact route match for ?view=menu / ?mode=pos or #menu / #/menu / #pos (no accidental substring hits). */
function matchesRoute(param: 'view' | 'mode', value: 'menu' | 'pos'): boolean {
  if (typeof window === 'undefined') return false;
  if (new URLSearchParams(window.location.search).get(param) === value) return true;
  return window.location.hash
    .replace(/^#/, '')
    .split(/[/?&=]/)
    .filter(Boolean)
    .includes(value);
}

export const App: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return readString('hotel_theme') === 'light' ? 'light' : 'dark';
  });

  // Track if Waiter POS Mode is active (defaults to true in native Android APK)
  const [isPosMode, setIsPosMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    if (Capacitor.isNativePlatform()) return true;
    return matchesRoute('mode', 'pos') || matchesRoute('view', 'pos');
  });
  const [isMenuView, setIsMenuView] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    // On native Android app, launch straight into Waiter POS / Digital Menu
    if (Capacitor.isNativePlatform()) return true;
    return matchesRoute('view', 'menu');
  });

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    writeString('hotel_theme', theme);
  }, [theme]);

  // Synchronize route changes for standalone menu
  useEffect(() => {
    const handleRouteChange = () => {
      setIsMenuView(matchesRoute('view', 'menu'));
    };

    window.addEventListener('popstate', handleRouteChange);
    window.addEventListener('hashchange', handleRouteChange);
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
      window.removeEventListener('hashchange', handleRouteChange);
    };
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleOpenMenu = () => {
    const base = window.location.origin + window.location.pathname.replace(/\/$/, '');
    window.open(`${base}/?view=menu`, '_blank');
  };

  const handleBackToHotel = () => {
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.pushState({}, '', cleanUrl);
    setIsMenuView(false);
  };

  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedRoomModal, setSelectedRoomModal] = useState<Room | null>(null);
  const [selectedTier, setSelectedTier] = useState<RoomTier | 'all'>('all');

  const [bookingDetails, setBookingDetails] = useState<BookingDetails>({
    checkIn: localDateString(7),
    checkOut: localDateString(10),
    guests: 2,
    roomTier: 'all',
  });

  const handleBookingBarSearch = (details: {
    checkIn: string;
    checkOut: string;
    guests: number;
    tier: RoomTier | 'all';
  }) => {
    setBookingDetails({
      checkIn: details.checkIn,
      checkOut: details.checkOut,
      guests: details.guests,
      roomTier: details.tier,
    });
    if (details.tier !== 'all') {
      setSelectedTier(details.tier);
    }
    setIsBookingOpen(true);
  };

  const handleReserveRoom = (room: Room) => {
    setBookingDetails((prev) => ({
      ...prev,
      selectedRoomId: room.id,
      roomTier: room.tier,
    }));
    setIsBookingOpen(true);
  };

  const handleNavigateSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // In Native Android App OR Windows Desktop Counter POS: dedicated 100% for POS (no website, no back buttons)
  const isElectron = typeof window !== 'undefined' && Boolean((window as any).ElectronAPI?.isElectron);
  if (Capacitor.isNativePlatform() || isElectron) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <WaiterPOS />
      </Suspense>
    );
  }

  // Web Browser: Staff POS mode
  if (isPosMode) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <WaiterPOS onSwitchToGuestMenu={() => setIsPosMode(false)} />
      </Suspense>
    );
  }

  // Web Browser: Digital menu (?view=menu)
  if (isMenuView) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <DigitalMenuPage
          onBackToHotel={handleBackToHotel}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-[#090a0c] text-sand-50 selection:bg-gold-500 selection:text-black">
      {/* Navigation */}
      <Navbar
        onOpenBooking={() => setIsBookingOpen(true)}
        onSelectNav={handleNavigateSection}
        onOpenMenu={handleOpenMenu}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Content */}
      <main id="main-content">
        {/* Hero Section */}
        <Hero
          onExploreSuites={() => handleNavigateSection('suites')}
          onOpenBooking={() => setIsBookingOpen(true)}
        />

        {/* Floating Quick Booking Bar */}
        <BookingBar onSearch={handleBookingBarSearch} />

        {/* The Sanctuary Story & Philosophy */}
        <StoryPhilosophy />

        {/* Suites & Residences Catalog */}
        <RoomsCatalog
          rooms={ROOMS}
          selectedTier={selectedTier}
          onSelectTier={setSelectedTier}
          onOpenRoomModal={(room) => setSelectedRoomModal(room)}
          onReserveRoom={handleReserveRoom}
        />

        {/* Bento Grid Amenities & Wellness */}
        <AmenitiesBento />

        {/* Michelin Dining & Lounge */}
        <DiningSection onOpenMenu={handleOpenMenu} />

        {/* Destination & Concierge Neighborhood Guide */}
        <NeighborhoodGuide />

        {/* Guest Testimonials & Press Accolades */}
        <GuestReviews />
      </main>

      {/* Footer & FAQs */}
      <Footer theme={theme} />

      {/* Room Detail Modal */}
      <RoomModal
        room={selectedRoomModal}
        onClose={() => setSelectedRoomModal(null)}
        onBookNow={handleReserveRoom}
      />

      {/* Direct Reservation Drawer */}
      <ReservationDrawer
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        rooms={ROOMS}
        initialBookingDetails={bookingDetails}
      />
    </div>
  );
};

export default App;
