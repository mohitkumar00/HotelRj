export type RoomTier = 'deluxe' | 'suite' | 'standard' | 'family';

export interface Room {
  id: string;
  name: string;
  tier: RoomTier;
  tagline: string;
  pricePerNight: number;
  sizeSqFt: number;
  maxGuests: number;
  bedType: string;
  view: string;
  featured: boolean;
  heroImage: string;
  galleryImages: string[];
  amenities: string[];
  description: string;
}

export interface AmenityHighlight {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  category: 'comfort' | 'dining' | 'service' | 'events';
  iconName: string;
  imageUrl: string;
  colSpan?: string;
  badge?: string;
}

export interface DiningVenue {
  id: string;
  name: string;
  type: string;
  hours: string;
  dressCode: string;
  chefQuote: string;
  description: string;
  heroImage: string;
  signatureDishes: {
    name: string;
    description: string;
    price: string;
  }[];
}

export interface Review {
  id: string;
  author: string;
  location: string;
  stayDate: string;
  rating: number;
  title: string;
  comment: string;
  source: string;
}

export interface BookingDetails {
  checkIn: string;
  checkOut: string;
  guests: number;
  roomTier: RoomTier | 'all';
  selectedRoomId?: string;
}
