import React, { useState } from 'react';
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
import { Room, RoomTier, BookingDetails } from './types';

export const App: React.FC = () => {
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

  return (
    <div className="min-h-screen bg-[#090a0c] text-sand-50 selection:bg-gold-500 selection:text-black">
      {/* Navigation */}
      <Navbar
        onOpenBooking={() => setIsBookingOpen(true)}
        onSelectNav={handleNavigateSection}
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
        <DiningSection />

        {/* Destination & Concierge Neighborhood Guide */}
        <NeighborhoodGuide />

        {/* Guest Testimonials & Press Accolades */}
        <GuestReviews />
      </main>

      {/* Footer & FAQs */}
      <Footer />

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
