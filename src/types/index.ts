export type RoomTier = 'deluxe' | 'executive' | 'family';

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

export type DietaryType = 'veg' | 'non-veg' | 'egg';

export interface MenuItem {
  id: string;
  name: string;
  hindiName?: string;
  price: number | string;
  dietary: DietaryType;
  category: string;
  popular?: boolean;
  image?: string;
  description?: string;
  isCustom?: boolean;
  isAvailable?: boolean; // Kitchen "86" Sold Out tracking
  spicyLevel?: 'mild' | 'medium' | 'spicy';
  preparationTime?: string;
}

export interface HotelRoomRecord {
  id: string;
  name: string;
  tier: 'deluxe' | 'executive' | 'family';
  pricePerNight: number;
  status: 'available' | 'occupied' | 'dirty' | 'maintenance';
  maxGuests: number;
  bedType: string;
  guestName?: string;
  checkInDate?: string;
  checkOutDate?: string;
  folioAmount?: number;
  notes?: string;
  updatedAt?: number;
}

export interface TableConfigItem {
  id: string;
  name: string;
  section: 'dining' | 'parcel' | 'lawn' | 'banquet';
  capacity: number;
  isActive: boolean;
  sortOrder: number;
}

export interface MenuCategory {
  id: string;
  title: string;
  description: string;
  iconName: string;
  heroImage?: string;
  items: MenuItem[];
}

export interface CartItem {
  item: MenuItem;
  quantity: number;
}

