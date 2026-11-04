import React, { useState, useEffect } from 'react';
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
import { DigitalMenuPage } from './pages/DigitalMenuPage';
import { WaiterPOS } from './components/WaiterPOS';
import { ROOMS } from './data/hotelData';
import { Capacitor } from '@capacitor/core';
import { Room, RoomTier, BookingDetails } from './types';

export const App: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('hotel_theme') as 'dark' | 'light') || 'dark';
  });

  // Track if current route is the standalone food menu page (?view=menu or #/menu)
    // Track if Waiter POS Mode is active (defaults to true in native Android APK)
  const [isPosMode, setIsPosMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    if (Capacitor.isNativePlatform()) return true;
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'pos' || window.location.hash.includes('pos');
  });
  const [isMenuView, setIsMenuView] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    // On native Android app, launch straight into Waiter POS / Digital Menu
    if (Capacitor.isNativePlatform()) return true;
    const params = new URLSearchParams(window.location.search);
    return params.get('view') === 'menu' || window.location.hash.includes('menu');
  });

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    localStorage.setItem('hotel_theme', theme);
  }, [theme]);

  // Synchronize route changes for standalone menu
  useEffect(() => {
    const handleRouteChange = () => {
      const params = new URLSearchParams(window.location.search);
      setIsMenuView(params.get('view') === 'menu' || window.location.hash.includes('menu'));
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
    checkIn: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0],
    checkOut: new Date(new Date().setDate(new Date().getDate() + 10)).toISOString().split('T')[0],
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
    return <WaiterPOS />;
  }

  // Web Browser: Staff POS mode
  if (isPosMode) {
    return <WaiterPOS onSwitchToGuestMenu={() => setIsPosMode(false)} />;
  }

  // Web Browser: Digital menu (?view=menu)
  if (isMenuView) {
    return (
      <DigitalMenuPage
        onBackToHotel={handleBackToHotel}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
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
