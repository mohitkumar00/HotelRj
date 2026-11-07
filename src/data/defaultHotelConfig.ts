import type { HotelRoomRecord, TableConfigItem } from '../types';

export const DEFAULT_ROOMS: HotelRoomRecord[] = [
  { id: 'Room 101', name: 'Room 101 (Deluxe King)', tier: 'deluxe', pricePerNight: 1600, status: 'available', maxGuests: 2, bedType: '1 King Bed' },
  { id: 'Room 102', name: 'Room 102 (Deluxe King)', tier: 'deluxe', pricePerNight: 1600, status: 'available', maxGuests: 2, bedType: '1 King Bed' },
  { id: 'Room 103', name: 'Room 103 (Deluxe King)', tier: 'deluxe', pricePerNight: 1600, status: 'available', maxGuests: 2, bedType: '1 King Bed' },
  { id: 'Room 201', name: 'Room 201 (Super Deluxe)', tier: 'executive', pricePerNight: 2200, status: 'available', maxGuests: 2, bedType: '1 King Bed' },
  { id: 'Room 202', name: 'Room 202 (Super Deluxe)', tier: 'executive', pricePerNight: 2200, status: 'available', maxGuests: 2, bedType: '1 King Bed' },
  { id: 'Room 203', name: 'Room 203 (Super Deluxe)', tier: 'executive', pricePerNight: 2200, status: 'available', maxGuests: 2, bedType: '1 King Bed' },
  { id: 'Room 204', name: 'Room 204 (Super Deluxe)', tier: 'executive', pricePerNight: 2200, status: 'available', maxGuests: 2, bedType: '1 King Bed' },
  { id: 'Room 301', name: 'Room 301 (Family Suite)', tier: 'family', pricePerNight: 3000, status: 'available', maxGuests: 4, bedType: '2 Double Beds' },
  { id: 'Room 302', name: 'Room 302 (Family Suite)', tier: 'family', pricePerNight: 3000, status: 'available', maxGuests: 4, bedType: '2 Double Beds' },
  { id: 'Room 305', name: 'Room 305 (Family Suite)', tier: 'family', pricePerNight: 3000, status: 'available', maxGuests: 4, bedType: '2 Double Beds' },
];

export const DEFAULT_TABLES: TableConfigItem[] = [
  { id: 'T-1', name: 'Table 1', section: 'dining', capacity: 4, isActive: true, sortOrder: 1 },
  { id: 'T-2', name: 'Table 2', section: 'dining', capacity: 4, isActive: true, sortOrder: 2 },
  { id: 'T-3', name: 'Table 3', section: 'dining', capacity: 4, isActive: true, sortOrder: 3 },
  { id: 'T-4', name: 'Table 4', section: 'dining', capacity: 4, isActive: true, sortOrder: 4 },
  { id: 'T-5', name: 'Table 5', section: 'dining', capacity: 4, isActive: true, sortOrder: 5 },
  { id: 'T-6', name: 'Table 6', section: 'dining', capacity: 4, isActive: true, sortOrder: 6 },
  { id: 'T-7', name: 'Table 7', section: 'dining', capacity: 6, isActive: true, sortOrder: 7 },
  { id: 'T-8', name: 'Table 8', section: 'dining', capacity: 6, isActive: true, sortOrder: 8 },
  { id: 'T-9', name: 'Table 9', section: 'dining', capacity: 6, isActive: true, sortOrder: 9 },
  { id: 'T-10', name: 'Table 10', section: 'dining', capacity: 8, isActive: true, sortOrder: 10 },
  { id: 'T-11', name: 'Table 11', section: 'dining', capacity: 8, isActive: true, sortOrder: 11 },
  { id: 'T-12', name: 'Table 12', section: 'dining', capacity: 8, isActive: true, sortOrder: 12 },
  { id: 'Parcel 1', name: 'Parcel 1', section: 'parcel', capacity: 1, isActive: true, sortOrder: 13 },
  { id: 'Parcel 2', name: 'Parcel 2', section: 'parcel', capacity: 1, isActive: true, sortOrder: 14 },
  { id: 'Parcel 3', name: 'Parcel 3', section: 'parcel', capacity: 1, isActive: true, sortOrder: 15 },
  { id: 'Parcel 4', name: 'Parcel 4', section: 'parcel', capacity: 1, isActive: true, sortOrder: 16 },
  { id: 'Takeaway Counter', name: 'Takeaway Counter', section: 'parcel', capacity: 1, isActive: true, sortOrder: 17 },
  { id: 'Lawn 1', name: 'Lawn Table 1', section: 'lawn', capacity: 6, isActive: true, sortOrder: 18 },
  { id: 'Banquet Hall', name: 'Banquet Hall 1', section: 'banquet', capacity: 50, isActive: true, sortOrder: 19 },
];
